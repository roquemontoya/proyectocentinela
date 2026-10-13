// ==========================================
// GPS operativo: ubicación actual y activos cercanos
// Proyecto Centinela 2.0
// ==========================================
import { clienteSupabase } from './supabaseClient.js';
import { agregarCapasBase } from './mapaBase.js';

const VISTA_INICIAL = [-38.88, -62.08];
const RADIO_INICIAL = 1000;
const COLORES = {
  'Hidrantes': '#38bdf8',
  'Extintores': '#f97316',
  'ECAS': '#a78bfa',
  'Valvulas': '#facc15',
  'VECAS': '#34d399',
  'Purgas ECAS (PECAS)': '#fb7185',
  'IPP (Macro Sectores)': '#94a3b8'
};
let mapa = null;
let marcadorUsuario = null;
let circuloPrecision = null;
let capaActivos = null;
let watchId = null;
let activosConPunto = [];
let posicionActual = null;
let radioMetros = RADIO_INICIAL;
let secuencia = 0;

function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function nombreActivo(item) {
  return item.etiqueta || item.nombre || item.rotulo || (item.categoria + ' #' + item.id);
}

function coordenadas(item) {
  const latRaw = item?.latitud ?? item?.lat;
  const lngRaw = item?.longitud ?? item?.lng ?? item?.lon ?? item?.long;
  if (latRaw !== null && latRaw !== undefined && lngRaw !== null && lngRaw !== undefined &&
      String(latRaw).trim() !== '' && String(lngRaw).trim() !== '') {
    const lat = Number(latRaw), lng = Number(lngRaw);
    if (valida(lat, lng)) return [lat, lng];
  }

  const valor = item?.ubicacion_wkt ?? item?.ubicacion ?? item?.['ubicación'] ??
    item?.geom ?? item?.coordenadas ?? item?.coordenada ?? item?.wkt;
  if (typeof valor !== 'string' || !valor.trim()) return null;
  const texto = valor.trim();
  let m = texto.match(/^\s*POINT\s*(?:Z\s*)?\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)\s*$/i);
  if (m) {
    const lng = Number(m[1]), lat = Number(m[2]);
    return valida(lat, lng) ? [lat, lng] : null;
  }
  m = texto.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (valida(a, b)) return [a, b];
    if (valida(b, a)) return [b, a];
  }
  return null;
}

