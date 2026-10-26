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
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

type Row = Record<string, unknown>;

async function readAll(baseUrl: string, key: string, table: string, select: string, order: string): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`/rest/v1/${table}`, baseUrl);
    url.searchParams.set("select", select);
    url.searchParams.set("order", order);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, { headers: { apikey: key, Accept: "application/json" } });
    if (!response.ok) {
      console.error("audit_report_read_failed", table, response.status, (await response.text()).slice(0, 200));
      throw new Error(`read_failed:${table}:${response.status}`);
    }
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`invalid_response:${table}`);
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function blank(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}
function normalized(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}
function duplicateGroups(rows: Row[], field: string) {
  const counts = new Map<string, Row[]>();
  for (const row of rows) {
    const value = String(row[field] ?? "").trim();
    if (!value) continue;
    const key = value.toUpperCase();
    const group = counts.get(key) ?? [];
    group.push(row);
    counts.set(key, group);
  }
  return [...counts.entries()].filter(([, group]) => group.length > 1).map(([value, group]) => ({
    value, count: group.length, ids: group.slice(0, 10).map(r => r.id ?? r.id_activo ?? null),
  }));
}
function finding(severity: string, code: string, title: string, count: number, detail: string, examples: unknown[] = []) {
  return { severity, code, title, count, detail, examples: examples.slice(0, 10) };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const expectedToken = Deno.env.get("AGENTE_CAQ_AUDIT_TOKEN") ?? "";
  const suppliedToken = req.headers.get("x-agent-token") ?? "";
  if (!expectedToken) return json(503, { error: "agent_token_not_configured" });
  if (!suppliedToken || !constantTimeEqual(suppliedToken, expectedToken)) return json(401, { error: "unauthorized" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  if (body.agent_id !== "AGENTE-CAQUITAS-001" ||
      body.mayordomo_id !== "EL_MAYORDOMO_001" ||
      body.task_id !== "auditoria-extintores-resumen") {
    return json(400, { error: "task_not_allowed" });
  }

  // Reutiliza la función de lectura ya verificada; evita una segunda ruta de credenciales a PostgREST.
  const baseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!baseUrl) return json(503, { error: "supabase_url_not_configured" });

  let sourceData: Record<string, unknown>;
  try {
    const upstream = await fetch(new URL("/functions/v1/agente-caquitas-audit-read", baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-agent-token": expectedToken },
      body: JSON.stringify({
        agent_id: "AGENTE-CAQUITAS-001",
        mayordomo_id: "EL_MAYORDOMO_001",
        task_id: "auditoria-extintores",
      }),
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 300);
      console.error("audit_source_function_failed", upstream.status, detail);
      return json(502, { error: "audit_source_function_failed", upstream_status: upstream.status });
    }
    sourceData = await upstream.json();
  } catch (error) {
    console.error("audit_source_function_unreachable", error instanceof Error ? error.message : "unknown");
    return json(502, { error: "audit_source_function_unreachable" });
  }

  const extintores = Array.isArray(sourceData.extintores) ? sourceData.extintores as Row[] : [];
  const trazabilidad = Array.isArray(sourceData.trazabilidad) ? sourceData.trazabilidad as Row[] : [];
  const alveolos = Array.isArray(sourceData.alveolos) ? sourceData.alveolos as Row[] : [];
  // Una tabla legítimamente vacía es un resultado válido. Solo se considera
  // incompleto el payload si faltan los contenedores o los metadatos de origen.
  if (
    !sourceData.counts ||\n    typeof sourceData.counts !== "object" ||\n    Array.isArray(sourceData.counts) ||
    !Array.isArray(sourceData.extintores) ||
    !Array.isArray(sourceData.trazabilidad) ||
    !Array.isArray(sourceData.alveolos) ||
    sourceData.agent_id !== "AGENTE-CAQUITAS-001" ||
    sourceData.task_id !== "auditoria-extintores"
  ) {
    console.error("audit_source_payload_incomplete", {
      hasCounts: Boolean(sourceData.counts),
      extintoresIsArray: Array.isArray(sourceData.extintores),
      trazabilidadIsArray: Array.isArray(sourceData.trazabilidad),
      alveolosIsArray: Array.isArray(sourceData.alveolos),
      hasExpectedAgent: sourceData.agent_id === "AGENTE-CAQUITAS-001",
      hasExpectedTask: sourceData.task_id === "auditoria-extintores",
    });
    return json(502, { error: "audit_source_payload_incomplete" });
  }

  try {
    const findings: ReturnType<typeof finding>[] = [];
    const dupSeries = duplicateGroups(extintores, "numero_serie");
    const dupCards = duplicateGroups(extintores, "numero_tarjeta");
    if (dupSeries.length) findings.push(finding("alta", "EXT_SERIE_DUPLICADA", "Números de serie duplicados en Extintores",
      dupSeries.reduce((n, x) => n + x.count, 0), "Verificar identidad física; no corregir automáticamente.", dupSeries));
    if (dupCards.length) findings.push(finding("alta", "EXT_TARJETA_DUPLICADA", "Números de tarjeta duplicados en Extintores",
      dupCards.reduce((n, x) => n + x.count, 0), "Verificar tarjetas repetidas antes de cualquier corrección.", dupCards));

    const missingSeries = extintores.filter(r => blank(r.numero_serie));
    const missingCards = extintores.filter(r => blank(r.numero_tarjeta));
    const missingLocation = extintores.filter(r => blank(r.UBICACION));
    const missingExpiry = extintores.filter(r => blank(r.Vencimiento));
    const invalidExpiry = extintores.filter(r => !blank(r.Vencimiento) && !/^(0[1-9]|1[0-2])\/(20\d{2}|\d{2})$/.test(String(r.Vencimiento).trim()));
    const missingPH = extintores.filter(r => blank(r.PH));
    const invalidType = extintores.filter(r => !["PQS", "CO2", "HALON", "K"].includes(normalized(r.TIPO)));

    if (missingSeries.length) findings.push(finding("media", "EXT_SERIE_FALTANTE", "Extintores sin número de serie", missingSeries.length, "Confirmar si el activo debe tener serie; no inventar valores.", missingSeries.map(r => ({id:r.id, ubicacion:r.UBICACION, etiqueta:r.ETIQUETA}))));
    if (missingCards.length) findings.push(finding("media", "EXT_TARJETA_FALTANTE", "Extintores sin número de tarjeta", missingCards.length, "Confirmar si corresponde exigir tarjeta.", missingCards.map(r => ({id:r.id, ubicacion:r.UBICACION, etiqueta:r.ETIQUETA}))));
    if (missingLocation.length) findings.push(finding("alta", "EXT_UBICACION_FALTANTE", "Extintores sin ubicación", missingLocation.length, "La ubicación es necesaria para localizar el activo.", missingLocation.map(r => ({id:r.id, etiqueta:r.ETIQUETA}))));
    if (missingExpiry.length) findings.push(finding("alta", "EXT_VENCIMIENTO_FALTANTE", "Extintores sin vencimiento", missingExpiry.length, "Validar contra el registro de mantenimiento.", missingExpiry.map(r => ({id:r.id, ubicacion:r.UBICACION, serie:r.numero_serie}))));
    if (invalidExpiry.length) findings.push(finding("media", "EXT_VENCIMIENTO_FORMATO", "Vencimientos con formato no estándar", invalidExpiry.length, "Regla preliminar acepta MM/AAAA o MM/AA; verificar y normalizar solo con fuente confirmada.", invalidExpiry.map(r => ({id:r.id, ubicacion:r.UBICACION, vencimiento:r.Vencimiento}))));
    if (missingPH.length) findings.push(finding("media", "EXT_PH_FALTANTE", "Extintores sin año de prueba hidráulica", missingPH.length, "Confirmar el dato en documentación de mantenimiento.", missingPH.map(r => ({id:r.id, ubicacion:r.UBICACION, serie:r.numero_serie, vencimiento:r.Vencimiento}))));
    if (invalidType.length) findings.push(finding("media", "EXT_TIPO_CATALOGO", "Tipos fuera del catálogo preliminar", invalidType.length, "Validar catálogo autorizado antes de reclasificar.", invalidType.map(r => ({id:r.id, tipo:r.TIPO, ubicacion:r.UBICACION}))));

    const traceMissingSeries = trazabilidad.filter(r => blank(r.numero_serie));
    const traceMissingCards = trazabilidad.filter(r => blank(r.numero_tarjeta));
    const traceMissingLocation = trazabilidad.filter(r => blank(r.ubicacion_operativa));
    const tracePendingLocation = trazabilidad.filter(r => normalized(r.estado_ubicacion) === "PENDIENTE_VERIFICACION");
    const tracePendingOperational = trazabilidad.filter(r => normalized(r.estado_operativo) === "PENDIENTE_RELEVAMIENTO");
    const traceDuplicateIds = duplicateGroups(trazabilidad, "id_activo");
    if (traceMissingSeries.length || traceMissingCards.length || traceMissingLocation.length) {
      findings.push(finding("alta", "TRAZABILIDAD_DATOS_INCOMPLETOS", "Trazabilidad con identificadores o ubicación faltantes",
        Math.max(traceMissingSeries.length, traceMissingCards.length, traceMissingLocation.length),
        "Los conteos por campo se informan por separado; registros históricos requieren revisión antes de vincularlos.",
        [{campo:"numero_serie", faltantes:traceMissingSeries.length},{campo:"numero_tarjeta", faltantes:traceMissingCards.length},{campo:"ubicacion_operativa", faltantes:traceMissingLocation.length},
          ...trazabilidad.filter(r => blank(r.numero_serie) || blank(r.numero_tarjeta) || blank(r.ubicacion_operativa)).slice(0,8).map(r=>({id_activo:r.id_activo, estado_ubicacion:r.estado_ubicacion, estado_operativo:r.estado_operativo}))]));
    }
    if (tracePendingLocation.length) findings.push(finding("informativa", "TRAZABILIDAD_PENDIENTE_UBICACION", "Registros pendientes de verificación de ubicación", tracePendingLocation.length, "Pendiente no implica error: confirmar si estos registros están en una cola de relevamiento."));
    if (tracePendingOperational.length) findings.push(finding("informativa", "TRAZABILIDAD_PENDIENTE_RELEVAMIENTO", "Registros pendientes de relevamiento operativo", tracePendingOperational.length, "Pendiente no implica error: confirmar proceso operativo esperado."));
    if (traceDuplicateIds.length) findings.push(finding("media", "TRAZABILIDAD_ID_DUPLICADO", "Identificadores repetidos en trazabilidad", traceDuplicateIds.length, "Confirmar si id_activo representa un activo único o admite múltiples eventos históricos.", traceDuplicateIds));

    const missingAlveoloCode = alveolos.filter(r => blank(r.codigo));
    const missingAlveoloState = alveolos.filter(r => blank(r.estado));
    const unassignedAlveolos = alveolos.filter(r => blank(r.activo_extintor_id));
    const duplicateCodes = duplicateGroups(alveolos, "codigo");
    const duplicateAssignedAssets = duplicateGroups(alveolos, "activo_extintor_id");
    const extById = new Map(extintores.map(r => [String(r.id), r]));
    const alveoloById = new Map(alveolos.map(r => [String(r.id), r]));
    const alveoloBadRef = alveolos.filter(r => !blank(r.activo_extintor_id) && !extById.has(String(r.activo_extintor_id)));
    const extBadRef = extintores.filter(r => !blank(r.alveolo_id) && !alveoloById.has(String(r.alveolo_id)));
    const mismatchedAssignment = extintores.filter(r => !blank(r.alveolo_id) && alveoloById.has(String(r.alveolo_id)) &&
      !blank(alveoloById.get(String(r.alveolo_id))?.activo_extintor_id) &&
      String(alveoloById.get(String(r.alveolo_id))?.activo_extintor_id) !== String(r.id));

    if (missingAlveoloCode.length) findings.push(finding("media", "ALV_CODIGO_FALTANTE", "Alvéolos sin código", missingAlveoloCode.length, "Verificar nomenclatura del Pulmón."));
    if (missingAlveoloState.length) findings.push(finding("media", "ALV_ESTADO_FALTANTE", "Alvéolos sin estado", missingAlveoloState.length, "Verificar estado operativo del alveolo."));
    if (unassignedAlveolos.length) findings.push(finding("informativa", "ALV_SIN_ASIGNACION", "Alvéolos sin extintor asignado", unassignedAlveolos.length, "Puede ser normal si el alveolo está disponible.", unassignedAlveolos.slice(0,10).map(r=>({id:r.id,codigo:r.codigo,estado:r.estado}))));
    if (duplicateCodes.length) findings.push(finding("alta", "ALV_CODIGO_DUPLICADO", "Códigos de alvéolo duplicados", duplicateCodes.length, "Los códigos deberían identificar alvéolos de forma inequívoca.", duplicateCodes));
    if (duplicateAssignedAssets.length) findings.push(finding("alta", "ALV_EXTINTOR_MULTIPLE", "Extintores asignados a varios alvéolos", duplicateAssignedAssets.length, "Revisar asignación física.", duplicateAssignedAssets));
    if (alveoloBadRef.length) findings.push(finding("alta", "ALV_REFERENCIA_ROTA", "Alvéolos apuntan a extintores inexistentes", alveoloBadRef.length, "La referencia no encuentra coincidencia con Extintores.id.", alveoloBadRef.slice(0,10).map(r=>({id:r.id,codigo:r.codigo,activo_extintor_id:r.activo_extintor_id}))));
    if (extBadRef.length) findings.push(finding("alta", "EXT_ALV_REFERENCIA_ROTA", "Extintores apuntan a alvéolos inexistentes", extBadRef.length, "La referencia no encuentra coincidencia con pulmon_alveolos.id.", extBadRef.slice(0,10).map(r=>({id:r.id,ubicacion:r.UBICACION,alveolo_id:r.alveolo_id}))));
    if (mismatchedAssignment.length) findings.push(finding("alta", "ALV_ASIGNACION_NO_COINCIDE", "Asignación del extintor no coincide entre tablas", mismatchedAssignment.length, "Extintores.alveolo_id y pulmon_alveolos.activo_extintor_id no coinciden.", mismatchedAssignment.slice(0,10).map(r=>({id:r.id,ubicacion:r.UBICACION,alveolo_id:r.alveolo_id,alveolo_activo:alveoloById.get(String(r.alveolo_id))?.activo_extintor_id}))));

    // Deliberately do not compare trazabilidad.id_activo to Extintores.id or activo_leu_id:
    // identifier semantics have not yet been confirmed.
    const severityRank: Record<string, number> = { alta: 0, media: 1, informativa: 2 };
    findings.sort((a,b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) || a.code.localeCompare(b.code));

    const reportPayload = {
      agent_id: "AGENTE-CAQUITAS-001",
      mayordomo_id: "EL_MAYORDOMO_001",
      task_id: "auditoria-extintores-resumen",
      generated_at: new Date().toISOString(),
      access_method: "supabase_data_api",
      mode: "read_only_audit_rules_v1",
      read_only: true,
      counts: { extintores: extintores.length, trazabilidad: trazabilidad.length, alveolos: alveolos.length },
      summary: {
        findings_total: findings.length,
        alta: findings.filter(f=>f.severity==="alta").length,
        media: findings.filter(f=>f.severity==="media").length,
        informativa: findings.filter(f=>f.severity==="informativa").length,
        records_with_examples_limited: true,
      },
      data_quality_details: {
        trazabilidad: {
          total: trazabilidad.length,
          faltan_numero_serie: traceMissingSeries.length,
          faltan_numero_tarjeta: traceMissingCards.length,
          faltan_ubicacion_operativa: traceMissingLocation.length,
          estado_ubicacion_pendiente: tracePendingLocation.length,
          estado_operativo_pendiente: tracePendingOperational.length,
          muestra_registros: trazabilidad
            .filter(r => blank(r.numero_serie) || blank(r.numero_tarjeta) || blank(r.ubicacion_operativa))
            .slice(0, 10)
            .map(r => ({
              id_activo: r.id_activo ?? null,
              numero_serie: r.numero_serie ?? null,
              numero_tarjeta: r.numero_tarjeta ?? null,
              ubicacion_operativa: r.ubicacion_operativa ?? null,
              estado_ubicacion: r.estado_ubicacion ?? null,
              estado_operativo: r.estado_operativo ?? null,
              fecha_ultima_verificacion: r.fecha_ultima_verificacion ?? null
            }))
        },
        extintores_sin_ph: missingPH.slice(0, 10).map(r => ({
          id: r.id ?? null,
          etiqueta: r.ETIQUETA ?? null,
          ubicacion: r.UBICACION ?? null,
          vencimiento: r.Vencimiento ?? null,
          numero_serie: r.numero_serie ?? null,
          numero_tarjeta: r.numero_tarjeta ?? null,
          PH: r.PH ?? null
        }))
      },
      caveats: [
        "Las reglas son preliminares y no actualizan datos.",
        "Los estados pendientes se informan, pero no se clasifican como error por sí solos.",
        "No se compara trazabilidad.id_activo con Extintores.id ni activo_leu_id hasta confirmar la semántica de esos identificadores.",
        "Un vencimiento MM/AA se acepta como formato para revisión, no se normaliza automáticamente."
      ],
      findings,
    };

    // CSV opcional para guardar el informe en Excel; JSON sigue siendo el formato predeterminado.
    if ((new URL(req.url)).searchParams.get("format") === "csv") {
      const csvCell = (value: unknown) => {
        let raw = typeof value === "string" ? value : JSON.stringify(value ?? "");
        // Evita que valores de datos se interpreten como fórmulas al abrir CSV en Excel.
        if (/^[\\u0000-\\u0020]*[=+@-]/.test(raw)) raw = "'" + raw;
        return '"' + raw.replace(/"/g, '""') + '"';
      };
      const lines = [
        ["generated_at", "severity", "code", "title", "count", "detail", "examples_json"].map(csvCell).join(","),
        ...findings.map(f => [
          reportPayload.generated_at, f.severity, f.code, f.title, f.count, f.detail, f.examples
        ].map(csvCell).join(","))
      ];
      return new Response("\\uFEFF" + lines.join("\\r\\n"), {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="caquitas-auditoria-extintores.csv"',
        },
      });
    }
    return json(200, reportPayload);
  } catch (error) {
    console.error("audit_report_failed", error instanceof Error ? error.message : "unknown");
    return json(500, { error: "audit_report_failed" });
  }
});