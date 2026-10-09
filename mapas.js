// ==========================================
// MÓDULO: Mapas y Geolocalización (Leaflet)
// ==========================================

import { clienteSupabase } from './supabaseClient.js';

const MAPEO_MODULOS = {
    'hidrantes': { tabla: 'hidrantes', bucket: 'FotosHidrantes', nombreLegible: 'Hidrantes' },
    'extintores': { tabla: 'leu', bucket: 'FotosExtintores', nombreLegible: 'Extintores' },
    'ecas': { tabla: 'ecas', bucket: 'FotosEcas', nombreLegible: 'ECAS' },
    'valvulas': { tabla: 'valvulas', bucket: 'FotosValvulas', nombreLegible: 'Válvulas' },
    'vecas': { tabla: 'vecas', bucket: 'FotosVecas', nombreLegible: 'VECAS' },
    'pecas': { tabla: 'pecas', bucket: 'FotosPecas', nombreLegible: 'PECAS' },
    'ipp': { tabla: 'ipp', bucket: 'FotosIpp', nombreLegible: 'IPP' },
    'bomberos': { tabla: 'Bomberos', bucket: 'FotosBomberos', nombreLegible: 'Personal / Bomberos' }
};

let mapaActivo = null;

// Función todoterreno para encontrar coordenadas sin importar cómo se llame la columna
function extraerCoordenadas(item) {
    let lat = null;
    let lng = null;
    let puntoString = null;

    const keys = Object.keys(item);
    for (let key of keys) {
        const k = key.toLowerCase();
        
        if (k === 'latitud' || k === 'lat') lat = parseFloat(item[key]);
        if (k === 'longitud' || k === 'lng' || k === 'lon' || k === 'long') lng = parseFloat(item[key]);
        if (k === 'ubicacion' || k === 'ubicación' || k === 'geom' || k === 'coordenadas' || k === 'coordenada' || k === 'wkt' || k === 'ubicacion_wkt') {
            puntoString = item[key];
        }
    }

    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        return [lat, lng];
    }

    if (typeof puntoString === 'string') {
        const matchPoint = puntoString.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
        if (matchPoint) {
            const pLng = parseFloat(matchPoint[1]);
            const pLat = parseFloat(matchPoint[2]);
            if (!isNaN(pLat) && !isNaN(pLng)) return [pLat, pLng];
        }

        const matchComa = puntoString.match(/([-\d.]+)\s*,\s*([-\d.]+)/);
        if (matchComa) {
            const val1 = parseFloat(matchComa[1]);
            const val2 = parseFloat(matchComa[2]);
            if (!isNaN(val1) && !isNaN(val2)) {
                return Math.abs(val1) > 90 ? [val2, val1] : [val1, val2];
            }
        }
    }
    return null;
}

