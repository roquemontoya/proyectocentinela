// Panel geográfico administrativo: territorios y recorridos GPS registrados.
import { clienteSupabase } from './supabaseClient.js';
import { obtenerRolActual } from './auth.js';
import { agregarCapasBase } from './mapaBase.js';

let mapa = null;
let capas = null;
let recorridos = [];
let territorios = [];
let puntosActuales = [];
let recorridosControlin = [];
let capaSimulada = null;
let recorridoControlinSeleccionado = 0;
let puntoControlinSeleccionado = 0;

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
function generarRecorridosControlin(){
  // Rutas demostrativas sobre zonas reales dibujadas en Centinela. No son coordenadas GPS históricas.
  const zonas=territorios.filter(t=>t.activo&&t.geom).map(t=>{
    const layer=L.geoJSON(t.geom), b=layer.getBounds();
    return b.isValid()?{nombre:t.nombre,centro:b.getCenter()}:null;
  }).filter(Boolean);
  if(zonas.length<2){recorridosControlin=[];return;}
  const salida=[];
  for(let dia=1;dia<=31;dia++){
    const ciclo=(dia-1)%12;
    if(ciclo>=4&&ciclo<6 || ciclo>=10) continue;
    const noche=ciclo>=6&&ciclo<10;
    const inicio=new Date(2026,9,dia,noche?19:7,0,0);
    const puntos=[];
    const cantidad=Math.min(6,Math.max(3,zonas.length));
    for(let i=0;i<cantidad;i++){
      const z=zonas[(dia*3+i*2)%zonas.length];
      // Pequeña variación visual reproducible alrededor del centro de cada zona.
      const variacion=((dia+i)%3)*0.00006;
      puntos.push({lat: z.centro.lat+variacion,lng:z.centro.lng-variacion, zona:z.nombre,
        hora:new Date(inicio.getTime()+i*105*60*1000)});
    }
    salida.push({id:'controlin-demo-'+dia,fecha:inicio,tipo:noche?'Ronda nocturna':'Ronda diurna',
      distancia:5.2+((dia*13)%47)/10,puntos,zonas:new Set(puntos.map(p=>p.zona)).size});
  }
  recorridosControlin=salida;
}
function mostrarRecorridoControlin(id, indicePunto=null){
  const r=recorridosControlin.find(x=>x.id===id);
  if(!r||!mapa||!capas)return;
  recorridoControlinSeleccionado=recorridosControlin.findIndex(x=>x.id===id);
  if(indicePunto!==null) puntoControlinSeleccionado=Math.max(0,Math.min(indicePunto,r.puntos.length-1));
  else puntoControlinSeleccionado=Math.max(0,Math.min(puntoControlinSeleccionado,r.puntos.length-1));
  if(capaSimulada) capas.removeLayer(capaSimulada);
  capaSimulada=L.layerGroup().addTo(capas);
  const coords=r.puntos.map(p=>[p.lat,p.lng]);
  L.polyline(coords,{color:'#e879f9',weight:5,opacity:.95,dashArray:'8 7'}).bindTooltip('Controlin · RECORRIDO SIMULADO').addTo(capaSimulada);
  r.puntos.forEach((p,i)=>L.circleMarker([p.lat,p.lng],{radius:i===puntoControlinSeleccionado?9:6,color:'#fff',weight:2,fillColor:i===0?'#22c55e':i===r.puntos.length-1?'#ef4444':i===puntoControlinSeleccionado?'#facc15':'#e879f9',fillOpacity:1})
    .bindTooltip((i+1)+'. '+esc(p.zona)+' · '+esc(fecha(p.hora))).addTo(capaSimulada));
  mapa.fitBounds(L.latLngBounds(coords),{padding:[30,30],maxZoom:18});
  const tabla=document.getElementById('geo-admin-eventos');
  if(tabla){
    const actual=r.puntos[puntoControlinSeleccionado];
    tabla.innerHTML='<div style="padding:10px;background:#3b2f14;border:1px solid #8b6b22;border-radius:7px;color:#fde68a;margin-bottom:8px">Recorrido ficticio de demostración. Los puntos se ubican cerca de los centros de zonas reales; no representan un trayecto GPS histórico.</div>'+
    '<div style="display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;background:#211626;border:1px solid #6b356f;border-radius:9px;padding:12px;margin-bottom:10px"><div><strong>'+esc(r.tipo)+' · '+esc(fecha(r.fecha))+'</strong><div style="font-size:12px;color:#d8b4fe;margin-top:4px">Punto '+(puntoControlinSeleccionado+1)+' de '+r.puntos.length+' · '+esc(actual.zona)+' · '+esc(fecha(actual.hora))+'</div></div><div style="font-size:22px;font-weight:bold;color:#f0abfc">'+Math.round((puntoControlinSeleccionado/(Math.max(1,r.puntos.length-1)))*100)+'%</div></div>'+
    '<label for="geo-controlin-tiempo" style="display:block;font-size:12px;color:#c4b5fd;margin-bottom:5px">Avanzar por el recorrido</label><input id="geo-controlin-tiempo" type="range" min="0" max="'+(r.puntos.length-1)+'" step="1" value="'+puntoControlinSeleccionado+'" style="width:100%;accent-color:#e879f9;cursor:pointer"/>'+
    '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 12px"><button id="geo-controlin-anterior" type="button" style="padding:8px 12px;background:#374151;color:white;border:0;border-radius:6px;cursor:pointer">◀ Anterior</button><div style="display:flex;gap:8px;align-items:center"><button id="geo-controlin-play" type="button" style="padding:8px 12px;background:#86198f;color:white;border:0;border-radius:6px;cursor:pointer">▶ Reproducir</button><button id="geo-controlin-siguiente" type="button" style="padding:8px 12px;background:#374151;color:white;border:0;border-radius:6px;cursor:pointer">Siguiente ▶</button></div></div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:7px">'+r.puntos.map((p,i)=>'<button type="button" data-controlin-punto="'+i+'" style="text-align:left;padding:8px;border-radius:6px;border:1px solid '+(i===puntoControlinSeleccionado?'#e879f9':'#374151')+';background:'+(i===puntoControlinSeleccionado?'#3b2140':'#111827')+';color:#e5e7eb;cursor:pointer"><div style="font-size:11px;color:#c4b5fd">'+esc(fecha(p.hora))+'</div><strong style="font-size:12px">'+esc(p.zona)+'</strong></button>').join('')+'</div>';
    const slider=tabla.querySelector('#geo-controlin-tiempo');
    slider?.addEventListener('input',e=>mostrarRecorridoControlin(id,Number(e.target.value)));
    tabla.querySelector('#geo-controlin-anterior')?.addEventListener('click',()=>mostrarRecorridoControlin(id,puntoControlinSeleccionado-1));
    tabla.querySelector('#geo-controlin-siguiente')?.addEventListener('click',()=>mostrarRecorridoControlin(id,puntoControlinSeleccionado+1));
    tabla.querySelectorAll('[data-controlin-punto]').forEach(b=>b.addEventListener('click',()=>mostrarRecorridoControlin(id,Number(b.dataset.controlinPunto))));
    tabla.querySelector('#geo-controlin-play')?.addEventListener('click',()=>{
      let i=puntoControlinSeleccionado;
      const avanzar=()=>{if(!document.getElementById('geo-controlin-tiempo'))return;if(i>=r.puntos.length-1){mostrarRecorridoControlin(id,0);return;}i++;mostrarRecorridoControlin(id,i);setTimeout(avanzar,900);};
      setTimeout(avanzar,250);
    });
  }
  estado('Controlin · '+r.tipo+' del '+esc(fecha(r.fecha))+' · punto '+(puntoControlinSeleccionado+1)+'/'+r.puntos.length+' · datos simulados.');
}
function renderListaControlin(){
  const el=document.getElementById('geo-admin-controlin'); if(!el)return;
  if(!recorridosControlin.length){
    el.innerHTML='<p style="color:#9ca3af">No hay suficientes zonas con geometría para dibujar recorridos de demostración. Dibujá/activá al menos dos zonas en el editor.</p>';
    return;
  }
  el.innerHTML=`
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 12px">
      <label for="geo-controlin-dia" style="font-size:13px;color:#d8b4fe">Jornada:</label>
      <input id="geo-controlin-dia" type="date" value="2026-10-01" min="2026-10-01" max="2026-10-31" style="padding:8px;border-radius:7px;background:#111827;color:white;border:1px solid #6b356f">
      <button id="geo-controlin-ir" type="button" style="padding:8px 12px;background:#86198f;color:white;border:0;border-radius:7px;cursor:pointer">Ver día</button>
      <span id="geo-controlin-turno" style="font-size:12px;color:#c4b5fd"></span>
    </div>
    <div id="geo-controlin-pastillas" style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:4px"></div>
  `;
  const fechaInput=el.querySelector('#geo-controlin-dia');
  const pastillas=el.querySelector('#geo-controlin-pastillas');
  const turno=el.querySelector('#geo-controlin-turno');
  function renderDia(){
    const valor=fechaInput.value;
    const f=valor?new Date(valor+'T12:00:00'):null;
    const jornada=recorridosControlin.filter(r=>f&&r.fecha.getFullYear()===f.getFullYear()&&r.fecha.getMonth()===f.getMonth()&&r.fecha.getDate()===f.getDate());
    if(!jornada.length){
      pastillas.innerHTML='<span style="padding:7px 10px;border-radius:8px;background:#292929;color:#9ca3af;font-size:12px">Franco o sin recorrido simulado para este día.</span>';
      turno.textContent='Franco';
      return;
    }
    turno.textContent=jornada.length+' recorrido(s) · '+jornada.map(r=>r.tipo).join(', ');
    pastillas.innerHTML=jornada.map((r,i)=>'<button type="button" data-controlin="'+esc(r.id)+'" style="display:flex;align-items:center;gap:8px;padding:8px 11px;border-radius:9px;border:1px solid '+(i===0?'#a855f7':'#6b356f')+';background:'+(i===0?'#3b2140':'#211626')+';color:#f3e8ff;cursor:pointer;text-align:left;max-width:100%"><span style="font-size:17px">'+(r.tipo==='Ronda nocturna'?'🌙':'☀️')+'</span><span><strong style="display:block;font-size:12px">Controlin · '+(r.tipo==='Ronda nocturna'?'Noche':'Día')+'</strong><span style="font-size:11px;color:#d8b4fe">'+(r.tipo==='Ronda nocturna'?'19:00–07:00':'07:00–19:00')+' · '+r.puntos.length+' puntos · '+r.distancia.toFixed(1)+' km</span></span><span style="font-size:10px;color:#f0abfc">DEMO</span></button>').join('');
    pastillas.querySelectorAll('[data-controlin]').forEach(btn=>btn.addEventListener('click',()=>{
      pastillas.querySelectorAll('[data-controlin]').forEach(x=>{x.style.borderColor='#6b356f';x.style.background='#211626';});
      btn.style.borderColor='#e879f9';btn.style.background='#3b2140';
      mostrarRecorridoControlin(btn.dataset.controlin,0);
      // Mantener el reproductor a la vista tras elegir la jornada.
      document.getElementById('geo-admin-eventos')?.scrollIntoView({behavior:'smooth',block:'nearest'});
    }));
    // Selección inicial del día: mostrar la primera ronda disponible sin exigir desplazarse a una lista larga.
    if(jornada.length===1) mostrarRecorridoControlin(jornada[0].id,0);
  }
  fechaInput.addEventListener('change',renderDia);
  el.querySelector('#geo-controlin-ir')?.addEventListener('click',renderDia);
  renderDia();
}
function renderLista(){
  const el=document.getElementById('geo-admin-recorridos'); if(!el)return;
  el.innerHTML=recorridos.length?recorridos.map(r=>'<article style="padding:10px;border:1px solid #374151;border-radius:7px;margin:6px 0;background:#111827"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>'+esc(r.equipo_nombre||r.equipo_id)+'</strong><span style="color:#93c5fd">'+esc(r.estado)+'</span></div><div style="font-size:12px;color:#9ca3af;margin:5px 0">'+esc(r.tipo)+' · '+esc(fecha(r.iniciado_en))+' · '+esc(r.cantidad_puntos||0)+' puntos · '+esc(distancia(r.distancia_m))+'</div><button type="button" data-recorrido="'+esc(r.id)+'" style="padding:7px 10px;background:#1d4ed8;color:#fff;border:0;border-radius:5px;cursor:pointer">Ver recorrido y cruces de zonas</button></article>').join(''):'<p style="color:#9ca3af">No hay recorridos GPS registrados todavía.</p>';
  el.querySelectorAll('[data-recorrido]').forEach(b=>b.addEventListener('click',()=>verRecorrido(b.dataset.recorrido)));
}
export async function detenerModuloPanelGeografico(){ if(mapa){mapa.remove();mapa=null;} capas=null; puntosActuales=[]; capaSimulada=null; }
export async function cargarModuloPanelGeografico(contenedor){
  await detenerModuloPanelGeografico();
  if(!['administrador','superadministrador'].includes(obtenerRolActual())){contenedor.innerHTML='<p>Este panel es exclusivo de administración.</p>';return;}
  contenedor.style.cssText+=';display:block;width:100%;max-width:100%;padding:0;margin:0';
  contenedor.innerHTML=`<section style="padding:12px;color:#e5e7eb;font-family:Arial,sans-serif;max-width:1600px;margin:auto">
    <h2 style="margin:0 0 5px">🗺️ Panel geográfico de supervisión</h2>
    <p style="color:#9ca3af;margin:0 0 12px">Mapa territorial y recorridos GPS sincronizados de Centinela. No representa ubicación en vivo: muestra recorridos registrados y calcula cruces usando los polígonos activos actuales.</p>
    <div id="geo-admin-estado" role="status" style="padding:9px;background:#111827;border-radius:6px;margin-bottom:9px">Cargando datos…</div>
    <div id="geo-admin-mapa" style="height:55vh;min-height:380px;width:100%;border-radius:8px;background:#1f2937;margin-bottom:10px"></div>
    <section style="background:#0f172a;border:1px solid #6b356f;border-radius:8px;padding:10px;margin-bottom:10px"><h3 style="margin:0 0 5px">🧪 Controlin · recorridos por día</h3><p style="color:#d8b4fe;font-size:12px;margin:0 0 9px">Elegí una fecha y seleccioná la ronda en las pastillas. Los trazados son simulados, no GPS histórico real.</p><div id="geo-admin-controlin">Preparando recorridos…</div></section><section style="background:#0f172a;border:1px solid #374151;border-radius:8px;padding:10px;margin-bottom:10px"><h3 style="margin:0 0 7px">Recorridos GPS reales registrados</h3><div id="geo-admin-recorridos">Cargando…</div></section>
    <section style="background:#0f172a;border:1px solid #374151;border-radius:8px;padding:10px"><h3 style="margin:0 0 5px">Entradas y salidas inferidas</h3><p style="color:#9ca3af;font-size:12px">El cruce se estima entre muestras GPS consecutivas. Si el polígono cambió desde el recorrido, el resultado refleja la geometría actual, no necesariamente la histórica.</p><div id="geo-admin-eventos"><p style="color:#9ca3af">Elegí un recorrido para calcular los eventos.</p></div></section>
  </section>`;
  mapa=L.map('geo-admin-mapa').setView([-31.47,-64.24],15); agregarCapasBase(mapa); capas=L.layerGroup().addTo(mapa);
  try{await Promise.all([cargarTerritorios(),cargarRecorridos()]);pintarPuntos([]);renderLista();generarRecorridosControlin();renderListaControlin();estado(territorios.length+' zonas activas · '+recorridos.length+' recorridos GPS reales · '+recorridosControlin.length+' jornadas de Controlin simuladas.');}
  catch(e){estado('Error cargando el panel: '+(e.message||e),true);}
  setTimeout(()=>mapa?.invalidateSize(),200);
}
