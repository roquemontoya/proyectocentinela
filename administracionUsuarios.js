import { clienteSupabase } from "./supabaseClient.js";
import { obtenerRolActual } from "./auth.js";

const ROLES = [
  { value: "administrador", label: "Administrador" },
  { value: "supervisor", label: "Supervisor" },
  { value: "bombero_inspector", label: "Bombero/Inspector" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "superadministrador", label: "Superadministrador" },
];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
let usuarios = [];

async function llamar(action, payload = {}) {
  const { data: sessionData } = await clienteSupabase.auth.getSession();
  if (!sessionData.session) throw new Error("Tu sesión venció. Volvé a ingresar.");
  const { data, error } = await clienteSupabase.functions.invoke("administrar-usuarios", { body: { action, ...payload } });
  if (error) {
    const detalle = String(error.message || "");
    if (/Failed to send a request|fetch failed|FunctionsFetchError/i.test(detalle)) {
      throw new Error("El panel está visible, pero el servicio seguro de usuarios todavía no está desplegado o no responde en Supabase. No se realizó ningún cambio. Hay que desplegar la función administrar-usuarios y aplicar su migración antes de gestionar cuentas.");
    }
    throw new Error(data?.error || detalle || "No se pudo completar la operación.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function estadoBadge(activo) {
  return activo
    ? '<span style="padding:4px 8px;border-radius:999px;background:#14532d;color:#bbf7d0;font-size:12px">Activo</span>'
    : '<span style="padding:4px 8px;border-radius:999px;background:#7f1d1d;color:#fecaca;font-size:12px">Desactivado</span>';
}

function renderTabla(contenedor, filtro = "") {
  const q = filtro.trim().toLocaleLowerCase("es");
  const lista = usuarios.filter((u) => [u.nombre_completo, u.email, u.legajo, ...(u.roles || [])].join(" ").toLocaleLowerCase("es").includes(q));
  const cuerpo = lista.map((u) => `<tr>
    <td style="padding:11px;border-bottom:1px solid #303846"><strong>${esc(u.nombre_completo || "Sin nombre")}</strong><div style="font-size:12px;color:#9ca3af">${esc(u.legajo || "Sin legajo")}</div></td>
    <td style="padding:11px;border-bottom:1px solid #303846;overflow-wrap:anywhere">${esc(u.email)}</td>
    <td style="padding:11px;border-bottom:1px solid #303846">${esc((u.roles || []).map((r) => ROLES.find((x) => x.value === r)?.label || r).join(", ") || "Sin perfil")}</td>
    <td style="padding:11px;border-bottom:1px solid #303846">${estadoBadge(u.activo)}</td>
    <td style="padding:11px;border-bottom:1px solid #303846"><button type="button" data-edit="${esc(u.id)}" style="padding:7px 9px;border:1px solid #475569;border-radius:6px;background:#1f2937;color:#fff;cursor:pointer">Editar</button> <button type="button" data-active="${esc(u.id)}" data-next="${!u.activo}" style="padding:7px 9px;border:1px solid #7f1d1d;border-radius:6px;background:#291b1b;color:#fecaca;cursor:pointer">${u.activo ? "Desactivar" : "Reactivar"}</button></td>
  </tr>`).join("");
  contenedor.querySelector("#usuarios-tbody").innerHTML = cuerpo || '<tr><td colspan="5" style="padding:22px;text-align:center;color:#9ca3af">No hay usuarios que coincidan.</td></tr>';
  contenedor.querySelector("#usuarios-resumen").textContent = `${lista.length} usuario(s) · ${lista.filter((u) => u.activo).length} activo(s)`;
  contenedor.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => abrirEdicion(contenedor, usuarios.find((u) => u.id === b.dataset.edit))));
  contenedor.querySelectorAll("[data-active]").forEach((b) => b.addEventListener("click", async () => {
    const u = usuarios.find((x) => x.id === b.dataset.active);
    const next = b.dataset.next === "true";
    if (!u || !confirm(`¿${next ? "Reactivar" : "Desactivar"} la cuenta de ${u.email}? El historial operativo se conserva.`)) return;
    await ejecutar(contenedor, async () => { await llamar("set_active", { user_id: u.id, active: next }); await cargarUsuarios(contenedor); });
  }));
}

