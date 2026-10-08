// ==========================================
// MÓDULO: CMU (Conversor Maestro Universal)
// El Bibliotecario Autónomo Definitivo (Parser Robusto RFC 4180)
// ==========================================

import { clienteSupabase } from './supabaseClient.js';

const MAPAS_CONFIG = {
    "Extintores": "1SoiI--YYaSL7UJs7cZjk8qxIHNjmVrM",
    "Hidrantes": "1-kh06uxnaCx9AOEaVC6g80VeZ5A_ePg",
    "Permisos Permanentes": "1DtM0jSm04nXrpB1efrCl6hLxAxtDzxo",
    "Valvulas": "1-kh06uxnaCx9AOEaVC6g80VeZ5A_ePg",
    "ECAS": "1-kh06uxnaCx9AOEaVC6g80VeZ5A_ePg",
    "VECAS": "1-kh06uxnaCx9AOEaVC6g80VeZ5A_ePg",
    "Ceniceros": "1lNpPuI3-4IjII_ZIf6rTL76Jk3oums0",
    "Puertas Cortafuego": "1DtM0jSm04nXrpB1efrCl6hLxAxtDzxo",
    "Espumigenos": "1lNpPuI3-4IjII_ZIf6rTL76Jk3oums0",
    "Centrales de Alarmas": "1SoiI--YYaSL7UJs7cZjk8qxIHNjmVrM",
    "Sub Estaciones": "1SoiI--YYaSL7UJs7cZjk8qxIHNjmVrM",
    "IPP (Macro Sectores)": "1FI54CKve2s3E4nKQ4PQQ5M6ABn2vvno",
    "Purgas ECAS (PECAS)": "1-kh06uxnaCx9AOEaVC6g80VeZ5A_ePg"
};

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
                <h2 style="color: #38bdf8; margin: 0;">📚 CMU: Bibliotecario Autónomo Pro</h2>
                <span style="background: #22c55e; color: #000; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold;">PARSER ROBUSTO RFC 4180</span>
            </div>
            
            <p style="color: #aaa; font-size: 13px; margin-bottom: 20px; line-height: 1.4;">
                Carga cualquier CSV de My Maps. El sistema detectará la categoría por el nombre y procesará celdas multilínea y polígonos sin errores.
            </p>

            <div style="background: #1e1e1e; padding: 20px; border-radius: 8px; border: 1px solid #333; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="color: #38bdf8; margin: 0; font-size: 14px;">🗺️ Visor de Referencia Visual</h4>
                    <a id="btn-ir-editor" href="https://www.google.com/maps/d/" target="_blank" style="background: #2563eb; color: #fff; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 11px; font-weight: bold;">📥 Abrir Editor My Maps</a>
                </div>
                <div id="iframe-container" style="width: 100%; height: 250px; background: #121212; border-radius: 6px; border: 1px solid #444; display: flex; align-items: center; justify-content: center; color: #666; font-size: 13px;">
                    Cargando visor...
                </div>
            </div>

            <div style="background: #1e1e1e; padding: 20px; border-radius: 8px; border: 1px solid #333; margin-bottom: 20px;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #38bdf8;">Cargar CSV exportado:</label>
                    <input type="file" id="admin-input-csv" accept=".csv" style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; color: #ccc; border-radius: 5px; font-size: 13px; box-sizing: border-box;">
                </div>

                <div id="badge-categoria-detectada" style="display: none; background: #0f172a; border: 1px solid #38bdf8; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 13px; color: #38bdf8;">
                    🔍 Categoría detectada: <strong id="texto-cat-detectada" style="color: #22c55e;">-</strong>
                </div>

                <button id="btn-procesar-csv" style="background: #22c55e; color: #000; border: none; padding: 12px 20px; border-radius: 5px; font-weight: bold; cursor: pointer; width: 100%; font-size: 14px;">⚙️ Procesar Archivo</button>
            </div>

            <div id="admin-resultado-container" style="display: none; background: #1e1e1e; padding: 20px; border-radius: 8px; border: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="color: #22c55e; margin: 0; font-size: 15px;" id="admin-estado-texto">Datos listos:</h3>
                    <span id="admin-contador-registros" style="background: #2a2a2a; padding: 3px 8px; border-radius: 4px; font-size: 12px; color: #ccc;"></span>
                </div>
                
                <div id="admin-preview-tabla" style="max-height: 280px; overflow: auto; margin-bottom: 15px; font-size: 12px; background: #121212; padding: 10px; border-radius: 4px; border: 1px solid #444;"></div>
                
                <button id="btn-subir-supabase" style="background: #38bdf8; color: #000; border: none; padding: 12px 20px; border-radius: 5px; font-weight: bold; cursor: pointer; width: 100%; font-size: 14px;">🚀 Inyectar en LEU, Controles y Anomalías (Supabase)</button>
            </div>
        </div>
    `;

    const detectarCategoria = (nombreArchivo) => {
        const name = nombreArchivo.toLowerCase();
        if (name.includes('extintor')) return 'Extintores';
        if (name.includes('hidrante')) return 'Hidrantes';
        if (name.includes('permiso')) return 'Permisos Permanentes';
        if (name.includes('valvulasecas') || name.includes('valvulas eca')) return 'VECAS';
        if (name.includes('valvula')) return 'Valvulas';
        if (name.includes('ecas')) return 'ECAS';
        if (name.includes('cenicero')) return 'Ceniceros';
        if (name.includes('cortafuego') || name.includes('puertas')) return 'Puertas Cortafuego';
        if (name.includes('espumigeno')) return 'Espumigenos';
        if (name.includes('centrales')) return 'Centrales de Alarmas';
        if (name.includes('sub estaci') || name.includes('subestacion')) return 'Sub Estaciones';
        if (name.includes('ipp')) return 'IPP (Macro Sectores)';
        if (name.includes('purga')) return 'Purgas ECAS (PECAS)';
        return 'Extintores';
    };

    let categoriaDetectadaGlobal = 'Extintores';
    let datosConvertidosGlobal = [];

    // Parser robusto RFC 4180 (Maneja comillas, comas/punto y comas y saltos de línea internos en celdas)
    const parseCsvRobust = (text) => {
        let rows = [];
        let currentRow = [];
        let currentField = '';
        let inQuotes = false;
        
        let firstLineEnd = text.indexOf('\n');
        let firstLine = firstLineEnd !== -1 ? text.substring(0, firstLineEnd) : text;
        let separator = firstLine.includes(';') ? ';' : ',';

        for (let i = 0; i < text.length; i++) {
            let char = text[i];
            let nextChar = text[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentField += '"';
                    i++; 
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === separator && !inQuotes) {
                currentRow.push(currentField.trim());
                currentField = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++; 
                }
                currentRow.push(currentField.trim());
                if (currentRow.length > 1 || currentRow[0] !== '') {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentField = '';
            } else {
                currentField += char;
            }
        }
        if (currentField !== '' || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            rows.push(currentRow);
        }
        return rows;
    };

    document.getElementById('admin-input-csv').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        categoriaDetectadaGlobal = detectarCategoria(file.name);
        document.getElementById('texto-cat-detectada').innerText = categoriaDetectadaGlobal;
        document.getElementById('badge-categoria-detectada').style.display = 'block';

        const mid = MAPAS_CONFIG[categoriaDetectadaGlobal];
        if (mid) {
            document.getElementById('iframe-container').innerHTML = `<iframe src="https://www.google.com/maps/d/embed?mid=${mid}" width="100%" height="100%" style="border:0; border-radius: 6px;" allowfullscreen></iframe>`;
            document.getElementById('btn-ir-editor').href = `https://www.google.com/maps/d/edit?mid=${mid}`;
        }
    });

    document.getElementById('btn-procesar-csv').addEventListener('click', () => {
        const fileInput = document.getElementById('admin-input-csv');
        if (!fileInput.files[0]) {
            alert('Por favor selecciona un archivo CSV.');
            return;
        }

        const reader = new FileReader();
        reader.readAsText(fileInput.files[0], 'UTF-8');

        reader.onload = function(e) {
            let textoCsv = e.target.result;
            textoCsv = textoCsv.replace(/â‚¬/g, '°').replace(/Â°/g, '°').replace(/Â/g, '');

            const parsedRows = parseCsvRobust(textoCsv);
            if (parsedRows.length < 2) {
                alert('El archivo CSV está vacío o mal formado.');
                return;
            }

            const cabeceras = parsedRows[0].map(c => c.replace(/^"|"$/g, '').trim());
            const filasDatos = parsedRows.slice(1);

            const aliasEtiqueta = ['nombre de etiqueta', 'nombre', 'etiqueta', 'identificador', 'elemento', 'valvula eca', 'valvula eca 1'];
            const aliasSector = ['sector', 'departamento'];
            const aliasRonda = ['ronda', 'uet'];
            const aliasWkt = ['wkt', 'geom'];
            const aliasGmsIgnorar = ['punto gps', 'puntogps', 'coordenadas gms'];

            let listaTemporal = [];
            const limpiarTextoSeguro = (val) => {
                if (!val) return null;
                let s = String(val).trim().replace(/^"|"$/g, '');
                return s === '' ? null : s;
            };

            const parsearWkt = (wktStr) => {
                if (!wktStr) return null;
                const match = String(wktStr).match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
                if (match) return `${match[2]}, ${match[1]}`;
                return wktStr; 
            };

            filasDatos.forEach((fila, index) => {
                let etiqueta = null, sector = null, ronda = null, wkt = null;
                let atributosJSON = {};

                cabeceras.forEach((cab, idx) => {
                    let valor = limpiarTextoSeguro(fila[idx]);
                    if (!valor) return;
                    let cabMin = cab.toLowerCase();

                    if (aliasEtiqueta.includes(cabMin) && !etiqueta) etiqueta = valor;
                    else if (aliasSector.includes(cabMin) && !sector) sector = valor;
                    else if (aliasRonda.includes(cabMin) && !ronda) ronda = valor;
                    else if (aliasWkt.includes(cabMin) && !wkt) wkt = valor;
                    else if (!aliasGmsIgnorar.includes(cabMin)) {
                        atributosJSON[cab] = valor;
                    }
                });

                if (!etiqueta) etiqueta = `Sin Etiqueta Fila ${index + 1}`;
                if (categoriaDetectadaGlobal === 'Extintores') {
                    etiqueta = etiqueta.replace(/^extintor\s*/i, '');
                }

                listaTemporal.push({
                    "etiqueta": etiqueta,
                    "categoria": categoriaDetectadaGlobal,
                    "sector": sector,
                    "ronda": ronda,
                    "ubicacion_wkt": wkt ? parsearWkt(wkt) : null,
                    "atributos_tecnicos": atributosJSON
                });
            });

            datosConvertidosGlobal = listaTemporal;
            document.getElementById('admin-resultado-container').style.display = 'block';
            document.getElementById('admin-estado-texto').innerText = `¡Procesado como: ${categoriaDetectadaGlobal}!`;
            document.getElementById('admin-contador-registros').innerText = `${datosConvertidosGlobal.length} elementos`;

            const previewDiv = document.getElementById('admin-preview-tabla');
            let tablaHtml = `<style>
                #admin-preview-tabla table { width: 100%; border-collapse: collapse; color: #ccc; }
                #admin-preview-tabla th, #admin-preview-tabla td { border: 1px solid #444; padding: 6px; text-align: left; }
                #admin-preview-tabla th { background: #2a2a2a; color: #38bdf8; position: sticky; top: 0; }
            </style><table><thead><tr><th>Etiqueta</th><th>Sector</th><th>WKT</th><th>JSON Atributos</th></tr></thead><tbody>`;
            
            datosConvertidosGlobal.slice(0, 15).forEach(row => {
                tablaHtml += `<tr>
                    <td>${row.etiqueta || ''}</td>
                    <td>${row.sector || ''}</td>
                    <td style="color: #eab308;">${row.ubicacion_wkt || ''}</td>
                    <td style="color: #38bdf8; font-family: monospace;">${JSON.stringify(row.atributos_tecnicos).substring(0, 40)}...</td>
                </tr>`;
            });
            tablaHtml += `</tbody></table>`;
            previewDiv.innerHTML = tablaHtml;
        };
    });

    document.getElementById('btn-subir-supabase').addEventListener('click', async () => {
        if (datosConvertidosGlobal.length === 0) return;
        if (!confirm(`¿Inyectar ${datosConvertidosGlobal.length} registros como "${categoriaDetectadaGlobal}"?`)) return;

        const btnSubir = document.getElementById('btn-subir-supabase');
        btnSubir.innerText = 'Inyectando...'; 
        btnSubir.disabled = true;

        try {
            let maxId = 0;
            const { data: maxRes } = await clienteSupabase.from('leu').select('id').order('id', { ascending: false }).limit(1);
            if (maxRes && maxRes.length > 0) maxId = maxRes[0].id || 0;

            const arrayLEU = []; const arrayControlesH = []; const arrayControlesE = [];
            const arrayControlesPfp = []; const arrayControlesV = []; const arrayControlesEcas = [];
            const arrayControlesVecas = []; const arrayControlesC = []; const arrayControlesPc = [];
            const arrayControlesEs = []; const arrayAnomalias = [];

            datosConvertidosGlobal.forEach((item) => {
                maxId++;
                const idActivo = maxId;
                const attrs = item.atributos_tecnicos;

                arrayLEU.push({
                    id: idActivo, categoria: item.categoria, etiqueta: item.etiqueta,
                    sector: item.sector, ronda: item.ronda, ubicacion_wkt: item.ubicacion_wkt,
                    atributos_tecnicos: { fuente: 'My Maps CSV', atributos_originales: attrs }
                });

                const textoAnomalia = attrs['ANOMALIAS SI / NO'] || attrs['anomalias'] || attrs['Novedades'] || null;
                if (textoAnomalia && String(textoAnomalia).trim() !== '' && String(textoAnomalia).toUpperCase() !== 'NULL' && String(textoAnomalia).toUpperCase() !== 'NO') {
                    arrayAnomalias.push({
                        id_activo: idActivo, modulo_origen: categoriaDetectadaGlobal.toLowerCase(),
                        evento_numero: attrs['Evento Numero'] || null, anomalia_detectada: String(textoAnomalia),
                        detalle_informe: attrs['Detalle Informe'] || attrs['Observacion'] || null,
                        reportado_fecha: null, reportado_por: attrs['Reportado Por'] || null, estado_resolucion: 'Abierta'
                    });
                }

                const matchNum = item.etiqueta.match(/([0-9]+)/);
                if (categoriaDetectadaGlobal === 'Extintores') {
                    arrayControlesE.push({
                        id_extintor: matchNum ? parseInt(matchNum[1], 10) : null,
                        nombreetiqueta: item.etiqueta, sector: item.sector, ronda: item.ronda,
                        controlmensual: attrs['CONTROL MENSUAL (Mes)'] || null, tipoextintor: 'GENERAL',
                        observacion: attrs['Observacion'] || null
                    });
                } else if (categoriaDetectadaGlobal === 'Hidrantes') {
                    arrayControlesH.push({ id_activo: idActivo, idch_original: matchNum ? matchNum[1] : null });
                } else if (categoriaDetectadaGlobal === 'Permisos Permanentes') {
                    arrayControlesPfp.push({ id_activo: idActivo, nombreetiqueta: item.etiqueta, sector: item.sector });
                } else if (categoriaDetectadaGlobal === 'Valvulas') {
                    arrayControlesV.push({ id_activo: idActivo, nombreetiqueta: item.etiqueta, sector: item.sector });
                } else if (categoriaDetectadaGlobal === 'ECAS') {
                    arrayControlesEcas.push({ id_activo: idActivo, nombreetiqueta: item.etiqueta, sector: item.sector });
                } else if (categoriaDetectadaGlobal === 'VECAS') {
                    arrayControlesVecas.push({ id_activo: idActivo, valvula_eca: item.etiqueta, sector: item.sector });
                } else if (categoriaDetectadaGlobal === 'Ceniceros') {
                    arrayControlesC.push({ id_activo: idActivo, nombreetiqueta: item.etiqueta, sector: item.sector });
                } else if (categoriaDetectadaGlobal === 'Puertas Cortafuego') {
                    arrayControlesPc.push({ id_activo: idActivo, nombreetiqueta: item.etiqueta, sector: item.sector });
                } else if (categoriaDetectadaGlobal === 'Espumigenos') {
                    arrayControlesEs.push({ id_activo: idActivo, nombreetiqueta: item.etiqueta, sector: item.sector });
                }
            });

            const chunkSize = 500;
            for (let i = 0; i < arrayLEU.length; i += chunkSize) {
                await clienteSupabase.from('leu').insert(arrayLEU.slice(i, i + chunkSize));
            }
            if (arrayAnomalias.length > 0) {
                for (let i = 0; i < arrayAnomalias.length; i += chunkSize) {
                    await clienteSupabase.from('anomalias').insert(arrayAnomalias.slice(i, i + chunkSize));
                }
            }

            const mapTablas = [
                { data: arrayControlesE, tabla: 'controles_e' }, { data: arrayControlesH, tabla: 'controles_h' },
                { data: arrayControlesPfp, tabla: 'controles_pfp' }, { data: arrayControlesV, tabla: 'controles_v' },
                { data: arrayControlesEcas, tabla: 'controles_ecas' }, { data: arrayControlesVecas, tabla: 'controles_vecas' },
                { data: arrayControlesC, tabla: 'controles_c' }, { data: arrayControlesPc, tabla: 'controles_pc' },
                { data: arrayControlesEs, tabla: 'controles_es' }
            ];

            for (const t of mapTablas) {
                if (t.data.length > 0) {
                    for (let i = 0; i < t.data.length; i += chunkSize) {
                        await clienteSupabase.from(t.tabla).insert(t.data.slice(i, i + chunkSize));
                    }
                }
            }

            alert(`¡Carga masiva exitosa para "${categoriaDetectadaGlobal}" con el parser robusto!`);
            btnSubir.innerText = '🚀 Inyectar en LEU, Controles y Anomalías (Supabase)';
            btnSubir.disabled = false;
        } catch (err) {
            alert('❌ Error: ' + err.message);
            btnSubir.innerText = '🚀 Inyectar en LEU, Controles y Anomalías (Supabase)';
            btnSubir.disabled = false;
        }
    });
}