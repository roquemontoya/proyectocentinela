// Panel geográfico administrativo: territorios y recorridos GPS registrados.
import { clienteSupabase } from './supabaseClient.js';
import { obtenerRolActual } from './auth.js';
import { agregarCapasBase } from './mapaBase.js';

let mapa = null;
let capas = null;
let recorridos = [];
let territorios = [];
let puntosActuales = [];

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fecha = v => v ? new Date(v).toLocaleString('es-AR') : '—';
const distancia = m => Number(m || 0) < 1000 ? Math.round(Number(m || 0)) + ' m' : (Number(m || 0) / 1000).toLocaleString('es-AR',{maximumFractionDigits:2}) + ' km';
function estado(t, error=false) { const el=document.getElementById('geo-admin-estado'); if(el){el.textContent=t;el.style.color=error?'#fca5a5':'#cbd5e1';} }
function dentro(lat,lng,coords) {
  // Ray casting sobre anillo exterior; coordenadas del GeoJSON en [longitud, latitud].
  let inside=false;
  for(let i=0,j=coords.length-1;i<coords.length;j=i++){
    const xi=coords[i][0], yi=coords[i][1], xj=coords[j][0], yj=coords[j][1];
    const cruza=((yi>lat)!==(yj>lat)) && (lng < (xj-xi)*(lat-yi)/((yj-yi)||1e-12)+xi);
    if(cruza) inside=!inside;
  }
  return inside;
}
function anillos(geom) {
  if(!geom?.coordinates) return [];
  if(geom.type==='Polygon') return geom.coordinates[0] ? [geom.coordinates[0]] : [];
  if(geom.type==='MultiPolygon') return geom.coordinates.map(p=>p[0]).filter(Boolean);
  return [];
}
function territorioDe(p) {
  for(const t of territorios.filter(x=>x.activo && x.geom)){
    if(anillos(t.geom).some(a=>dentro(Number(p.latitud),Number(p.longitud),a))) return t;
  }
  return null;
}
function calcularEventos(puntos) {
  const ordenados=[...puntos].sort((a,b)=>a.secuencia-b.secuencia);
  const eventos=[]; let anterior=null;
  for(const p of ordenados){
    const actual=territorioDe(p);
    const aid=actual?.id ?? null, pid=anterior?.id ?? null;
    if(aid!==pid){
      if(anterior) eventos.push({tipo:'Salida',territorio:anterior.nombre,fecha:p.capturado_en,lat:Number(p.latitud),lng:Number(p.longitud),nota:'Salida inferida entre dos puntos GPS'});
      if(actual) eventos.push({tipo:'Entrada',territorio:actual.nombre,fecha:p.capturado_en,lat:Number(p.latitud),lng:Number(p.longitud),nota:'Entrada inferida entre dos puntos GPS'});
    }
    anterior=actual;
  }
  return eventos;
}
async function cargarTerritorios(){
  const {data,error}=await clienteSupabase.from('territorios_dinamicos')
    .select('id,nombre,tipo,padre_id,geom,color,activo,estado_modelado').eq('activo',true);
  if(error) throw error;
  territorios=data||[];
}
async function cargarRecorridos(){
  const {data,error}=await clienteSupabase.from('recorridos_gps')
    .select('id,equipo_id,equipo_nombre,tipo,estado,iniciado_en,finalizado_en,distancia_m,cantidad_puntos')
    .order('iniciado_en',{ascending:false}).limit(200);
  if(error) throw error;
  recorridos=data||[];
}
function pintarTerritorios(){
  territorios.filter(t=>t.geom).forEach(t=>{
    const layer=L.geoJSON({type:'Feature',properties:{nombre:t.nombre},geometry:t.geom},{
      style:{color:t.color||'#64748b',weight:2,fillColor:t.color||'#64748b',fillOpacity:.13}
    }).bindTooltip(esc(t.nombre)+' · '+esc(t.tipo));
    layer.addTo(capas);
  });
}
function pintarPuntos(puntos){
  puntosActuales=puntos;
  if(!mapa||!capas)return;
  capas.clearLayers(); pintarTerritorios();
  if(puntos.length){
    const coords=puntos.map(p=>[Number(p.latitud),Number(p.longitud)]);
    L.polyline(coords,{color:'#f97316',weight:4,opacity:.9}).addTo(capas);
    coords.forEach((c,i)=>{ if(i===0||i===coords.length-1) L.circleMarker(c,{radius:6,color:'#fff',weight:2,fillColor:i===0?'#22c55e':'#ef4444',fillOpacity:1}).bindTooltip(i===0?'Inicio del recorrido':'Último punto registrado').addTo(capas); });
    mapa.fitBounds(L.latLngBounds(coords),{padding:[25,25],maxZoom:19});
  } else {
    const bounds=[];
    territorios.filter(t=>t.geom).forEach(t=>{const layer=L.geoJSON(t.geom);const b=layer.getBounds();if(b.isValid())bounds.push(b);});
    if(bounds.length) mapa.fitBounds(bounds.reduce((a,b)=>a.extend(b),bounds[0]),{padding:[25,25],maxZoom:18});
  }
}
async function verRecorrido(id){
  estado('Cargando puntos GPS del recorrido…');
  const {data,error}=await clienteSupabase.from('puntos_recorrido_gps')
    .select('latitud,longitud,secuencia,capturado_en,precision_m').eq('recorrido_id',id)
    .order('secuencia',{ascending:true}).limit(20000);
  if(error){estado('No se pudo leer el recorrido: '+error.message,true);return;}
  const puntos=data||[]; pintarPuntos(puntos);
  const eventos=calcularEventos(puntos);
  const tabla=document.getElementById('geo-admin-eventos');
  if(tabla) tabla.innerHTML=eventos.length
    ? '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:7px">Evento</th><th style="text-align:left;padding:7px">Zona</th><th style="text-align:left;padding:7px">Fecha/hora aproximada</th><th style="text-align:left;padding:7px">Precisión GPS</th></tr></thead><tbody>'+eventos.map(e=>'<tr><td style="padding:7px;border-top:1px solid #374151">'+esc(e.tipo)+'</td><td style="padding:7px;border-top:1px solid #374151">'+esc(e.territorio)+'</td><td style="padding:7px;border-top:1px solid #374151">'+esc(fecha(e.fecha))+'</td><td style="padding:7px;border-top:1px solid #374151">'+esc(e.nota)+'</td></tr>').join('')+'</tbody></table></div>'
    : '<p style="color:#9ca3af">No se detectaron cruces de zonas en los puntos disponibles, o el recorrido no contiene puntos.</p>';
  estado('Recorrido cargado: '+puntos.length+' puntos · '+eventos.length+' eventos de entrada/salida inferidos. Los horarios corresponden al punto GPS que detecta el cambio, no a una marca exacta del cruce.');
}
function renderLista(){
  const el=document.getElementById('geo-admin-recorridos'); if(!el)return;
  el.innerHTML=recorridos.length?recorridos.map(r=>'<article style="padding:10px;border:1px solid #374151;border-radius:7px;margin:6px 0;background:#111827"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>'+esc(r.equipo_nombre||r.equipo_id)+'</strong><span style="color:#93c5fd">'+esc(r.estado)+'</span></div><div style="font-size:12px;color:#9ca3af;margin:5px 0">'+esc(r.tipo)+' · '+esc(fecha(r.iniciado_en))+' · '+esc(r.cantidad_puntos||0)+' puntos · '+esc(distancia(r.distancia_m))+'</div><button type="button" data-recorrido="'+esc(r.id)+'" style="padding:7px 10px;background:#1d4ed8;color:#fff;border:0;border-radius:5px;cursor:pointer">Ver recorrido y cruces de zonas</button></article>').join(''):'<p style="color:#9ca3af">No hay recorridos GPS registrados todavía.</p>';
  el.querySelectorAll('[data-recorrido]').forEach(b=>b.addEventListener('click',()=>verRecorrido(b.dataset.recorrido)));
}
export async function detenerModuloPanelGeografico(){ if(mapa){mapa.remove();mapa=null;} capas=null; puntosActuales=[]; }
export async function cargarModuloPanelGeografico(contenedor){
  await detenerModuloPanelGeografico();
  if(!['administrador','superadministrador'].includes(obtenerRolActual())){contenedor.innerHTML='<p>Este panel es exclusivo de administración.</p>';return;}
  contenedor.style.cssText+=';display:block;width:100%;max-width:100%;padding:0;margin:0';
  contenedor.innerHTML=`<section style="padding:12px;color:#e5e7eb;font-family:Arial,sans-serif;max-width:1600px;margin:auto">
    <h2 style="margin:0 0 5px">🗺️ Panel geográfico de supervisión</h2>
    <p style="color:#9ca3af;margin:0 0 12px">Mapa territorial y recorridos GPS sincronizados de Centinela. No representa ubicación en vivo: muestra recorridos registrados y calcula cruces usando los polígonos activos actuales.</p>
    <div id="geo-admin-estado" role="status" style="padding:9px;background:#111827;border-radius:6px;margin-bottom:9px">Cargando datos…</div>
    <div id="geo-admin-mapa" style="height:55vh;min-height:380px;width:100%;border-radius:8px;background:#1f2937;margin-bottom:10px"></div>
    <section style="background:#0f172a;border:1px solid #374151;border-radius:8px;padding:10px;margin-bottom:10px"><h3 style="margin:0 0 7px">Recorridos GPS recientes</h3><div id="geo-admin-recorridos">Cargando…</div></section>
    <section style="background:#0f172a;border:1px solid #374151;border-radius:8px;padding:10px"><h3 style="margin:0 0 5px">Entradas y salidas inferidas</h3><p style="color:#9ca3af;font-size:12px">El cruce se estima entre muestras GPS consecutivas. Si el polígono cambió desde el recorrido, el resultado refleja la geometría actual, no necesariamente la histórica.</p><div id="geo-admin-eventos"><p style="color:#9ca3af">Elegí un recorrido para calcular los eventos.</p></div></section>
  </section>`;
  mapa=L.map('geo-admin-mapa').setView([-31.47,-64.24],15); agregarCapasBase(mapa); capas=L.layerGroup().addTo(mapa);
  try{await Promise.all([cargarTerritorios(),cargarRecorridos()]);pintarPuntos([]);renderLista();estado(territorios.length+' zonas activas · '+recorridos.length+' recorridos recientes.');}
  catch(e){estado('Error cargando el panel: '+(e.message||e),true);}
  setTimeout(()=>mapa?.invalidateSize(),200);
}
