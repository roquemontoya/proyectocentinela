import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditReport, finishAuditReport } from './identity.mjs';
import { auditExtintores } from './audit-rules.mjs';

test('el informe identifica agente y mayordomo por separado', () => {
  const report = createAuditReport({ runId: 'test-run-001', taskId: 'auditoria-extintores' });
  assert.equal(report.agent_name, 'agente-caquitas');
  assert.equal(report.mayordomo_name, 'EL_MAYORDOMO_001');
  assert.equal(report.mode, 'read_only');
});

test('detecta duplicados y faltantes sin mutar las filas de entrada', () => {
  const extintores = [
    { id: 1, ETIQUETA: 'E-1', numero_serie: 'SN-1', numero_tarjeta: 'T-1' },
    { id: 2, ETIQUETA: 'E-2', numero_serie: 'sn-1', numero_tarjeta: 'T-2' },
    { id: 3, numero_serie: 'SN-3', numero_tarjeta: 'T-3' }
  ];
  const original = structuredClone(extintores);
  const checks = auditExtintores({
    extintores,
    trazabilidad: [{ id_activo: 1 }, { id_activo: 1 }],
    alveolos: [{ activo_extintor_id: 3 }, { activo_extintor_id: 3 }]
  });
  assert.deepEqual(extintores, original);
  assert.equal(checks.find(c => c.id === 'EXT_DUPLICATE_SERIAL').status, 'CHECK_REQUIRED');
  assert.equal(checks.find(c => c.id === 'EXT_MISSING_LABEL').evidence.length, 1);
  assert.equal(checks.find(c => c.id === 'EXT_MISSING_TRACE').evidence.length, 2);
  assert.equal(checks.find(c => c.id === 'TRACE_DUPLICATE_ASSET').evidence.length, 1);
  assert.equal(checks.find(c => c.id === 'PULMON_ASSET_IN_MULTIPLE_SLOTS').evidence.length, 1);
});

test('informe sano pasa todos los controles de integridad', () => {
  const checks = auditExtintores({
    extintores: [{ id: 10, ETIQUETA: 'E-10', numero_serie: 'S-10', numero_tarjeta: 'T-10' }],
    trazabilidad: [{ id_activo: 10 }],
    alveolos: [{ id: 1, activo_extintor_id: null }]
  });
  assert.ok(checks.every(c => c.status === 'PASS'));
  const report = createAuditReport({ runId: 'test-run-002' });
  report.checks = checks;
  finishAuditReport(report);
  assert.ok(report.finished_at);
});
