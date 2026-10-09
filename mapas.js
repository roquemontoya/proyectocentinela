// ==========================================
// MÓDULO: Mapas y Geolocalización (Leaflet)
// Fuente canónica de activos: public.leu
// ==========================================

import { clienteSupabase } from './supabaseClient.js';

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

function normalizarTexto(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function escaparHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[caracter]));
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

function popupActivo(item, moduloKey, config, estado, esExtintor) {
    const etiqueta = item.etiqueta || item.nombre || 'Activo #' + item.id;
    const sector = item.sector || buscarAtributo(item, 'Sector', 'Ubicación', 'Ubicacion') || 'N/D';
    const vencimiento = esExtintor ? buscarAtributo(item, 'Vencimiento') : '';
    const tipo = esExtintor ? buscarAtributo(item, 'Tipo de Extintor', 'TipoExtintor') : '';
    const controlPermitido = ['extintores', 'hidrantes', 'ecas', 'pecas', 'vecas', 'valvulas'].includes(moduloKey);
    const boton = controlPermitido
        ? '<button onclick="window.abrirFormularioControl(\'' + moduloKey + '\',\'' + item.id + '\',\'' +
            escaparHtml(String(etiqueta).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n')) +
            '\')" style="background:#22c55e;color:#000;border:0;padding:7px 10px;border-radius:4px;font-weight:bold;cursor:pointer;width:100%">Nuevo control</button>'
        : '';
    return '<div style="font-family:Arial,sans-serif;color:#333;min-width:180px;max-width:230px">' +
        '<div style="font-weight:bold;font-size:13px;margin-bottom:5px">' + escaparHtml(etiqueta) + '</div>' +
        '<div style="font-size:11px;margin-bottom:5px">Categoría: ' + escaparHtml(config.categoria) + '</div>' +
        '<div style="font-size:11px;margin-bottom:7px">Sector: ' + escaparHtml(sector) + '</div>' +
        (tipo ? '<div style="font-size:11px;margin-bottom:4px">Tipo: ' + escaparHtml(tipo) + '</div>' : '') +
        (vencimiento ? '<div style="font-size:11px;margin-bottom:6px">Vencimiento: <b>' + escaparHtml(vencimiento) + '</b></div>' : '') +
        '<div style="font-size:11px;margin-bottom:9px">Estado: <b style="color:' + estado.color + '">' + escaparHtml(estado.estado) + '</b></div>' +
        boton + '</div>';
}

export async function cargarModuloMapa(moduloKey, contenedor) {
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

    if (mapaActivo) {
        mapaActivo.remove();
        mapaActivo = null;
    }
    contenedor.innerHTML = '<div id="mapa-modulo" style="width:100%;height:100%;min-height:450px"></div>' +
        '<div id="mapa-diagnostico" role="status" style="position:absolute;z-index:500;left:10px;bottom:18px;max-width:calc(100% - 40px);background:rgba(15,23,42,.92);color:#fff;padding:8px 11px;border-radius:6px;font:12px Arial;box-shadow:0 2px 8px #0006"></div>';

    mapaActivo = L.map('mapa-modulo', { zoomControl: true }).setView([-31.4168, -64.1834], 17);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 22
    }).addTo(mapaActivo);

    const limites = [];
    let puntosDibujados = 0, poligonosDibujados = 0, sinUbicacion = 0, fueraDePlanta = 0;
    const esExtintor = moduloKey === 'extintores';

    for (const item of activos) {
        const estado = leerEstado(item, esExtintor);
        if (!estado.visible) { fueraDePlanta++; continue; }
        const geometria = extraerGeometria(item);
        if (!geometria) { sinUbicacion++; continue; }

        const nombre = item.etiqueta || item.nombre || 'Activo #' + item.id;
        const popup = popupActivo(item, moduloKey, config, estado, esExtintor);

        if (geometria.tipo === 'punto') {
            const coords = geometria.coordenadas;
            L.marker(coords, { icon: crearIcono(estado.color), title: nombre })
                .addTo(mapaActivo).bindPopup(popup);
            limites.push(coords);
            puntosDibujados++;
        } else {
            const anillos = geometria.coordenadas;
            if (geometria.tipo === 'multipoligono') {
                anillos.forEach(anillo => {
                    if (anillo.length < 3) return;
                    L.polygon(anillo, { color: estado.color, weight: 2, fillColor: estado.color, fillOpacity: 0.22 })
                        .addTo(mapaActivo).bindPopup(popup);
                    limites.push(...anillo);
                    poligonosDibujados++;
                });
            } else {
                L.polygon(anillos, { color: estado.color, weight: 2, fillColor: estado.color, fillOpacity: 0.22 })
                    .addTo(mapaActivo).bindPopup(popup);
                limites.push(...anillos.flat());
                poligonosDibujados++;
            }
        }
    }

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

    setTimeout(() => {
        if (miSolicitud === solicitudMapa && mapaActivo) mapaActivo.invalidateSize();
    }, 250);
    console.info('[Centinela mapa]', {
        modulo: moduloKey, tabla: 'leu', categoria: config.categoria, consultados: activos.length,
        puntos: puntosDibujados, poligonos: poligonosDibujados, sinUbicacion, fueraDePlanta
    });
}
