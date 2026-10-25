import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const ALLOWED_ORIGIN = /^https:\/\/proyectocentinela-[a-z0-9-]+-acme-argentina\.vercel\.app$/;
const TABLES = [
  "leu", "Extintores", "hidrantes", "ecas", "Valvulas", "vecas", "pecas", "ipp",
  "controles_e", "controles_h", "controles_ecas", "controles_vecas", "controles_v",
  "controles_pecas", "controles_pc", "controles_c", "controles_es", "controles_pfp",
  "anomalias", "extintores_trazabilidad", "movimientos_extintores",
  "reemplazos_temporales_extintores", "movimientos_reemplazos_extintores",
  "pulmon_alveolos", "recorridos_gps", "puntos_recorrido_gps", "caminos_internos",
  "territorios_dinamicos", "app_roles", "app_permissions", "app_role_permissions",
  "app_user_roles", "app_user_profiles", "app_user_audit",
] as const;

type Row = Record<string, unknown>;
type Finding = {
  code: string; severity: "alta" | "media" | "baja" | "informativa";
  confidence: "confirmado" | "probable" | "incompleto" | "revision_humana";
  title: string; count: number; tables: string[]; detail: string; examples: unknown[];
};

function headers(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = origin === "https://proyectocentinela.vercel.app" || ALLOWED_ORIGIN.test(origin);
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function response(req: Request, status: number, data: unknown) {
  return new Response(JSON.stringify(data), { status, headers: headers(req) });
}
function blank(value: unknown) { return value === null || value === undefined || String(value).trim() === ""; }
function norm(value: unknown) { return String(value ?? "").trim().toLocaleUpperCase("es"); }
function id(row: Row) { return row.id ?? row.id_activo ?? row.ID ?? row.fid ?? null; }

async function readTable(baseUrl: string, key: string, table: string): Promise<Row[]> {
  const result: Row[] = [];
  const size = 500;
  for (let offset = 0; offset < 50000; offset += size) {
    const url = new URL(`/rest/v1/${encodeURIComponent(table)}`, baseUrl);
    url.searchParams.set("select", "*");
    url.searchParams.set("limit", String(size));
    url.searchParams.set("offset", String(offset));
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" } });
    if (!res.ok) throw new Error(`table_read_failed:${table}:${res.status}`);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error(`invalid_table_response:${table}`);
    result.push(...page);
    if (page.length < size) return result;
  }
  throw new Error(`table_row_safety_limit:${table}`);
}

function finding(code: string, severity: Finding["severity"], confidence: Finding["confidence"], title: string,
  rows: Row[], tables: string[], detail: string, fields: string[] = []): Finding {
  return {
    code, severity, confidence, title, count: rows.length, tables, detail,
    examples: rows.slice(0, 10).map(row => {
      const example: Row = { id: id(row) };
      for (const field of fields) if (field in row) example[field] = row[field];
      return example;
    }),
  };
}
function duplicateGroups(rows: Row[], field: string) {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    if (blank(row[field])) continue;
    const key = norm(row[field]);
    const group = map.get(key) ?? [];
    group.push(row); map.set(key, group);
  }
  return [...map.entries()].filter(([, group]) => group.length > 1)
    .map(([value, group]) => ({ value, count: group.length, ids: group.slice(0, 10).map(id) }));
}

