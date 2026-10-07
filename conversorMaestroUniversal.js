// ==========================================
// MÓDULO: CMU (Conversor Maestro Universal)
// Sincronización Inteligente, Diccionario de Mapas e Ingesta a Supabase
// ==========================================

import { clienteSupabase } from './supabaseClient.js';

// =========================================================================
// DICCIONARIO DE MAPAS CONFIGURABLES
// Para agregar un nuevo mapa en el futuro, solo añade una línea aquí abajo
// formato: "NombreVisible": { tabla: "NombreTablaSupabase", mid: "ID_DE_MY_MAPS" }
// =========================================================================
const MAPAS_CONFIG = {
    "Extintores": { tabla: "Extintores", mid: "1SoiI--YYaSL7UJs7cZjk8qxIHNjmVrM" },
    "Movil 20": { tabla: "Movil 20", mid: "1lNpPuI3-4IjII_ZIf6rTL76Jk3oums0" },
    "Ingenieria": { tabla: "Ingenieria", mid: "1-kh06uxnaCx9AOEaVC6g80VeZ5A_ePg" },
    "MPR": { tabla: "MPR", mid: "1FI54CKve2s3E4nKQ4PQQ5M6ABn2vvno" },
    "Seguridad PC Abril - Julio": { tabla: "Seguridad PC Abril - Julio", mid: "1DtM0jSm04nXrpB1efrCl6hLxAxtDzxo" },
    "Prevencion": { tabla: "Prevencion", mid: "1IGbD2Xi2_6zmccPikavfTDX8b0OvkjU" },
    "Seguridad Relevamiento": { tabla: "Seguridad Relevamiento", mid: "16r_aJ_eYHovLnmweQo6v1Ly_6J_y22k" }
};

