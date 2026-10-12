import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const modules: Record<string, { table: string; order: string }> = {
  hidrantes: { table: "controles_h", order: "creado_el" },
  extintores: { table: "controles_e", order: "created_at" },
  ecas: { table: "controles_ecas", order: "created_at" },
  pecas: { table: "controles_pecas", order: "created_at" },
  vecas: { table: "controles_vecas", order: "created_at" },
  valvulas: { table: "controles_v", order: "created_at" },
};

function extractObjectPath(value: unknown): string | null {
  const photo = String(value ?? "").trim();
  if (!photo) return null;

  if (/^https?:\/\//i.test(photo)) {
    try {
      const url = new URL(photo);
      const marker = "/storage/v1/object/public/fotos-controles/";
      const index = url.pathname.indexOf(marker);
      if (index < 0) return null;
      return decodeURIComponent(url.pathname.slice(index + marker.length));
    } catch {
      return null;
    }
  }

  return photo.replace(/^\/+/, "").replace(/^fotos-controles\//i, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405, headers: corsHeaders });
  }

  try {
    const { moduleKey } = await req.json();
    const config = modules[String(moduleKey ?? "")];
    if (!config) {
      return new Response(JSON.stringify({ error: "Módulo no permitido" }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuración del servicio incompleta" }), { status: 500, headers: corsHeaders });
    }

    // La clave privilegiada permanece únicamente en el entorno server-side.
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin
      .from(config.table)
      .select(`id_activo, foto, ${config.order}`)
      .not("foto", "is", null)
      .order(config.order, { ascending: false });

    if (error) {
      console.error("Error consultando fotos de controles", error.message);
      return new Response(JSON.stringify({ error: "No se pudieron consultar las fotos" }), { status: 500, headers: corsHeaders });
    }

    // Solo se firma la foto más reciente de cada activo; jamás se devuelve el historial.
    const latest = new Map<number, string>();
    for (const control of data ?? []) {
      const id = Number(control.id_activo);
      const path = extractObjectPath(control.foto);
      if (Number.isSafeInteger(id) && id > 0 && path && !latest.has(id)) latest.set(id, path);
    }

    const photos: Record<string, string> = {};
    await Promise.all([...latest.entries()].map(async ([id, path]) => {
      const { data: signed, error: signError } = await admin.storage
        .from("fotos-controles")
        .createSignedUrl(path, 300);
      if (signError || !signed?.signedUrl) return;
      photos[String(id)] = signed.signedUrl;
    }));

    return new Response(JSON.stringify({ photos }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Solicitud de última foto inválida", error);
    return new Response(JSON.stringify({ error: "Solicitud inválida" }), { status: 400, headers: corsHeaders });
  }
});
