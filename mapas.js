// ==========================================
// MÓDULO: Mapas y Geolocalización (Leaflet)
// Fuente canónica de activos: public.leu
// ==========================================

import { clienteSupabase } from './supabaseClient.js';
import { agregarCapasBase } from './mapaBase.js';

const MAPEO_MODULOS = {
    hidrantes: { categoria: 'Hidrantes', nombreLegible: 'Hidrantes' },
    extintores: { categoria: 'Extintores', nombreLegible: 'Extintores' },
    ecas: { categoria: 'ECAS', nombreLegible: 'ECAS' },
    valvulas: { categoria: 'Valvulas', nombreLegible: 'Válvulas' },
    vecas: { categoria: 'VECAS', nombreLegible: 'VECAS' },
    pecas: { categoria: 'Purgas ECAS (PECAS)', nombreLegible: 'PECAS' },
    ipp: { categoria: 'IPP (Macro Sectores)', nombreLegible: 'IPP' }
};

let mapaActivo = null;
let solicitudMapa = 0;
let gpsMapaWatchId = null;
let marcadorUsuarioMapa = null;
let circuloPrecisionMapa = null;
let posicionUsuarioMapa = null;
let activosPuntualesMapa = [];

function distanciaGPS(a, b) {
    const rad = n => n * Math.PI / 180;
    const dLat = rad(b[0] - a[0]);
    const dLng = rad(b[1] - a[1]);
    const x = Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatoDistanciaGPS(metros) {
    return metros < 1000 ? Math.round(metros) + ' m' :
        (metros / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' km';
}

function detenerGPSMapa() {
    if (gpsMapaWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(gpsMapaWatchId);
        gpsMapaWatchId = null;
    }
    if (mapaActivo) {
        if (marcadorUsuarioMapa) mapaActivo.removeLayer(marcadorUsuarioMapa);
        if (circuloPrecisionMapa) mapaActivo.removeLayer(circuloPrecisionMapa);
    }
    marcadorUsuarioMapa = null;
    circuloPrecisionMapa = null;
    posicionUsuarioMapa = null;
    activosPuntualesMapa = [];
}

export function detenerModuloMapa() {
    solicitudMapa++;
    detenerGPSMapa();
    if (mapaActivo) {
        mapaActivo.remove();
        mapaActivo = null;
    }
}

function actualizarListaCercanosMapa() {
    const lista = document.getElementById('gps-mapa-cercanos');
    const contador = document.getElementById('gps-mapa-contador');
    const radioEl = document.getElementById('gps-mapa-radio');
    if (!lista || !posicionUsuarioMapa) return;
    const radio = Number(radioEl?.value || 1000);
    const cercanos = activosPuntualesMapa
        .map(a => ({ ...a, distancia: distanciaGPS(posicionUsuarioMapa, a.coords) }))
        .filter(a => a.distancia <= radio)
        .sort((a, b) => a.distancia - b.distancia);
    if (contador) contador.textContent = cercanos.length > 99 ? '99+' : String(cercanos.length);
    lista.innerHTML = cercanos.length
        ? cercanos.slice(0, 30).map((a, i) =>
            '<button type="button" data-gps-mapa-index="' + i + '" style="display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;padding:10px 9px;margin-top:5px;text-align:left;background:#172033;color:#fff;border:1px solid #374151;border-radius:7px;font-size:13px;cursor:pointer"><span style="min-width:0;overflow-wrap:anywhere">' +
            escaparHtml(a.nombre) + '</span><b style="white-space:nowrap;color:#93c5fd">' + formatoDistanciaGPS(a.distancia) + '</b></button>'
        ).join('')
        : '<div style="font-size:13px;color:#cbd5e1;padding:12px 4px">' +
            (posicionUsuarioMapa ? 'No hay puntos de esta categoría dentro del radio elegido.' : 'Activá tu ubicación para calcular distancias.') + '</div>';
    lista.querySelectorAll('[data-gps-mapa-index]').forEach(boton => {
        boton.addEventListener('click', () => {
            const a = cercanos[Number(boton.dataset.gpsMapaIndex)];
            if (!a || !mapaActivo) return;
            mapaActivo.setView(a.coords, Math.max(mapaActivo.getZoom(), 18));
            a.marcador.openPopup();
            const panel = document.getElementById('gps-mapa-lista-panel');
            const toggle = document.getElementById('gps-mapa-cercanos-toggle');
            if (panel) panel.hidden = true;
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        });
    });
    const estado = document.getElementById('gps-mapa-estado');
    if (estado) estado.textContent = cercanos.length + ' elemento(s) dentro de ' +
        (radio >= 1000 ? (radio / 1000) + ' km' : radio + ' m');
}

function iniciarGPSMapa() {
    const estado = document.getElementById('gps-mapa-estado');
    const boton = document.getElementById('gps-mapa-iniciar');
    if (!navigator.geolocation) {
        if (estado) estado.textContent = 'Este navegador no ofrece geolocalización.';
        return;
    }
    if (!window.isSecureContext) {
        if (estado) estado.textContent = 'La ubicación requiere HTTPS o localhost.';
        return;
    }
    if (gpsMapaWatchId !== null) navigator.geolocation.clearWatch(gpsMapaWatchId);
    if (estado) estado.textContent = 'Solicitando permiso de ubicación…';
    if (boton) boton.disabled = true;
    gpsMapaWatchId = navigator.geolocation.watchPosition(pos => {
        if (!mapaActivo) return;
        posicionUsuarioMapa = [pos.coords.latitude, pos.coords.longitude];
        const precision = Math.max(5, Number(pos.coords.accuracy) || 25);
        if (!marcadorUsuarioMapa) {
            marcadorUsuarioMapa = L.circleMarker(posicionUsuarioMapa, {
                radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1
            }).addTo(mapaActivo).bindPopup('Tu ubicación actual');
            mapaActivo.setView(posicionUsuarioMapa, 18);
        } else {
            marcadorUsuarioMapa.setLatLng(posicionUsuarioMapa);
        }
        if (circuloPrecisionMapa) mapaActivo.removeLayer(circuloPrecisionMapa);
        circuloPrecisionMapa = L.circle(posicionUsuarioMapa, {
            radius: precision, color: '#60a5fa', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.08
        }).addTo(mapaActivo);
        if (estado) estado.textContent = 'GPS activo · precisión aproximada ' + Math.round(precision) + ' m';
        if (boton) {
            boton.disabled = false;
            boton.setAttribute('aria-label', 'Centrar mapa en mi ubicación');
            boton.title = 'Centrar mapa en mi ubicación';
        }
        actualizarListaCercanosMapa();
    }, err => {
        const mensajes = {
            1: 'Permiso de ubicación denegado. Habilítalo en el navegador.',
            2: 'No se pudo determinar la ubicación. Comprueba el GPS del dispositivo.',
            3: 'La solicitud agotó el tiempo. Intenta nuevamente.'
        };
        if (estado) estado.textContent = mensajes[err.code] || 'No se pudo obtener la ubicación.';
        if (boton) {
            boton.disabled = false;
            boton.setAttribute('aria-label', 'Reintentar ubicación');
            boton.title = 'Reintentar ubicación';
        }
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}

function normalizarTexto(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[caracter]));
}

const PALETA_SECTORES_IPP = [
    '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c',
    '#0891b2', '#ca8a04', '#db2777', '#4f46e5', '#65a30d',
    '#0f766e', '#c2410c', '#7c3aed', '#be123c', '#0369a1',
    '#15803d', '#b45309', '#a21caf', '#475569', '#0e7490'
];

function obtenerSectorMapa(item) {
    return String(
        item?.sector ??
        buscarAtributo(item, 'Sector', 'Macro Sector', 'MacroSector', 'Ubicación', 'Ubicacion') ??
        'Sin sector'
    ).trim() || 'Sin sector';
}

function crearColoresSectoresIPP(activos) {
    const sectores = [...new Set(activos.map(obtenerSectorMapa))]
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    const colores = new Map();
    sectores.forEach((sector, indice) => {
        colores.set(sector, PALETA_SECTORES_IPP[indice % PALETA_SECTORES_IPP.length]);
    });
    return colores;
}

function obtenerCentroGeometria(geometria) {
    if (!geometria || geometria.tipo === 'punto') return geometria?.coordenadas || null;
    const puntos = Array.isArray(geometria.coordenadas)
        ? geometria.coordenadas.flat(1).filter(p => Array.isArray(p) && p.length >= 2)
        : [];
    if (!puntos.length) return null;
    const suma = puntos.reduce((acc, punto) => [acc[0] + Number(punto[0]), acc[1] + Number(punto[1])], [0, 0]);
    return [suma[0] / puntos.length, suma[1] / puntos.length];
}

function agregarEtiquetaSectorIPP(mapa, item, geometria, color) {
    const centro = obtenerCentroGeometria(geometria);
    if (!centro) return null;
    const sector = obtenerSectorMapa(item);
    return L.marker(centro, {
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
        icon: L.divIcon({
            className: 'centinela-ipp-sector-label',
            html: '<div style="display:inline-block;max-width:180px;padding:4px 8px;border:1px solid rgba(255,255,255,.9);border-radius:6px;background:' +
                color + 'dd;color:#fff;font:bold 12px Arial,sans-serif;line-height:1.15;text-align:center;text-shadow:0 1px 2px #000;box-shadow:0 1px 5px #0007;white-space:normal;pointer-events:none">' +
                escaparHtml(sector) + '</div>',
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        })
    }).addTo(mapa);
}

function agregarLeyendaSectoresIPP(mapa, colores) {
    if (!colores?.size) return;
    const control = L.control({ position: 'topright' });
    control.onAdd = () => {
        const div = L.DomUtil.create('div', 'centinela-ipp-leyenda');
        div.style.cssText = 'max-width:min(270px,calc(100vw - 90px));max-height:45vh;overflow:auto;padding:10px 12px;background:rgba(15,23,42,.94);color:#fff;border:1px solid #475569;border-radius:10px;box-shadow:0 2px 10px #0007;font:12px Arial,sans-serif';
        const filas = [...colores.entries()].map(([sector, color]) =>
            '<div style="display:flex;align-items:center;gap:7px;margin:4px 0;line-height:1.2">' +
            '<span style="flex:0 0 14px;width:14px;height:14px;border-radius:3px;background:' + color + ';border:1px solid #fff8"></span>' +
            '<span style="overflow-wrap:anywhere">' + escaparHtml(sector) + '</span></div>'
        ).join('');
        div.innerHTML = '<div style="font-weight:bold;font-size:13px;margin-bottom:6px">Sectores IPP</div>' + filas;
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        return div;
    };
    control.addTo(mapa);
    return control;
}

function obtenerAtributos(item) {
    const tecnicos = item?.atributos_tecnicos;
    return tecnicos?.atributos_originales || tecnicos?.originales || tecnicos || {};
}

function buscarAtributo(item, ...nombres) {
    const attrs = obtenerAtributos(item);
    const fuentes = [item || {}, attrs || {}];
    for (const nombre of nombres) {
        for (const fuente of fuentes) {
            const clave = Object.keys(fuente).find(k => normalizarTexto(k) === normalizarTexto(nombre));
            if (clave && fuente[clave] !== null && fuente[clave] !== undefined && String(fuente[clave]).trim() !== '') {
                return fuente[clave];
            }
        }
    }
    return '';
}

// Devuelve geometría Leaflet-compatible. Los pares sueltos de LEU están en latitud,longitud;
// WKT sigue el estándar x,y = longitud,latitud.
function extraerGeometria(item) {
    const latRaw = item?.latitud ?? item?.lat;
    const lngRaw = item?.longitud ?? item?.lng ?? item?.lon ?? item?.long;
    if (latRaw !== null && latRaw !== undefined && lngRaw !== null && lngRaw !== undefined) {
        const lat = Number(latRaw), lng = Number(lngRaw);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { tipo: 'punto', coordenadas: [lat, lng] };
        }
    }

    const valor = item?.ubicacion_wkt ?? item?.ubicacion ?? item?.['ubicación'] ??
        item?.geom ?? item?.coordenadas ?? item?.coordenada ?? item?.wkt;
    if (typeof valor !== 'string' || !valor.trim()) return null;
    const texto = valor.trim();

    const matchPoint = texto.match(/^\s*POINT\s*(?:Z\s*)?\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)\s*$/i);
    if (matchPoint) {
        const lng = Number(matchPoint[1]), lat = Number(matchPoint[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { tipo: 'punto', coordenadas: [lat, lng] };
        }
        return null;
    }

    const tipoWkt = texto.match(/^\s*(POLYGON|MULTIPOLYGON)\s*(?:Z\s*)?\(/i);
    if (tipoWkt) {
        const grupos = texto.match(/\(([^()]+)\)/g) || [];
        const anillos = grupos.map(grupo => {
            const pares = [];
            const re = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
            let m;
            while ((m = re.exec(grupo)) !== null) {
                const lng = Number(m[1]), lat = Number(m[2]);
                if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
                pares.push([lat, lng]);
            }
            return pares;
        }).filter(anillo => anillo.length >= 3);
        if (anillos.length) {
            // Leaflet acepta un anillo exterior y anillos interiores (huecos).
            // Para MULTIPOLYGON dibujamos cada anillo como polígono independiente más abajo.
            return { tipo: tipoWkt[1].toUpperCase() === 'MULTIPOLYGON' ? 'multipoligono' : 'poligono', coordenadas: anillos };
        }
        return null;
    }

    // Formato usado por los CSV importados a LEU: latitud, longitud.
    const pareja = texto.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (pareja) {
        const primero = Number(pareja[1]), segundo = Number(pareja[2]);
        if (!Number.isFinite(primero) || !Number.isFinite(segundo)) return null;
        const lat = Math.abs(primero) <= 90 && Math.abs(segundo) <= 180 ? primero :
            (Math.abs(segundo) <= 90 && Math.abs(primero) <= 180 ? segundo : NaN);
        const lng = lat === primero ? segundo : primero;
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
            return { tipo: 'punto', coordenadas: [lat, lng] };
        }
    }
    return null;
}

async function consultarActivos(categoria) {
    const todos = [];
    const tamanoPagina = 1000;
    for (let desde = 0; ; desde += tamanoPagina) {
        const { data, error } = await clienteSupabase
            .from('leu')
            .select('*')
            .eq('categoria', categoria)
            .order('id', { ascending: true })
            .range(desde, desde + tamanoPagina - 1);
        if (error) throw error;
        const pagina = data || [];
        todos.push(...pagina);
        if (pagina.length < tamanoPagina) break;
    }
    return todos;
}

const TABLAS_FOTOS_CONTROLES = {
    hidrantes: { tabla: 'controles_h', orden: 'creado_el' },
    extintores: { tabla: 'controles_e', orden: 'created_at' },
    ecas: { tabla: 'controles_ecas', orden: 'created_at' },
    pecas: { tabla: 'controles_pecas', orden: 'created_at' },
    vecas: { tabla: 'controles_vecas', orden: 'created_at' },
    valvulas: { tabla: 'controles_v', orden: 'created_at' }
};

async function consultarUltimosEstadosControl(moduloKey) {
    // En hidrantes, el estado operativo vigente proviene del último control guardado,
    // no del CSV histórico importado en LEU.
    if (moduloKey !== 'hidrantes') return new Map();

    const ultimos = new Map();
    const tamanoPagina = 1000;
    for (let desde = 0; ; desde += tamanoPagina) {
        const { data, error } = await clienteSupabase
            .from('controles_h')
            .select('id_activo, estado, creado_el, id')
            .not('estado', 'is', null)
            .neq('estado', '')
            .order('creado_el', { ascending: false })
            .order('id', { ascending: false })
            .range(desde, desde + tamanoPagina - 1);

        if (error) {
            console.warn('[Centinela mapa] No se pudieron consultar los últimos estados de hidrantes:', error.message);
            return new Map();
        }

        const pagina = data || [];
        for (const control of pagina) {
            const id = Number(control.id_activo);
            // La consulta viene ordenada de más reciente a más antiguo:
            // el primer control de cada activo es el estado que debe mostrarse.
            if (id && !ultimos.has(id)) ultimos.set(id, control.estado);
        }
        if (pagina.length < tamanoPagina) break;
    }
    return ultimos;
}

function extraerRutaFotoControl(valor) {
    const foto = String(valor || '').trim();
    if (!foto) return null;

    // Compatibilidad con fotos históricas guardadas como URL pública.
    if (/^https?:\/\//i.test(foto)) {
        try {
            const url = new URL(foto);
            const marcador = '/storage/v1/object/public/fotos-controles/';
            const indice = url.pathname.indexOf(marcador);
            if (indice < 0) return null;
            return decodeURIComponent(url.pathname.slice(indice + marcador.length));
        } catch {
            return null;
        }
    }

    return foto.replace(/^\/+/, '').replace(/^fotos-controles\//i, '');
}

async function consultarUltimasFotos(moduloKey) {
    const configFotos = TABLAS_FOTOS_CONTROLES[moduloKey];
    if (!configFotos) return new Map();

    const { data: usuarioData } = await clienteSupabase.auth.getUser();
    if (usuarioData?.user) {
        // Las cuentas autenticadas solo ven el historial completo si tienen rol administrativo.
        const { data: esAdmin } = await clienteSupabase.rpc('current_user_has_role', { p_role: 'administrador' });
        const { data: esSuperadmin } = await clienteSupabase.rpc('current_user_has_role', { p_role: 'superadministrador' });
        if (!esAdmin && !esSuperadmin) return new Map();
    }
    // Para Bomberos, la policy de Storage permite firmar únicamente la última foto
    // de cada activo. Los objetos históricos permanecen inaccesibles desde el cliente anónimo.
    const { data, error } = await clienteSupabase
        .from(configFotos.tabla)
        .select('id_activo, foto, ' + configFotos.orden)
        .not('foto', 'is', null)
        .order(configFotos.orden, { ascending: false });

    if (error) {
        console.warn('[Centinela mapa] No se pudieron consultar las fotos de ' + moduloKey + ':', error.message);
        return new Map();
    }

    const ultimasRutas = new Map();
    for (const control of data || []) {
        const id = Number(control.id_activo);
        const ruta = extraerRutaFotoControl(control.foto);
        if (id && ruta && !ultimasRutas.has(id)) ultimasRutas.set(id, ruta);
    }

    const ultimasFirmadas = new Map();
    await Promise.all([...ultimasRutas.entries()].map(async ([id, ruta]) => {
        const { data: urlData, error: urlError } = await clienteSupabase.storage
            .from('fotos-controles')
            .createSignedUrl(ruta, 300);
        if (urlError || !urlData?.signedUrl) {
            // En sesión de Bomberos, Storage rechaza deliberadamente fotos históricas.
            if (usuarioData?.user) console.warn('[Centinela mapa] No se pudo firmar una foto:', urlError?.message || 'sin URL firmada');
            return;
        }
        ultimasFirmadas.set(id, urlData.signedUrl);
    }));
    return ultimasFirmadas;
}

function inicializarMiniMapaPopup(popup, item) {
    const el = popup.getElement()?.querySelector('#popup-mini-mapa-' + item.id);
    if (!el || el.dataset.inicializado === 'true') return;
    const geometria = extraerGeometria(item);
    if (!geometria) {
        el.innerHTML = '<div style="padding:8px;font:10px Arial;color:#aaa;text-align:center">UBICACIÓN NO DISPONIBLE</div>';
        return;
    }
    el.dataset.inicializado = 'true';
    const mini = L.map(el, {
        zoomControl: false, attributionControl: false, dragging: false,
        scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false,
        tap: false
    });
    agregarCapasBase(mini, { selector: false });

    if (geometria.tipo === 'punto') {
        L.circleMarker(geometria.coordenadas, {
            radius: 6, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1
        }).addTo(mini);
        mini.setView(geometria.coordenadas, 18);
    } else {
        const anillos = geometria.tipo === 'multipoligono'
            ? geometria.coordenadas
            : geometria.coordenadas;
        const figuras = anillos.map(anillo => L.polygon(anillo, {
            color: '#ef4444', weight: 2, fillColor: '#ef4444', fillOpacity: 0.18
        }).addTo(mini));
        const grupo = L.featureGroup(figuras);
        if (grupo.getBounds().isValid()) mini.fitBounds(grupo.getBounds(), { padding: [4, 4], maxZoom: 17 });
        else mini.setView([-31.4168, -64.1834], 10);
    }
    setTimeout(() => mini.invalidateSize(), 100);
}

function leerEstado(item, esExtintor) {
    const estado = buscarAtributo(item, 'EstadoReferencia', 'Estado', 'STATUS', 'Estado PRP');
    if (esExtintor) {
        const prp = buscarAtributo(item, 'PRP', 'Estado PRP');
        // Los CSV actuales no siempre traen PRP; solo excluimos explícitamente estados fuera de planta.
        if (prp && !['en planta', 'planta'].includes(normalizarTexto(prp))) {
            return { visible: false, estado: String(prp), color: '#64748b' };
        }
        const vencimiento = buscarAtributo(item, 'Vencimiento');
        const fecha = parsearVencimiento(vencimiento);
        if (fecha) {
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
            fecha.setHours(0, 0, 0, 0);
            const dias = (fecha.getTime() - hoy.getTime()) / 86400000;
            if (dias < 0) return { visible: true, estado: 'Vencido', color: '#ef4444' };
            if (dias <= 30) return { visible: true, estado: 'Próximo a vencer', color: '#eab308' };
            return { visible: true, estado: estado || 'Vigente', color: '#22c55e' };
        }
        return { visible: true, estado: estado || 'Vigente (sin fecha)', color: '#22c55e' };
    }
    const normal = normalizarTexto(estado);
    if (normal.includes('observado')) return { visible: true, estado: estado || 'Observado', color: '#eab308' };
    if (normal.includes('anomalo') || normal.includes('no operativo') || normal.includes('fuera de servicio')) {
        return { visible: true, estado: estado || 'No operativo', color: '#ef4444' };
    }
    return { visible: true, estado: estado || 'Sin estado informado', color: '#22c55e' };
}

function parsearVencimiento(valor) {
    if (!valor) return null;
    const texto = String(valor).trim().toLowerCase();
    const meses = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };
    let match = texto.match(/^([a-záé]{3})[\s\-/]+(\d{2,4})$/i);
    if (match) {
        const mes = meses[normalizarTexto(match[1]).slice(0, 3)];
        let anio = Number(match[2]); if (anio < 100) anio += 2000;
        return mes === undefined ? null : new Date(anio, mes + 1, 0);
    }
    match = texto.match(/^(\d{1,2})[\s\-/]+(\d{2,4})$/);
    if (match) {
        const mes = Number(match[1]) - 1;
        let anio = Number(match[2]); if (anio < 100) anio += 2000;
        if (mes < 0 || mes > 11) return null;
        return new Date(anio, mes + 1, 0);
    }
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function crearIcono(color) {
    return L.divIcon({
        className: 'centinela-map-pin',
        html: '<div style="background:' + color + ';width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #000"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

function actualizarDistanciaPopup(popup, item, geometria) {
    const el = popup.getElement()?.querySelector('#popup-distancia-' + Number(item.id));
    if (!el) return;

    const vertices = geometria?.tipo === 'punto'
        ? []
        : (Array.isArray(geometria?.coordenadas) ? geometria.coordenadas.flat(1) : []);
    const destino = geometria?.tipo === 'punto'
        ? geometria.coordenadas
        : (vertices.length
            ? vertices.reduce((acc, punto) => [acc[0] + punto[0], acc[1] + punto[1]], [0, 0])
                .map(valor => valor / vertices.length)
            : null);
    if (!destino) {
        el.textContent = 'Distancia no disponible para esta geometría.';
        return;
    }

    const mostrar = (origen, precision = 0) => {
        if (!el.isConnected) return;
        const distancia = distanciaGPS(origen, destino);
        el.textContent = '📍 A ' + formatoDistanciaGPS(distancia) + ' de tu ubicación' +
            (precision ? ' · precisión GPS ±' + Math.round(precision) + ' m' : '');
    };

    // Reutiliza la ubicación activa si el usuario ya encendió el GPS del mapa.
    if (posicionUsuarioMapa) {
        mostrar(posicionUsuarioMapa, 0);
        return;
    }
    if (!navigator.geolocation) {
        el.textContent = 'Activá la geolocalización para calcular la distancia.';
        return;
    }
    el.textContent = 'Calculando distancia desde tu ubicación…';
    const solicitud = String(Date.now()) + '-' + Number(item.id);
    el.dataset.solicitud = solicitud;
    navigator.geolocation.getCurrentPosition(pos => {
        if (!el.isConnected || el.dataset.solicitud !== solicitud) return;
        mostrar([pos.coords.latitude, pos.coords.longitude], pos.coords.accuracy);
    }, error => {
        if (!el.isConnected || el.dataset.solicitud !== solicitud) return;
        el.textContent = error.code === 1
            ? 'Permiso GPS denegado. Habilitá la ubicación en el navegador.'
            : error.code === 2
                ? 'No se pudo obtener la ubicación GPS.'
                : 'GPS demoró demasiado. Volvé a abrir el popup para reintentar.';
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
}

function popupActivo(item, moduloKey, config, estado, esExtintor, ultimaFoto = '') {
    const etiqueta = item.etiqueta || item.nombre || 'Activo #' + item.id;
    const sector = item.sector || buscarAtributo(item, 'Sector', 'Ubicación', 'Ubicacion') || 'N/D';
    const vencimiento = esExtintor ? buscarAtributo(item, 'Vencimiento') : '';
    const tipo = esExtintor ? buscarAtributo(item, 'Tipo de Extintor', 'TipoExtintor') : '';
    const controlPermitido = ['extintores', 'hidrantes', 'ecas', 'pecas', 'vecas', 'valvulas'].includes(moduloKey);
    const boton = controlPermitido
        ? '<button onclick="window.abrirFormularioControl(\'' + moduloKey + '\',\'' + item.id + '\',\'\')" style="background:#22c55e;color:#000;border:0;padding:7px 10px;border-radius:4px;font-weight:bold;cursor:pointer;width:100%">Nuevo control</button>'
        : '';
    return '<div style="font-family:Arial,sans-serif;color:#333;min-width:180px;max-width:230px">' +
        '<div style="font-weight:bold;font-size:13px;margin-bottom:5px">' + escaparHtml(etiqueta) + '</div>' +
        '<div style="font-size:11px;margin-bottom:5px">Categoría: ' + escaparHtml(config.categoria) + '</div>' +
        '<div style="font-size:11px;margin-bottom:5px">Sector: ' + escaparHtml(sector) + '</div>' +
        '<div id="popup-distancia-' + Number(item.id) + '" role="status" style="font-size:11px;font-weight:bold;color:#1d4ed8;background:#eff6ff;border-radius:4px;padding:5px 6px;margin:0 0 7px">Calculando distancia GPS…</div>' +
        (tipo ? '<div style="font-size:11px;margin-bottom:4px">Tipo: ' + escaparHtml(tipo) + '</div>' : '') +
        (vencimiento ? '<div style="font-size:11px;margin-bottom:6px">Vencimiento: <b>' + escaparHtml(vencimiento) + '</b></div>' : '') +
        '<div style="font-size:11px;margin-bottom:9px">Estado: <b style="color:' + estado.color + '">' + escaparHtml(estado.estado) + '</b></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 9px;align-items:start">' +
            '<div style="min-width:0"><div style="font-size:10px;font-weight:bold;margin-bottom:3px">Última foto</div>' +
            (ultimaFoto
                ? '<img src="' + escaparHtml(ultimaFoto) + '" alt="Última foto del control" loading="lazy" style="display:block;width:100%;height:92px;object-fit:cover;border-radius:4px;background:#111;border:1px solid #bbb">' 
                : '<div style="height:92px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:11px;font-weight:bold;color:#888;background:#171717;border:1px solid #777;border-radius:4px">NO IMAGE</div>') +
            '</div><div style="min-width:0"><div style="font-size:10px;font-weight:bold;margin-bottom:3px">Ubicación</div>' +
            '<div id="popup-mini-mapa-' + Number(item.id) + '" style="width:100%;height:92px;border:1px solid #bbb;border-radius:4px;overflow:hidden;background:#171717"></div></div></div>' +
        boton + '</div>';
}

export async function cargarModuloMapa(moduloKey, contenedor) {
    detenerGPSMapa();
    const config = MAPEO_MODULOS[moduloKey];
    if (!config) {
        contenedor.innerHTML = '<div style="padding:24px;color:#ef4444">Módulo cartográfico no configurado: ' + escaparHtml(moduloKey) + '</div>';
        return;
    }

    const miSolicitud = ++solicitudMapa;
    contenedor.style.width = '100%';
    contenedor.style.maxWidth = '100%';
    contenedor.style.height = 'calc(100vh - 65px)';
    contenedor.style.minHeight = '450px';
    contenedor.style.margin = '0';
    contenedor.style.padding = '0';
    contenedor.style.display = 'block';
    contenedor.innerHTML = '<div style="padding:24px;text-align:center;color:#fff;font-family:Arial">Cargando ' +
        escaparHtml(config.nombreLegible) + ' desde LEU…</div>';

    let activos;
    try {
        activos = await consultarActivos(config.categoria);
    } catch (error) {
        if (miSolicitud !== solicitudMapa) return;
        contenedor.innerHTML = '<div style="padding:24px;color:#ef4444;font-family:Arial">No se pudieron consultar los activos de LEU (' +
            escaparHtml(config.categoria) + '): ' + escaparHtml(error.message || error) + '</div>';
        console.error('[Centinela mapa] Error consultando LEU:', error);
        return;
    }
    if (miSolicitud !== solicitudMapa) return;

    const ultimasFotos = await consultarUltimasFotos(moduloKey);
    if (miSolicitud !== solicitudMapa) return;
    const ultimosEstadosControl = await consultarUltimosEstadosControl(moduloKey);
    if (miSolicitud !== solicitudMapa) return;

    if (mapaActivo) {
        mapaActivo.remove();
        mapaActivo = null;
    }
    contenedor.innerHTML = '<div style="position:relative;width:100%;height:100%;min-height:450px;overflow:hidden">' +
        '<div id="mapa-modulo" style="position:absolute;inset:0;width:100%;height:100%;min-height:450px"></div>' +
        '<div style="position:absolute;z-index:650;right:12px;bottom:76px;display:flex;flex-direction:column;gap:10px;align-items:flex-end;pointer-events:none">' +
        '<button id="gps-mapa-iniciar" type="button" aria-label="Mostrar mi ubicación" title="Mostrar mi ubicación" style="pointer-events:auto;width:48px;height:48px;border-radius:50%;border:1px solid #d1d5db;background:#fff;color:#2563eb;box-shadow:0 2px 8px #0005;font-size:24px;display:flex;align-items:center;justify-content:center;cursor:pointer">➤</button>' +
        '<button id="gps-mapa-cercanos-toggle" type="button" aria-label="Mostrar activos cercanos" aria-expanded="false" title="Activos cercanos" style="pointer-events:auto;position:relative;width:48px;height:48px;border-radius:50%;border:1px solid #d1d5db;background:#fff;color:#111827;box-shadow:0 2px 8px #0005;font-size:22px;display:flex;align-items:center;justify-content:center;cursor:pointer">☷<span id="gps-mapa-contador" style="position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 3px;border-radius:10px;background:#2563eb;color:#fff;font-size:10px;line-height:18px;font-weight:bold">0</span></button></div>' +
        '<section id="gps-mapa-lista-panel" aria-label="Activos cercanos" hidden style="position:absolute;z-index:640;right:12px;bottom:188px;width:min(330px,calc(100% - 24px));max-height:min(48vh,390px);overflow:auto;box-sizing:border-box;background:rgba(15,23,42,.97);color:#fff;padding:12px;border:1px solid #475569;border-radius:12px;box-shadow:0 4px 18px #0007;font:12px Arial">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong style="font-size:14px">Activos cercanos · ' + escaparHtml(config.nombreLegible) + '</strong>' +
        '<button id="gps-mapa-cerrar-lista" type="button" aria-label="Cerrar lista" style="border:0;border-radius:50%;background:#374151;color:#fff;width:30px;height:30px;font-size:18px;cursor:pointer">×</button></div>' +
        '<label style="display:block;margin-top:10px;color:#cbd5e1">Radio de búsqueda ' +
        '<select id="gps-mapa-radio" style="background:#111827;color:white;border:1px solid #64748b;border-radius:6px;padding:7px;margin-left:5px"><option value="10">10 m</option><option value="25">25 m</option><option value="50">50 m</option><option value="100">100 m</option><option value="250">250 m</option><option value="500">500 m</option><option value="1000" selected>1 km</option><option value="2000">2 km</option><option value="5000">5 km</option></select></label>' +
        '<div id="gps-mapa-estado" role="status" style="color:#cbd5e1;margin-top:8px">Tocá el botón de ubicación para comenzar.</div>' +
        '<div id="gps-mapa-cercanos" style="margin-top:5px"></div></section>' +
        '<div id="mapa-diagnostico" role="status" style="position:absolute;z-index:500;left:10px;bottom:10px;max-width:calc(100% - 80px);background:rgba(15,23,42,.82);color:#fff;padding:6px 9px;border-radius:6px;font:11px Arial;box-shadow:0 2px 8px #0004;pointer-events:none"></div></div>';

    mapaActivo = L.map('mapa-modulo', { zoomControl: true }).setView([-31.4168, -64.1834], 17);
    agregarCapasBase(mapaActivo);

    const limites = [];
    activosPuntualesMapa = [];
    let puntosDibujados = 0, poligonosDibujados = 0, sinUbicacion = 0, fueraDePlanta = 0;
    const esExtintor = moduloKey === 'extintores';
    const esIPP = moduloKey === 'ipp';
    const coloresSectoresIPP = esIPP ? crearColoresSectoresIPP(activos) : new Map();

    for (const item of activos) {
        const estadoControl = ultimosEstadosControl.get(Number(item.id));
        const estado = estadoControl
            ? leerEstado({ EstadoReferencia: estadoControl }, false)
            : leerEstado(item, esExtintor);
        if (!estado.visible) { fueraDePlanta++; continue; }
        const geometria = extraerGeometria(item);
        if (!geometria) { sinUbicacion++; continue; }

        const nombre = item.etiqueta || item.nombre || 'Activo #' + item.id;
        const popup = popupActivo(item, moduloKey, config, estado, esExtintor, ultimasFotos.get(Number(item.id)) || '');

        if (geometria.tipo === 'punto') {
            const coords = geometria.coordenadas;
            const marcador = L.marker(coords, { icon: crearIcono(estado.color), title: nombre })
                .addTo(mapaActivo).bindPopup(popup);
            marcador.on('popupopen', evento => {
                inicializarMiniMapaPopup(evento.popup, item);
                actualizarDistanciaPopup(evento.popup, item, geometria);
            });
            limites.push(coords);
            activosPuntualesMapa.push({ coords, nombre, marcador });
            puntosDibujados++;
        } else {
            const anillos = geometria.coordenadas;
            if (geometria.tipo === 'multipoligono') {
                anillos.forEach(anillo => {
                    if (anillo.length < 3) return;
                    const colorPoligono = esIPP ? coloresSectoresIPP.get(obtenerSectorMapa(item)) : estado.color;
                    const capaPoligono = L.polygon(anillo, { color: colorPoligono, weight: 2, fillColor: colorPoligono, fillOpacity: 0.22 })
                        .addTo(mapaActivo).bindPopup(popup);
                    capaPoligono.on('popupopen', evento => {
                        inicializarMiniMapaPopup(evento.popup, item);
                        actualizarDistanciaPopup(evento.popup, item, geometria);
                    });
                    limites.push(...anillo);
                    poligonosDibujados++;
                    if (esIPP && anillo === anillos[0]) agregarEtiquetaSectorIPP(mapaActivo, item, geometria, colorPoligono);
                });
            } else {
                const colorPoligono = esIPP ? coloresSectoresIPP.get(obtenerSectorMapa(item)) : estado.color;
                const capaPoligono = L.polygon(anillos, { color: colorPoligono, weight: 2, fillColor: colorPoligono, fillOpacity: 0.22 })
                    .addTo(mapaActivo).bindPopup(popup);
                capaPoligono.on('popupopen', evento => {
                    inicializarMiniMapaPopup(evento.popup, item);
                    actualizarDistanciaPopup(evento.popup, item, geometria);
                });
                limites.push(...anillos.flat());
                poligonosDibujados++;
                if (esIPP) agregarEtiquetaSectorIPP(mapaActivo, item, geometria, colorPoligono);
            }
        }
    }

    if (esIPP) agregarLeyendaSectoresIPP(mapaActivo, coloresSectoresIPP);

    const diagnostico = document.getElementById('mapa-diagnostico');
    if (diagnostico) {
        diagnostico.textContent = config.nombreLegible + ': ' + activos.length + ' registros · ' +
            puntosDibujados + ' puntos · ' + poligonosDibujados + ' polígonos · ' +
            sinUbicacion + ' sin ubicación' + (fueraDePlanta ? ' · ' + fueraDePlanta + ' fuera de planta' : '');
    }
    if (limites.length) {
        mapaActivo.fitBounds(L.latLngBounds(limites), { padding: [35, 35], maxZoom: 19 });
    } else {
        mapaActivo.setView([-31.4168, -64.1834], 15);
        const aviso = document.createElement('div');
        aviso.style.cssText = 'position:absolute;z-index:500;top:12px;left:50%;transform:translateX(-50%);background:#7f1d1d;color:white;padding:10px 14px;border-radius:6px;font:13px Arial;max-width:90%;text-align:center';
        aviso.textContent = activos.length
            ? 'Hay registros en LEU, pero ninguno tiene una ubicación que el mapa pueda interpretar. Revisá el diagnóstico y los formatos de ubicación.'
            : 'No hay registros en LEU para la categoría "' + config.categoria + '".';
        contenedor.appendChild(aviso);
    }

    document.getElementById('gps-mapa-iniciar')?.addEventListener('click', () => {
        if (posicionUsuarioMapa && mapaActivo) {
            mapaActivo.setView(posicionUsuarioMapa, Math.max(mapaActivo.getZoom(), 18));
            marcadorUsuarioMapa?.openPopup();
            return;
        }
        iniciarGPSMapa();
    });
    document.getElementById('gps-mapa-cercanos-toggle')?.addEventListener('click', () => {
        const panel = document.getElementById('gps-mapa-lista-panel');
        const boton = document.getElementById('gps-mapa-cercanos-toggle');
        if (!panel || !boton) return;
        panel.hidden = !panel.hidden;
        boton.setAttribute('aria-expanded', String(!panel.hidden));
        if (!panel.hidden && !posicionUsuarioMapa) iniciarGPSMapa();
        if (!panel.hidden) actualizarListaCercanosMapa();
    });
    document.getElementById('gps-mapa-cerrar-lista')?.addEventListener('click', () => {
        const panel = document.getElementById('gps-mapa-lista-panel');
        const boton = document.getElementById('gps-mapa-cercanos-toggle');
        if (panel) panel.hidden = true;
        if (boton) boton.setAttribute('aria-expanded', 'false');
    });
    document.getElementById('gps-mapa-radio')?.addEventListener('change', actualizarListaCercanosMapa);
    setTimeout(() => {
        if (miSolicitud === solicitudMapa && mapaActivo) mapaActivo.invalidateSize();
    }, 250);
    console.info('[Centinela mapa]', {
        modulo: moduloKey, tabla: 'leu', categoria: config.categoria, consultados: activos.length,
        puntos: puntosDibujados, poligonos: poligonosDibujados, sinUbicacion, fueraDePlanta
    });
}
