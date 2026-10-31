import { clienteSupabase } from './supabaseClient.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inp='width:100%;box-sizing:border-box;padding:8px;background:#111827;color:#fff;border:1px solid #475569;border-radius:5px';
const btn='padding:8px 11px;border:0;border-radius:5px;font-weight:600;cursor:pointer';
export async function renderizarAlveolosPulmon(contenedor){
 const [pm,pt]=await Promise.all([
  clienteSupabase.rpc('current_user_has_permission',{p_permission:'pulmon.manage'}),
  clienteSupabase.rpc('current_user_has_permission',{p_permission:'pulmon.update'})
 ]);
 const admin=pm.data===true||pt.data===true;
 const {data:alveolos,error}=await clienteSupabase.from('pulmon_alveolos').select('id,codigo,estado,activo_extintor_id,observaciones').order('id');
 if(error){contenedor.insertAdjacentHTML('beforeend',`<section style="color:#fecaca">No se pudieron cargar los alvéolos: ${esc(error.message)}</section>`);return;}
 const {data:stock,error:stockError}=await clienteSupabase.from('Extintores')
  .select('id,ETIQUETA,TIPO,PRP,Referencia,Novedades,alveolo_id,activo_leu_id,Vencimiento,PH,numero_serie,numero_tarjeta,capacidad_kg,marca')
  .in('PRP',['En Pulmon','En Pulmón']).order('id');
 if(stockError){contenedor.insertAdjacentHTML('beforeend',`<section style="color:#fecaca">No se pudo cargar el inventario: ${esc(stockError.message)}</section>`);return;}
 const equipos=stock||[],porId=new Map(equipos.map(e=>[Number(e.id),e]));
 const ocupados=(alveolos||[]).filter(a=>a.estado==='Ocupado').length;
 const libres=(alveolos||[]).filter(a=>a.estado==='Libre'&&!a.activo_extintor_id);
 const sinAlveolo=equipos.filter(e=>e.alveolo_id==null);
 const section=document.createElement('section');section.id='tablero-alveolos-pulmon';
 section.style.cssText='max-width:1100px;margin:28px auto;color:#fff;font-family:Arial,sans-serif';
 section.innerHTML=`
 <h2 style="color:#38bdf8;margin-bottom:6px">🫁 Alvéolos del Pulmón</h2>
 <p style="color:#bbb;margin-top:0">La ubicación se reutiliza; la identidad y el historial pertenecen al extintor. Los reemplazos se registran desde el flujo transaccional.</p>
 <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
 <span style="background:#166534;padding:7px 10px;border-radius:5px">Ocupados: ${ocupados}</span>
 <span style="background:#334155;padding:7px 10px;border-radius:5px">Libres: ${libres.length}</span>
 <span style="background:#475569;padding:7px 10px;border-radius:5px">Sin alvéolo: ${sinAlveolo.length}</span></div>
 <div style="display:flex;gap:10px;flex-wrap:wrap;margin:12px 0">
 <input id="filtro-alveolo" placeholder="Filtrar por número, etiqueta o tipo..." style="flex:1;min-width:220px;padding:10px;background:#222;color:#fff;border:1px solid #555;border-radius:5px">
 <select id="filtro-tipo-alveolo" style="padding:10px;background:#222;color:#fff;border:1px solid #555;border-radius:5px"><option value="">Todos los tipos</option><option>PQS</option><option>HALON</option><option>CO2</option><option>K</option></select>
 <select id="filtro-estado-alveolo" style="padding:10px;background:#222;color:#fff;border:1px solid #555;border-radius:5px"><option value="">Todos los estados</option><option value="Ocupado">Ocupados</option><option value="Libre">Libres</option></select></div>
 <div id="grid-alveolos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:8px">
 ${(alveolos||[]).map(a=>{
  const e=porId.get(Number(a.activo_extintor_id)),tipo=e?.TIPO||'—',et=e?.ETIQUETA||(e?'Equipo sin etiqueta':''),estado=a.estado||'Libre';
  const buscar=`${a.codigo} ${et} ${tipo} ${estado}`.toLowerCase();
  return `<article data-search="${esc(buscar)}" data-type="${esc(tipo.toUpperCase())}" data-state="${esc(estado)}" style="background:${estado==='Ocupado'?'#172a22':'#20252d'};border:1px solid ${estado==='Ocupado'?'#22c55e':'#475569'};border-radius:8px;padding:10px;min-width:0">
   <strong style="color:#7dd3fc">${esc(a.codigo)}</strong><div style="font-size:12px;margin:7px 0;color:${estado==='Ocupado'?'#86efac':'#94a3b8'}">${estado==='Ocupado'?'● OCUPADO':estado==='Libre'?'○ LIBRE':'⚠ FUERA DE SERVICIO'}</div>
   <div style="font-size:12px;min-height:32px;overflow-wrap:anywhere">${esc(et||'Sin equipo asignado')}</div>
   ${e?`<div style="font-size:12px;color:#7dd3fc;margin-top:4px">${esc(tipo)} · ID ${e.id}</div>`:''}
   ${admin?`<details style="margin-top:10px"><summary style="cursor:pointer;color:#93c5fd;font-size:12px">Administrar alvéolo</summary>
   <form data-alveolo-form="${a.id}" style="display:grid;gap:6px;margin-top:8px">
   <input name="codigo" maxlength="80" required value="${esc(a.codigo)}" aria-label="Código" style="${inp}">
   <input name="observaciones" value="${esc(a.observaciones||'')}" placeholder="Observaciones" style="${inp}">
   <button type="submit" style="${btn};background:#2563eb;color:white">Guardar</button>
   <button type="button" data-delete-alveolo="${a.id}" ${estado!=='Libre'||a.activo_extintor_id?'disabled':''} style="${btn};background:#7f1d1d;color:white;opacity:${estado!=='Libre'||a.activo_extintor_id?'.45':'1'}">Eliminar alvéolo</button></form></details>`:''}
  </article>`;
 }).join('')}</div>
 ${admin?`<section style="margin-top:24px;padding:16px;background:#172033;border:1px solid #334155;border-radius:9px">
 <h3 style="margin:0 0 12px;color:#bfdbfe">🛠️ Administración del inventario Pulmón</h3>
 <p style="color:#cbd5e1;font-size:13px">Para dar de alta un extintor debe existir previamente como activo de categoría extintor en LEU. El alta y la ocupación del alvéolo se realizan en una sola transacción.</p>
 <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px">
 <form id="form-nuevo-alveolo" style="display:grid;gap:8px;align-content:start"><strong>Crear alvéolo</strong>
 <input name="codigo" maxlength="80" required placeholder="Ej.: PULMÓN 421" style="${inp}">
 <input name="observaciones" placeholder="Observaciones (opcional)" style="${inp}">
 <button type="submit" style="${btn};background:#2563eb;color:white">Crear alvéolo libre</button></form>
 <form id="form-nuevo-extintor-pulmon" style="display:grid;gap:8px;align-content:start"><strong>Incorporar extintor al stock</strong>
 <input name="activo_leu_id" type="number" min="1" step="1" required placeholder="ID del activo extintor en LEU" style="${inp}">
 <input name="etiqueta" maxlength="180" required placeholder="Etiqueta del extintor" style="${inp}">
 <select name="tipo" required style="${inp}"><option value="">Tipo...</option><option>PQS</option><option>Halón</option><option>CO2</option><option>K</option></select>
 <input name="vencimiento" required placeholder="Vencimiento MM/AA (ej. 08/28)" pattern="^(0?[1-9]|1[0-2])[/\\-](\\d{2}|\\d{4})$" style="${inp}">
 <select name="alveolo_id" required style="${inp}"><option value="">Alvéolo libre...</option>${libres.map(a=>`<option value="${a.id}">${esc(a.codigo)}</option>`).join('')}</select>
 <input name="numero_serie" placeholder="Número de serie (opcional)" style="${inp}"><input name="numero_tarjeta" placeholder="Número de tarjeta (opcional)" style="${inp}">
 <input name="capacidad_kg" type="number" min="0.1" step="0.1" placeholder="Capacidad en kg" style="${inp}"><input name="marca" placeholder="Marca (opcional)" style="${inp}">
 <input name="ph" type="number" min="1900" max="2200" step="1" placeholder="Año prueba hidráulica (opcional)" style="${inp}">
 <button type="submit" style="${btn};background:#15803d;color:white" ${libres.length?'':'disabled'}>Dar de alta en Pulmón</button>
 ${libres.length?'':'<small style="color:#fbbf24">Primero creá un alvéolo libre.</small>'}</form></div>
 ${sinAlveolo.length?`<h4 style="margin:20px 0 8px;color:#fbbf24">Extintores del stock sin alvéolo</h4><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:500px"><thead><tr style="text-align:left;color:#94a3b8"><th style="padding:8px">Etiqueta</th><th>Tipo</th><th>Acción</th></tr></thead><tbody>
 ${sinAlveolo.map(e=>`<tr style="border-top:1px solid #475569"><td style="padding:8px">${esc(e.ETIQUETA)} · ${e.id}</td><td>${esc(e.TIPO)}</td><td><button type="button" data-delete-extintor="${e.id}" style="${btn};background:#7f1d1d;color:white">Eliminar</button></td></tr>`).join('')}</tbody></table></div>`:''}</section>`:''}`;
 contenedor.appendChild(section);
 const filtrar=()=>{const q=section.querySelector('#filtro-alveolo').value.toLowerCase(),t=section.querySelector('#filtro-tipo-alveolo').value.toUpperCase(),s=section.querySelector('#filtro-estado-alveolo').value;section.querySelectorAll('[data-search]').forEach(card=>card.style.display=card.dataset.search.includes(q)&&(!t||card.dataset.type===t)&&(!s||card.dataset.state===s)?'':'none');};
 section.querySelector('#filtro-alveolo').addEventListener('input',filtrar);
 section.querySelector('#filtro-tipo-alveolo').addEventListener('change',filtrar);
 section.querySelector('#filtro-estado-alveolo').addEventListener('change',filtrar);
 if(!admin)return;
 section.querySelector('#form-nuevo-alveolo')?.addEventListener('submit',async ev=>{
  ev.preventDefault();const f=ev.currentTarget,v=new FormData(f);
  const {data,error}=await clienteSupabase.rpc('crear_alveolo_pulmon',{p_codigo:String(v.get('codigo')||'').trim(),p_observaciones:String(v.get('observaciones')||'').trim()||null});
  if(error||!data?.ok)return alert('No se pudo crear el alvéolo: '+(error?.message||'sin confirmación'));
  alert(`Alvéolo ${data.codigo} creado.`);window.cargarModulo('pulmon');
 });
 section.querySelector('#form-nuevo-extintor-pulmon')?.addEventListener('submit',async ev=>{
  ev.preventDefault();const f=ev.currentTarget;if(!f.reportValidity())return;const v=new FormData(f),cap=String(v.get('capacidad_kg')||'').trim(),ph=String(v.get('ph')||'').trim();
  const {data,error}=await clienteSupabase.rpc('crear_extintor_stock_pulmon',{
   p_activo_leu_id:Number(v.get('activo_leu_id')),p_etiqueta:String(v.get('etiqueta')||'').trim(),p_tipo:String(v.get('tipo')||''),
   p_vencimiento:String(v.get('vencimiento')||'').trim(),p_alveolo_id:Number(v.get('alveolo_id')),
   p_numero_serie:String(v.get('numero_serie')||'').trim()||null,p_numero_tarjeta:String(v.get('numero_tarjeta')||'').trim()||null,
   p_capacidad_kg:cap?Number(cap):null,p_marca:String(v.get('marca')||'').trim()||null,p_ph:ph?Number(ph):null
  });
  if(error||!data?.ok)return alert('No se pudo incorporar el extintor: '+(error?.message||'sin confirmación'));
  alert(`Extintor incorporado. ID inventario: ${data.id}; alvéolo: ${data.alveolo_codigo}.`);window.cargarModulo('pulmon');
 });
 section.querySelectorAll('form[data-alveolo-form]').forEach(form=>form.addEventListener('submit',async ev=>{
  ev.preventDefault();const v=new FormData(form),id=Number(form.dataset.alveoloForm);
  const {data,error}=await clienteSupabase.from('pulmon_alveolos').update({codigo:String(v.get('codigo')||'').trim(),observaciones:String(v.get('observaciones')||'').trim()||null,actualizado_en:new Date().toISOString()}).eq('id',id).select('id').maybeSingle();
  if(error||!data)return alert('No se pudo actualizar el alvéolo: '+(error?.message||'sin confirmación'));
  alert('Alvéolo actualizado.');window.cargarModulo('pulmon');
 }));
 section.querySelectorAll('[data-delete-alveolo]').forEach(button=>button.addEventListener('click',async()=>{
  const id=Number(button.dataset.deleteAlveolo),a=(alveolos||[]).find(x=>x.id===id);
  if(!a||a.estado!=='Libre'||a.activo_extintor_id)return alert('Solo se puede eliminar un alvéolo libre y vacío.');
  if(!confirm(`¿Eliminar el alvéolo ${a.codigo}? Esta acción no se puede deshacer.`))return;
  const {data,error}=await clienteSupabase.from('pulmon_alveolos').delete().eq('id',id).select('id').maybeSingle();
  if(error||!data)return alert('No se pudo eliminar el alvéolo: '+(error?.message||'sin confirmación'));
  alert('Alvéolo eliminado.');window.cargarModulo('pulmon');
 }));
 section.querySelectorAll('[data-delete-extintor]').forEach(button=>button.addEventListener('click',async()=>{
  const id=Number(button.dataset.deleteExtintor),e=sinAlveolo.find(x=>x.id===id);
  if(!e||e.alveolo_id!=null)return alert('Solo se puede eliminar un extintor sin alvéolo asignado.');
  if(!confirm(`¿Eliminar ${e.ETIQUETA||id}? Solo se permite si no tiene ciclos ni movimientos históricos.`))return;
  const {data,error}=await clienteSupabase.from('Extintores').delete().eq('id',id).select('id').maybeSingle();
  if(error||!data)return alert('No se pudo eliminar: '+(error?.message||'tiene historial o ciclo asociado'));
  alert('Extintor eliminado.');window.cargarModulo('pulmon');
 }));
}
