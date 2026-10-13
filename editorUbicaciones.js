import { clienteSupabase } from './supabaseClient.js';
import { agregarCapasBase } from './mapaBase.js';

const CATEGORIAS = [
  { valor: 'Hidrantes', etiqueta: 'Hidrantes' },
  { valor: 'Extintores', etiqueta: 'Extintores' },
  { valor: 'ECAS', etiqueta: 'ECAS' },
  { valor: 'Valvulas', etiqueta: 'Válvulas' },
  { valor: 'VECAS', etiqueta: 'VECAS' },
  { valor: 'Purgas ECAS (PECAS)', etiqueta: 'PECAS' },
];
const VISTA_INICIAL = [-38.88, -62.08];
let mapa = null;
let marcadorSeleccionado = null;
let capaMarcadores = null;
let activos = [];
let seleccionado = null;
let ubicacionPendiente = null;
let solicitud = 0;

function escapar(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function geometriaPunto(valor) {
  if (typeof valor !== 'string' || !valor.trim()) return null;
  const t = valor.trim();
  let m = t.match(/^\s*POINT\s*(?:Z\s*)?\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)\s*$/i);
  if (m) {
    const lng = Number(m[1]), lat = Number(m[2]);
    return validar(lat,lng) ? [lat,lng] : null;
  }
  m = t.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) {
    const a=Number(m[1]), b=Number(m[2]);
    if (validar(a,b)) return [a,b];
    if (validar(b,a)) return [b,a];
  }
  return null;
}
function validar(lat,lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180;
}
function coordenadasActivo(a) { return geometriaPunto(a.ubicacion_wkt); }
function nombre(a) { return a.etiqueta || a.nombre || (a.categoria + ' #' + a.id); }
function mensaje(texto, error=false) {
  const el=document.getElementById('editor-ubicacion-mensaje');
  if (el) { el.textContent=texto; el.style.color=error?'#fca5a5':'#86efac'; }
}
function renderLista() {
  const el=document.getElementById('editor-ubicacion-lista');
  if (!el) return;
  const sin=activos.filter(a=>!coordenadasActivo(a));
  const con=activos.filter(a=>coordenadasActivo(a));
  el.innerHTML=`
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <span style="background:#1f2937;padding:7px 10px;border-radius:6px">Elementos: <b>${activos.length}</b></span>
      <span style="background:#1f2937;padding:7px 10px;border-radius:6px">Con punto: <b>${con.length}</b></span>
      <span style="background:${sin.length?'#78350f':'#1f2937'};padding:7px 10px;border-radius:6px">Sin ubicación válida: <b>${sin.length}</b></span>
    </div>
    <h3 style="font-size:15px;margin:12px 0 6px">Sin ubicación (${sin.length})</h3>
    ${sin.length ? sin.map(a=>fila(a)).join('') : '<p style="color:#9ca3af">Todos los elementos tienen un punto reconocible.</p>'}
    <details style="margin-top:12px"><summary style="cursor:pointer;padding:8px 0">Elementos con ubicación (${con.length})</summary>
      ${con.map(a=>fila(a)).join('') || '<p>No hay elementos con ubicación.</p>'}
    </details>`;
  el.querySelectorAll('[data-asset-id]').forEach(btn=>btn.addEventListener('click',()=>seleccionarActivo(Number(btn.dataset.assetId))));
}
function fila(a) {
  const coords=coordenadasActivo(a);
  return `<button type="button" data-asset-id="${a.id}" style="display:block;width:100%;text-align:left;padding:9px;margin:4px 0;border:1px solid ${seleccionado?.id===a.id?'#60a5fa':'#374151'};border-radius:6px;background:${seleccionado?.id===a.id?'#1e3a5f':'#111827'};color:#e5e7eb;cursor:pointer">
    <strong>${escapar(nombre(a))}</strong><small style="display:block;color:#9ca3af">ID ${a.id} · ${coords?'Ubicación registrada':'Sin ubicación válida'}${a.sector?' · Sector '+escapar(a.sector):''}</small>
  </button>`;
}
function pintarMarcador(coords, draggable) {
  if (marcadorSeleccionado) { mapa.removeLayer(marcadorSeleccionado); marcadorSeleccionado=null; }
  marcadorSeleccionado=L.marker(coords,{draggable,title:seleccionado?nombre(seleccionado):'Nueva ubicación'}).addTo(mapa);
  marcadorSeleccionado.bindPopup(escapar(seleccionado?nombre(seleccionado):'Ubicación provisional')).openPopup();
  marcadorSeleccionado.on('dragend',()=> {
    ubicacionPendiente=marcadorSeleccionado.getLatLng();
    mensaje('Nueva posición preparada. Pulsa «Guardar ubicación» para confirmar.');
  });
}
function seleccionarActivo(id) {
  seleccionado=activos.find(a=>Number(a.id)===id)||null;
  ubicacionPendiente=null;
  if(!seleccionado) return;
  const coords=coordenadasActivo(seleccionado);
  renderLista();
  document.getElementById('editor-ubicacion-seleccionado').textContent='Seleccionado: '+nombre(seleccionado)+' (ID '+seleccionado.id+'). ';
  document.getElementById('editor-ubicacion-ayuda').textContent=coords
    ? 'Arrastra el marcador al punto correcto. La base de datos no cambia hasta que guardes.'
    : 'Este elemento no tiene un punto válido. Haz clic en su ubicación correcta sobre el mapa para colocar un marcador provisional.';
  if(coords) {
    pintarMarcador(coords,true);
    mapa.setView(coords,Math.max(mapa.getZoom(),18));
  } else {
    if(marcadorSeleccionado){mapa.removeLayer(marcadorSeleccionado);marcadorSeleccionado=null;}
    mensaje('Elemento sin ubicación: haz clic en el mapa para asignarle un punto.');
  }
  const boton=document.getElementById('editor-ubicacion-guardar');
  if(boton) boton.disabled=!seleccionado;
}
async function cargarCategoria(categoria) {
  const miSolicitud=++solicitud;
  seleccionado=null; ubicacionPendiente=null; activos=[];
  if(marcadorSeleccionado&&mapa){mapa.removeLayer(marcadorSeleccionado);marcadorSeleccionado=null;}
  document.getElementById('editor-ubicacion-seleccionado').textContent='Selecciona un elemento de la lista.';
  document.getElementById('editor-ubicacion-ayuda').textContent='Selecciona un elemento y arrastra su marcador, o haz clic en el mapa si no tiene ubicación.';
  document.getElementById('editor-ubicacion-guardar').disabled=true;
  document.getElementById('editor-ubicacion-lista').textContent='Cargando elementos…';
  mensaje('');
  // Supabase puede limitar cada respuesta a 1.000 filas. Leer por bloques
  // garantiza que el editor cargue todos los activos de la categoría.
  const TAMANO_LOTE = 500;
  let desde = 0;
  let errorConsulta = null;
  const todosLosActivos = [];
  while (true) {
    const { data, error } = await clienteSupabase
      .from('leu')
      .select('id,etiqueta,categoria,sector,ubicacion_wkt')
      .eq('categoria', categoria)
      .order('id', { ascending: true })
      .range(desde, desde + TAMANO_LOTE - 1);

    if (miSolicitud !== solicitud) return;
    if (error) {
      errorConsulta = error;
      break;
    }

    const lote = data || [];
    todosLosActivos.push(...lote);
    if (lote.length < TAMANO_LOTE) break;
    desde += TAMANO_LOTE;
  }

  if (miSolicitud !== solicitud) return;
  if (errorConsulta) {
    document.getElementById('editor-ubicacion-lista').textContent = 'Error al consultar LEU: ' + errorConsulta.message;
    return;
  }
  activos = todosLosActivos;
  if(capaMarcadores){mapa.removeLayer(capaMarcadores);capaMarcadores=null;}
  capaMarcadores=L.layerGroup().addTo(mapa);
  const limites=[];
  activos.forEach(a=>{
    const coords=coordenadasActivo(a);
    if(!coords)return;
    const m=L.circleMarker(coords,{radius:5,color:'#f8fafc',weight:1,fillColor:'#0ea5e9',fillOpacity:.9}).addTo(capaMarcadores);
    m.bindTooltip(escapar(nombre(a)));
    m.on('click',()=>seleccionarActivo(Number(a.id)));
    limites.push(coords);
  });
  renderLista();
  document.getElementById('editor-ubicacion-categoria-resumen').textContent='Categoría: '+categoria+' · '+activos.length+' elementos';
  if(limites.length) mapa.fitBounds(L.latLngBounds(limites),{padding:[30,30],maxZoom:19});
  else mapa.setView(VISTA_INICIAL,16);
  if(!activos.length)mensaje('No hay elementos registrados en esta categoría.',true);
}
export async function cargarModuloEditorUbicaciones(contenedor) {
  if(mapa){mapa.remove();mapa=null;}
  contenedor.innerHTML=`
    <section style="padding:14px;color:#e5e7eb;max-width:1500px;margin:auto">
      <h2 style="margin:0 0 5px">Corrección de ubicaciones en el mapa</h2>
      <p style="color:#9ca3af;margin:0 0 12px">La ubicación oficial se modifica únicamente en LEU. Los cambios se guardan solo al confirmarlos.</p>
      <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:10px">
        <label style="display:flex;flex-direction:column;gap:5px;min-width:220px;flex:1">Categoría
          <select id="editor-ubicacion-categoria" style="padding:10px;background:#111827;color:#fff;border:1px solid #4b5563;border-radius:6px">
            ${CATEGORIAS.map(c=>`<option value="${escapar(c.valor)}">${escapar(c.etiqueta)}</option>`).join('')}
          </select>
        </label>
        <span id="editor-ubicacion-categoria-resumen" style="color:#9ca3af;padding:8px"></span>
      </div>
      <div style="display:grid;grid-template-columns:minmax(250px,340px) minmax(0,1fr);gap:12px;align-items:start">
        <aside style="max-height:68vh;overflow:auto;background:#0f172a;padding:10px;border:1px solid #374151;border-radius:8px">
          <div id="editor-ubicacion-lista">Selecciona una categoría.</div>
        </aside>
        <div>
          <div id="editor-ubicacion-mapa" style="height:68vh;min-height:420px;width:100%;border-radius:8px;background:#1f2937"></div>
          <div style="padding:10px 2px">
            <strong id="editor-ubicacion-seleccionado">Selecciona un elemento de la lista.</strong>
            <p id="editor-ubicacion-ayuda" style="color:#9ca3af;margin:6px 0">Arrastra el marcador del elemento elegido, o coloca uno nuevo si no tiene ubicación.</p>
            <button id="editor-ubicacion-guardar" type="button" disabled style="padding:10px 16px;border:0;border-radius:6px;background:#2563eb;color:white;font-weight:600;cursor:pointer">Guardar ubicación</button>
            <button id="editor-ubicacion-cancelar" type="button" style="padding:10px 16px;margin-left:6px;border:1px solid #4b5563;border-radius:6px;background:#111827;color:white;cursor:pointer">Cancelar movimiento</button>
            <p id="editor-ubicacion-mensaje" role="status" style="min-height:18px;margin:8px 0"></p>
          </div>
        </div>
      </div>
    </section>`;
  mapa=L.map('editor-ubicacion-mapa',{zoomControl:true}).setView(VISTA_INICIAL,16);
  agregarCapasBase(mapa);
  mapa.on('click',evento=>{
    if(!seleccionado)return;
    if(coordenadasActivo(seleccionado))return;
    ubicacionPendiente=evento.latlng;
    pintarMarcador(evento.latlng,true);
    mensaje('Punto provisional colocado. Comprueba su posición y pulsa «Guardar ubicación».');
  });
  document.getElementById('editor-ubicacion-categoria').addEventListener('change',e=>cargarCategoria(e.target.value));
  document.getElementById('editor-ubicacion-cancelar').addEventListener('click',()=>{
    if(!seleccionado)return;
    const coords=coordenadasActivo(seleccionado);
    ubicacionPendiente=null;
    if(coords)pintarMarcador(coords,true);
    else if(marcadorSeleccionado){mapa.removeLayer(marcadorSeleccionado);marcadorSeleccionado=null;}
    mensaje('Movimiento cancelado; no se guardaron cambios.');
  });
  document.getElementById('editor-ubicacion-guardar').addEventListener('click',async()=>{
    if(!seleccionado||!marcadorSeleccionado){mensaje('Selecciona un elemento y define su posición.',true);return;}
    const idGuardado=Number(seleccionado.id);
    const nombreGuardado=nombre(seleccionado);
    const pos=marcadorSeleccionado.getLatLng();
    if(!validar(pos.lat,pos.lng)){mensaje('Las coordenadas no son válidas.',true);return;}
    if(!confirm('¿Guardar la nueva ubicación de «'+nombreGuardado+'» (ID '+idGuardado+') en LEU?'))return;
    const boton=document.getElementById('editor-ubicacion-guardar');
    boton.disabled=true;
    const wkt='POINT('+pos.lng.toFixed(8)+' '+pos.lat.toFixed(8)+')';
    const {data,error}=await clienteSupabase.from('leu').update({ubicacion_wkt:wkt}).eq('id',seleccionado.id).select('id,ubicacion_wkt');
    boton.disabled=false;
    if(error){mensaje('No se pudo guardar: '+error.message,true);return;}
    if(!data||data.length!==1){mensaje('No se confirmó la actualización. Comprueba permisos y políticas de acceso.',true);return;}
    ubicacionPendiente=null;
    mensaje('Ubicación guardada en LEU correctamente.');
    await cargarCategoria(document.getElementById('editor-ubicacion-categoria').value);
    seleccionarActivo(idGuardado);
  });
  setTimeout(()=>mapa?.invalidateSize(),200);
  await cargarCategoria(CATEGORIAS[0].valor);
}
