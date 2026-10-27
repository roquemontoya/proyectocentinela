import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { isCompatibleReplacement, parseExpiry } from "./audit-rules.ts";
import { readAll } from "./read-all.ts";

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
  // Reglas de dominio preliminares basadas en columnas y restricciones observadas.
  const alveoli = dataByTable.get("pulmon_alveolos") ?? [];
  const extinguisherInventory = dataByTable.get("Extintores") ?? [];
  const inventoryById = new Map(extinguisherInventory.map(r => [String(r.id), r]));
  const assignedSlots = new Map<string, Row[]>();
  for (const slot of alveoli) {
    const activeId = slot.activo_extintor_id;
    const state = String(slot.estado ?? "").trim().toLowerCase();
    const hasAsset = activeId !== null && activeId !== undefined && String(activeId).trim() !== "";
    if ((state === "ocupado" && !hasAsset) || (state === "libre" && hasAsset)) {
      findings.push({ severity: "media", code: "PULMON_SLOT_STATE_MISMATCH", table: "pulmon_alveolos", title: "Estado del alvéolo no coincide con su asignación", count: 1, examples: [{ id: slot.id, codigo: slot.codigo, estado: slot.estado, activo_extintor_id: activeId ?? null }], detail: "Un alvéolo ocupado debería tener extintor asignado y uno libre no debería conservar una asignación." });
    }
    if (hasAsset) {
      const k = String(activeId);
      assignedSlots.set(k, [...(assignedSlots.get(k) ?? []), slot]);
      const inventoryAsset = inventoryById.get(k);
      if (!inventoryAsset) findings.push({ severity: "alta", code: "PULMON_ASSET_NOT_IN_EXTINGUISHERS", table: "pulmon_alveolos", title: "Extintor asignado al Pulmón no aparece en inventario Extintores", count: 1, examples: [{ alveolo_id: slot.id, activo_extintor_id: activeId }] });
      else if (String(inventoryAsset.alveolo_id ?? "") !== String(slot.id)) findings.push({ severity: "media", code: "PULMON_ALVEOLUS_LINK_MISMATCH", table: "pulmon_alveolos", title: "Vínculo de alvéolo no coincide entre tablas", count: 1, examples: [{ alveolo_id: slot.id, inventario_alveolo_id: inventoryAsset.alveolo_id, activo_extintor_id: activeId }] });
    }
  }
  for (const [assetId, slots] of assignedSlots) if (slots.length > 1) findings.push({ severity: "alta", code: "PULMON_ASSET_ASSIGNED_MULTIPLE_SLOTS", table: "pulmon_alveolos", title: "Un extintor está asignado a más de un alvéolo", count: slots.length, examples: [{ activo_extintor_id: assetId, alveolos: slots.slice(0, 5).map(s => ({ id: s.id, codigo: s.codigo })) }] });

  // Vencimientos del Pulmón: la columna heredada es texto, pero el perfil actual mostró MM/YYYY y un caso MM/YY.
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const asset of extinguisherInventory) {
    if (asset.alveolo_id == null || String(asset.alveolo_id).trim() === "") continue;
    const raw = String(asset.Vencimiento ?? "").trim();
    const parsedExpiry = parseExpiry(raw);
    if (!parsedExpiry) {
      findings.push({ severity: "alta", code: "PULMON_EXPIRY_MISSING_OR_UNPARSEABLE", table: "Extintores", field: "Vencimiento", title: "Vencimiento de extintor del Pulmón ausente o no interpretable", count: 1, examples: [{ id: asset.id, alveolo_id: asset.alveolo_id, vencimiento: raw || null }] });
      continue;
    }
    const { month, year } = parsedExpiry;
    const expiryUtc = Date.UTC(year, month, 0);
    const daysLeft = Math.floor((expiryUtc - todayUtc) / 86400000);
    if (daysLeft < 0) findings.push({ severity: "alta", code: "PULMON_EXTINGUISHER_EXPIRED", table: "Extintores", field: "Vencimiento", title: "Extintor del Pulmón vencido", count: 1, examples: [{ id: asset.id, alveolo_id: asset.alveolo_id, vencimiento: raw, dias_desde_vencimiento: Math.abs(daysLeft) }] });
    else if (year === now.getUTCFullYear() && month === now.getUTCMonth() + 1) findings.push({ severity: "alta", code: "PULMON_EXPIRY_IN_CURRENT_MONTH", table: "Extintores", field: "Vencimiento", title: "Extintor del Pulmón vence durante el mes actual", count: 1, examples: [{ id: asset.id, alveolo_id: asset.alveolo_id, vencimiento: raw, dias_hasta_fin_vigencia: daysLeft }] });
    else if (daysLeft <= 30) findings.push({ severity: "alta", code: "PULMON_EXPIRY_WITHIN_30_DAYS", table: "Extintores", field: "Vencimiento", title: "Extintor del Pulmón vence dentro de 30 días", count: 1, examples: [{ id: asset.id, alveolo_id: asset.alveolo_id, vencimiento: raw, dias_hasta_fin_vigencia: daysLeft }] });
  }

  const replacements = dataByTable.get("reemplazos_temporales_extintores") ?? [];
  const activeByTitular = new Map<string, Row[]>();
  for (const replacement of replacements) {
    const isActive = String(replacement.estado ?? "").trim().toLowerCase() === "activo";
    if (!isActive) continue;
    const titularId = String(replacement.activo_titular_id ?? "");
    activeByTitular.set(titularId, [...(activeByTitular.get(titularId) ?? []), replacement]);
    if (replacement.fecha_fin != null && String(replacement.fecha_fin).trim() !== "") findings.push({ severity: "media", code: "ACTIVE_REPLACEMENT_HAS_END_DATE", table: "reemplazos_temporales_extintores", title: "Reemplazo activo con fecha de fin cargada", count: 1, examples: [{ id: replacement.id, fecha_fin: replacement.fecha_fin }] });
    const rule = isCompatibleReplacement(replacement.tipo_titular, replacement.tipo_reemplazo);
    if (rule === false) findings.push({ severity: "alta", code: "INCOMPATIBLE_EXTINGUISHER_REPLACEMENT_TYPE", table: "reemplazos_temporales_extintores", title: "Tipo de reemplazo posiblemente incompatible", count: 1, examples: [{ id: replacement.id, titular: replacement.tipo_titular, reemplazo: replacement.tipo_reemplazo }] });
    if (rule === null) findings.push({ severity: "informativa", code: "REPLACEMENT_TYPE_REQUIRES_REVIEW", table: "reemplazos_temporales_extintores", title: "Tipo de extintor no reconocido por la matriz de compatibilidad", count: 1, examples: [{ id: replacement.id, titular: replacement.tipo_titular, reemplazo: replacement.tipo_reemplazo }] });
  }
  for (const [titularId, rows] of activeByTitular) if (titularId && rows.length > 1) findings.push({ severity: "alta", code: "MULTIPLE_ACTIVE_REPLACEMENTS_PER_TITULAR", table: "reemplazos_temporales_extintores", title: "Un titular tiene más de un reemplazo temporal activo", count: rows.length, examples: rows.slice(0, 5).map(r => ({ id: r.id, activo_titular_id: titularId, activo_reemplazo_id: r.activo_reemplazo_id })) });

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
