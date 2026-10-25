import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAuditSnapshot } from './read-adapter.mjs';

const snapshot = {
  agent_id: 'AGENTE-CAQUITAS-001',
  mayordomo_id: 'EL_MAYORDOMO_001',
  extintores: [{ id: 1, ETIQUETA: 'E-1' }],
  trazabilidad: [{ id_activo: 1 }],
  alveolos: [],
  fetched_at: '2026-10-25T00:00:00.000Z'
};

test('envía petición POST autenticada e incluye identidades esperadas', async () => {
  let captured;
  const result = await fetchAuditSnapshot({
    endpoint: 'https://localhost/functions/v1/agente-caquitas-audit-read',
    token: 'test-token',
    fetchImpl: async (url, init) => {
      captured = { url: String(url), init };
      return new Response(JSON.stringify(snapshot), { status: 200 });
    }
  });
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers.authorization, 'Bearer test-token');
  assert.equal(JSON.parse(captured.init.body).mayordomo_id, 'EL_MAYORDOMO_001');
  assert.deepEqual(result.extintores, snapshot.extintores);
});

test('falla cerrado si el servicio rechaza la autenticación', async () => {
  await assert.rejects(() => fetchAuditSnapshot({
    endpoint: 'https://localhost/functions/v1/read',
    token: 'bad-token',
    fetchImpl: async () => new Response('denied', { status: 401 })
  }), /Acceso denegado/);
});

test('rechaza endpoint inseguro fuera de localhost', async () => {
  await assert.rejects(() => fetchAuditSnapshot({
    endpoint: 'http://example.com/read', token: 'x',
    fetchImpl: async () => { throw new Error('no debe invocarse'); }
  }), /HTTPS/);
});

test('rechaza respuestas incompletas o con identidad distinta', async () => {
  await assert.rejects(() => fetchAuditSnapshot({
    endpoint: 'https://localhost/read', token: 'x',
    fetchImpl: async () => new Response(JSON.stringify({ ...snapshot, agent_id: 'otro' }), { status: 200 })
  }), /contrato de snapshot/);
});

test('propaga errores HTTP del servicio sin intentar usar datos', async () => {
  await assert.rejects(() => fetchAuditSnapshot({
    endpoint: 'https://localhost/read', token: 'x',
    fetchImpl: async () => new Response('error', { status: 503 })
  }), /HTTP 503/);
});