function abrirEdicion(contenedor, u) {
  if (!u) return;
  const form = contenedor.querySelector("#usuario-form");
  form.elements.user_id.value = u.id;
  form.elements.nombre_completo.value = u.nombre_completo || "";
  form.elements.legajo.value = u.legajo || "";
  form.elements.email.value = u.email || "";
  form.elements.role.value = (u.roles || [])[0] || "bombero_inspector";
  form.elements.email.disabled = true;
  contenedor.querySelector("#usuario-form-title").textContent = "Editar usuario";
  contenedor.querySelector("#usuario-cancelar").style.display = "inline-flex";
  form.style.display = "block";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function nuevoUsuario(contenedor) {
  const form = contenedor.querySelector("#usuario-form");
  form.reset();
  form.elements.user_id.value = "";
  form.elements.email.disabled = false;
  form.elements.role.value = "bombero_inspector";
  contenedor.querySelector("#usuario-form-title").textContent = "Crear usuario";
  contenedor.querySelector("#usuario-cancelar").style.display = "none";
}

async function ejecutar(contenedor, fn) {
  const msg = contenedor.querySelector("#usuarios-mensaje");
  try { msg.style.display = "none"; await fn(); }
  catch (e) { msg.textContent = e?.message || "Ocurrió un error."; msg.style.display = "block"; }
}

async function cargarUsuarios(contenedor) {
  const data = await llamar("list");
  usuarios = data.users || [];
  renderTabla(contenedor, contenedor.querySelector("#usuarios-busqueda").value);
}

export async function cargarModuloAdministracionUsuarios(contenedor) {
  if (!["administrador", "superadministrador"].includes(obtenerRolActual())) {
    contenedor.innerHTML = '<p style="padding:20px;color:#fca5a5">Este módulo es exclusivo de Administración.</p>';
    return;
  }
  contenedor.style.cssText += ";display:block;width:100%;max-width:1400px;margin:0 auto";
  contenedor.innerHTML = `<section style="padding:clamp(14px,3vw,28px);color:#e5e7eb;font-family:Arial,sans-serif">
    <header style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px">
      <div><h2 style="margin:0 0 5px">👥 Administración de usuarios</h2><p style="margin:0;color:#9ca3af">Cuentas individuales, perfiles y estado de acceso.</p></div>
      <button id="usuario-nuevo" type="button" style="padding:11px 14px;background:#166534;border:1px solid #22c55e;color:#fff;border-radius:8px;font-weight:700;cursor:pointer">＋ Crear usuario</button>
    </header>
    <div id="usuarios-mensaje" role="alert" style="display:none;padding:11px;margin-bottom:12px;border:1px solid #7f1d1d;background:#451a1a;color:#fecaca;border-radius:8px"></div>
    <form id="usuario-form" style="display:none;padding:16px;background:#111827;border:1px solid #374151;border-radius:10px;margin-bottom:18px">
      <h3 id="usuario-form-title" style="margin:0 0 14px">Crear usuario</h3><input type="hidden" name="user_id">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
        <label style="display:grid;gap:6px;font-size:13px">Nombre y apellido<input name="nombre_completo" required maxlength="120" style="padding:10px;background:#0b1220;color:white;border:1px solid #475569;border-radius:6px"></label>
        <label style="display:grid;gap:6px;font-size:13px">Correo corporativo<input name="email" type="email" required maxlength="254" style="padding:10px;background:#0b1220;color:white;border:1px solid #475569;border-radius:6px"></label>
        <label style="display:grid;gap:6px;font-size:13px">Legajo (opcional)<input name="legajo" maxlength="40" style="padding:10px;background:#0b1220;color:white;border:1px solid #475569;border-radius:6px"></label>
        <label style="display:grid;gap:6px;font-size:13px">Perfil<select name="role" required style="padding:10px;background:#0b1220;color:white;border:1px solid #475569;border-radius:6px">${ROLES.map((r) => `<option value="${r.value}">${r.label}</option>`).join("")}</select></label>
      </div>
      <p style="font-size:12px;color:#9ca3af;line-height:1.5">La cuenta se crea con invitación por correo; no se define ni se almacena una contraseña desde este panel.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="submit" style="padding:10px 14px;background:#1d4ed8;color:#fff;border:0;border-radius:7px;cursor:pointer">Guardar usuario</button><button id="usuario-cancelar" type="button" style="display:none;padding:10px 14px;background:#374151;color:#fff;border:0;border-radius:7px;cursor:pointer">Cancelar</button></div>
    </form>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><input id="usuarios-busqueda" type="search" placeholder="Buscar nombre, correo, legajo o perfil…" style="flex:1;min-width:220px;padding:11px;background:#111827;color:white;border:1px solid #374151;border-radius:8px"><span id="usuarios-resumen" style="color:#9ca3af;font-size:13px"></span></div>
    <div style="overflow:auto;border:1px solid #374151;border-radius:10px;background:#111827"><table style="width:100%;border-collapse:collapse;min-width:760px;text-align:left"><thead style="background:#1f2937"><tr>${["Usuario / legajo","Correo","Perfil","Estado","Acciones"].map((x)=>`<th style="padding:11px;font-size:12px;color:#cbd5e1">${x}</th>`).join("")}</tr></thead><tbody id="usuarios-tbody"><tr><td colspan="5" style="padding:20px">Cargando usuarios…</td></tr></tbody></table></div>
    <p style="color:#9ca3af;font-size:12px;margin-top:12px">La desactivación bloquea el acceso y conserva los registros operativos asociados. Las acciones administrativas se auditan en la base de datos.</p>
    <details style="margin-top:18px;border:1px solid #374151;border-radius:10px;background:#111827;padding:14px">
      <summary style="cursor:pointer;font-weight:700">🔐 Matriz de permisos por perfil</summary>
      <p style="color:#9ca3af;font-size:12px;line-height:1.5">Permisos configurados actualmente en Supabase. El acceso a cada pantalla puede variar según los módulos activos.</p>
      <div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:780px;text-align:left">
        <thead><tr>${["Capacidad","Superadministrador","Administrador","Supervisor","Bombero/Inspector","Mantenimiento"].map(x=>`<th style="padding:9px;border-bottom:1px solid #374151;font-size:12px">${x}</th>`).join("")}</tr></thead>
        <tbody>${[
          ["Consultar activos e inventario",[1,1,1,1,1]],
          ["Modificar datos maestros de activos",[1,1,0,0,1]],
          ["Consultar historial de controles",[1,1,1,1,1]],
          ["Registrar controles",[1,1,1,1,1]],
          ["Corregir controles existentes",[1,1,1,0,1]],
          ["Consultar y registrar anomalías",[1,1,1,1,1]],
          ["Resolver anomalías",[1,1,1,0,1]],
          ["Modificar ubicaciones",[1,1,1,0,1]],
          ["Consultar personal de Bomberos",[1,1,1,1,1]],
          ["Administrar personal de Bomberos",[1,1,0,0,1]],
          ["Consultar Pulmón y recargas",[1,1,1,1,1]],
          ["Actualizar stock y recargas",[1,1,0,0,1]],
          ["Administrar cuentas de usuario",[1,1,0,0,0]],
          ["Administrar roles y permisos",[1,0,0,0,0]],
          ["Funciones avanzadas del sistema",[1,0,0,0,0]]
        ].map(([capacidad,vals])=>`<tr><td style="padding:9px;border-bottom:1px solid #263244">${capacidad}</td>${vals.map(v=>`<td style="padding:9px;text-align:center;border-bottom:1px solid #263244;color:${v?"#86efac":"#9ca3af"}">${v?"✓":"—"}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
      <p style="color:#fbbf24;font-size:12px;line-height:1.5">La matriz documenta los permisos configurados; antes de producción debemos comprobar también que cada módulo y operación los aplique efectivamente en el backend.</p>
    </details>
  </section>`;
  const form = contenedor.querySelector("#usuario-form");
  contenedor.querySelector("#usuario-nuevo").addEventListener("click", () => {
    const visible = form.style.display !== "none";
    if (visible) { form.style.display = "none"; return; }
    nuevoUsuario(contenedor); form.style.display = "block"; form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  contenedor.querySelector("#usuario-cancelar").addEventListener("click", () => { nuevoUsuario(contenedor); form.style.display = "none"; });
  contenedor.querySelector("#usuarios-busqueda").addEventListener("input", () => renderTabla(contenedor, contenedor.querySelector("#usuarios-busqueda").value));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(form);
    const payload = { nombre_completo: values.get("nombre_completo"), email: values.get("email"), legajo: values.get("legajo"), role: values.get("role") };
    ejecutar(contenedor, async () => {
      if (values.get("user_id")) await llamar("update", { ...payload, user_id: values.get("user_id") });
      else await llamar("create", payload);
      form.style.display = "none"; nuevoUsuario(contenedor); await cargarUsuarios(contenedor);
      const msg = contenedor.querySelector("#usuarios-mensaje"); msg.textContent = "Operación completada."; msg.style.display = "block"; msg.style.background = "#14532d"; msg.style.borderColor = "#166534";
    });
  });
  await ejecutar(contenedor, () => cargarUsuarios(contenedor));
}
