import { clienteSupabase } from './supabaseClient.js';

const esc = v => String(v ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normal = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function tabla(titulo, columnas, filas) {
  return `<section style="margin:18px 0;padding:16px;background:#111827;border:1px solid #374151;border-radius:10px">
    <h3 style="margin:0 0 12px;color:#e5e7eb">${titulo} <small style="color:#9ca3af;font-weight:400">(${filas.length})</small></h3>
    <div style="overflow:auto"><table style="width:100%;border-collapse:collapse;min-width:620px"><thead><tr>${columnas.map(c=>`<th style="text-align:left;padding:9px;border-bottom:1px solid #475569;color:#93c5fd">${c.label}</th>`).join('')}</tr></thead>
    <tbody>${filas.length ? filas.map(f=>`<tr>${columnas.map(c=>`<td style="padding:9px;border-bottom:1px solid #263244;color:#e5e7eb">${esc(c.value(f))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${columnas.length}" style="padding:14px;color:#9ca3af">Sin registros disponibles o la tabla no devolvió datos.</td></tr>`}</tbody></table></div></section>`;
}
async function leer(tablaNombre, limite=500) {
  const {data,error}=await clienteSupabase.from(tablaNombre).select('*').limit(limite);
  if(error) return {data:[],error:error.message};
  return {data:data||[],error:null};
}
export async function cargarModuloReferente(contenedor) {
  contenedor.style.cssText += ';display:block;width:100%;max-width:1400px;margin:0 auto';
  contenedor.innerHTML='<section style="padding:22px;color:#e5e7eb"><h2>👨‍🚒 Bombero Referente</h2><p style="color:#9ca3af">Panel de consulta. Este perfil no debe registrar controles, modificar anomalías ni cambiar inventarios.</p><p>Cargando información…</p></section>';
  const nombres=['leu','Extintores','Bomberos','anomalias','controles_e','Controles_H','extintores_trazabilidad','movimientos_extintores','reemplazos_temporales_extintores'];
  const results=await Promise.all(nombres.map(async n=>[n,await leer(n)]));
  const data=Object.fromEntries(results);
  const activos=data.leu.data.filter(x=>normal(x.categoria).includes('extintor'));
  const pulmon=data.Extintores.data.filter(x=>normal(x.PRP).includes('pulmon'));
  const proveedor=data.Extintores.data.filter(x=>/bertolez|vertoles|recarga|proveedor/i.test(String(x.PRP||'')+' '+String(x.Referencia||'')+' '+String(x.Novedades||'')));
  const estado=x=>x.Estado||x.estado||x.PRP||x.estado_resolucion||'Sin estado informado';
  const etiqueta=x=>x.etiqueta||x.ETIQUETA||x.Etiqueta||x.id||'—';
  const fecha=x=>x.created_at||x.fecha_control||x.Fecha||x.fecha||x.reportado_fecha||'—';
  const cExt=tabla('🧯 Extintores en planta',[
    {label:'Activo',value:etiqueta},{label:'Sector',value:x=>x.sector},{label:'Estado',value:estado},{label:'Datos técnicos',value:x=>JSON.stringify(x.atributos_tecnicos||{}).slice(0,160)}
  ],activos);
  const cPul=tabla('📦 Pulmón / reserva',[
    {label:'Extintor',value:etiqueta},{label:'Tipo',value:x=>x.TIPO||x.TipoExtintor||x['Tipo de Extintor']},{label:'Vencimiento',value:x=>x.Vencimiento||x.vencimiento},{label:'Estado / ubicación',value:estado}
  ],pulmon);
  const cProv=tabla('🚚 En proveedor / recarga (según texto registrado)',[
    {label:'Extintor',value:etiqueta},{label:'Tipo',value:x=>x.TIPO||x.TipoExtintor},{label:'Vencimiento',value:x=>x.Vencimiento||x.vencimiento},{label:'Referencia / estado',value:x=>x.PRP||x.Referencia||x.Novedades}
  ],proveedor);
  const cBom=tabla('👥 Personal de Bomberos',[
    {label:'Bombero',value:x=>x.Bombero||x.nombre_completo||x.nombre},{label:'Estado',value:estado},{label:'Legajo',value:x=>x.Legajo||x.legajo}
  ],data.Bomberos.data);
  const cAnom=tabla('⚠️ Anomalías (consulta)',[
    {label:'ID / activo',value:x=>String(x.id)+' / '+String(x.id_activo||'—')},{label:'Anomalía',value:x=>x.anomalia_detectada||x.detalle_informe||x.observacion},{label:'Estado',value:estado},{label:'Fecha',value:fecha}
  ],data.anomalias.data);
  const cCtrl=tabla('📝 Controles realizados — controles_e',[
    {label:'ID',value:x=>x.id},{label:'Activo',value:x=>x.id_activo||x.idch||x.etiqueta},{label:'Fecha',value:fecha},{label:'Inspector',value:x=>x.realizado_por||x.bombero||x.Control_realizado_por},{label:'Resultado / observación',value:x=>x.estado||x.observacion||x.resultado}
  ],data.controles_e.data);
  const cHist=tabla('📚 Historial adicional — Controles_H',[
    {label:'ID',value:x=>x.id},{label:'Activo',value:x=>x.id_activo||x.idch||x.etiqueta},{label:'Fecha',value:fecha},{label:'Detalle',value:x=>x.observacion||x.detalle||x.estado}
  ],data.Controles_H.data);
  const warnings=results.filter(([n,r])=>r.error).map(([n,r])=>`<li><strong>${esc(n)}:</strong> ${esc(r.error)}</li>`).join('');
  contenedor.innerHTML=`<main style="padding:clamp(14px,3vw,26px);font-family:Arial,sans-serif;color:#e5e7eb">
    <header style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><h2 style="margin:0 0 5px">👨‍🚒 Bombero Referente</h2><p style="margin:0;color:#9ca3af">Vista de consulta · datos en vivo desde Supabase · sin botones de edición en este panel</p></div><button onclick="irInicio()" style="padding:9px 13px;background:#374151;color:white;border:1px solid #4b5563;border-radius:7px;cursor:pointer">← Volver</button></header>
    <div style="margin-top:16px;padding:12px;border:1px solid #365314;background:#1a2e05;border-radius:8px;color:#d9f99d">Este panel solo consulta datos. La información de proveedor se detecta por textos existentes y puede ser incompleta si el estado no está normalizado.</div>
    ${warnings?`<section style="margin-top:14px;padding:12px;border:1px solid #92400e;background:#451a03;border-radius:8px"><strong>Tablas que no pudieron consultarse:</strong><ul>${warnings}</ul></section>`:''}
    ${cExt}${cPul}${cProv}${cBom}${cAnom}${cCtrl}${cHist}
    <p style="font-size:12px;color:#9ca3af">Solo se muestran hasta 500 filas por tabla en esta primera vista de prueba. Las consultas fallidas se indican arriba; no se infiere que una tabla vacía signifique ausencia real de activos.</p>
  </main>`;
}
