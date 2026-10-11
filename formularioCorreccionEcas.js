import { clienteSupabase } from './supabaseClient.js';

const CAMPOS = [
  ['ideca_original','Identificador original'],['nombreetiqueta','Nombre de etiqueta'],
  ['ubicacion','Ubicación'],['sector','Sector'],['central_que_reporta','Central que reporta'],
  ['estado','Estado'],['fecha_inspeccion_2025','Fecha inspección 2025'],['mes','Mes'],
  ['p_entrada','P/ENTRADA'],['p_salida','P/SALIDA'],['t_gong','T/GONG'],
  ['t_central','T central'],['t_monitoreo','T.monitoreo'],['rotulo_central','Rótulo central'],
  ['rotulo_base','Rótulo base'],['observaciones','Observaciones'],
  ['parametros_reporte','Parámetros / Reporte 2025'],['control_semana_n','Control semana N°'],
  ['control_s_realizado_por','Control S. realizado por'],['p_entrada_semanal','P/ Entrada semanal'],
  ['p_salida_semanal','P/ Salida semanal'],['status','STATUS'],['anomalias','ANOMALÍAS Sí/No'],
  ['evento_numero','Evento número'],['observacion','Observación'],['reportado_fecha','Reportado fecha'],
  ['reportado_mes','Reportado mes'],['reportado_por','Reportado por']
];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const estilo = 'width:100%;box-sizing:border-box;padding:9px;background:#242424;color:#fff;border:1px solid #555;border-radius:5px;';
let activos = [], controlActual = null;

