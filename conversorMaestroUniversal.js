// ==========================================
// MÓDULO: CMU (Conversor Maestro Universal)
// Sincronización Inteligente, Limpieza e Ingesta a Supabase
// ==========================================

import { clienteSupabase } from './supabaseClient.js';

export function cargarModuloAdminCsv(contenedor) {
    contenedor.style.width = '100%';
    contenedor.style.padding = '20px';
    contenedor.style.boxSizing = 'border-box';
    contenedor.style.overflowY = 'auto';
    contenedor.style.height = 'calc(100vh - 65px)';
    contenedor.style.backgroundColor = '#121212';

    contenedor.innerHTML = `
        <div style="max-width: 950px; margin: 0 auto; color: #fff; font-family: Arial, sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h2 style="color: #38bdf8; margin: 0;">🌐 CMU (Conversor Maestro Universal)</h2>
                <span style="background: #ef4444; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold;">ADMINISTRACIÓN INTELIGENTE</span>
            </div>
            
            <p style="color: #aaa; font-size: 13px; margin-bottom: 20px; line-height: 1.4;">
                Herramienta centralizada para migrar los mapas de Google My Maps a Supabase. 
                El motor limpia la codificación corrupta, <b>protege las marcas con primas (' , ´ , ¨)</b> y gestiona altas y actualizaciones de forma blindada.
            </p>

            <div style="background: #1e1e1e; padding: 20px; border-radius: 8px; border: 1px solid #333; margin-bottom: 20px;">
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                    <div>
                        <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #38bdf8;">1. Seleccionar Tabla Destino:</label>
                        <select id="admin-tabla-destino" style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; font-size: 13px;">
                            <option value="Extintores">Extintores</option>
                            <option value="hidrantes">Hidrantes</option>
                            <option value="ecas">ECAS</option>
                            <option value="valvulas">Válvulas</option>
                            <option value="vecas">VECAS</option>
                            <option value="pecas">PECAS</option>
                            <option value="ipp">IPP</option>
                            <option value="Bomberos">Bomberos</option>
                        </select>
                    </div>

                    <div>
                        <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #38bdf8;">2. Cargar CSV de My Maps:</label>
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

    let datosConvertidosGlobal = [];

    // ==========================================
    // MOTOR DE LIMPIEZA Y CONVERSIÓN UNIVERSAL
    // ==========================================
    document.getElementById('btn-procesar-csv').addEventListener('click', () => {
        const fileInput = document.getElementById('admin-input-csv');
        if (!fileInput.files[0]) {
            alert('Por favor selecciona un archivo CSV exportado de My Maps.');
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

            // Deduplicación interna por etiqueta
            const mapaUnicos = new Map();
            listaTemporal.forEach(item => {
                if (item.ETIQUETA) {
                    mapaUnicos.set(item.ETIQUETA, item);
                }
            });
            datosConvertidosGlobal = Array.from(mapaUnicos.values());

            // Renderizar previsualización
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
    // SINCRONIZACIÓN INTELIGENTE (UPSERT / INSERT BLINDADO)
    // ==========================================
    document.getElementById('btn-subir-supabase').addEventListener('click', async () => {
        if (datosConvertidosGlobal.length === 0) return;
        const tablaDestino = document.getElementById('admin-tabla-destino').value;

        if (!confirm(`¿Estás seguro de sincronizar ${datosConvertidosGlobal.length} registros en la tabla "${tablaDestino}"?`)) {
            return;
        }

        const btnSubir = document.getElementById('btn-subir-supabase');
        btnSubir.innerText = 'Analizando registros existentes en Supabase...';
        btnSubir.disabled = true;

        try {
            // 1. Consultar registros actualizados en Supabase
            const { data: registrosExistentes, error: errFetch } = await clienteSupabase
                .from(tablaDestino)
                .select('id, ETIQUETA');

            if (errFetch) throw new Error("No se pudo consultar Supabase: " + errFetch.message);

            const mapaExistentes = new Map();
            if (registrosExistentes) {
                registrosExistentes.forEach(reg => {
                    if (reg.ETIQUETA) mapaExistentes.set(reg.ETIQUETA, reg.id);
                });
            }

            // 2. Separar limpiamente: Actualizaciones (con ID) e Inserciones (sin rastro de id)
            const paraActualizar = [];
            const paraInsertar = [];

            datosConvertidosGlobal.forEach(item => {
                const idExistente = mapaExistentes.get(item.ETIQUETA);
                if (idExistente) {
                    paraActualizar.push({ ...item, id: idExistente });
                } else {
                    const limpio = { ...item };
                    delete limpio.id; // Nos aseguramos de borrar cualquier rastro de ID para que Supabase lo autogenere
                    paraInsertar.push(limpio);
                }
            });

            btnSubir.innerText = `Sincronizando: ${paraActualizar.length} actualizaciones, ${paraInsertar.length} nuevos...`;

            const chunkSize = 500;

            // 3. Procesar Actualizaciones mediante UPSERT por ID
            for (let i = 0; i < paraActualizar.length; i += chunkSize) {
                const chunk = paraActualizar.slice(i, i + chunkSize);
                const { error } = await clienteSupabase
                    .from(tablaDestino)
                    .upsert(chunk, { onConflict: 'id' });

                if (error) throw new Error("Error en actualización: " + error.message);
            }

            // 4. Procesar Inserciones mediante INSERT limpio
            for (let i = 0; i < paraInsertar.length; i += chunkSize) {
                const chunk = paraInsertar.slice(i, i + chunkSize);
                const { error } = await clienteSupabase
                    .from(tablaDestino)
                    .insert(chunk);

                if (error) throw new Error("Error en inserción: " + error.message);
            }

            alert(`¡Sincronización inteligente completada con éxito en "${tablaDestino}"!\n- Registros actualizados: ${paraActualizar.length}\n- Registros nuevos agregados: ${paraInsertar.length}`);
            btnSubir.innerText = '🚀 Sincronizar Inteligentemente con Supabase';
            btnSubir.disabled = false;

        } catch (err) {
            alert('Error durante la sincronización: ' + err.message);
            btnSubir.innerText = '🚀 Sincronizar Inteligentemente con Supabase';
            btnSubir.disabled = false;
        }
    });
}