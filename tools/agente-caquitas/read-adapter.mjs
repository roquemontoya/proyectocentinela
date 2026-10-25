/**
 * Cliente del endpoint seguro de lectura. No conoce claves de Supabase.
 * Solo acepta snapshots de auditoría con el contrato esperado.
 */
export async function fetchAuditSnapshot({ endpoint, token, fetchImpl = fetch } = {}) {
  if (!endpoint || !token) throw new TypeError('endpoint y token son obligatorios.');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new TypeError('El endpoint debe usar HTTPS (salvo localhost de pruebas).');
  }

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: 'AGENTE-CAQUITAS-001',
      mayordomo_id: 'EL_MAYORDOMO_001',
      task_id: 'auditoria-extintores'
    })
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Acceso denegado por el servicio de lectura.');
  }
  if (!response.ok) throw new Error(`Servicio de lectura respondió HTTP ${response.status}.`);

  const data = await response.json();
  if (!data || data.agent_id !== 'AGENTE-CAQUITAS-001' ||
      data.mayordomo_id !== 'EL_MAYORDOMO_001' ||
      !Array.isArray(data.extintores) ||
      !Array.isArray(data.trazabilidad) ||
      !Array.isArray(data.alveolos)) {
    throw new TypeError('Respuesta inválida: no cumple el contrato de snapshot.');
  }
  return {
    extintores: data.extintores,
    trazabilidad: data.trazabilidad,
    alveolos: data.alveolos,
    fetched_at: data.fetched_at
  };
}
