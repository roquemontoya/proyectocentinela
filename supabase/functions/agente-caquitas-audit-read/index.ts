import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Headers": "content-type, x-agent-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers });
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

async function readAll(
  baseUrl: string,
  key: string,
  table: string,
  select: string,
  order: string,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`/rest/v1/${table}`, baseUrl);
    url.searchParams.set("select", select);
    url.searchParams.set("order", order);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: key,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("audit_read_failed", table, response.status, detail.slice(0, 300));
      throw new Error(`read_failed:${table}:${response.status}`);
    }
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`invalid_response:${table}`);
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const expectedToken = Deno.env.get("AGENTE_CAQ_AUDIT_TOKEN") ?? "";
  if (!expectedToken) return json(503, { error: "agent_token_not_configured" });

  const suppliedToken = req.headers.get("x-agent-token") ?? "";
  if (!suppliedToken || !constantTimeEqual(suppliedToken, expectedToken)) {
    return json(401, { error: "unauthorized" });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (
    body.agent_id !== "AGENTE-CAQUITAS-001" ||
    body.mayordomo_id !== "EL_MAYORDOMO_001" ||
    body.task_id !== "auditoria-extintores"
  ) {
    return json(400, { error: "task_not_allowed" });
  }

  const baseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  // Prefer the server-side service key provided by the Supabase Edge runtime.
  // It never leaves this function. Queries are hard-coded GET requests only.
  const apiKey =
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";
  if (!baseUrl || !apiKey) {
    console.error("agent_api_environment_missing", {
      hasUrl: Boolean(baseUrl),
      hasServerKey: Boolean(apiKey),
    });
    return json(503, { error: "supabase_server_access_not_configured" });
  }

  try {
    const [extintores, trazabilidad, alveolos] = await Promise.all([
      readAll(
        baseUrl, apiKey, "Extintores",
        "id,ID,ETIQUETA,UBICACION,TIPO,Vencimiento,PH,numero_serie,numero_tarjeta,capacidad_kg,marca,fecha_fabricacion,alveolo_id,activo_leu_id",
        "id.asc",
      ),
      readAll(
        baseUrl, apiKey, "extintores_trazabilidad",
        "id_activo,numero_serie,numero_tarjeta,ubicacion_operativa,estado_ubicacion,estado_operativo,fecha_ultima_verificacion,verificado_por,observaciones",
        "id_activo.asc",
      ),
      readAll(
        baseUrl, apiKey, "pulmon_alveolos",
        "id,codigo,estado,activo_extintor_id,observaciones",
        "id.asc",
      ),
    ]);

    return json(200, {
      agent_id: "AGENTE-CAQUITAS-001",
      mayordomo_id: "EL_MAYORDOMO_001",
      task_id: "auditoria-extintores",
      fetched_at: new Date().toISOString(),
      access_method: "supabase_data_api",
      mode: "read_only_fixed_selects",
      operational_context: {
        system: "Proyecto Centinela: PWA de inspección y trazabilidad de protección contra incendios industrial.",
        agent_identity: "Un solo agente lógico central de Proyecto Centinela. J.A.R.V.I.S. es el nombre visible en la aplicación; Caquitas es el nombre/apodo usado en desarrollo, auditoría y pruebas. No son dos agentes ni deben duplicar memoria, lógica o decisiones.",
        agent_role: "Agente central en modo auditor de solo lectura en esta función. Puede invocar capacidades especializadas como herramientas, sujetas a permisos de la sesión y al alcance autorizado.",
        user_facing_behavior: "Las respuestas visibles de J.A.R.V.I.S. solo pueden incluir datos y acciones autorizados para la sesión actual. No filtrar información interna, datos personales, secretos ni herramientas privilegiadas.",
        specialist_model: "Auditoría de datos, seguridad, operación de extintores/Pulmón y diagnóstico técnico son capacidades/módulos especializados del mismo agente; no son identidades autónomas.",
        mayordomo_role: "Mayordomo_001 es el operador/orquestador técnico separado que ejecuta tareas de desarrollo y despliegue autorizadas; no es otra identidad conversacional del agente central.",
        provider_name: "Bertolez",
        asset_locations: ["En planta", "En Pulmón", "Instalado como provisorio", "Enviado a Bertolez", "Retornado al Pulmón"],
        replacement_rules: {
          PQS: ["PQS", "HALON", "CO2"],
          HALON: ["HALON"],
          CO2: ["CO2", "HALON"],
          K: ["K"]
        },
        provisional_expiry_rule: "Solo ofrecer equipos con fecha interpretable y más de 30 días hasta el vencimiento; excluir vencidos, sin fecha válida o con 30 días o menos.",
        safety_rules: [
          "No inventar números de serie o tarjeta.",
          "No asumir que LEU.id, Extintores.id, activo_leu_id y trazabilidad.id_activo son equivalentes sin evidencia.",
          "Un alvéolo libre puede ser normal.",
          "Múltiples filas de trazabilidad pueden representar historia, no duplicados automáticamente.",
          "Estados pendientes no son errores por sí solos.",
          "Los hallazgos son recomendaciones de revisión; no modificar registros."
        ]
      },
      counts: {
        extintores: extintores.length,
        trazabilidad: trazabilidad.length,
        alveolos: alveolos.length,
      },
      extintores,
      trazabilidad,
      alveolos,
    });
  } catch (error) {
    console.error("audit_execution_failed", error instanceof Error ? error.message : "unknown");
    return json(500, { error: "audit_execution_failed" });
  }
});