export async function cargarFormularioCorreccionEcas(contenedor) {
  contenedor.style.cssText = 'padding:16px;box-sizing:border-box;min-height:100%;background:#121212;color:#eee;font-family:Arial,sans-serif;';
  contenedor.innerHTML = '<div style="max-width:1000px;margin:auto"><h2 style="color:#38bdf8">📝 Corrección directa de ECAS</h2><p style="color:#bbb">Edita los datos históricos y guárdalos en <code>controles_ecas</code>. No modifica LEU ni otros controles.</p><div id="ce-status">Cargando ECAS…</div><label for="ce-select">Seleccionar ECA</label><select id="ce-select" style="'+estilo+'margin:8px 0 16px"></select><div id="ce-meta" style="color:#aaa;margin-bottom:12px"></div><form id="ce-form"><div id="ce-fields" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px"></div><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><button type="submit" style="padding:11px 16px;background:#0284c7;color:white;border:0;border-radius:6px;font-weight:bold">Guardar en controles ECAS</button><button type="button" id="ce-reload" style="padding:11px 16px;background:#333;color:white;border:1px solid #555;border-radius:6px">Recargar datos</button></div></form></div>';
  const select = contenedor.querySelector('#ce-select'), status = contenedor.querySelector('#ce-status');
  const cargar = async () => {
    status.textContent = 'Buscando ECAS en LEU…';
    const {data,error} = await clienteSupabase.from('leu').select('id,etiqueta,categoria,sector,ubicacion_wkt,atributos_tecnicos').eq('categoria','ECAS').order('etiqueta');
    if (error) throw error;
    activos = data || [];
    select.innerHTML = '<option value="">— Selecciona una ECA —</option>' + activos.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.etiqueta||('ECA #'+a.id))+' · LEU '+a.id+'</option>').join('');
    status.textContent = activos.length+' ECAS encontradas en LEU.';
    contenedor.querySelector('#ce-fields').innerHTML = '';
    contenedor.querySelector('#ce-meta').textContent = '';
    controlActual = null;
  };
  const abrir = async () => {
    const activo = activos.find(a=>String(a.id)===select.value);
    const fields = contenedor.querySelector('#ce-fields');
    fields.innerHTML = ''; controlActual = null;
    if (!activo) { contenedor.querySelector('#ce-meta').textContent=''; return; }
    status.textContent = 'Buscando control existente…';
    const {data,error} = await clienteSupabase.from('controles_ecas').select('*').eq('id_activo',activo.id).order('id',{ascending:false}).limit(1);
    if (error) throw error;
    controlActual = data?.[0] || null;
    const attrs = activo.atributos_tecnicos?.atributos_originales || activo.atributos_tecnicos?.originales || activo.atributos_tecnicos || {};
    const getAttr = names => { const key=Object.keys(attrs||{}).find(k=>names.some(n=>k.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===n.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())); return key ? attrs[key] : null; };
    const csvToCol = {'ideca_original':['Nombre de etiqueta','Etiqueta','ECA'],'nombreetiqueta':['Nombre de etiqueta','Etiqueta'],'ubicacion':['Ubicación','Ubicacion'],'sector':['Sector'],'central_que_reporta':['Central que reporta','Central'],'estado':['Estado'],'fecha_inspeccion_2025':['Fecha Inspeccion 2025','Fecha Inspección 2025'],'mes':['Mes'],'p_entrada':['P/ENTRADA'],'p_salida':['P/SALIDA'],'t_gong':['T/GONG'],'t_central':['T central'],'t_monitoreo':['T.monitoreo','T monitoreo'],'rotulo_central':['ROTULO CENTRAL'],'rotulo_base':['ROTULO BASE'],'observaciones':['Observaciones'],'parametros_reporte':['Parametros / Reporte 2025','Parámetros / Reporte 2025'],'control_semana_n':['CONTROL SEMANA N°','CONTROL SEMANA Nº','CONTROL SEMANA'],'control_s_realizado_por':['Control S. realizado por'],'p_entrada_semanal':['P/ Entrada Semanal'],'p_salida_semanal':['P/ Salida Semanal'],'status':['STATUS'],'anomalias':['ANOMALIAS SI / NO','ANOMALIAS'],'evento_numero':['Evento Numero','Evento Número'],'observacion':['Observacion','Observación'],'reportado_fecha':['Reportado Fecha'],'reportado_mes':['Reportado Mes'],'reportado_por':['Reportado Por']};
    contenedor.querySelector('#ce-meta').textContent = 'Activo LEU #'+activo.id+' · '+(activo.sector||'Sector sin dato')+' · '+(controlActual ? 'Se editará el control existente #'+controlActual.id : 'No hay control previo: se creará uno nuevo.');
    for (const [col,label] of CAMPOS) {
      let value = controlActual?.[col];
      if (value === undefined || value === null || value === '') {
        if (col==='nombreetiqueta') value=activo.etiqueta;
        else if (col==='sector') value=activo.sector;
        else if (col==='ubicacion') value=getAttr(csvToCol[col]||[]) ?? activo.ubicacion_wkt;
        else value=getAttr(csvToCol[col]||[]);
      }
      const type = col==='control_semana_n' ? 'number' : (col==='fecha_inspeccion_2025'||col==='reportado_fecha' ? 'date' : 'text');
      fields.insertAdjacentHTML('beforeend','<div><label for="ce-'+col+'" style="display:block;font-size:13px;margin-bottom:5px">'+esc(label)+'</label><input id="ce-'+col+'" data-column="'+col+'" type="'+type+'" '+(col==='control_semana_n'?'min="1" max="53" step="1"':'')+' value="'+esc(value)+'" style="'+estilo+'"></div>');
    }
    status.textContent = 'Formulario listo. Verifica los datos antes de guardar.';
  };
  select.addEventListener('change',()=>abrir().catch(e=>{status.textContent='Error: '+e.message;}));
  contenedor.querySelector('#ce-reload').addEventListener('click',()=>cargar().catch(e=>{status.textContent='Error: '+e.message;}));
  contenedor.querySelector('#ce-form').addEventListener('submit',async ev=>{
    ev.preventDefault();
    const activo=activos.find(a=>String(a.id)===select.value);
    if (!activo) { status.textContent='Selecciona una ECA.'; return; }
    const payload={id_activo:activo.id,nombreetiqueta:activo.etiqueta||null,sector:activo.sector||null};
    for (const input of fieldsInputs()) {
      const col=input.dataset.column; let val=input.value.trim();
      if (val==='') val=null;
      if (col==='control_semana_n' && val!==null) {
        const n=Number(val); if(!Number.isInteger(n)||n<1||n>53){status.textContent='La semana debe ser un entero entre 1 y 53.';return;} val=n;
      }
      payload[col]=val;
    }
    const btn=contenedor.querySelector('button[type="submit"]'); btn.disabled=true; btn.textContent='Guardando…';
    try {
      let result;
      if (controlActual) result=await clienteSupabase.from('controles_ecas').update(payload).eq('id',controlActual.id).select('id').single();
      else result=await clienteSupabase.from('controles_ecas').insert(payload).select('id').single();
      if (result.error) throw result.error;
      status.textContent='Guardado correctamente en controles_ecas (registro #'+result.data.id+').';
      const {data,error}=await clienteSupabase.from('controles_ecas').select('*').eq('id_activo',activo.id).order('id',{ascending:false}).limit(1);
      if(error) throw error; controlActual=data?.[0]||null;
      contenedor.querySelector('#ce-meta').textContent='Activo LEU #'+activo.id+' · '+(controlActual?'Control existente #'+controlActual.id:'Sin control');
    } catch(e) { status.textContent='No se pudo guardar: '+e.message; }
    finally { btn.disabled=false; btn.textContent='Guardar en controles ECAS'; }
  });
  function fieldsInputs(){ return Array.from(contenedor.querySelectorAll('#ce-fields input[data-column]')); }
  try { await cargar(); } catch(e) { status.textContent='Error cargando ECAS: '+e.message; }
}
