import { clienteSupabase } from './supabaseClient.js';
import { agregarCapasBase } from './mapaBase.js';

let mapa = null;
let territorios = [];
let capa = null;
let puntosDibujo = [];
let lineaDibujo = null;
let poligonoTemporal = null;
let seleccionado = null;
let modoDibujo = false;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colorDefault = '#2563eb';
function aviso(t, error=false) { const e=document.getElementById('territorio-aviso'); if(e){e.textContent=t;e.style.color=error?'#fca5a5':'#86efac';} }
function limpiarDibujo() {
  puntosDibujo=[]; modoDibujo=false;
  if(lineaDibujo) mapa.removeLayer(lineaDibujo);
  if(poligonoTemporal) mapa.removeLayer(poligonoTemporal);
  lineaDibujo=null; poligonoTemporal=null;
  document.getElementById('territorio-modo-dibujo').textContent='Dibujar / redibujar polígono';
}
function geoCoords(geo) {
  if(!geo?.coordinates) return null;
  const c=geo.type==='Polygon'?geo.coordinates[0]:geo.type==='MultiPolygon'?geo.coordinates[0]?.[0]:null;
  return c?.map(([lng,lat])=>[lat,lng]) || null;
}
function cargarFormulario(t=null) {
  seleccionado=t;
  document.getElementById('territorio-id').value=t?.id||'';
  document.getElementById('territorio-nombre').value=t?.nombre||'';
  document.getElementById('territorio-tipo').value=t?.tipo||'macrosector';
  document.getElementById('territorio-color').value=t?.color||colorDefault;
  document.getElementById('territorio-padre').value=t?.padre_id||'';
  document.getElementById('territorio-estado').textContent=t ? 'Editando '+t.nombre+' · '+(t.estado_modelado||'en_modelado') : 'Nuevo territorio';
  document.getElementById('territorio-desactivar').disabled=!t || !t.activo;
  document.getElementById('territorio-activar').disabled=!t || t.activo;
  renderLista();
}
function renderLista() {
 const el=document.getElementById('territorio-lista');
 if(!el)return;
 el.innerHTML=territorios.map(t=>`<button type="button" data-territorio="${t.id}" style="display:block;width:100%;text-align:left;margin:4px 0;padding:9px;border-radius:6px;border:1px solid ${seleccionado?.id===t.id?'#60a5fa':'#374151'};background:#111827;color:#e5e7eb;opacity:${t.activo?1:.55};cursor:pointer"><span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${esc(t.color)};margin-right:7px"></span><b>${esc(t.nombre)}</b><small style="display:block;color:#9ca3af">${esc(t.tipo)} · ${t.geom?'con geometría':'sin geometría'} · ${t.activo?'activo':'inactivo'}</small></button>`).join('') || '<p>No hay territorios todavía.</p>';
 el.querySelectorAll('[data-territorio]').forEach(b=>b.onclick=()=>seleccionar(Number(b.dataset.territorio)));
 const padre=document.getElementById('territorio-padre');
 const actual=padre.value;
 padre.innerHTML='<option value="">Sin padre (nivel raíz)</option>'+territorios.filter(t=>t.activo&&t.id!==seleccionado?.id).map(t=>`<option value="${t.id}">${esc(t.nombre)} · ${esc(t.tipo)}</option>`).join('');
 padre.value=actual;
}
function pintar() {
 if(capa)mapa.removeLayer(capa);
 capa=L.featureGroup().addTo(mapa);
 const limites=[];
 territorios.filter(t=>t.activo&&t.geom).forEach(t=>{
  const gj={type:'Feature',properties:{id:t.id},geometry:t.geom};
  const layer=L.geoJSON(gj,{style:{color:t.color,weight:seleccionado?.id===t.id?4:2,fillColor:t.color,fillOpacity:.18}});
  layer.eachLayer(l=>{l.bindTooltip(esc(t.nombre),{sticky:true});l.on('click',()=>seleccionar(t.id));});
  layer.addTo(capa);
  const b=layer.getBounds();if(b.isValid())limites.push(b);
 });
 if(limites.length){const b=limites.reduce((acc,x)=>acc.extend(x),L.latLngBounds(limites[0]));mapa.fitBounds(b,{padding:[25,25],maxZoom:19});}
}
async function cargar() {
 aviso('Cargando territorios…');
 const {data,error}=await clienteSupabase.from('territorios_dinamicos').select('id,nombre,tipo,padre_id,geom,color,activo,estado_modelado,origen,origen_ipp_id,notas').order('tipo').order('nombre');
 if(error){aviso('No se pudieron leer los territorios: '+error.message,true);return;}
 territorios=data||[];
 const padres=territorios.map(t=>({...t,geom:undefined}));
 document.getElementById('territorio-padre').innerHTML='<option value="">Sin padre (nivel raíz)</option>'+padres.filter(t=>t.activo).map(t=>`<option value="${t.id}">${esc(t.nombre)} · ${esc(t.tipo)}</option>`).join('');
 renderLista();pintar();
 aviso(`${territorios.length} territorios cargados. Los cambios se guardan en el esquema territorial independiente; LEU no se modifica.`);
}
function seleccionar(id) {
 const t=territorios.find(x=>x.id===id);if(!t)return;
 limpiarDibujo();cargarFormulario(t);pintar();
 const c=geoCoords(t.geom);if(c?.length)mapa.fitBounds(L.latLngBounds(c),{padding:[40,40],maxZoom:19});
}
export async function cargarModuloEditorTerritorios(contenedor) {
 if(mapa){mapa.remove();mapa=null;}
 contenedor.innerHTML=`
 <section style="padding:14px;color:#e5e7eb;max-width:1600px;margin:auto;font-family:Arial,sans-serif">
 <h2 style="margin:0 0 5px">Modelador territorial · etapa previa al Día D</h2>
 <p style="color:#9ca3af;margin:0 0 12px">Las zonas se guardan separadas de LEU. Podés crear, renombrar, clasificar, desactivar y redibujar territorios sin modificar activos ni historiales.</p>
 <div style="display:grid;grid-template-columns:minmax(260px,350px) minmax(0,1fr);gap:12px;align-items:start">
 <aside style="background:#0f172a;padding:10px;border:1px solid #374151;border-radius:8px;max-height:76vh;overflow:auto">
 <h3 style="margin:4px 0 8px">Territorios</h3><div id="territorio-lista">Cargando…</div>
 <hr style="border-color:#374151;margin:14px 0"><h3 style="margin:4px 0 8px">Ficha territorial</h3>
 <div id="territorio-estado" style="font-size:12px;color:#93c5fd;margin-bottom:8px">Nuevo territorio</div>
 <input id="territorio-id" type="hidden">
 <label style="display:block;margin:8px 0 4px">Nombre</label><input id="territorio-nombre" maxlength="160" placeholder="Ej. Montaje VP" style="box-sizing:border-box;width:100%;padding:9px;background:#111827;color:#fff;border:1px solid #4b5563;border-radius:5px">
 <label style="display:block;margin:8px 0 4px">Tipo</label><select id="territorio-tipo" style="width:100%;padding:9px;background:#111827;color:#fff;border:1px solid #4b5563;border-radius:5px"><option value="planta">Planta</option><option value="macrosector">Macrosector</option><option value="microsector">Microsector</option><option value="calle">Calle interna</option><option value="subzona">Subzona</option></select>
 <label style="display:block;margin:8px 0 4px">Territorio padre</label><select id="territorio-padre" style="width:100%;padding:9px;background:#111827;color:#fff;border:1px solid #4b5563;border-radius:5px"><option value="">Sin padre</option></select>
 <label style="display:block;margin:8px 0 4px">Color</label><input id="territorio-color" type="color" value="#2563eb" style="width:100%;height:38px;background:#111827;border:1px solid #4b5563;border-radius:5px">
 <button id="territorio-nuevo" type="button" style="width:100%;margin-top:10px;padding:10px;background:#334155;color:white;border:1px solid #64748b;border-radius:5px">Nuevo territorio</button>
 <button id="territorio-guardar" type="button" style="width:100%;margin-top:7px;padding:10px;background:#166534;color:white;border:0;border-radius:5px;font-weight:bold">Guardar ficha / geometría</button>
 <button id="territorio-modo-dibujo" type="button" style="width:100%;margin-top:7px;padding:10px;background:#1d4ed8;color:white;border:0;border-radius:5px">Dibujar / redibujar polígono</button>
 <button id="territorio-cerrar-poligono" type="button" style="width:100%;margin-top:7px;padding:10px;background:#334155;color:white;border:1px solid #64748b;border-radius:5px">Cerrar polígono</button>
 <button id="territorio-cancelar-dibujo" type="button" style="width:100%;margin-top:7px;padding:10px;background:#111827;color:white;border:1px solid #4b5563;border-radius:5px">Cancelar dibujo</button>
 <button id="territorio-desactivar" type="button" disabled style="width:100%;margin-top:7px;padding:10px;background:#7f1d1d;color:white;border:0;border-radius:5px">Desactivar (conservar)</button>
 <button id="territorio-activar" type="button" disabled style="width:100%;margin-top:7px;padding:10px;background:#166534;color:white;border:0;border-radius:5px">Reactivar</button>
 <p id="territorio-aviso" role="status" style="font-size:12px;line-height:1.5;min-height:32px;color:#9ca3af"></p>
 </aside>
 <div id="territorio-mapa" style="height:76vh;min-height:480px;width:100%;border-radius:8px;background:#1f2937"></div>
 </div><p style="color:#9ca3af;font-size:12px">Uso inicial: seleccioná un macrosector importado desde IPP o creá uno nuevo; para cambiar su forma, redibujá el polígono y guardá. Los registros IPP de origen permanecen intactos. La detección automática de huecos/solapamientos y la congelación formal quedan para la siguiente etapa.</p>
 </section>`;
 mapa=L.map('territorio-mapa',{zoomControl:true}).setView([-31.47,-64.24],16);agregarCapasBase(mapa);
 mapa.on('click',e=>{
  if(!modoDibujo)return;
  puntosDibujo.push([e.latlng.lat,e.latlng.lng]);
  if(lineaDibujo)mapa.removeLayer(lineaDibujo);
  if(poligonoTemporal)mapa.removeLayer(poligonoTemporal);
  if(puntosDibujo.length>=3)poligonoTemporal=L.polygon(puntosDibujo,{color:document.getElementById('territorio-color').value,fillOpacity:.18}).addTo(mapa);
  else lineaDibujo=L.polyline(puntosDibujo,{color:document.getElementById('territorio-color').value,dashArray:'5 5'}).addTo(mapa);
  aviso(`Dibujo en curso: ${puntosDibujo.length} vértices. Hacé clic en «Cerrar polígono» cuando termines.`);
 });
 document.getElementById('territorio-nuevo').onclick=()=>{limpiarDibujo();cargarFormulario(null);aviso('Nuevo territorio. Completá la ficha y dibujá el polígono.');};
 document.getElementById('territorio-modo-dibujo').onclick=()=>{limpiarDibujo();modoDibujo=true;document.getElementById('territorio-modo-dibujo').textContent='Dibujo activo · clic en el mapa';aviso('Hacé clic en el mapa para marcar los vértices del polígono.');};
 document.getElementById('territorio-cerrar-poligono').onclick=()=>{
  if(puntosDibujo.length<3){aviso('Un polígono necesita al menos 3 vértices.',true);return;}
  if(lineaDibujo){mapa.removeLayer(lineaDibujo);lineaDibujo=null;}
  if(poligonoTemporal)mapa.removeLayer(poligonoTemporal);
  poligonoTemporal=L.polygon(puntosDibujo,{color:document.getElementById('territorio-color').value,fillOpacity:.18}).addTo(mapa);
  modoDibujo=false;document.getElementById('territorio-modo-dibujo').textContent='Dibujar / redibujar polígono';
  aviso('Polígono preparado. Guardá para persistirlo en Supabase.');
 };
 document.getElementById('territorio-cancelar-dibujo').onclick=()=>{limpiarDibujo();aviso('Dibujo cancelado; no se guardaron cambios.');};
 document.getElementById('territorio-guardar').onclick=async()=>{
  const nombre=document.getElementById('territorio-nombre').value.trim();
  if(!nombre){aviso('El nombre es obligatorio.',true);return;}
  let geom=seleccionado?.geom||null;
  if(poligonoTemporal){
   const ring=poligonoTemporal.getLatLngs()[0].map(p=>[Number(p.lng.toFixed(8)),Number(p.lat.toFixed(8))]);
   if(ring.length<3){aviso('Geometría insuficiente.',true);return;}
   if(ring[0][0]!==ring[ring.length-1][0]||ring[0][1]!==ring[ring.length-1][1])ring.push([...ring[0]]);
   geom={type:'Polygon',coordinates:[ring]};
  }
  const padre=document.getElementById('territorio-padre').value;
  const payload={nombre,tipo:document.getElementById('territorio-tipo').value,padre_id:padre?Number(padre):null,color:document.getElementById('territorio-color').value,geom,estado_modelado:'en_modelado'};
  const id=document.getElementById('territorio-id').value;
  const btn=document.getElementById('territorio-guardar');btn.disabled=true;
  try{
   let q=id?clienteSupabase.from('territorios_dinamicos').update(payload).eq('id',Number(id)):clienteSupabase.from('territorios_dinamicos').insert(payload);
   const {error}=await q;
   if(error)throw error;
   limpiarDibujo();await cargar();
   if(id)seleccionar(Number(id));
   else {const nuevo=territorios.find(t=>t.nombre===nombre);if(nuevo)seleccionar(nuevo.id);}
   aviso('Territorio guardado. LEU y los historiales no fueron modificados.');
  }catch(e){aviso('No se pudo guardar: '+e.message,true);}
  finally{btn.disabled=false;}
 };
 document.getElementById('territorio-desactivar').onclick=()=>cambiarActivo(false);
 document.getElementById('territorio-activar').onclick=()=>cambiarActivo(true);
 async function cambiarActivo(activo){
  if(!seleccionado)return;
  if(!confirm((activo?'Reactivar':'Desactivar')+' «'+seleccionado.nombre+'»? Se conserva el registro.'))return;
  const {error}=await clienteSupabase.from('territorios_dinamicos').update({activo}).eq('id',seleccionado.id);
  if(error){aviso('No se pudo actualizar: '+error.message,true);return;}
  const id=seleccionado.id;await cargar();seleccionar(id);aviso('Estado actualizado; el territorio se conserva en la base.');
 }
 await cargar();setTimeout(()=>mapa?.invalidateSize(),200);
}
