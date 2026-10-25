import { clienteSupabase } from './supabaseClient.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function render(container, report) {
  const counts = report.counts || {}, summary = report.summary || {};
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const colors = { alta:'#991b1b', media:'#92400e', informativa:'#334155' };
  const cards = [['Extintores',counts.extintores],['Trazabilidad',counts.trazabilidad],['Alvéolos',counts.alveolos]]
    .map(([label,n]) => `<div style="padding:14px;border:1px solid #374151;border-radius:10px;background:#1f2937"><small style="color:#9ca3af">${label}</small><div style="font-size:26px;font-weight:700">${esc(n ?? '—')}</div></div>`).join('');
  const rows = findings.map(f => `<details style="border:1px solid #374151;border-radius:10px;margin:10px 0;background:#171717">
    <summary style="cursor:pointer;padding:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span style="background:${colors[f.severity] || '#334155'};color:white;border-radius:5px;padding:3px 7px;font-size:12px">${esc(f.severity || 'sin nivel')}</span>
      <strong>${esc(f.title || f.code)}</strong><b style="margin-left:auto">${esc(f.count ?? '—')}</b>
    </summary><div style="padding:0 14px 14px"><p>${esc(f.detail || '')}</p><small style="color:#94a3b8">Código: ${esc(f.code || '—')}</small>
    ${f.examples?.length ? `<pre style="white-space:pre-wrap;overflow-wrap:anywhere;background:#0b1220;padding:10px;border-radius:7px;font-size:12px">${esc(JSON.stringify(f.examples,null,2))}</pre>` : '<p style="color:#94a3b8">Sin ejemplos adjuntos.</p>'}</div></details>`).join('');
  container.innerHTML = `<section style="max-width:1000px;margin:0 auto;padding:18px;color:#e5e7eb">
    <header style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
      <div><p style="margin:0;color:#38bdf8;font-size:12px;font-weight:bold;letter-spacing:.08em">ASISTENTE DE AUDITORÍA · SOLO LECTURA</p>
      <h2 style="margin:5px 0">Mayordomo_001</h2><p style="color:#9ca3af;margin-top:0">Auditoría de Extintores, trazabilidad y alvéolos del Pulmón.</p></div>
      <button id="mayordomo-refresh" style="padding:10px 14px;border-radius:8px;border:1px solid #0284c7;background:#075985;color:white;cursor:pointer">Actualizar auditoría</button></header>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:18px 0">${cards}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <span style="padding:7px 10px;background:#7f1d1d;border-radius:7px">Alta: ${esc(summary.alta ?? 0)}</span>
      <span style="padding:7px 10px;background:#78350f;border-radius:7px">Media: ${esc(summary.media ?? 0)}</span>
      <span style="padding:7px 10px;background:#334155;border-radius:7px">Informativa: ${esc(summary.informativa ?? 0)}</span>
      <span style="padding:7px 10px;background:#1e293b;border:1px solid #475569;border-radius:7px">Hallazgos: ${esc(summary.findings_total ?? findings.length)}</span></div>
    <p style="font-size:12px;color:#9ca3af">Generado: ${esc(report.generated_at || '—')} · Solo lectura: ${report.read_only === true ? 'Sí' : 'No confirmado'}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 20px">
      <button id="mayordomo-json" style="padding:9px 12px;border-radius:7px;border:1px solid #475569;background:#1f2937;color:#e5e7eb;cursor:pointer">Exportar JSON</button>
      <button id="mayordomo-csv" style="padding:9px 12px;border-radius:7px;border:1px solid #475569;background:#1f2937;color:#e5e7eb;cursor:pointer">Exportar hallazgos CSV</button></div>
    <h3>Hallazgos de auditoría</h3>${rows || '<p>No se devolvieron hallazgos.</p>'}
    ${report.caveats?.length ? `<h3>Alcances y precauciones</h3><ul>${report.caveats.map(x=>`<li style="margin:6px 0">${esc(x)}</li>`).join('')}</ul>` : ''}
    <p style="padding:12px;border:1px solid #365314;border-radius:8px;background:#1a2e05;color:#d9f99d;font-size:13px">Este módulo no corrige datos ni registra movimientos. Revisar los hallazgos antes de decidir acciones operativas.</p></section>`;
  container.querySelector('#mayordomo-refresh')?.addEventListener('click',()=>cargarModuloMayordomo001(container));
  container.querySelector('#mayordomo-json')?.addEventListener('click',()=>download('mayordomo-001-auditoria.json',JSON.stringify(report,null,2),'application/json;charset=utf-8'));
  container.querySelector('#mayordomo-csv')?.addEventListener('click',()=>{
    const fields=['generated_at','severity','code','title','count','detail','examples'];
    const cell=v=>'"'+String(typeof v==='object'?JSON.stringify(v??''):(v??'')).replace(/"/g,'""')+'"';
    const lines=[fields.map(cell).join(','),...findings.map(f=>[report.generated_at,f.severity,f.code,f.title,f.count,f.detail,f.examples].map(cell).join(','))];
    download('mayordomo-001-hallazgos.csv','\uFEFF'+lines.join('\r\n'),'text/csv;charset=utf-8');
  });
}
export async function cargarModuloMayordomo001(container) {
  if (!container) return;
  container.innerHTML='<section style="max-width:900px;margin:40px auto;padding:24px;color:#e5e7eb;background:#171717;border:1px solid #374151;border-radius:12px"><p style="color:#38bdf8;font-size:12px;font-weight:bold">MAYORDOMO_001</p><h2>Auditoría de solo lectura</h2><p>Consultando la auditoría segura…</p></section>';
  try {
    const {data: sessionData,error: sessionError}=await clienteSupabase.auth.getSession();
    const token=sessionData?.session?.access_token;
    if(sessionError||!token) throw new Error('La sesión no está activa. Volvé a ingresar a Centinela.');
    const {data,error}=await clienteSupabase.functions.invoke('mayordomo-001-audit',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:{}});
    if(error) {
      let message='No se pudo consultar el servicio de auditoría.';
      try {
        const payload=await error.context?.json?.();
        if(payload?.error==='insufficient_role') message='Tu cuenta no tiene un rol autorizado para consultar esta auditoría.';
        else if(payload?.error==='service_not_configured') message='El servicio de auditoría necesita configuración del administrador.';
        else if(payload?.error==='audit_unavailable') message='El informe de auditoría no está disponible temporalmente.';
      } catch {}
      throw new Error(message);
    }
    if(!data||data.read_only!==true||!Array.isArray(data.findings)) throw new Error('La respuesta no pasó la validación de formato y modo de solo lectura.');
    render(container,data);
  } catch(error) {
    container.innerHTML=`<section style="max-width:900px;margin:40px auto;padding:24px;color:#e5e7eb;background:#171717;border:1px solid #7f1d1d;border-radius:12px"><p style="color:#38bdf8;font-size:12px;font-weight:bold">MAYORDOMO_001 · SOLO LECTURA</p><h2>No se pudo completar la auditoría</h2><p role="alert" style="color:#fecaca">${esc(error?.message||'Error inesperado.')}</p><button id="mayordomo-retry" style="padding:10px 14px;border-radius:8px;border:1px solid #0284c7;background:#075985;color:white;cursor:pointer">Reintentar</button></section>`;
    container.querySelector('#mayordomo-retry')?.addEventListener('click',()=>cargarModuloMayordomo001(container));
    console.error('[Mayordomo_001] Falló la auditoría:',error);
  }
}
