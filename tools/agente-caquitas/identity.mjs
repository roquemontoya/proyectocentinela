/**
 * Identidad estable y contrato de auditoría para Agente-Caquitas.
 *
 * Este módulo no autentica al agente ni concede acceso a Supabase.
 * La identidad aquí declarada es metadata; el backend deberá autenticar
 * cada ejecución y aplicar permisos mínimos antes de consultar datos.
 */

export const AGENT_ID = 'AGENTE-CAQUITAS-001';
export const AGENT_NAME = 'Agente-Caquitas';
export const AGENT_VERSION = '0.1.0';
export const AGENT_MODE = 'read_only';

const ALLOWED_STATUSES = new Set(['PASS', 'CHECK_REQUIRED', 'ERROR']);

export function createAuditReport({ runId, startedAt = new Date().toISOString() } = {}) {
  if (!runId || typeof runId !== 'string') {
    throw new TypeError('runId es obligatorio para identificar la ejecución.');
  }

  return {
    agent_id: AGENT_ID,
    agent_name: AGENT_NAME,
    run_id: runId,
    started_at: startedAt,
    finished_at: null,
    agent_version: AGENT_VERSION,
    mode: AGENT_MODE,
    checks: [],
    errors: [],
    status: 'PASS'
  };
}

export function addCheck(report, { id, status, summary, evidence = null } = {}) {
  if (!report || report.agent_id !== AGENT_ID) {
    throw new TypeError('El informe no pertenece a Agente-Caquitas.');
  }
  if (!id || !ALLOWED_STATUSES.has(status) || !summary) {
    throw new TypeError('La comprobación requiere id, status válido y summary.');
  }

  report.checks.push({ id, status, summary, evidence });
  if (status === 'ERROR') report.status = 'ERROR';
  else if (status === 'CHECK_REQUIRED' && report.status !== 'ERROR') {
    report.status = 'CHECK_REQUIRED';
  }
  return report;
}

export function finishAuditReport(report, finishedAt = new Date().toISOString()) {
  if (!report || report.agent_id !== AGENT_ID) {
    throw new TypeError('El informe no pertenece a Agente-Caquitas.');
  }
  report.finished_at = finishedAt;
  return report;
}
