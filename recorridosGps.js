// Recorridos GPS de Centinela 2.0.
// Captura en primer plano, cola IndexedDB y sincronización idempotente por secuencia.
import { clienteSupabase } from './supabaseClient.js';
import { obtenerRolActual } from './auth.js';

const CLAVE_ACTIVO = 'centinela.recorridosGps.activo.v1';
const DB_NAME = 'centinela-recorridos-gps';
const STORE = 'puntos-pendientes';
const INTERVALO_MS = 10000;
const DESPLAZAMIENTO_MIN_M = 15;
const PRECISION_MAX_M = 50;

let mapa = null;
let watchId = null;
let activo = null;
let secuenciaCaptura = 0;
let ultimaPosicionAceptada = null;
let ultimaCapturaMs = 0;
let contenedorActual = null;
let sincronizando = false;
let manejadorOnline = null;

const esAdmin = () => ['administrador', 'superadministrador'].includes(obtenerRolActual());

function escapar(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function distancia(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b.latitud - a.latitud), dLng = rad(b.longitud - a.longitud);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function formatoDistancia(m) {
  return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' km';
}
function tokenAleatorio() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
function leerActivo() {
  try { return JSON.parse(localStorage.getItem(CLAVE_ACTIVO) || 'null'); } catch { return null; }
}
function guardarActivo() {
  if (activo) localStorage.setItem(CLAVE_ACTIVO, JSON.stringify(activo));
  else localStorage.removeItem(CLAVE_ACTIVO);
}
function estado(texto, error = false) {
  const el = document.getElementById('rgps-estado');
  if (el) { el.textContent = texto; el.style.color = error ? '#fca5a5' : '#cbd5e1'; }
}

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function guardarPuntoLocal(punto) {
  const db = await abrirDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ key: punto.recorrido_id + ':' + punto.secuencia, ...punto });
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function listarPuntosLocales(recorridoId) {
  const db = await abrirDB();
  const todos = await new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error);
  });
  db.close();
  return todos.filter(p => p.recorrido_id === recorridoId).sort((a, b) => a.secuencia - b.secuencia);
}
async function borrarPuntosLocales(puntos) {
  if (!puntos.length) return;
  const db = await abrirDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    puntos.forEach(p => store.delete(p.key || (p.recorrido_id + ':' + p.secuencia)));
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function contarPendientes() {
  if (!activo) return 0;
  return (await listarPuntosLocales(activo.id)).length;
}

async function sincronizarPuntos() {
  if (!activo || !navigator.onLine || sincronizando) return;
  sincronizando = true;
  try {
    const pendientes = await listarPuntosLocales(activo.id);
    for (let i = 0; i < pendientes.length; i += 100) {
      const lote = pendientes.slice(i, i + 100);
      const payload = lote.map(({ recorrido_id, secuencia, latitud, longitud, capturado_en, precision_m }) =>
        ({ secuencia, latitud, longitud, capturado_en, precision_m }));
      const { error } = await clienteSupabase.rpc('registrar_puntos_recorrido_gps', {
        p_recorrido_id: activo.id, p_token: activo.token, p_puntos: payload
      });
      if (error) throw error;
      await borrarPuntosLocales(lote);
    }
    const n = await contarPendientes();
    const pendienteFinalizar = activo?.finalizarPendiente;
    estado(n ? 'Quedan ' + n + ' puntos pendientes de enviar.' : 'GPS activo · puntos sincronizados.');
    if (pendienteFinalizar && n === 0) await finalizarEnServidor(pendienteFinalizar.cancelar);
  } catch (e) {
    estado('Sincronización pendiente: ' + (e.message || e) + '. Se conservaron los puntos en este dispositivo.', true);
  } finally {
    sincronizando = false;
    actualizarContadorPendientes().catch(() => {});
  }
}
async function actualizarContadorPendientes() {
  const el = document.getElementById('rgps-pendientes');
  if (!el) return;
  const n = await contarPendientes();
  el.textContent = n ? n + ' punto(s) pendientes de sincronizar' : 'Sin pendientes locales';
}

async function iniciarRecorrido() {
  const equipoId = document.getElementById('rgps-equipo-id')?.value.trim() || '';
  const equipoNombre = document.getElementById('rgps-equipo-nombre')?.value.trim() || '';
  const tipo = document.getElementById('rgps-tipo')?.value || 'ronda';
  if (equipoId.length < 2 || equipoNombre.length < 2) {
    estado('Completa el identificador del dispositivo/equipo y el nombre de guardia.', true); return;
  }
  if (!navigator.geolocation) { estado('Este navegador no permite GPS.', true); return; }
  if (!window.isSecureContext) { estado('El GPS requiere HTTPS.', true); return; }
  if (!navigator.onLine) { estado('Para iniciar un recorrido nuevo necesitas conexión. Una vez iniciado, puede continuar temporalmente sin conexión.', true); return; }
  try {
    const token = tokenAleatorio();
    const { data, error } = await clienteSupabase.rpc('iniciar_recorrido_gps', {
      p_equipo_id: equipoId, p_equipo_nombre: equipoNombre, p_tipo: tipo, p_token: token
    });
    if (error) throw error;
    activo = { id: data.id, token, equipoId, equipoNombre, tipo, secuencia: 0, iniciadoEn: data.iniciado_en, finalizarPendiente: false };
    secuenciaCaptura = 0; ultimaPosicionAceptada = null; ultimaCapturaMs = 0;
    localStorage.setItem('centinela.recorridosGps.equipo.v1', JSON.stringify({ equipoId, equipoNombre }));
    guardarActivo();
    mostrarEstadoActivo();
    iniciarCaptura();
    estado('Recorrido iniciado. Mantén Centinela visible para mejorar la continuidad del GPS.');
  } catch (e) { estado('No se pudo iniciar el recorrido: ' + (e.message || e), true); }
}
function actualizarPosicion(pos) {
  if (!activo || !contenedorActual) return;
  const c = pos.coords;
  const punto = {
    recorrido_id: activo.id, secuencia: ++activo.secuencia,
    latitud: Number(c.latitude), longitud: Number(c.longitude),
    capturado_en: new Date(pos.timestamp || Date.now()).toISOString(),
    precision_m: Number.isFinite(c.accuracy) ? Number(c.accuracy) : null
  };
  const ahora = Date.now();
  if (punto.precision_m !== null && punto.precision_m > PRECISION_MAX_M) {
    activo.secuencia--; estado('Se omitió una posición con precisión de ' + Math.round(punto.precision_m) + ' m (> ' + PRECISION_MAX_M + ' m).', true); return;
  }
  if (ultimaPosicionAceptada && ahora - ultimaCapturaMs < INTERVALO_MS &&
      distancia(ultimaPosicionAceptada, punto) < DESPLAZAMIENTO_MIN_M) {
    activo.secuencia--; return;
  }
  ultimaPosicionAceptada = { latitud: punto.latitud, longitud: punto.longitud };
  ultimaCapturaMs = ahora;
  guardarActivo();
  guardarPuntoLocal(punto).then(async () => {
    const coords = document.getElementById('rgps-coordenadas');
    if (coords) coords.textContent = punto.latitud.toFixed(6) + ', ' + punto.longitud.toFixed(6) + ' · precisión ' + Math.round(punto.precision_m || 0) + ' m';
    await actualizarContadorPendientes();
    if (navigator.onLine) sincronizarPuntos();
  }).catch(e => estado('No se pudo guardar el punto en el dispositivo: ' + (e.message || e), true));
}
function errorGPS(err) {
  const msg = { 1: 'Permiso GPS denegado.', 2: 'No se pudo determinar la posición.', 3: 'Tiempo de espera GPS agotado.' };
  estado((msg[err.code] || 'Error GPS.') + ' El recorrido permanece abierto.', true);
}
function iniciarCaptura() {
  if (!activo || !navigator.geolocation) return;
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(actualizarPosicion, errorGPS, {
    enableHighAccuracy: true, maximumAge: 3000, timeout: 20000
  });
}
async function finalizarEnServidor(cancelar = false) {
  if (!activo || !navigator.onLine) return;
  const { data, error } = await clienteSupabase.rpc('finalizar_recorrido_gps', {
    p_recorrido_id: activo.id, p_token: activo.token, p_cancelar: Boolean(cancelar)
  });
  if (error) throw error;
  detenerCaptura();
  const terminado = activo;
  activo = null; guardarActivo();
  mostrarFormulario();
  estado((cancelar ? 'Recorrido cancelado.' : 'Recorrido finalizado.') + ' Distancia aproximada: ' + formatoDistancia(Number(data?.distancia_m || 0)) + '.');
  await cargarHistorialYCaminos();
}
async function finalizarRecorrido(cancelar = false) {
  if (!activo) return;
  if (!confirm(cancelar ? '¿Cancelar este recorrido? Los puntos capturados se conservarán en el historial.' : '¿Finalizar el recorrido y sincronizar los puntos pendientes?')) return;
  try {
    const pendientes = await contarPendientes();
    if (!navigator.onLine || pendientes > 0) {
      activo.finalizarPendiente = Boolean(cancelar);
      guardarActivo();
      estado('Finalización en cola. Al recuperar conexión se enviarán los puntos pendientes y se cerrará el recorrido.');
      detenerCaptura();
      if (navigator.onLine) await sincronizarPuntos();
      return;
    }
    await finalizarEnServidor(cancelar);
  } catch (e) { estado('No se pudo finalizar: ' + (e.message || e), true); }
}
function detenerCaptura() {
  if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}
function mostrarEstadoActivo() {
  const f = document.getElementById('rgps-form');
  const c = document.getElementById('rgps-controles-activo');
  if (f) f.style.display = activo ? 'none' : '';
  if (c) c.style.display = activo ? '' : 'none';
  const equipo = document.getElementById('rgps-equipo-activo');
  if (equipo && activo) equipo.textContent = activo.equipoNombre + ' · ' + activo.tipo + ' · iniciado ' + new Date(activo.iniciadoEn).toLocaleString('es-AR');
}
function mostrarFormulario() {
  const f = document.getElementById('rgps-form');
  const c = document.getElementById('rgps-controles-activo');
  if (f) f.style.display = activo ? 'none' : '';
  if (c) c.style.display = activo ? '' : 'none';
}
async function cargarHistorialYCaminos() {
  const lista = document.getElementById('rgps-historial');
  if (!lista || !mapa) return;
  const capas = window.L.layerGroup().addTo(mapa);
  try {
    const { data: caminos, error: errCaminos } = await clienteSupabase
      .from('caminos_internos').select('id,nombre,coordenadas,estado').eq('estado', 'validado');
    if (!errCaminos) (caminos || []).forEach(c => {
      const coords = (c.coordenadas || []).map(p => [Number(p[1]), Number(p[0])]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (coords.length >= 2) window.L.polyline(coords, { color: '#22c55e', weight: 5, opacity: .9 }).bindTooltip('Camino validado: ' + escapar(c.nombre)).addTo(capas);
    });
    if (!esAdmin()) {
      lista.innerHTML = '<p style="color:#9ca3af;font-size:13px">Los caminos validados se muestran en verde. El historial completo de recorridos está reservado a administración.</p>';
      return;
    }
    const { data: recorridos, error } = await clienteSupabase.from('recorridos_gps')
      .select('id,equipo_id,equipo_nombre,tipo,estado,iniciado_en,finalizado_en,distancia_m,cantidad_puntos')
      .order('iniciado_en', { ascending: false }).limit(100);
    if (error) throw error;
    if (!recorridos?.length) {
      lista.innerHTML = '<p style="color:#9ca3af">Todavía no hay recorridos registrados.</p>'; return;
    }
    lista.innerHTML = recorridos.map(r => '<article style="padding:10px;border:1px solid #374151;border-radius:7px;margin:7px 0;background:#111827">' +
      '<strong>' + escapar(r.equipo_nombre) + '</strong><div style="font-size:12px;color:#9ca3af;margin:4px 0">' +
      escapar(r.tipo) + ' · ' + escapar(r.estado) + ' · ' + new Date(r.iniciado_en).toLocaleString('es-AR') +
      '</div><div style="font-size:12px;color:#cbd5e1">' + Number(r.cantidad_puntos || 0) + ' puntos · ' + formatoDistancia(Number(r.distancia_m || 0)) + '</div>' +
      (r.estado === 'finalizado' ? '<button type="button" data-validar="' + escapar(r.id) + '" style="margin-top:7px;padding:7px;background:#166534;color:white;border:0;border-radius:5px;cursor:pointer">Validar como camino</button>' : '') +
      '<button type="button" data-ver="' + escapar(r.id) + '" style="margin:7px 0 0 6px;padding:7px;background:#1d4ed8;color:white;border:0;border-radius:5px;cursor:pointer">Ver recorrido</button></article>'
    ).join('');
    lista.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => mostrarRecorrido(b.dataset.ver, capas)));
    lista.querySelectorAll('[data-validar]').forEach(b => b.addEventListener('click', async () => {
      const nombre = prompt('Nombre del camino interno que se va a validar:');
      if (!nombre || nombre.trim().length < 2) return;
      try {
        const { error: e } = await clienteSupabase.rpc('validar_recorrido_como_camino_gps', { p_recorrido_id: b.dataset.validar, p_nombre: nombre.trim() });
        if (e) throw e;
        estado('Camino guardado como validado y disponible en el mapa operativo.');
        await cargarHistorialYCaminos();
      } catch (e) { estado('No se pudo validar el camino: ' + (e.message || e), true); }
    }));
  } catch (e) {
    lista.innerHTML = '<p style="color:#fca5a5">No se pudo cargar el historial: ' + escapar(e.message || e) + '</p>';
  }
}
async function mostrarRecorrido(id, capas) {
  const { data, error } = await clienteSupabase.from('puntos_recorrido_gps')
    .select('latitud,longitud,secuencia').eq('recorrido_id', id).order('secuencia', { ascending: true }).limit(20000);
  if (error) { estado('No se pudo cargar el trazado: ' + error.message, true); return; }
  if (!data?.length) { estado('Este recorrido no tiene puntos sincronizados.', true); return; }
  const coords = data.map(p => [Number(p.latitud), Number(p.longitud)]);
  window.L.polyline(coords, { color: '#f97316', weight: 4 }).addTo(capas);
  mapa.fitBounds(coords, { padding: [24, 24], maxZoom: 19 });
  estado('Mostrando ' + data.length + ' puntos del recorrido seleccionado.');
}
export function detenerModuloRecorridosGPS() {
  detenerCaptura();
  if (mapa) { mapa.remove(); mapa = null; }
  if (manejadorOnline) window.removeEventListener('online', manejadorOnline);
  manejadorOnline = null;
  contenedorActual = null;
}
export async function cargarModuloRecorridosGPS(contenedor) {
  detenerModuloRecorridosGPS();
  contenedorActual = contenedor;
  contenedor.style.cssText += ';display:block;width:100%;max-width:100%;padding:0;margin:0';
  contenedor.innerHTML = `
    <section style="padding:12px;color:#e5e7eb;font-family:Arial,sans-serif;max-width:1500px;margin:auto">
      <h2 style="margin:0 0 5px">🧭 Recorridos GPS y caminos internos</h2>
      <p style="color:#9ca3af;margin:0 0 12px">Se registra el dispositivo/equipo de guardia, no una identidad personal garantizada. La captura GPS funciona mientras la PWA permanece activa en primer plano.</p>
      <div id="rgps-estado" role="status" style="padding:9px 10px;background:#111827;border-radius:6px;margin-bottom:8px">Preparando módulo…</div>
      <form id="rgps-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px;background:#0f172a;border:1px solid #374151;border-radius:8px;padding:12px;margin-bottom:10px">
        <label style="font-size:13px">ID de dispositivo/equipo<input id="rgps-equipo-id" required maxlength="120" placeholder="Ej. MOVIL-01" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px;background:#111827;color:white;border:1px solid #4b5563;border-radius:6px"></label>
        <label style="font-size:13px">Nombre de guardia<input id="rgps-equipo-nombre" required maxlength="120" placeholder="Ej. Guardia A / Móvil 1" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px;background:#111827;color:white;border:1px solid #4b5563;border-radius:6px"></label>
        <label style="font-size:13px">Tipo<select id="rgps-tipo" style="display:block;width:100%;box-sizing:border-box;padding:10px;margin-top:5px;background:#111827;color:white;border:1px solid #4b5563;border-radius:6px"><option value="ronda">Ronda</option><option value="relevamiento">Relevamiento de caminos</option><option value="inspeccion">Inspección</option></select></label>
        <button type="submit" style="align-self:end;padding:11px;background:#16a34a;color:#04120a;border:0;border-radius:6px;font-weight:bold;cursor:pointer">▶ Iniciar recorrido</button>
      </form>
      <section id="rgps-controles-activo" style="display:none;background:#0f172a;border:1px solid #166534;border-radius:8px;padding:12px;margin-bottom:10px">
        <strong id="rgps-equipo-activo"></strong><div id="rgps-coordenadas" style="font-size:12px;color:#9ca3af;margin:6px 0">Esperando GPS…</div>
        <div id="rgps-pendientes" style="font-size:12px;color:#93c5fd;margin:5px 0">Verificando cola local…</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button id="rgps-finalizar" type="button" style="padding:10px;background:#2563eb;color:white;border:0;border-radius:6px;cursor:pointer">■ Finalizar recorrido</button><button id="rgps-cancelar" type="button" style="padding:10px;background:#7f1d1d;color:white;border:0;border-radius:6px;cursor:pointer">Cancelar recorrido</button></div>
      </section>
      <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:10px">
        <div id="rgps-mapa" style="height:50vh;min-height:340px;width:100%;border-radius:8px;background:#1f2937"></div>
        <section style="background:#0f172a;border:1px solid #374151;border-radius:8px;padding:10px">
          <h3 style="font-size:15px;margin:0 0 6px">Caminos e historial</h3><div id="rgps-historial">Cargando…</div>
        </section>
      </div>
    </section>`;
  mapa = window.L.map('rgps-mapa').setView([-38.88, -62.08], 15);
  window.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri', maxZoom: 22
  }).addTo(mapa);
  const guardado = (() => { try { return JSON.parse(localStorage.getItem('centinela.recorridosGps.equipo.v1') || 'null'); } catch { return null; } })();
  if (guardado) {
    document.getElementById('rgps-equipo-id').value = guardado.equipoId || '';
    document.getElementById('rgps-equipo-nombre').value = guardado.equipoNombre || '';
  }
  activo = leerActivo();
  if (activo) {
    mostrarEstadoActivo();
    iniciarCaptura();
    estado('Se recuperó el recorrido activo de este dispositivo.');
    sincronizarPuntos();
    actualizarContadorPendientes().catch(() => {});
  } else mostrarFormulario();
  document.getElementById('rgps-form').addEventListener('submit', e => { e.preventDefault(); iniciarRecorrido(); });
  document.getElementById('rgps-finalizar').addEventListener('click', () => finalizarRecorrido(false));
  document.getElementById('rgps-cancelar').addEventListener('click', () => finalizarRecorrido(true));
  manejadorOnline = () => { if (activo) sincronizarPuntos(); };
  window.addEventListener('online', manejadorOnline);
  setTimeout(() => mapa?.invalidateSize(), 200);
  await cargarHistorialYCaminos();
}