export async function cargarModuloMapa(moduloKey, contenedor) {
    const config = MAPEO_MODULOS[moduloKey] || { tabla: moduloKey, bucket: `Fotos${moduloKey}`, nombreLegible: moduloKey };
    
    contenedor.style.width = '100%';
    contenedor.style.maxWidth = '100%'; 
    contenedor.style.height = 'calc(100vh - 65px)'.trim(); 
    contenedor.style.margin = '0';
    contenedor.style.padding = '0';
    contenedor.style.display = 'block';

    contenedor.innerHTML = `<div style="padding: 40px; text-align: center; color: #fff; font-family: Arial;">Cargando mapa satelital de ${config.nombreLegible}...</div>`;

    const esMapaExtintores = moduloKey === 'extintores';
    let consulta = clienteSupabase.from(config.tabla).select('*');
    if (esMapaExtintores) consulta = consulta.eq('categoria', 'Extintores');
    const { data: datosOriginales, error } = await consulta;
    let data = datosOriginales;
    if (esMapaExtintores && data) {
        data = data.map(activo => {
            const attrs = activo?.atributos_tecnicos?.atributos_originales
                || activo?.atributos_tecnicos?.originales
                || activo?.atributos_tecnicos
                || {};
            const valor = (...keys) => {
                for (const key of keys) {
                    if (attrs[key] !== undefined && attrs[key] !== null && String(attrs[key]).trim() !== '') return attrs[key];
                }
                return '';
            };
            return {
                ...activo,
                NombreEtiqueta: activo.etiqueta,
                Sector: activo.sector,
                Ronda: activo.ronda,
                ubicacion_wkt: activo.ubicacion_wkt,
                Vencimiento: valor('Vencimiento', 'vencimiento'),
                TipoExtintor: valor('Tipo de Extintor', 'TipoExtintor'),
                PRP: valor('PRP', 'Estado PRP')
            };
        });
    }

    if (error) {
        contenedor.innerHTML = `<div style="padding: 20px; color: #ef4444; text-align: center; font-family: Arial;">Error al cargar datos (${config.tabla}): ${error.message}</div>`;
        return;
    }

    contenedor.innerHTML = `<div id="mapa-modulo" style="width: 100%; height: 100%;"></div>`;

    if (mapaActivo) {
        mapaActivo.remove();
        mapaActivo = null;
    }

    let centroLat = -31.4168;
    let centroLon = -64.1834;

    mapaActivo = L.map('mapa-modulo', {
        zoomControl: true
    }).setView([centroLat, centroLon], 17);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 22
    }).addTo(mapaActivo);

    let bounds = [];

    (data || []).forEach(item => {
        // ==========================================
        // FILTRO PRP: Ocultar del mapa lo que no esté en planta
        // ==========================================
        if (esMapaExtintores || config.tabla.toLowerCase() === 'extintores' || config.tabla.toLowerCase() === 'extintor') {
            // Asumimos que si no tiene valor (null), es un extintor viejo que está En Planta
            const estadoPRP = item.PRP ? String(item.PRP).trim().toLowerCase() : 'en planta';
            
            // Si no dice "en planta" (ej: "en pulmon", "en recarga"), NO lo dibujamos en el mapa
            if (estadoPRP !== 'en planta') return; 
        }

        const coords = extraerCoordenadas(item);
        
        if (coords) {
            const lat = coords[0];
            const lon = coords[1];
            bounds.push([lat, lon]);

            let colorPin = '#22c55e';
            let estadoTexto = item.EstadoReferencia || item.Estado || 'Operativo';
            
            if (esMapaExtintores || config.tabla.toLowerCase() === 'extintores' || config.tabla.toLowerCase() === 'extintor') {
                const parsearFechaVenc = (fStr) => {
                    if (!fStr) return null;
                    const f = fStr.toString().toLowerCase().trim();
                    const meses = { 'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11 };
                    
                    let match = f.match(/^([a-z]{3})[\s\-\/]+(\d{2,4})$/);
                    if (match) {
                        let m = meses[match[1]];
                        let y = parseInt(match[2], 10);
                        if (y < 100) y += 2000;
                        if (m !== undefined) return new Date(y, m + 1, 0);
                    }
                    match = f.match(/^(\d{1,2})[\s\-\/]+(\d{2,4})$/);
                    if (match) {
                        let m = parseInt(match[1], 10) - 1;
                        let y = parseInt(match[2], 10);
                        if (y < 100) y += 2000;
                        return new Date(y, m + 1, 0);
                    }
                    let parsed = new Date(fStr);
                    if (!isNaN(parsed.getTime())) return parsed;
                    return null;
                };

                const estRefLower = String(estadoTexto).toLowerCase();
                if (estRefLower.includes('anomalo') || estRefLower.includes('anómalo')) {
                    colorPin = '#ef4444';
                    estadoTexto = 'Anómalo / Baja';
                } else {
                    let fechaVenc = parsearFechaVenc(item.Vencimiento);
                    if (fechaVenc) {
                        let hoy = new Date();
                        hoy.setHours(0,0,0,0);
                        fechaVenc.setHours(0,0,0,0);
                        
                        let diffDias = (fechaVenc.getTime() - hoy.getTime()) / (1000 * 3600 * 24);
                        
                        if (diffDias < 0) {
                            colorPin = '#ef4444';
                            estadoTexto = 'Vencido';
                        } else if (diffDias <= 30) {
                            colorPin = '#eab308';
                            estadoTexto = 'Próximo a Vencer';
                        } else {
                            colorPin = '#22c55e';
                            estadoTexto = 'Vigente';
                        }
                    } else {
                        colorPin = '#22c55e';
                        estadoTexto = 'Vigente (Sin fecha)';
                    }
                }
            } else {
                const estLower = String(estadoTexto).toLowerCase();
                if (estLower.includes('observado')) {
                    colorPin = '#eab308';
                } else if (estLower.includes('anomalo') || estLower.includes('anómalo') || estLower.includes('no operativo')) {
                    colorPin = '#ef4444';
                }
            }

            const iconoPin = L.divIcon({
                className: 'custom-pin',
                html: `<div style="background-color: ${colorPin}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 8px rgba(0,0,0,0.9);"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            const marker = L.marker([lat, lon], { icon: iconoPin }).addTo(mapaActivo);

            let idElemento = item.NombreEtiqueta || item.Nombre || item.nombre || `Elemento #${item.id}`;
            let pastillaHtml = `<span style="background: ${colorPin}; color: #000; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 11px;">${estadoTexto.toUpperCase()}</span>`;
            
            let extraInfo = '';
            if ((esMapaExtintores || config.tabla.toLowerCase() === 'extintores' || config.tabla.toLowerCase() === 'extintor') && item.Vencimiento) {
                extraInfo = `<div style="font-size: 11px; margin-bottom: 4px; color: #555;">Vencimiento: <strong style="color:#111;">${item.Vencimiento}</strong></div>`;
            }

            // ==========================================
            // EXTRACCIÓN ROBUSTA DE FOTO CON FALLBACK SVG NATIVO
            // ==========================================
            let fotoUrl = item.Foto || item.foto || item.FOTO || item.Imagen || item.imagen || null;
            
            // Gráficos SVG incrustados en Base64 (No requieren internet)
            const svgSinFoto = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='100'><rect width='200' height='100' fill='%231e1e1e'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23888888' font-family='Arial, sans-serif' font-size='13'>📷 Sin Foto Registrada</text></svg>";
            const svgError = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='100'><rect width='200' height='100' fill='%232a1515'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23ef4444' font-family='Arial, sans-serif' font-size='13'>⚠️ Error al cargar imagen</text></svg>";
            
            let imgFinal = svgSinFoto;
            
            if (fotoUrl) {
                imgFinal = fotoUrl;
                if (!imgFinal.startsWith('http') && !imgFinal.startsWith('data:')) {
                    imgFinal = `https://zgzhudcdxoentmfgdncf.supabase.co/storage/v1/object/public/fotos-controles/${imgFinal}`;
                }
            }

            let htmlFoto = `
                <div style="margin-bottom: 8px; text-align: center; width: 100%;">
                    <img src="${imgFinal}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; border: 1px solid #444; background: #1e1e1e;" onerror="this.src='${svgError}'">
                </div>
            `;

            const popupContent = `
                <div style="font-family: Arial, sans-serif; color: #333; min-width: 180px; max-width: 210px;">
                    <div style="font-weight: bold; font-size: 13px; margin-bottom: 4px; color: #111;">${idElemento}</div>
                    <div style="font-size: 11px; margin-bottom: 6px; color: #555;">Sector: ${item.Sector || 'N/D'}</div>
                    ${extraInfo}
                    <div style="font-size: 11px; margin-bottom: 8px; display: flex; align-items: center; gap: 5px;">
                        Estado: ${pastillaHtml}
                    </div>
                    ${htmlFoto}
                    <button onclick="window.abrirFormularioControl('${moduloKey === 'extintores' ? 'Extintores' : config.tabla}', '${item.id}', '${idElemento.replace(/'/g, "\\'")}')" style="background: #22c55e; color: #000; border: none; padding: 6px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; width: 100%; font-size: 12px; text-align: center;">Nuevo Control</button>
                </div>
            `;

            marker.bindPopup(popupContent);
        }
    });

    setTimeout(() => {
        if (mapaActivo) {
            mapaActivo.invalidateSize();
            if (bounds.length > 0) {
                mapaActivo.fitBounds(bounds, { padding: [50, 50], maxZoom: 19 });
            }
        }
    }, 200);
}