function runRules(data: Record<string, Row[]>): Finding[] {
  const out: Finding[] = [];
  const leu = data.leu ?? [];
  const leuIds = new Set(leu.map(row => String(row.id)));
  const assetTables = ["Extintores", "hidrantes", "ecas", "Valvulas", "vecas", "pecas", "ipp"];
  const controlTables = ["controles_e", "controles_h", "controles_ecas", "controles_vecas", "controles_v",
    "controles_pecas", "controles_pc", "controles_c", "controles_es", "controles_pfp"];
  const orphans: Row[] = [];
  for (const table of controlTables) {
    for (const row of data[table] ?? []) {
      if (!blank(row.id_activo) && !leuIds.has(String(row.id_activo))) orphans.push({ table, id: row.id, id_activo: row.id_activo });
    }
  }
  if (orphans.length) out.push(finding("REL-001", "alta", "confirmado", "Controles con activo maestro inexistente",
    orphans, controlTables.concat("leu"), "El id_activo de estos controles no aparece en leu. Confirmar si son registros históricos o referencias incorrectas.", ["table", "id_activo"]));

  const missingLink: Row[] = [];
  for (const table of controlTables) for (const row of data[table] ?? []) {
    if (blank(row.id_activo)) missingLink.push({ id: row.id, table });
  }
  if (missingLink.length) out.push(finding("REL-002", "media", "incompleto", "Controles sin vínculo a activo",
    missingLink, controlTables, "Falta id_activo. Puede tratarse de datos importados o históricos; no se asume automáticamente corrupción.", ["table"]));

  const duplicateAssets: Row[] = [];
  for (const table of assetTables) {
    const rows = data[table] ?? [];
    for (const field of ["ID", "ETIQUETA", "Etiqueta", "Punto", "nombre"]) {
      const groups = duplicateGroups(rows, field);
      for (const group of groups) duplicateAssets.push({ table, field, ...group });
    }
  }
  if (duplicateAssets.length) out.push(finding("DUP-001", "media", "revision_humana", "Posibles identificadores duplicados en módulos de activos",
    duplicateAssets, assetTables, "Coincidencias normalizadas de etiquetas/identificadores. Revisar la clave de negocio de cada módulo antes de concluir que son duplicados.", ["table", "field", "value", "count"]));

  const traceOrphans = (data.extintores_trazabilidad ?? []).filter(row => !blank(row.id_activo) && !leuIds.has(String(row.id_activo)));
  if (traceOrphans.length) out.push(finding("TRACE-001", "alta", "confirmado", "Trazabilidad sin activo maestro",
    traceOrphans, ["extintores_trazabilidad", "leu"], "La referencia id_activo no coincide con un activo de leu.", ["id_activo"]));

  const extintores = data.Extintores ?? [];
  const extIds = new Set(extintores.map(row => String(row.id)));
  const alveolos = data.pulmon_alveolos ?? [];
  const invalidAlveolos = alveolos.filter(row => !blank(row.activo_extintor_id) && !extIds.has(String(row.activo_extintor_id)));
  if (invalidAlveolos.length) out.push(finding("PUL-001", "alta", "confirmado", "Alvéolos asignados a extintores inexistentes",
    invalidAlveolos, ["pulmon_alveolos", "Extintores"], "activo_extintor_id no coincide con un registro de Extintores.", ["codigo", "activo_extintor_id", "estado"]));

  const assignedMoreThanOnce = duplicateGroups(alveolos.filter(row => !blank(row.activo_extintor_id)), "activo_extintor_id");
  if (assignedMoreThanOnce.length) out.push({
    code: "PUL-002", severity: "alta", confidence: "probable", title: "Extintores asignados a más de un alvéolo",
    count: assignedMoreThanOnce.length, tables: ["pulmon_alveolos"], detail: "Un mismo extintor aparece asignado a múltiples alvéolos; verificar inventario y estado operativo.",
    examples: assignedMoreThanOnce.slice(0, 10),
  });

  const movementOrphans = (data.movimientos_extintores ?? []).filter(row => !blank(row.id_activo) && !leuIds.has(String(row.id_activo)));
  if (movementOrphans.length) out.push(finding("MOV-001", "alta", "confirmado", "Movimientos de extintores sin activo maestro",
    movementOrphans, ["movimientos_extintores", "leu"], "El movimiento referencia un activo que no aparece en el maestro.", ["id_activo", "tipo_movimiento"]));

  const anomalies = data.anomalias ?? [];
  const anomalyOrphans = anomalies.filter(row => !blank(row.id_activo) && !leuIds.has(String(row.id_activo)));
  if (anomalyOrphans.length) out.push(finding("ANO-001", "media", "confirmado", "Anomalías con activo inexistente",
    anomalyOrphans, ["anomalias", "leu"], "La anomalía referencia un id_activo ausente del maestro.", ["id_activo", "estado_resolucion"]));

  const badAnomalyClosure = anomalies.filter(row => {
    const resolved = norm(row.estado_resolucion).includes("RESUEL");
    return resolved && (blank(row.fecha_resolucion) || blank(row.detalle_resolucion));
  });
  if (badAnomalyClosure.length) out.push(finding("ANO-002", "baja", "probable", "Anomalías resueltas con datos de cierre incompletos",
    badAnomalyClosure, ["anomalias"], "El estado parece resuelto, pero falta fecha o detalle de resolución. Confirmar el flujo operativo.", ["estado_resolucion"]));

  const replacementIssues: Row[] = [];
  for (const row of data.reemplazos_temporales_extintores ?? []) {
    if (!blank(row.fecha_inicio) && !blank(row.fecha_fin) && String(row.fecha_fin) < String(row.fecha_inicio)) replacementIssues.push({ id: row.id, issue: "fin_antes_inicio" });
    if (!blank(row.activo_titular_id) && String(row.activo_titular_id) === String(row.activo_reemplazo_id)) replacementIssues.push({ id: row.id, issue: "titular_igual_reemplazo" });
  }
  if (replacementIssues.length) out.push(finding("REP-001", "alta", "confirmado", "Reemplazos temporales con cronología o identidad imposible",
    replacementIssues, ["reemplazos_temporales_extintores"], "Se detectó fecha de fin anterior al inicio o el mismo activo como titular y reemplazo.", ["issue"]));

  const routeIssues: Row[] = [];
  for (const row of data.recorridos_gps ?? []) {
    if (!blank(row.iniciado_en) && !blank(row.finalizado_en) && String(row.finalizado_en) < String(row.iniciado_en)) routeIssues.push({ id: row.id, issue: "fin_antes_inicio" });
  }
  const points = data.puntos_recorrido_gps ?? [];
  const sequenceKeys = new Set<string>();
  for (const row of points) {
    const key = `${row.recorrido_id}:${row.secuencia}`;
    if (!blank(row.recorrido_id) && !blank(row.secuencia) && sequenceKeys.has(key)) routeIssues.push({ id: row.id, issue: "secuencia_duplicada", recorrido_id: row.recorrido_id, secuencia: row.secuencia });
    sequenceKeys.add(key);
    const lat = Number(row.latitud), lon = Number(row.longitud);
    if (!blank(row.latitud) && !blank(row.longitud) && (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180)) {
      routeIssues.push({ id: row.id, issue: "coordenadas_fuera_de_rango" });
    }
  }
  if (routeIssues.length) out.push(finding("GPS-001", "media", "confirmado", "Inconsistencias en recorridos GPS",
    routeIssues, ["recorridos_gps", "puntos_recorrido_gps"], "Fechas invertidas, secuencias repetidas por recorrido o coordenadas fuera de rango.", ["issue", "recorrido_id", "secuencia"]));

  const emptyWkt = leu.filter(row => blank(row.ubicacion_wkt));
  if (emptyWkt.length) out.push(finding("GEO-001", "baja", "incompleto", "Activos maestros sin ubicación WKT",
    emptyWkt, ["leu"], "La ubicación textual WKT está vacía; validar si el activo requiere georreferenciación.", ["etiqueta", "categoria", "sector"]));

  return out;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method !== "POST") return response(req, 405, { error: "method_not_allowed" });
  const authorization = req.headers.get("Authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const baseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
  const serverKey = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!bearer) return response(req, 401, { error: "authentication_required" });
  if (!baseUrl || !anonKey || !serverKey) return response(req, 503, { error: "service_not_configured" });

  try {
    const userResponse = await fetch(new URL("/auth/v1/user", baseUrl), { headers: { apikey: anonKey, Authorization: `Bearer ${bearer}` } });
    if (!userResponse.ok) return response(req, 401, { error: "invalid_session" });
    const roleResponse = await fetch(new URL("/rest/v1/rpc/current_user_role", baseUrl), {
      method: "POST", headers: { apikey: anonKey, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" }, body: "{}",
    });
    if (!roleResponse.ok) return response(req, 403, { error: "role_check_failed" });
    const role = String(await roleResponse.json() ?? "").trim().toLowerCase();
    if (!["administrador", "superadministrador"].includes(role)) return response(req, 403, { error: "insufficient_role" });

    const tables: Record<string, Row[]> = {};
    const queue = [...TABLES];
    const worker = async () => {
      while (queue.length) {
        const table = queue.shift()!;
        tables[table] = await readTable(baseUrl, serverKey, table);
      }
    };
    await Promise.all(Array.from({ length: 4 }, () => worker()));
    const findings = runRules(tables);
    const counts = Object.fromEntries(TABLES.map(table => [table, tables[table].length]));
    return response(req, 200, {
      agent_id: "AGENTE-CAQUITAS-001", presented_as: "Mayordomo_001",
      task_id: "auditoria-integral-v1", generated_at: new Date().toISOString(),
      read_only: true, mode: "fixed_allowlist_read_only",
      summary: {
        tables_checked: TABLES.length,
        rows_checked: Object.values(tables).reduce((sum, rows) => sum + rows.length, 0),
        findings_total: findings.length,
        alta: findings.filter(f => f.severity === "alta").length,
        media: findings.filter(f => f.severity === "media").length,
        baja: findings.filter(f => f.severity === "baja").length,
        informativa: findings.filter(f => f.severity === "informativa").length,
      },
      counts, findings,
      limitations: [
        "Solo se aplican reglas codificadas; no se ha integrado un modelo de IA generativa.",
        "Las relaciones lógicas no declaradas como FK pueden necesitar revisión humana.",
        "Los campos faltantes y las coincidencias de etiquetas no prueban corrupción por sí solos.",
        "Ningún dato fue modificado.",
      ],
    });
  } catch (error) {
    console.error("mayordomo_integral_failed", error instanceof Error ? error.message : "unknown");
    return response(req, 500, { error: "integral_audit_failed" });
  }
});
