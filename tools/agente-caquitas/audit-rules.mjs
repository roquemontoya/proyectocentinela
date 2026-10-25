/**
 * Reglas deterministas iniciales para EL_MAYORDOMO_001.
 * Solo procesa snapshots ya suministrados por un adaptador de lectura.
 * No importa Supabase, no hace peticiones y no escribe datos.
 */
import { addCheck, createAuditReport } from './identity.mjs';

function value(row, key) {
  const v = row?.[key];
  return v === null || v === undefined ? '' : String(v).trim();
}

function duplicates(rows, key) {
  const seen = new Map();
  for (const row of rows ?? []) {
    const v = value(row, key);
    if (!v) continue;
    const normalized = v.toLocaleLowerCase('es-AR');
    seen.set(normalized, [...(seen.get(normalized) ?? []), row]);
  }
  return [...seen.entries()].filter(([, matches]) => matches.length > 1)
    .map(([normalized, matches]) => ({ value: normalized, count: matches.length }));
}

export function auditExtintores({ extintores = [], trazabilidad = [], alveolos = [] } = {}) {
  const reportFindings = [];
  const duplicateSerials = duplicates(extintores, 'numero_serie');
  const duplicateCards = duplicates(extintores, 'numero_tarjeta');
  const duplicateTraceIds = duplicates(trazabilidad, 'id_activo');
  const duplicateAlveoloAssets = duplicates(alveolos, 'activo_extintor_id');

  const missingLabels = extintores.filter(row => !value(row, 'ETIQUETA') && !value(row, 'ID'));
  const missingTrace = extintores.filter(row => {
    const id = value(row, 'id');
    return id && !trazabilidad.some(t => value(t, 'id_activo') === id);
  });

  const findings = [
    { id: 'EXT_DUPLICATE_SERIAL', count: duplicateSerials.length, status: duplicateSerials.length ? 'CHECK_REQUIRED' : 'PASS',
      summary: 'Números de serie duplicados entre extintores.', evidence: duplicateSerials },
    { id: 'EXT_DUPLICATE_CARD', count: duplicateCards.length, status: duplicateCards.length ? 'CHECK_REQUIRED' : 'PASS',
      summary: 'Números de tarjeta duplicados entre extintores.', evidence: duplicateCards },
    { id: 'EXT_MISSING_LABEL', count: missingLabels.length, status: missingLabels.length ? 'CHECK_REQUIRED' : 'PASS',
      summary: 'Extintores sin etiqueta ni identificador alternativo (ID).', evidence: missingLabels.map(r => ({ id: r.id })) },
    { id: 'EXT_MISSING_TRACE', count: missingTrace.length, status: missingTrace.length ? 'CHECK_REQUIRED' : 'PASS',
      summary: 'Extintores sin fila de trazabilidad asociada por id_activo.', evidence: missingTrace.map(r => ({ id: r.id })) },
    { id: 'TRACE_DUPLICATE_ASSET', count: duplicateTraceIds.length, status: duplicateTraceIds.length ? 'CHECK_REQUIRED' : 'PASS',
      summary: 'Más de una fila de trazabilidad para el mismo activo.', evidence: duplicateTraceIds },
    { id: 'PULMON_ASSET_IN_MULTIPLE_SLOTS', count: duplicateAlveoloAssets.length, status: duplicateAlveoloAssets.length ? 'CHECK_REQUIRED' : 'PASS',
      summary: 'Un mismo extintor aparece asignado a más de un alvéolo.', evidence: duplicateAlveoloAssets }
  ];

  for (const f of findings) {
    addCheck(reportFindings, f);
  }
  return reportFindings;
}
