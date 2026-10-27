import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Access-Control-Allow-Headers": "content-type, x-agent-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TABLES = [
  "leu","Extintores","hidrantes","Valvulas","ecas","vecas","pecas","ipp","Bomberos",
  "controles_e","controles_h","controles_v","controles_ecas","controles_vecas",
  "controles_pecas","controles_pc","controles_pfp","controles_es","controles_c",
  "anomalias","extintores_trazabilidad","pulmon_alveolos","movimientos_extintores",
  "movimientos_reemplazos_extintores","reemplazos_temporales_extintores",
  "app_roles","app_permissions","app_role_permissions","app_user_profiles",
  "app_user_roles","app_user_audit","caminos_internos","recorridos_gps",
  "puntos_recorrido_gps","territorios_dinamicos","inicio"
];
type Row = Record<string, unknown>;
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers });
}
function equalSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0; for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
async function readAll(base: string, key: string, table: string): Promise<Row[]> {
  const result: Row[] = [], size = 500;
  for (let offset = 0; ; offset += size) {
    const url = new URL("/rest/v1/" + encodeURIComponent(table), base);
    url.searchParams.set("select", "*");
    url.searchParams.set("limit", String(size));
    url.searchParams.set("offset", String(offset));
    const res = await fetch(url, { headers: { apikey: key, Accept: "application/json" } });
    if (!res.ok) throw new Error("read_failed:" + table + ":" + res.status);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error("invalid_response:" + table);
    result.push(...page);
    if (page.length < size) return result;
  }
}
function keyField(rows: Row[]): string | null {
  if (!rows.length) return null;
  for (const candidate of ["id", "id_activo", "fid", "user_id"]) {
    if (rows.every(r => Object.prototype.hasOwnProperty.call(r, candidate))) return candidate;
  }
  return null;
}
function examples(rows: Row[], field: string) {
  return rows.slice(0, 5).map(r => ({ key: r[field] ?? null }));
}
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const expected = Deno.env.get("AGENTE_CAQ_AUDIT_TOKEN") ?? "";
  const supplied = req.headers.get("x-agent-token") ?? "";
  if (!expected) return json(503, { error: "agent_token_not_configured" });
  if (!supplied || !equalSecret(expected, supplied)) return json(401, { error: "unauthorized" });
  let body: Row;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  if (body.agent_id !== "AGENTE-CAQUITAS-001" ||
      body.mayordomo_id !== "EL_MAYORDOMO_001" ||
      body.task_id !== "auditoria-integral-leu") return json(400, { error: "task_not_allowed" });

  const base = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!base || !key) return json(503, { error: "server_access_not_configured" });

  const generatedAt = new Date().toISOString();
  const tables: Record<string, unknown>[] = [], findings: Record<string, unknown>[] = [];
  const errors: { table: string; error: string }[] = [];
  for (const table of TABLES) {
    try {
      const rows = await readAll(base, key, table);
      const field = keyField(rows);
      const duplicateValues = new Map<string, number>();
      if (field) for (const row of rows) {
        const v = row[field];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          const k = String(v).trim();
          duplicateValues.set(k, (duplicateValues.get(k) ?? 0) + 1);
        }
      }
      const duplicates = field ? [...duplicateValues].filter(([, n]) => n > 1) : [];
      tables.push({ table, status: "checked", rows: rows.length, key_field_checked: field,
        duplicate_key_groups: duplicates.length });
      if (duplicates.length) findings.push({
        severity: "alta", code: "KEY_DUPLICATE_CANDIDATE", table,
        title: "Posibles claves repetidas", count: duplicates.length,
        detail: "Hallazgo preliminar: verificar si el campo es una clave única real antes de concluir que existe corrupción.",
        examples: duplicates.slice(0, 5).map(([value, count]) => ({ value, count }))
      });
      if (!rows.length) findings.push({
        severity: "informativa", code: "TABLE_EMPTY", table, title: "Tabla sin filas",
        count: 0, detail: "Una tabla vacía puede ser válida; comprobar si se esperaba contenido."
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown_error";
      errors.push({ table, error: message });
      tables.push({ table, status: "error", rows: null, error: message });
    }
  }
  const checked = tables.filter(t => t.status === "checked").length;
  const complete = errors.length === 0 && checked === TABLES.length;
  return json(200, {
    agent_id: "AGENTE-CAQUITAS-001", coordinator: "J.A.R.V.I.S.",
    presented_as: "Mayordomo_001", task_id: "auditoria-integral-leu",
    generated_at: generatedAt, read_only: true,
    status: complete ? "complete_inventory_preliminary_rules" : "incomplete",
    coverage: { planned_tables: TABLES.length, checked_tables: checked, failed_tables: errors.length },
    tables, findings, errors,
    caveats: [
      "Esta primera versión inventaría tablas y aplica una regla preliminar de duplicados; no declara validadas todas las relaciones de LEU.",
      "Las relaciones entre identificadores no se infieren por nombres. La siguiente fase debe incorporar las FK reales y reglas de dominio verificadas.",
      "Los duplicados son candidatos, no prueba automática de corrupción.",
      "El endpoint solo realiza GET; no modifica tablas ni ejecuta correcciones.",
      "La función debe probarse en un entorno de prueba antes de desplegarse o conectarse a la interfaz."
    ]
  });
});
