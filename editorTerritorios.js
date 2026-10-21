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
let modoVertices = false;
let capaVertices = null;
let geometriaEditada = null;
let encuadreInicialAplicado = false;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colorDefault = '#2563eb';
function aviso(t, error=false) { const e=document.getElementById('territorio-aviso'); if(e){e.textContent=t;e.style.color=error?'#fca5a5':'#86efac';} }
function limpiarVertices(){ if(capaVertices && mapa) mapa.removeLayer(capaVertices); capaVertices=null; modoVertices=false; const b=document.getElementById('territorio-editar-vertices'); if(b)b.textContent='Editar vértices del sector'; }
function limpiarDibujo() {
  limpiarVertices();
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
  if(modoVertices && seleccionado?.id===t.id)return;
  const gj={type:'Feature',properties:{id:t.id},geometry:t.geom};
  const layer=L.geoJSON(gj,{style:{color:t.color,weight:seleccionado?.id===t.id?4:2,fillColor:t.color,fillOpacity:.18}});
  layer.eachLayer(l=>{l.bindTooltip(esc(t.nombre),{sticky:true});l.on('click',()=>seleccionar(t.id));});
  layer.addTo(capa);
  const b=layer.getBounds();if(b.isValid())limites.push(b);
 });
 if(limites.length && !encuadreInicialAplicado){const b=limites.reduce((acc,x)=>acc.extend(x),L.latLngBounds(limites[0]));mapa.fitBounds(b,{padding:[25,25],maxZoom:19});encuadreInicialAplicado=true;}
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
 limpiarDibujo();geometriaEditada=null;cargarFormulario(t);pintar();
 const resumen=document.getElementById('territorio-seleccionado-resumen');if(resumen)resumen.textContent=t.nombre;
 const c=geoCoords(t.geom);if(c?.length)mapa.fitBounds(L.latLngBounds(c),{padding:[40,40],maxZoom:19});
}
export async function cargarModuloEditorTerritorios(contenedor) {
 if(mapa){mapa.remove();mapa=null;}
 contenedor.innerHTML=`
 <section style="padding:14px;color:#e5e7eb;max-width:1600px;margin:auto;font-family:Arial,sans-serif">
 <h2 style="margin:0 0 5px">Modelador territorial · etapa previa al Día D</h2>
 <p style="color:#9ca3af;margin:0 0 12px">Las zonas se guardan separadas de LEU. Podés crear, renombrar, clasificar, desactivar y redibujar territorios sin modificar activos ni historiales.</p>
  <aside style="background:#0f172a;padding:7px;border:1px solid #374151;border-radius:8px;margin-bottom:7px"><details><summary style="cursor:pointer;color:#cbd5e1;font-size:13px;padding:4px">Zonas y propiedades · <span id="territorio-seleccionado-resumen">seleccioná un sector</span></summary>
 <div style="display:grid;grid-template-columns:minmax(180px,240px) minmax(220px,1fr);gap:10px;max-height:42vh;overflow:auto;padding-top:8px">
 <div><h3>Zonas</h3><div id="territorio-lista">Cargando…</div></div><div><h3>Ficha territorial</h3><div id="territorio-estado">Nuevo territorio</div><input id="territorio-id" type="hidden">
 <label>Nombre</label><input id="territorio-nombre" maxlength="160" placeholder="Ej. Montaje VP" style="width:100%;box-sizing:border-box">
 <label>Tipo</label><select id="territorio-tipo" style="width:100%"><option value="planta">Planta</option><option value="macrosector">Macrosector</option><option value="microsector">Microsector</option><option value="calle">Calle interna</option><option value="subzona">Subzona</option></select>
 <label>Territorio padre</label><select id="territorio-padre" style="width:100%"><option value="">Sin padre</option></select><label>Color</label><input id="territorio-color" type="color" value="#2563eb">
 <button id="territorio-nuevo">Nuevo territorio</button><button id="territorio-guardar">Guardar ficha / geometría</button><button id="territorio-modo-dibujo">Dibujar / redibujar polígono</button><button id="territorio-cerrar-poligono">Cerrar polígono</button><button id="territorio-cancelar-dibujo">Cancelar dibujo</button><button id="territorio-desactivar" disabled>Desactivar (conservar)</button><button id="territorio-activar" disabled>Reactivar</button></div></div></details><p id="territorio-aviso" role="status"></p></aside>
 <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:6px"><button id="territorio-editar-vertices">Editar vértices</button><button id="territorio-guardar-mapa">Guardar cambios</button><button id="territorio-cancelar-edicion">Cancelar edición</button><span>Arrastrá nodos; clic cerca del borde para agregar uno.</span></div>
 <div id="territorio-mapa" style="height:calc(100vh - 185px);min-height:520px;width:100%;border-radius:8px;background:#1f2937"></div>
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
 function pintarVertices(){
  limpiarVertices(); if(!seleccionado || !seleccionado.geom){aviso('El territorio seleccionado no tiene polígono para editar.',true);return;}
  modoVertices=true; document.getElementById('territorio-editar-vertices').textContent='Edición activa · clic para agregar nodo';
  pintar(); capaVertices=L.layerGroup().addTo(mapa); const coords=geoCoords(geometriaEditada||seleccionado.geom);
  if(!coords || coords.length<4){aviso('No se pudo leer el anillo del polígono.',true);limpiarVertices();return;}
  coords.slice(0,-1).forEach((ll,i)=>{const m=L.marker(ll,{draggable:true,keyboard:false,icon:L.divIcon({className:'',html:'<div style="width:12px;height:12px;background:#fff;border:2px solid #7c3aed;border-radius:50%;box-shadow:0 1px 5px #000;box-sizing:border-box"></div>',iconSize:[12,12],iconAnchor:[6,6]})}).addTo(capaVertices);m.on('drag',()=>{const updated=coords.slice(0,-1);updated[i]=[m.getLatLng().lat,m.getLatLng().lng];const closed=[...updated,updated[0]];geometriaEditada={type:'Polygon',coordinates:[closed.map(p=>[Number(p[1].toFixed(8)),Number(p[0].toFixed(8))])]};if(poligonoTemporal)mapa.removeLayer(poligonoTemporal);poligonoTemporal=L.polygon(closed,{color:document.getElementById('territorio-color').value,fillOpacity:.18}).addTo(mapa);});m.on('dragend',()=>aviso('Vértice movido. Guardá la geometría para conservar el cambio.'));});
  aviso('Modo de edición: arrastrá los nodos blancos para mover vértices; hacé clic cerca de un borde para agregar uno. Guardá para persistir.');
 }
 document.getElementById('territorio-editar-vertices').onclick=()=>{if(!seleccionado){aviso('Primero seleccioná un sector desde Zonas y propiedades o tocá su polígono.',true);return;}if(modoVertices){limpiarVertices();pintar();aviso('Edición de vértices desactivada.');}else pintarVertices();};
 document.getElementById('territorio-guardar-mapa').onclick=()=>document.getElementById('territorio-guardar').click();
 document.getElementById('territorio-cancelar-edicion').onclick=()=>{if(!seleccionado)return;geometriaEditada=null;limpiarDibujo();seleccionar(seleccionado.id);aviso('Edición cancelada; no se guardaron cambios pendientes.');};
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
  let geom=geometriaEditada||seleccionado?.geom||null;
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
   limpiarDibujo();geometriaEditada=null;encuadreInicialAplicado=true;await cargar();
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
 await cargar();encuadreInicialAplicado=true;setTimeout(()=>mapa?.invalidateSize(),200);
}
