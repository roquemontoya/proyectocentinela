import { clienteSupabase } from './supabaseClient.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[ch]));

const pretty = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderReport(container, report) {
  const counts = report.counts || {};
  const summary = report.summary || {};
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const severityLabels = { alta: 'Alta', media: 'Media', informativa: 'Informativa' };
  const severityColors = { alta: '#b91c1c', media: '#b45309', informativa: '#475569' };

  const findingHtml = findings.map((item, index) => {
    const examples = Array.isArray(item.examples) ? item.examples : [];
    return `
      <details style="border:1px solid #374151;border-radius:10px;margin:10px 0;background:#171717;">
        <summary style="cursor:pointer;padding:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <span style="background:${severityColors[item.severity] || '#475569'};color:white;border-radius:5px;padding:3px 7px;font-size:12px;">${escapeHtml(severityLabels[item.severity] || item.severity)}</span>
          <strong>${escapeHtml(item.title || item.code)}</strong>
          <span style="margin-left:auto;font-weight:bold;">${escapeHtml(item.count)}</span>
        </summary>
        <div style="padding:0 14px 14px;">
          <p>${escapeHtml(item.detail || '')}</p>
          <p style="color:#94a3b8;font-size:12px;">Código: ${escapeHtml(item.code || '—')}</p>
          ${examples.length ? `<h4>Ejemplos y evidencia (máximo ${examples.length})</h4><pre style="white-space:pre-wrap;overflow-wrap:anywhere;background:#0b1220;padding:10px;border-radius:7px;font-size:12px;">${escapeHtml(JSON.stringify(examples, null, 2))}</pre>` : '<p style="color:#94a3b8;">No se adjuntaron ejemplos para este hallazgo.</p>'}
        </div>
      </details>`;
  }).join('');

  container.innerHTML = `
    <section style="max-width:1000px;margin:0 auto;padding:18px;color:var(--text-color,#e5e7eb);">
      <header style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <p style="margin:0;color:#38bdf8;font-size:12px;font-weight:bold;letter-spacing:.08em;">ASISTENTE DE AUDITORÍA · SOLO LECTURA</p>
          <h2 style="margin:5px 0;">Mayordomo_001</h2>
          <p style="color:#9ca3af;margin-top:0;">Auditoría de consistencia de Extintores, trazabilidad y alvéolos del Pulmón.</p>
        </div>
        <button type="button" id="mayordomo-refresh" style="padding:10px 14px;border-radius:8px;border:1px solid #0284c7;background:#075985;color:white;cursor:pointer;">Actualizar auditoría</button>
      </header>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:18px 0;">
        ${[['Extintores',counts.extintores],['Trazabilidad',counts.trazabilidad],['Alvéolos',counts.alveolos]].map(([label,value])=>`
          <div style="padding:14px;border:1px solid #374151;border-radius:10px;background:#1f2937;">
            <div style="font-size:12px;color:#9ca3af;">${label}</div><strong style="font-size:26px;">${escapeHtml(value ?? '—')}</strong>
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <span style="padding:7px 10px;background:#7f1d1d;border-radius:7px;">Alta: ${escapeHtml(summary.alta ?? 0)}</span>
        <span style="padding:7px 10px;background:#78350f;border-radius:7px;">Media: ${escapeHtml(summary.media ?? 0)}</span>
        <span style="padding:7px 10px;background:#334155;border-radius:7px;">Informativa: ${escapeHtml(summary.informativa ?? 0)}</span>
        <span style="padding:7px 10px;background:#1e293b;border:1px solid #475569;border-radius:7px;">Hallazgos: ${escapeHtml(summary.findings_total ?? findings.length)}</span>
      </div>
      <p style="font-size:12px;color:#9ca3af;">Generado: ${escapeHtml(report.generated_at || '—')} · Modo: ${escapeHtml(report.mode || '—')} · Solo lectura: ${report.read_only === true ? 'Sí' : 'No confirmado'}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 20px;">
        <button type="button" id="mayordomo-json" style="padding:9px 12px;border-radius:7px;border:1px solid #475569;background:#1f2937;color:#e5e7eb;cursor:pointer;">Exportar JSON</button>
        <button type="button" id="mayordomo-csv" style="padding:9px 12px;border-radius:7px;border:1px solid #475569;background:#1f2937;color:#e5e7eb;cursor:pointer;">Exportar hallazgos CSV</button>
      </div>
      <h3>Hallazgos de auditoría</h3>
      ${findingHtml || '<p>No se devolvieron hallazgos.</p>'}
      ${report.caveats?.length ? `<h3>Alcances y precauciones</h3><ul>${report.caveats.map(x=>`<li style="margin:6px 0;">${escapeHtml(x)}</li>`).join('')}</ul>` : ''}
      <p style="padding:12px;border:1px solid #365314;border-radius:8px;background:#1a2e05;color:#d9f99d;font-size:13px;">Este módulo no corrige datos ni registra movimientos. Los hallazgos requieren revisión humana antes de tomar decisiones operativas.</p>
    </section>`;

  container.querySelector('#mayordomo-refresh')?.addEventListener('click', () => cargarModuloMayordomo001(container));
  container.querySelector('#mayordomo-json')?.addEventListener('click', () => {
    downloadFile('mayordomo-001-auditoria.json', JSON.stringify(report, null, 2), 'application/json;charset=utf-8');
  });
  container.querySelector('#mayordomo-csv')?.addEventListener('click', () => {
    const fields = ['generated_at','severity','code','title','count','detail','examples'];
    const cell = (v) => '"' + String(typeof v === 'object' ? JSON.stringify(v ?? '') : (v ?? '')).replace(/"/g, '""') + '"';
    const lines = [fields.map(cell).join(',')];
    for (const f of findings) lines.push([report.generated_at, f.severity, f.code, f.title, f.count, f.detail, f.examples].map(cell).join(','));
    downloadFile('mayordomo-001-hallazgos.csv', '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  });
}

export async function cargarModuloMayordomo001(container) {
  if (!container) return;
  container.innerHTML = `
    <section style="max-width:900px;margin:40px auto;padding:24px;color:#e5e7eb;background:#171717;border:1px solid #374151;border-radius:12px;">
      <p style="color:#38bdf8;font-size:12px;font-weight:bold;">MAYORDOMO_001</p>
      <h2>Auditoría de solo lectura</h2>
      <p id="mayordomo-status">Consultando la auditoría segura…</p>
      <div style="height:5px;background:#374151;border-radius:5px;overflow:hidden;"><div style="width:45%;height:100%;background:#38bdf8;"></div></div>
    </section>`;
  try {
    const { data: sessionData, error: sessionError } = await clienteSupabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (sessionError || !accessToken) throw new Error('La sesión no está activa. Volvé a ingresar a Centinela.');
    const { data, error } = await clienteSupabase.functions.invoke('mayordomo-001-audit', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {}
    });
    if (error) {
      let message = error.message || 'No se pudo consultar el servicio de auditoría.';
      try {
        const context = error.context;
        if (context && typeof context.json === 'function') {
          const payload = await context.json();
          if (payload?.error === 'insufficient_role') message = 'Tu cuenta no tiene un rol autorizado para consultar esta auditoría.';
          else if (payload?.error === 'service_not_configured') message = 'El servicio de auditoría necesita configuración del administrador.';
          else if (payload?.error === 'audit_unavailable') message = 'El informe de auditoría no está disponible temporalmente.';
        }
      } catch { /* Mantener el mensaje seguro por defecto. */ }
      throw new Error(message);
    }
    if (!data || data.read_only !== true || !Array.isArray(data.findings)) {
      throw new Error('La respuesta del auditor no pasó la validación de formato y modo de solo lectura.');
    }
    renderReport(container, data);
  } catch (error) {
    container.innerHTML = `
      <section style="max-width:900px;margin:40px auto;padding:24px;color:#e5e7eb;background:#171717;border:1px solid #7f1d1d;border-radius:12px;">
        <p style="color:#38bdf8;font-size:12px;font-weight:bold;">MAYORDOMO_001 · SOLO LECTURA</p>
        <h2>No se pudo completar la auditoría</h2>
        <p role="alert" style="color:#fecaca;">${escapeHtml(error?.message || 'Error inesperado.')}</p>
        <button type="button" id="mayordomo-retry" style="padding:10px 14px;border-radius:8px;border:1px solid #0284c7;background:#075985;color:white;cursor:pointer;">Reintentar</button>
      </section>`;
    container.querySelector('#mayordomo-retry')?.addEventListener('click', () => cargarModuloMayordomo001(container));
    console.error('[Mayordomo_001] Falló la auditoría:', error);
  }
}
