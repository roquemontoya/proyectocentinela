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
  for (const candidate of ["id", "fid", "user_id"]) {
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
  const fkRules = [
    ["Extintores","activo_leu_id","leu","id"],["Extintores","alveolo_id","pulmon_alveolos","id"],
    ["anomalias","id_activo","leu","id"],["app_role_permissions","permission_id","app_permissions","id"],
    ["app_role_permissions","role_id","app_roles","id"],["app_user_roles","role_id","app_roles","id"],
    ["caminos_internos","recorrido_origen_id","recorridos_gps","id"],
    ["controles_c","id_activo","leu","id"],["controles_e","id_activo","leu","id"],
    ["controles_ecas","id_activo","leu","id"],["controles_es","id_activo","leu","id"],
    ["controles_h","id_activo","leu","id"],["controles_pc","id_activo","leu","id"],
    ["controles_pecas","id_activo","leu","id"],["controles_pfp","id_activo","leu","id"],
    ["controles_v","id_activo","leu","id"],["controles_vecas","id_activo","leu","id"],
    ["extintores_trazabilidad","id_activo","leu","id"],["movimientos_extintores","id_activo","leu","id"],
    ["movimientos_reemplazos_extintores","activo_titular_id","leu","id"],
    ["movimientos_reemplazos_extintores","reemplazo_id","reemplazos_temporales_extintores","id"],
    ["pulmon_alveolos","activo_extintor_id","Extintores","id"],
    ["puntos_recorrido_gps","recorrido_id","recorridos_gps","id"],
    ["reemplazos_temporales_extintores","activo_reemplazo_id","leu","id"],
    ["reemplazos_temporales_extintores","activo_titular_id","leu","id"],
    ["reemplazos_temporales_extintores","control_fin_id","controles_e","id"],
    ["reemplazos_temporales_extintores","control_inicio_id","controles_e","id"],
    ["territorios_dinamicos","padre_id","territorios_dinamicos","id"]
  ] as const;

  const tables: Record<string, unknown>[] = [], findings: Record<string, unknown>[] = [];
  const errors: { table: string; error: string }[] = [];
  const dataByTable = new Map<string, Row[]>();
  for (const table of TABLES) {
    try {
      const rows = await readAll(base, key, table);
      dataByTable.set(table, rows);
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

  for (const [childTable, childField, parentTable, parentField] of fkRules) {
    const children = dataByTable.get(childTable), parents = dataByTable.get(parentTable);
    if (!children || !parents) continue;
    const parentKeys = new Set(parents.map(r => r[parentField]).filter(v => v !== null && v !== undefined && String(v).trim() !== "").map(v => String(v)));
    const orphans = children.filter(r => {
      const v = r[childField];
      return v !== null && v !== undefined && String(v).trim() !== "" && !parentKeys.has(String(v));
    });
    if (orphans.length) findings.push({
      severity: "alta", code: "FK_ORPHAN_REFERENCE", table: childTable,
      field: childField, referenced_table: parentTable, referenced_field: parentField,
      title: "Referencias sin registro padre", count: orphans.length,
      detail: "Referencia basada en una FK declarada en PostgreSQL; revisar antes de corregir.",
      examples: orphans.slice(0, 5).map(r => ({ value: r[childField], id: r.id ?? null }))
    });
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
      "Audita candidatos de claves repetidas y las FK declaradas incluidas en fkRules; las reglas de dominio requieren fases adicionales.",
      "Las comprobaciones FK se limitan a restricciones verificadas e incluidas en fkRules; no se infieren relaciones por nombres.",
      "Los duplicados son candidatos, no prueba automática de corrupción.",
      "El endpoint solo realiza GET; no modifica tablas ni ejecuta correcciones.",
      "La función debe probarse en un entorno de prueba antes de desplegarse o conectarse a la interfaz."
    ]
  });
});