function valida(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function distanciaMetros(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatoDistancia(metros) {
  return metros < 1000 ? Math.round(metros) + ' m' : (metros / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' km';
}

function mostrarEstado(texto, error = false) {
  const el = document.getElementById('gps-estado');
  if (!el) return;
  el.textContent = texto;
  el.style.color = error ? '#fca5a5' : '#cbd5e1';
}

async function consultarActivos() {
  const todos = [];
  const tamanoPagina = 1000;
  for (let desde = 0; ; desde += tamanoPagina) {
    const { data, error } = await clienteSupabase
      .from('leu')
      .select('*')
      .order('id', { ascending: true })
      .range(desde, desde + tamanoPagina - 1);
    if (error) throw error;
    const pagina = data || [];
    todos.push(...pagina);
    if (pagina.length < tamanoPagina) break;
  }
  return todos;
}

function limpiarCapaActivos() {
  if (capaActivos && mapa) mapa.removeLayer(capaActivos);
  capaActivos = L.layerGroup().addTo(mapa);
}

function renderizarActivosCercanos() {
  if (!mapa || !posicionActual) return;
  limpiarCapaActivos();
  const cercanos = activosConPunto
    .map(item => ({ item, distancia: distanciaMetros(posicionActual, item.coords) }))
    .filter(x => x.distancia <= radioMetros)
    .sort((a, b) => a.distancia - b.distancia);

  cercanos.forEach(({ item, distancia }) => {
    const color = COLORES[item.categoria] || '#60a5fa';
    const marcador = L.circleMarker(item.coords, {
      radius: 7, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 0.95
    }).addTo(capaActivos);
    marcador.bindPopup(
      '<div style="font-family:Arial,sans-serif;min-width:170px;color:#111">' +
      '<strong>' + escapar(nombreActivo(item)) + '</strong>' +
      '<div style="margin-top:5px">Categoría: ' + escapar(item.categoria || 'Sin categoría') + '</div>' +
      '<div>Distancia: <b>' + formatoDistancia(distancia) + '</b></div>' +
      (item.sector ? '<div>Sector: ' + escapar(item.sector) + '</div>' : '') +
      '</div>'
    );
    marcador.bindTooltip(escapar(nombreActivo(item)), { direction: 'top' });
  });

  const resumen = document.getElementById('gps-resumen');
  if (resumen) {
    resumen.innerHTML = '<strong>' + cercanos.length + '</strong> activos dentro de ' +
      (radioMetros >= 1000 ? (radioMetros / 1000) + ' km' : radioMetros + ' m') +
      (activosConPunto.length ? ' · ' + activosConPunto.length + ' activos con coordenadas cargadas' : '');
  }

  const lista = document.getElementById('gps-lista');
  if (lista) {
    lista.innerHTML = cercanos.length
      ? cercanos.slice(0, 30).map(({ item, distancia }, i) =>
        '<button type="button" data-gps-index="' + i + '" style="display:block;width:100%;text-align:left;padding:9px 10px;margin:4px 0;background:#111827;color:#e5e7eb;border:1px solid #374151;border-radius:6px;cursor:pointer">' +
        '<span style="display:flex;justify-content:space-between;gap:8px"><strong>' + escapar(nombreActivo(item)) + '</strong><b style="white-space:nowrap;color:#93c5fd">' + formatoDistancia(distancia) + '</b></span>' +
        '<small style="display:block;color:#9ca3af;margin-top:3px">' + escapar(item.categoria || 'Sin categoría') + (item.sector ? ' · ' + escapar(item.sector) : '') + '</small>' +
        '</button>'
      ).join('')
      : '<p style="color:#9ca3af;font-size:13px">No hay activos con coordenadas dentro de este radio.</p>';

    lista.querySelectorAll('[data-gps-index]').forEach(boton => {
      boton.addEventListener('click', () => {
        const elegido = cercanos[Number(boton.dataset.gpsIndex)];
        if (!elegido || !mapa) return;
        mapa.setView(elegido.item.coords, Math.max(mapa.getZoom(), 18));
        capaActivos.eachLayer(layer => {
          if (layer.getLatLng && layer.getLatLng().lat === elegido.item.coords[0] &&
              layer.getLatLng().lng === elegido.item.coords[1]) layer.openPopup();
        });
      });
    });
  }
}

function actualizarPosicion(posicion) {
  if (!mapa) return;
  const primeraPosicion = !posicionActual;
  posicionActual = [posicion.coords.latitude, posicion.coords.longitude];
  if (primeraPosicion) mapa.setView(posicionActual, 18);
  const precision = Math.max(5, Number(posicion.coords.accuracy) || 25);
  if (!marcadorUsuario) {
    marcadorUsuario = L.circleMarker(posicionActual, {
      radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1
    }).addTo(mapa).bindPopup('Tu ubicación actual');
  } else {
    marcadorUsuario.setLatLng(posicionActual);
  }
  if (circuloPrecision) mapa.removeLayer(circuloPrecision);
  circuloPrecision = L.circle(posicionActual, {
    radius: precision, color: '#60a5fa', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.08
  }).addTo(mapa);
  const coordenadasEl = document.getElementById('gps-coordenadas');
  if (coordenadasEl) coordenadasEl.textContent =
    posicionActual[0].toFixed(6) + ', ' + posicionActual[1].toFixed(6) +
    ' · precisión aprox. ' + Math.round(precision) + ' m';
  mostrarEstado('GPS activo. Ubicación actualizada.');
  renderizarActivosCercanos();
}

function errorGPS(error) {
  const mensajes = {
    1: 'Permiso de ubicación denegado. Habilita el GPS para este sitio desde el navegador.',
    2: 'El dispositivo no pudo determinar la ubicación. Comprueba que el GPS esté activado.',
    3: 'La solicitud de ubicación agotó el tiempo. Intenta nuevamente.'
  };
  mostrarEstado(mensajes[error.code] || 'No se pudo obtener la ubicación del dispositivo.', true);
}

function iniciarGPS() {
  if (!navigator.geolocation) {
    mostrarEstado('Este navegador no ofrece geolocalización.', true);
    return;
  }
  if (!window.isSecureContext) {
    mostrarEstado('El GPS requiere HTTPS o localhost. Abre Centinela desde su dirección segura.', true);
    return;
  }
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  mostrarEstado('Solicitando permiso de ubicación al dispositivo…');
  watchId = navigator.geolocation.watchPosition(actualizarPosicion, errorGPS, {
    enableHighAccuracy: true, maximumAge: 5000, timeout: 20000
  });
}

export function detenerModuloGPS() {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (mapa) {
    mapa.remove();
    mapa = null;
  }
  marcadorUsuario = null;
  circuloPrecision = null;
  capaActivos = null;
  posicionActual = null;
}

export async function cargarModuloGPS(contenedor) {
  detenerModuloGPS();
  const miSecuencia = ++secuencia;
  contenedor.style.cssText += ';display:block;width:100%;max-width:100%;padding:0;margin:0';
  contenedor.innerHTML = `
    <section style="padding:12px;color:#e5e7eb;font-family:Arial,sans-serif;max-width:1500px;margin:auto">
      <h2 style="margin:0 0 5px">📍 Mi ubicación y activos cercanos</h2>
      <p style="color:#9ca3af;margin:0 0 12px">La posición se obtiene en este dispositivo. Centinela no guarda ni transmite tu ubicación personal.</p>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
        <button id="gps-iniciar" type="button" style="padding:10px 13px;background:#2563eb;color:#fff;border:0;border-radius:6px;font-weight:bold;cursor:pointer">◎ Usar mi ubicación</button>
        <label style="display:flex;align-items:center;gap:7px;color:#cbd5e1">Buscar en
          <select id="gps-radio" style="padding:9px;background:#111827;color:#fff;border:1px solid #4b5563;border-radius:6px">
            <option value="250">250 m</option><option value="500">500 m</option><option value="1000" selected>1 km</option><option value="2000">2 km</option><option value="5000">5 km</option>
          </select>
        </label>
      </div>
      <div id="gps-estado" role="status" style="padding:9px 10px;background:#111827;border-radius:6px;margin-bottom:6px">Preparando GPS…</div>
      <div id="gps-coordenadas" style="font-size:12px;color:#9ca3af;margin-bottom:8px">Esperando ubicación del dispositivo…</div>
      <div id="gps-resumen" style="font-size:13px;margin-bottom:8px">Cargando activos desde LEU…</div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:10px">
        <div id="gps-mapa" style="height:55vh;min-height:360px;width:100%;border-radius:8px;background:#1f2937"></div>
        <section style="background:#0f172a;border:1px solid #374151;border-radius:8px;padding:10px">
          <h3 style="font-size:15px;margin:0 0 6px">Activos más cercanos</h3>
          <div id="gps-lista" style="max-height:240px;overflow:auto">Cargando activos…</div>
        </section>
      </div>
    </section>`;
  mapa = L.map('gps-mapa', { zoomControl: true }).setView(VISTA_INICIAL, 16);
  agregarCapasBase(mapa);
  document.getElementById('gps-iniciar').addEventListener('click', iniciarGPS);
  document.getElementById('gps-radio').addEventListener('change', evento => {
    radioMetros = Number(evento.target.value) || RADIO_INICIAL;
    renderizarActivosCercanos();
  });
  setTimeout(() => mapa?.invalidateSize(), 200);

  try {
    const todos = await consultarActivos();
    if (miSecuencia !== secuencia || !mapa) return;
    activosConPunto = todos.map(item => ({ ...item, coords: coordenadas(item) }))
      .filter(item => item.coords && item.categoria !== 'IPP (Macro Sectores)');
    mostrarEstado('Activos cargados. Pulsa «Usar mi ubicación» y concede el permiso de GPS.');
    const resumen = document.getElementById('gps-resumen');
    if (resumen) resumen.textContent = 'Activos cargados: ' + todos.length + ' · Con coordenadas: ' + activosConPunto.length;
    iniciarGPS();
  } catch (error) {
    if (miSecuencia !== secuencia) return;
    mostrarEstado('No se pudieron cargar los activos desde LEU: ' + (error.message || error), true);
    const lista = document.getElementById('gps-lista');
    if (lista) lista.textContent = 'Error al consultar activos. Revisa la conexión y vuelve a abrir el módulo.';
  }
}