export function cargarModuloAdminCsv(contenedor) {
    contenedor.style.width = '100%';
    contenedor.style.padding = '20px';
    contenedor.style.boxSizing = 'border-box';
    contenedor.style.overflowY = 'auto';
    contenedor.style.height = 'calc(100vh - 65px)';
    contenedor.style.backgroundColor = '#121212';

    // Generar opciones del select dinámicamente desde el diccionario
    let opcionesSelectHtml = '';
    for (const [nombre, config] of Object.entries(MAPAS_CONFIG)) {
        opcionesSelectHtml += `<option value="${config.tabla}">${nombre}</option>`;
    }

    contenedor.innerHTML = `
        <div style="max-width: 950px; margin: 0 auto; color: #fff; font-family: Arial, sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h2 style="color: #38bdf8; margin: 0;">🌐 CMU (Conversor Maestro Universal)</h2>
                <span style="background: #ef4444; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold;">ADMINISTRACIÓN INTELIGENTE</span>
            </div>
            
            <p style="color: #aaa; font-size: 13px; margin-bottom: 20px; line-height: 1.4;">
                Herramienta centralizada para migrar los mapas de Google My Maps a Supabase. 
                Selecciona la tabla destino para cargar su visor y enlace de edición al instante.
            </p>

            <!-- TARJETA: VISOR INTEGRADO Y ACCESO A DESCARGA -->
            <div style="background: #1e1e1e; padding: 20px; border-radius: 8px; border: 1px solid #333; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="color: #38bdf8; margin: 0; font-size: 14px;">🗺️ Visor de Referencia Visual y Acceso a Editor</h4>
                    <a id="btn-ir-editor" href="https://www.google.com/maps/d/" target="_blank" style="background: #2563eb; color: #fff; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 11px; font-weight: bold;">📥 Abrir Editor para Descargar CSV</a>
                </div>
                <p style="color: #9ca3af; font-size: 12px; margin-bottom: 12px;">
                    Al cambiar de tabla abajo, el mapa se cargará automáticamente aquí. Usa el botón azul para abrir el editor de Google si necesitas descargar el CSV actualizado.
                </p>
                <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                    <input type="text" id="input-map-id" placeholder="ID o URL de My Maps (autocompletable)" style="flex: 1; padding: 9px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; font-size: 12px;">
                    <button id="btn-cargar-visor" style="background: #3b82f6; color: #fff; border: none; padding: 9px 16px; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 12px; white-space: nowrap;">Cargar Visor</button>
                </div>
                <div id="iframe-container" style="width: 100%; height: 300px; background: #121212; border-radius: 6px; border: 1px solid #444; display: flex; align-items: center; justify-content: center; color: #666; font-size: 13px;">
                    Cargando mapa...
                </div>
            </div>

            <!-- TARJETA: PROCESADOR Y CARGADOR DE CSV -->
            <div style="background: #1e1e1e; padding: 20px; border-radius: 8px; border: 1px solid #333; margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #38bdf8;">1. Seleccionar Tabla Destino:</label>
                        <select id="admin-tabla-destino" style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; font-size: 13px;">
                            ${opcionesSelectHtml}
                        </select>
                    </div>

                    <div>
                        <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #38bdf8;">2. Cargar CSV exportado:</label>
                        <input type="file" id="admin-input-csv" accept=".csv" style="width: 100%; padding: 7px; background: #2a2a2a; border: 1px solid #444; color: #ccc; border-radius: 5px; font-size: 12px; box-sizing: border-box;">
                    </div>
                </div>

                <button id="btn-procesar-csv" style="background: #22c55e; color: #000; border: none; padding: 12px 20px; border-radius: 5px; font-weight: bold; cursor: pointer; width: 100%; font-size: 14px; transition: opacity 0.2s;">⚙️ Procesar, Limpiar y Previsualizar</button>
            </div>

            <!-- Contenedor de Previsualización -->
            <div id="admin-resultado-container" style="display: none; background: #1e1e1e; padding: 20px; border-radius: 8px; border: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="color: #22c55e; margin: 0; font-size: 15px;" id="admin-estado-texto">Datos listos:</h3>
                    <span id="admin-contador-registros" style="background: #2a2a2a; padding: 3px 8px; border-radius: 4px; font-size: 12px; color: #ccc;"></span>
                </div>
                
                <div id="admin-preview-tabla" style="max-height: 280px; overflow: auto; margin-bottom: 15px; font-size: 12px; background: #121212; padding: 10px; border-radius: 4px; border: 1px solid #444;"></div>
                
                <button id="btn-subir-supabase" style="background: #38bdf8; color: #000; border: none; padding: 12px 20px; border-radius: 5px; font-weight: bold; cursor: pointer; width: 100%; font-size: 14px;">🚀 Sincronizar Inteligentemente con Supabase</button>
            </div>
        </div>
    `;

    // ==========================================
    // FUNCIÓN PARA CARGAR EL VISOR Y ACTUALIZAR ENLACES
    // ==========================================
    const actualizarVisorPorTabla = (tablaSeleccionada) => {
        let midEncontrado = "";
        
        // Buscar el mid correspondiente a la tabla seleccionada en el diccionario
        for (const [nombre, config] of Object.entries(MAPAS_CONFIG)) {
            if (config.tabla === tablaSeleccionada) {
                midEncontrado = config.mid;
                break;
            }
        }

        if (!midEncontrado) return;

        // Rellenar el input de texto visualmente
        document.getElementById('input-map-id').value = midEncontrado;

        // Cargar el iframe
        const iframeContainer = document.getElementById('iframe-container');
        iframeContainer.innerHTML = `<iframe src="https://www.google.com/maps/d/embed?mid=${midEncontrado}" width="100%" height="100%" style="border:0; border-radius: 6px;" allowfullscreen></iframe>`;

        // Actualizar el botón de enlace al editor de Google
        const btnEditor = document.getElementById('btn-ir-editor');
        btnEditor.href = `https://www.google.com/maps/d/edit?mid=${midEncontrado}`;
    };

    // Evento al cambiar de tabla en el select
    document.getElementById('admin-tabla-destino').addEventListener('change', (e) => {
        actualizarVisorPorTabla(e.target.value);
    });

    // Botón manual de recarga de visor por si pegan otro ID personalizado
    document.getElementById('btn-cargar-visor').addEventListener('click', () => {
        const val = document.getElementById('input-map-id').value.trim();
        if (!val) return;
        let mid = val;
        if (val.includes('mid=')) {
            const match = val.match(/mid=([a-zA-Z0-9_-]+)/);
            if (match) mid = match[1];
        }
        document.getElementById('iframe-container').innerHTML = `<iframe src="https://www.google.com/maps/d/embed?mid=${mid}" width="100%" height="100%" style="border:0; border-radius: 6px;" allowfullscreen></iframe>`;
        document.getElementById('btn-ir-editor').href = `https://www.google.com/maps/d/edit?mid=${mid}`;
    });

    // Cargar por defecto el mapa de la primera tabla seleccionada al abrir el módulo
    const tablaInicial = document.getElementById('admin-tabla-destino').value;
    actualizarVisorPorTabla(tablaInicial);

    let datosConvertidosGlobal = [];

    // ==========================================
    // MOTOR DE LIMPIEZA Y CONVERSIÓN UNIVERSAL
    // ==========================================
    document.getElementById('btn-procesar-csv').addEventListener('click', () => {
        const fileInput = document.getElementById('admin-input-csv');
        if (!fileInput.files[0]) {
            alert('Por favor selecciona un archivo CSV descargado de My Maps.');
            return;
        }

        const reader = new FileReader();
        reader.readAsText(fileInput.files[0], 'ISO-8859-1');

        reader.onload = function(e) {
            const textoCsv = e.target.result;
            const lineas = textoCsv.split(/\r\n|\n/);
            
            if (lineas.length < 2) {
                alert('El archivo CSV está vacío o no contiene filas.');
                return;
            }

            const separador = lineas[0].includes(';') ? ';' : ',';
            const cabeceras = lineas[0].split(separador).map(h => h.trim().replace(/^"|"$/g, ''));

            let listaTemporal = [];

            const limpiarTextoSeguro = (val) => {
                if (!val) return null;
                let s = String(val).replace(/^"|"$/g, '').trim();
                s = s.replace(/Â°/g, '°')
                     .replace(/Â/g, '')
                     .replace(/Ã³/g, 'ó')
                     .replace(/Ã¡/g, 'á')
                     .replace(/Ã©/g, 'é')
                     .replace(/Ã­/g, 'í')
                     .replace(/Ãº/g, 'ú')
                     .replace(/Ã±/g, 'ñ')
                     .replace(/\xa0/g, ' ')
                     .replace(/&nbsp;/g, ' ');
                return s === '' ? null : s;
            };

            const buscarCampo = (fila, nombresPosibles) => {
                for (let nombre of nombresPosibles) {
                    if (fila[nombre] !== undefined && fila[nombre] !== '') {
                        return limpiarTextoSeguro(fila[nombre]);
                    }
                }
                return null;
            };

            const parsearWkt = (wktStr) => {
                if (!wktStr) return { lat: null, lon: null, ubicacion: null };
                const match = String(wktStr).match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
                if (match) {
                    const lon = parseFloat(match[1]);
                    const lat = parseFloat(match[2]);
                    return { lat, lon, ubicacion: `${lat}, ${lon}` };
                }
                return { lat: null, lon: null, ubicacion: null };
            };

            for (let i = 1; i < lineas.length; i++) {
                if (!lineas[i].trim()) continue;

                const valores = lineas[i].split(separador).map(v => v.replace(/^"|"$/g, ''));
                let filaOriginal = {};
                cabeceras.forEach((cab, idx) => {
                    filaOriginal[cab] = valores[idx] !== undefined ? valores[idx] : '';
                });

                const etiqueta = buscarCampo(filaOriginal, ['Nombre de etiqueta', 'Nombre', 'ETIQUETA', 'Identificador', 'Elemento']);
                const puntoGps = buscarCampo(filaOriginal, ['Punto GPS', 'PuntoGPS', 'Coordenadas']);
                const sector = buscarCampo(filaOriginal, ['Sector', 'SECTOR']);
                const ronda = buscarCampo(filaOriginal, ['Ronda', 'RONDA', 'ronda']);
                const controlMensual = buscarCampo(filaOriginal, ['CONTROL MENSUAL (Mes)', 'CONTROL MENSUAL', 'Control Mensual']);
                const realizadoPor = buscarCampo(filaOriginal, ['Control M. realizado por', 'MensualRealizadoPor', 'Realizado por']);
                const tipo = buscarCampo(filaOriginal, ['Tipo de Extintor', 'TIPO', 'Tipo']);
                const vencimiento = buscarCampo(filaOriginal, ['Vencimiento', 'VENCIMIENTO']);
                const ph = buscarCampo(filaOriginal, ['Prueba Hidraulica', 'PH', 'Prueba Hidráulica']);
                const observacion = buscarCampo(filaOriginal, ['Observacion', 'Observación', 'OBSERVACION']);
                
                const wktData = parsearWkt(filaOriginal['WKT'] || filaOriginal['geom'] || '');

                const registroLimpio = {
                    "fid": i,
                    "ETIQUETA": etiqueta,
                    "PuntoGPS": puntoGps,
                    "Sector": sector,
                    "Ronda": ronda,
                    "CONTROL MENSUAL": controlMensual,
                    "MensualRealizadoPor": realizadoPor,
                    "TIPO": tipo,
                    "Vencimiento": vencimiento,
                    "PH": ph ? parseFloat(ph) : null,
                    "Observacion": observacion,
                    "UBICACION": wktData.ubicacion,
                    "PRP": "En Planta"
                };

                listaTemporal.push(registroLimpio);
            }

            const mapaUnicos = new Map();
            listaTemporal.forEach(item => {
                if (item.ETIQUETA) {
                    mapaUnicos.set(item.ETIQUETA, item);
                }
            });
            datosConvertidosGlobal = Array.from(mapaUnicos.values());

            document.getElementById('admin-resultado-container').style.display = 'block';
            document.getElementById('admin-estado-texto').innerText = `¡Conversión y análisis exitoso! Registros listos:`;
            document.getElementById('admin-contador-registros').innerText = `${datosConvertidosGlobal.length} elementos únicos`;

            const previewDiv = document.getElementById('admin-preview-tabla');
            let tablaHtml = `<table style="width: 100%; border-collapse: collapse; color: #ccc;"><thead><tr style="background: #2a2a2a;">`;
            
            const columnasMuestra = ['ETIQUETA', 'Sector', 'TIPO', 'Vencimiento', 'UBICACION', 'PRP'];
            columnasMuestra.forEach(col => {
                tablaHtml += `<th style="border: 1px solid #444; padding: 6px; text-align: left;">${col}</th>`;
            });
            tablaHtml += `</tr></thead><tbody>`;

            datosConvertidosGlobal.slice(0, 10).forEach(row => {
                tablaHtml += `<tr>`;
                columnasMuestra.forEach(col => {
                    tablaHtml += `<td style="border: 1px solid #444; padding: 6px;">${row[col] !== null ? row[col] : ''}</td>`;
                });
                tablaHtml += `</tr>`;
            });
            tablaHtml += `</tbody></table>`;
            previewDiv.innerHTML = tablaHtml;
        };
    });

    // ==========================================
    // SINCRONIZACIÓN INTELIGENTE CON ID SECUENCIAL
    // ==========================================
    document.getElementById('btn-subir-supabase').addEventListener('click', async () => {
        if (datosConvertidosGlobal.length === 0) return;
        const tablaDestino = document.getElementById('admin-tabla-destino').value;

        if (!confirm(`¿Estás seguro de sincronizar ${datosConvertidosGlobal.length} registros en la tabla "${tablaDestino}"?`)) {
            return;
        }

        const btnSubir = document.getElementById('btn-subir-supabase');
        btnSubir.innerText = 'Analizando registros y calculando IDs...';
        btnSubir.disabled = true;

        try {
            const { data: registrosExistentes, error: errFetch } = await clienteSupabase
                .from(tablaDestino)
                .select('id, ETIQUETA');

            if (errFetch) throw new Error("No se pudo consultar Supabase: " + errFetch.message);

            const mapaExistentes = new Map();
            let maxId = 0;

            if (registrosExistentes) {
                registrosExistentes.forEach(reg => {
                    if (reg.ETIQUETA) mapaExistentes.set(reg.ETIQUETA, reg.id);
                    if (reg.id && reg.id > maxId) maxId = reg.id;
                });
            }

            const datosParaEnviar = datosConvertidosGlobal.map(item => {
                const idExistente = mapaExistentes.get(item.ETIQUETA);
                if (idExistente) {
                    return { ...item, id: idExistente };
                } else {
                    maxId++;
                    return { ...item, id: maxId };
                }
            });

            btnSubir.innerText = `Sincronizando ${datosParaEnviar.length} registros con Supabase...`;

            const chunkSize = 500;
            for (let i = 0; i < datosParaEnviar.length; i += chunkSize) {
                const chunk = datosParaEnviar.slice(i, i + chunkSize);
                const { error } = await clienteSupabase
                    .from(tablaDestino)
                    .upsert(chunk, { onConflict: 'id' });

                if (error) throw new Error("Error en sincronización: " + error.message);
            }

            alert(`¡Sincronización inteligente completada con éxito en la tabla "${tablaDestino}"! Se procesaron ${datosConvertidosGlobal.length} registros manteniendo la integridad.`);
            btnSubir.innerText = '🚀 Sincronizar Inteligentemente con Supabase';
            btnSubir.disabled = false;

        } catch (err) {
            alert('Error durante la sincronización: ' + err.message);
            btnSubir.innerText = '🚀 Sincronizar Inteligentemente con Supabase';
            btnSubir.disabled = false;
        }
    });
}