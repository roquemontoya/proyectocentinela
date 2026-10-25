import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import postgres from "npm:postgres@3.4.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "null",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const expectedToken = Deno.env.get("AGENTE_CAQ_AUDIT_TOKEN") ?? "";
  const dbUrl = Deno.env.get("CENTINELA_READONLY_DB_URL") ?? "";
  if (!expectedToken || !dbUrl) return json(503, { error: "service_not_configured" });

  const auth = req.headers.get("authorization") ?? "";
  const suppliedToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!suppliedToken || !constantTimeEqual(suppliedToken, expectedToken)) {
    return json(401, { error: "unauthorized" });
  }

  let requestBody: Record<string, unknown>;
  try {
    requestBody = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (requestBody.agent_id !== "AGENTE-CAQUITAS-001" ||
      requestBody.mayordomo_id !== "EL_MAYORDOMO_001" ||
      requestBody.task_id !== "auditoria-extintores") {
    return json(400, { error: "task_not_allowed" });
  }

  // La URL debe pertenecer a un usuario PostgreSQL de SOLO LECTURA.
  // No usar service_role ni una cadena de conexión con permisos de escritura.
  const sql = postgres(dbUrl, { max: 1, connect_timeout: 5, idle_timeout: 5 });
  try {
    const [extintores, trazabilidad, alveolos] = await Promise.all([
      sql`SELECT id, "ID", "ETIQUETA", numero_serie, numero_tarjeta FROM public."Extintores" ORDER BY id`,
      sql`SELECT id_activo, numero_serie, numero_tarjeta FROM public.extintores_trazabilidad ORDER BY id_activo`,
      sql`SELECT id, codigo, activo_extintor_id FROM public.pulmon_alveolos ORDER BY id`,
    ]);
    return json(200, {
      agent_id: "AGENTE-CAQUITAS-001",
      mayordomo_id: "EL_MAYORDOMO_001",
      fetched_at: new Date().toISOString(),
      extintores,
      trazabilidad,
      alveolos,
    });
  } catch {
    return json(500, { error: "readonly_query_failed" });
  } finally {
    await sql.end({ timeout: 2 });
  }
});
