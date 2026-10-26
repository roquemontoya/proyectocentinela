import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const rolesPermitidos = new Set(["administrador", "supervisor", "bombero_inspector", "mantenimiento", "superadministrador", "bombero_referente", "bomberos", "gerencia", "jefe_seguridad_patrimonial", "jefe_guardia_fisica", "jefe_prevencion_incendios", "jefe_rhp"]);
const responder = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return responder({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return responder({ error: "Configuración del servidor incompleta" }, 500);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return responder({ error: "Sesión requerida" }, 401);
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: sessionData, error: sessionError } = await authClient.auth.getUser(token);
  if (sessionError || !sessionData.user) return responder({ error: "Sesión inválida o vencida" }, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const actorId = sessionData.user.id;
  const { data: actorRole, error: actorRoleError } = await admin.rpc("current_user_role_for_id", { p_user_id: actorId });
  if (actorRoleError || !["administrador", "superadministrador"].includes(actorRole)) {
    return responder({ error: "Solo Administración puede gestionar usuarios" }, 403);
  }
  const esSuper = actorRole === "superadministrador";

  try {
    const body = await req.json();
    const action = String(body.action || "");
    if (action === "list") {
      const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const ids = list.users.map((u) => u.id);
      if (!ids.length) return responder({ users: [] });
      const [{ data: profiles, error: profileError }, { data: assignments, error: assignmentError }] = await Promise.all([
        admin.from("app_user_profiles").select("user_id,nombre_completo,legajo,activo").in("user_id", ids),
        admin.from("app_user_roles").select("user_id,app_roles(role_key,nombre)").in("user_id", ids),
      ]);
      if (profileError) throw profileError;
      if (assignmentError) throw assignmentError;
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      const rolesMap = new Map<string, string[]>();
      for (const item of assignments || []) {
        const value = Array.isArray(item.app_roles) ? item.app_roles[0] : item.app_roles;
        if (value?.role_key) rolesMap.set(item.user_id, [...(rolesMap.get(item.user_id) || []), value.role_key]);
      }
      return responder({ users: list.users.map((u) => {
        const profile = profileMap.get(u.id);
        const suspendido = Boolean(u.banned_until && new Date(u.banned_until) > new Date());
        return {
          id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at, banned_until: u.banned_until,
          nombre_completo: profile?.nombre_completo || u.user_metadata?.nombre_completo || "",
          legajo: profile?.legajo || "", activo: profile?.activo !== false && !suspendido,
          roles: rolesMap.get(u.id) || [],
        };
      }) });
    }

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const nombre = String(body.nombre_completo || "").trim();
      const legajo = String(body.legajo || "").trim() || null;
      const role = String(body.role || "");
      if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !nombre || !rolesPermitidos.has(role)) return responder({ error: "Completá nombre, correo válido y perfil." }, 400);
      if (["superadministrador", "administrador"].includes(role) && !esSuper) return responder({ error: "Solo un Superadministrador puede asignar perfiles administrativos." }, 403);

      // Validar el legajo antes de invitar para evitar cuentas huérfanas si el dato está ocupado.
      if (legajo) {
        const { data: ocupado, error: legajoError } = await admin.from("app_user_profiles").select("user_id").eq("legajo", legajo).maybeSingle();
        if (legajoError) throw legajoError;
        if (ocupado) return responder({ error: `El legajo ${legajo} ya está asignado. Elegí otro legajo o dejá el campo vacío para asignación automática al primer ingreso.` }, 409);
      }

      // Recuperar una invitación previa que creó el usuario Auth pero no llegó a crear su perfil.
      const { data: authList, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;
      const existing = authList.users.find((u) => (u.email || "").toLowerCase() === email);
      let id: string;
      let invitacionEnviada = false;
      if (existing) {
        id = existing.id;
        const { data: existingProfile, error: existingProfileError } = await admin.from("app_user_profiles").select("user_id").eq("user_id", id).maybeSingle();
        if (existingProfileError) throw existingProfileError;
        if (existingProfile) return responder({ error: "Ya existe una cuenta para ese correo. Usá Editar para cambiar su perfil." }, 409);
      } else {
        const { data: created, error: createError } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { nombre_completo: nombre },
          redirectTo: "https://proyectocentinela.vercel.app/"
        });
        if (createError) throw createError;
        id = created.user.id;
        invitacionEnviada = true;
      }

      const { data: roleRow, error: roleError } = await admin.from("app_roles").select("id").eq("role_key", role).single();
      if (roleError) throw roleError;
      const { error: profileError } = await admin.from("app_user_profiles").upsert({
        user_id: id, nombre_completo: nombre, legajo, creado_por: actorId, actualizado_por: actorId
      }, { onConflict: "user_id" });
      if (profileError) throw profileError;
      const { error: assignDeleteError } = await admin.from("app_user_roles").delete().eq("user_id", id);
      if (assignDeleteError) throw assignDeleteError;
      const { error: assignError } = await admin.from("app_user_roles").insert({ user_id: id, role_id: roleRow.id, assigned_by: actorId });
      if (assignError) throw assignError;
      const { error: metadataError } = await admin.auth.admin.updateUserById(id, { user_metadata: { nombre_completo: nombre } });
      if (metadataError) throw metadataError;
      await admin.from("app_user_audit").insert({ actor_user_id: actorId, target_user_id: id, accion: existing ? "invitacion_incompleta_recuperada" : "usuario_creado", detalle: { email, role, legajo, invitacionEnviada } });
      return responder({
        ok: true, user_id: id, invitation_sent: invitacionEnviada,
        message: invitacionEnviada
          ? "Cuenta preparada y se solicitó el envío de la invitación. El legajo se asignará automáticamente en el primer ingreso si quedó vacío."
          : "Se recuperó la cuenta invitada previamente y se asignaron el perfil y el legajo. No se envió una segunda invitación."
      }, invitacionEnviada ? 201 : 200);
    }

    if (action === "update") {
      const id = String(body.user_id || "");
      const nombre = String(body.nombre_completo || "").trim();
      const legajo = String(body.legajo || "").trim() || null;
      const role = String(body.role || "");
      if (!id || !nombre || !rolesPermitidos.has(role)) return responder({ error: "Datos de edición inválidos." }, 400);
      const { data: targetRole } = await admin.rpc("current_user_role_for_id", { p_user_id: id });
      if (!esSuper && (["superadministrador", "administrador"].includes(role) || ["superadministrador", "administrador"].includes(targetRole || ""))) return responder({ error: "Solo Superadministrador puede modificar cuentas administrativas." }, 403);
      if (id === actorId && role !== actorRole) return responder({ error: "No podés cambiar tu propio rol." }, 400);
      const { data: roleRow, error: roleError } = await admin.from("app_roles").select("id").eq("role_key", role).single();
      if (roleError) throw roleError;
      const { error: profileError } = await admin.from("app_user_profiles").upsert({ user_id: id, nombre_completo: nombre, legajo, actualizado_por: actorId, updated_at: new Date().toISOString() });
      if (profileError) throw profileError;
      const { error: deleteError } = await admin.from("app_user_roles").delete().eq("user_id", id);
      if (deleteError) throw deleteError;
      const { error: assignError } = await admin.from("app_user_roles").insert({ user_id: id, role_id: roleRow.id, assigned_by: actorId });
      if (assignError) throw assignError;
      await admin.auth.admin.updateUserById(id, { user_metadata: { nombre_completo: nombre } });
      await admin.from("app_user_audit").insert({ actor_user_id: actorId, target_user_id: id, accion: "usuario_actualizado", detalle: { role, legajo } });
      return responder({ ok: true });
    }

    if (action === "set_temporary_password") {
      if (!esSuper) return responder({ error: "Solo Superadministrador puede asignar claves temporales." }, 403);
      const id = String(body.user_id || "");
      const temporaryPassword = String(body.temporary_password || "");
      if (!id || temporaryPassword.length < 10 || temporaryPassword.length > 128) return responder({ error: "Usuario inválido o clave temporal fuera de la política de longitud." }, 400);
      if (id === actorId) return responder({ error: "No podés asignarte una clave temporal desde este panel." }, 400);
      const { data: target, error: targetError } = await admin.auth.admin.getUserById(id);
      if (targetError || !target.user) return responder({ error: "No se encontró la cuenta de destino." }, 404);
      const { error: passwordError } = await admin.auth.admin.updateUserById(id, {
        password: temporaryPassword,
        user_metadata: { ...(target.user.user_metadata || {}), must_change_password: true, temporary_password_issued_at: new Date().toISOString() }
      });
      if (passwordError) throw passwordError;
      const { error: auditError } = await admin.from("app_user_audit").insert({
        actor_user_id: actorId, target_user_id: id, accion: "clave_temporal_asignada",
        detalle: { must_change_password: true, method: "admin_auth_password_update" }
      });
      if (auditError) throw auditError;
      return responder({ ok: true, must_change_password: true, message: "Clave temporal asignada; el usuario deberá cambiarla antes de acceder." });
    }

    if (action === "set_active") {
      const id = String(body.user_id || "");
      const active = body.active === true;
      if (!id || id === actorId) return responder({ error: "No podés desactivar tu propia cuenta." }, 400);
      const { data: targetRole } = await admin.rpc("current_user_role_for_id", { p_user_id: id });
      if (!esSuper && targetRole === "superadministrador") return responder({ error: "Solo Superadministrador puede modificar esa cuenta." }, 403);
      const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
      if (banError) throw banError;
      const { error: profileError } = await admin.from("app_user_profiles").upsert({ user_id: id, activo: active, actualizado_por: actorId, updated_at: new Date().toISOString() });
      if (profileError) throw profileError;
      await admin.from("app_user_audit").insert({ actor_user_id: actorId, target_user_id: id, accion: active ? "usuario_activado" : "usuario_desactivado" });
      return responder({ ok: true });
    }
    return responder({ error: "Acción no reconocida." }, 400);
  } catch (error) {
    console.error("administrar-usuarios", error);
    return responder({ error: error instanceof Error ? error.message : "Error interno" }, 500);
  }
});
