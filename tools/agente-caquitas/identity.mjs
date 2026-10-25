/**
 * Identidad técnica de Agente-Caquitas y contrato de auditoría.
 * El mayordomo se identifica por separado en informes y tareas.
 * Este módulo no autentica al servicio ni concede acceso a Supabase.
 */
export const AGENT_ID = 'AGENTE-CAQUITAS-001';
export const AGENT_NAME = 'agente-caquitas';
export const AGENT_VERSION = '0.1.1';
export const AGENT_MODE = 'read_only';

export const MAYORDOMO_ID = 'EL_MAYORDOMO_001';
export const MAYORDOMO_NAME = 'EL_MAYORDOMO_001';

const ALLOWED_STATUSES = new Set(['PASS', 'CHECK_REQUIRED', 'ERROR']);

export function createAuditReport({ runId, taskId = null, startedAt = new Date().toISOString() } = {}) {
  if (!runId || typeof runId !== 'string') {
    throw new TypeError('runId es obligatorio para identificar la ejecución.');
  }
  return {
    agent_id: AGENT_ID,
    agent_name: AGENT_NAME,
    mayordomo_id: MAYORDOMO_ID,
    mayordomo_name: MAYORDOMO_NAME,
    run_id: runId,
    task_id: taskId,
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
  if (!report || report.agent_id !== AGENT_ID || report.mayordomo_id !== MAYORDOMO_ID) {
    throw new TypeError('El informe no pertenece a esta identidad de agente/mayordomo.');
  }
  if (!id || !ALLOWED_STATUSES.has(status) || !summary) {
    throw new TypeError('La comprobación requiere id, status válido y summary.');
  }
  report.checks.push({ id, status, summary, evidence });
  if (status === 'ERROR') report.status = 'ERROR';
  else if (status === 'CHECK_REQUIRED' && report.status !== 'ERROR') report.status = 'CHECK_REQUIRED';
  return report;
}

export function finishAuditReport(report, finishedAt = new Date().toISOString()) {
  if (!report || report.agent_id !== AGENT_ID || report.mayordomo_id !== MAYORDOMO_ID) {
    throw new TypeError('El informe no pertenece a esta identidad de agente/mayordomo.');
  }
  report.finished_at = finishedAt;
  return report;
}
