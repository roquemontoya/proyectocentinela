// ==========================================
// MÓDULO: CMU (Conversor Maestro Universal)
// El Bibliotecario de Honor (Normalizador Autocorrector)
// ==========================================

import { clienteSupabase } from './supabaseClient.js';

// =========================================================================
// DICCIONARIO DE MAPAS CONFIGURABLES
// Clave: Categoría en LEU | Valor: ID de My Maps para el visor
// =========================================================================
const MAPAS_CONFIG = {
    "Extintores": "1SoiI--YYaSL7UJs7cZjk8qxIHNjmVrM",
    "Movil 20": "1lNpPuI3-4IjII_ZIf6rTL76Jk3oums0",
    "Ingenieria": "1-kh06uxnaCx9AOEaVC6g80VeZ5A_ePg",
    "MPR": "1FI54CKve2s3E4nKQ4PQQ5M6ABn2vvno",
    "Seguridad PC Abril - Julio": "1DtM0jSm04nXrpB1efrCl6hLxAxtDzxo",
    "Prevencion": "1IGbD2Xi2_6zmccPikavfTDX8b0OvkjU",
    "Seguridad Relevamiento": "16r_aJ_eYHovLnmweQo6v1Ly_6J_y22k"
};

export function cargarModuloAdminCsv(contenedor) {
    contenedor.style.width = '100%';
    contenedor.style.padding = '20px';
    contenedor.style.boxSizing = 'border-box';
    contenedor.style.overflowY = 'auto';
    contenedor.style.height = 'calc(100vh - 65px)';
    contenedor.style.backgroundColor = '#121212';

    let opcionesSelectHtml = '';
    for (const nombreCategoria of Object.keys(MAPAS_CONFIG)) {
        opcionesSelectHtml += `<option value="${nombreCategoria}">${nombreCategoria}</option>`;
    }

    contenedor.innerHTML = `
        <div style="max-width: 950px; margin: 0 auto; color: #fff; font-family: Arial, sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h2 style="color: #38bdf8; margin: 0;">📚 CMU: Bibliotecario de Honor</h2>
                <span style="background: #22c55e; color: #000; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold;">AUTOCORRECTOR ROBUSTO JSONB</span>
            </div>
            
            <p style="color: #aaa; font-size: 13px; margin-bottom: 20px; line-height: 1.4;">
                El motor cuenta con normalización geométrica y autocorrección de desvíos por comas no escapadas en My Maps.
            </p>

            <!-- TARJETA: VISOR INTEGRADO Y ACCESO A DESCARGA -->
            <div style="background: #1e1e1e; padding: 20px; border-radius: 8px; border: 1px solid #333; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <h4 style="color: #38bdf8; margin: 0; font-size: 14px;">🗺️ Visor de Referencia Visual y Acceso a Editor</h4>
                    <a id="btn-ir-editor" href="https://www.google.com/maps/d/" target="_blank" style="background: #2563eb; color: #fff; padding: 6px 12px; border-radius: 4px; text-decoration: none; font-size: 11px; font-weight: bold;">📥 Abrir Editor para Descargar CSV</a>
                </div>
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
                        <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #38bdf8;">1. Categoría en LEU (Activo):</label>
                        <select id="admin-categoria-destino" style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; font-size: 13px;">
                            ${opcionesSelectHtml}
                        </select>
                    </div>

                    <div>
                        <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #38bdf8;">2. Cargar CSV exportado:</label>
                        <input type="file" id="admin-input-csv" accept=".csv" style="width: 100%; padding: 7px; background: #2a2a2a; border: 1px solid #444; color: #ccc; border-radius: 5px; font-size: 12px; box-sizing: border-box;">
                    </div>
                </div>

                <button id="btn-procesar-csv" style="background: #22c55e; color: #000; border: none; padding: 12px 20px; border-radius: 5px; font-weight: bold; cursor: pointer; width: 100%; font-size: 14px; transition: opacity 0.2s;">⚙️ Procesar con Normalización Robusta</button>
            </div>

            <!-- Contenedor de Previsualización -->
            <div id="admin-resultado-container" style="display: none; background: #1e1e1e; padding: 20px; border-radius: 8px; border: 1px solid #333;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h3 style="color: #22c55e; margin: 0; font-size: 15px;" id="admin-estado-texto">Datos listos:</h3>
                    <span id="admin-contador-registros" style="background: #2a2a2a; padding: 3px 8px; border-radius: 4px; font-size: 12px; color: #ccc;"></span>
                </div>
                
                <div id="admin-preview-tabla" style="max-height: 280px; overflow: auto; margin-bottom: 15px; font-size: 12px; background: #121212; padding: 10px; border-radius: 4px; border: 1px solid #444;"></div>
                
                <button id="btn-subir-supabase" style="background: #38bdf8; color: #000; border: none; padding: 12px 20px; border-radius: 5px; font-weight: bold; cursor: pointer; width: 100%; font-size: 14px;">🚀 Inyectar en LEU de forma Impecable</button>
            </div>
        </div>
    `;

    // ==========================================
    // CONTROLADOR DEL VISOR Y ENLACES
    // ==========================================
    const actualizarVisorPorCategoria = (categoriaSeleccionada) => {
        const midEncontrado = MAPAS_CONFIG[categoriaSeleccionada];
        if (!midEncontrado) return;

        document.getElementById('input-map-id').value = midEncontrado;
        document.getElementById('iframe-container').innerHTML = `<iframe src="https://www.google.com/maps/d/embed?mid=${midEncontrado}" width="100%" height="100%" style="border:0; border-radius: 6px;" allowfullscreen></iframe>`;
        document.getElementById('btn-ir-editor').href = `https://www.google.com/maps/d/edit?mid=${midEncontrado}`;
    };

    document.getElementById('admin-categoria-destino').addEventListener('change', (e) => {
        actualizarVisorPorCategoria(e.target.value);
    });

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

    const categoriaInicial = document.getElementById('admin-categoria-destino').value;
    actualizarVisorPorCategoria(categoriaInicial);

    let datosConvertidosGlobal = [];

    // ==========================================
    // MOTOR DE NORMALIZACIÓN ROBUSTA
    // ==========================================
    document.getElementById('btn-procesar-csv').addEventListener('click', () => {
        const fileInput = document.getElementById('admin-input-csv');
        if (!fileInput.files[0]) {
            alert('Por favor selecciona un archivo CSV descargado de My Maps.');
            return;
        }

        const categoriaSeleccionada = document.getElementById('admin-categoria-destino').value;

        const reader = new FileReader();
        reader.readAsText(fileInput.files[0], 'ISO-8859-1');

        reader.onload = function(e) {
            const textoCsv = e.target.result;
            const lineasCrudas = textoCsv.split(/\r\n|\n/);
            
            if (lineasCrudas.length < 2) {
                alert('El archivo CSV está vacío.');
                return;
            }

            const separador = lineasCrudas[0].includes(';') ? ';' : ',';
            
            // Parser simple para la cabecera
            const parsearFilaSimple = (texto) => {
                let val = [];
                let cur = '';
                let q = false;
                for (let i = 0; i < texto.length; i++) {
                    let char = texto[i];
                    if (char === '"') {
                        q = !q;
                    } else if (char === separador && !q) {
                        val.push(cur.trim().replace(/^"|"$/g, ''));
                        cur = '';
                    } else {
                        cur += char;
                    }
                }
                val.push(cur.trim().replace(/^"|"$/g, ''));
                return val;
            };

            const cabeceras = parsearFilaSimple(lineasCrudas[0]);
            const expectedLen = cabeceras.length;

            // Agrupar bloques por WKT
            let registrosCrudos = [];
            let lineasActuales = [];

            for (let i = 1; i < lineasCrudas.length; i++) {
                let linea = lineasCrudas[i];
                let trimLinea = linea.trim();
                
                if (trimLinea.startsWith('POINT') || trimLinea.startsWith('POLYGON') || trimLinea.startsWith('"POINT') || trimLinea.startsWith('"POLYGON')) {
                    if (lineasActuales.length > 0) {
                        registrosCrudos.push(lineasActuales.join('\n'));
                        lineasActuales = [];
                    }
                }
                lineasActuales.push(linea);
            }
            if (lineasActuales.length > 0) {
                registrosCrudos.push(lineasActuales.join('\n'));
            }

            const parsearCamposFila = (filaTexto) => {
                let valores = [];
                let currentVal = '';
                let entreComillas = false;
                for (let c = 0; c < filaTexto.length; c++) {
                    let char = filaTexto[c];
                    let nextChar = filaTexto[c + 1];
                    if (char === '"') {
                        if (entreComillas && nextChar === '"') {
                            currentVal += '"';
                            c++;
                        } else {
                            entreComillas = !entreComillas;
                        }
                    } else if (char === separador && !entreComillas) {
                        valores.push(currentVal);
                        currentVal = '';
                    } else if ((char === '\n' || char === '\r') && !entreComillas) {
                        // Ignorar saltos internos
                    } else {
                        currentVal += char;
                    }
                }
                valores.push(currentVal);
                return valores.map(v => v.replace(/^"|"$/g, '').trim());
            };

            const aliasEtiqueta = ['nombre de etiqueta', 'nombre', 'etiqueta', 'identificador', 'elemento', 'valvula eca'];
            const aliasGps = ['punto gps', 'puntogps', 'coordenadas', 'punto'];
            const aliasSector = ['sector', 'departamento'];
            const aliasRonda = ['ronda', 'uet'];
            const aliasWkt = ['wkt', 'geom'];

            let listaTemporal = [];

            const limpiarTextoSeguro = (val) => {
                if (!val) return null;
                let s = String(val).trim();
                s = s.replace(/Â°/g, '°').replace(/Â/g, '').replace(/Ã³/g, 'ó').replace(/Ã¡/g, 'á')
                 .replace(/Ã©/g, 'é').replace(/Ã­/g, 'í').replace(/Ãº/g, 'ú').replace(/Ã±/g, 'ñ')
                 .replace(/\xa0/g, ' ');
                return s === '' ? null : s;
            };

            const parsearWkt = (wktStr) => {
                if (!wktStr) return null;
                const match = String(wktStr).match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
                if (match) {
                    const lon = parseFloat(match[1]);
                    const lat = parseFloat(match[2]);
                    return `${lat}, ${lon}`;
                }
                return wktStr; 
            };

            registrosCrudos.forEach((bloque, index) => {
                if (!bloque.trim()) return;
                let valores = parsearCamposFila(bloque);

                // --- NORMALIZADOR ANTIVENENO (Smart Normalizer) ---
                // Si hay un desfase de columnas por culpa de comas no escapadas en My Maps,
                // unimos los campos de texto intermedios hasta alinear la longitud exacta.
                while (valores.length > expectedLen) {
                    valores[1] = valores[1] + ", " + valores[2];
                    valores.splice(2, 1);
                }
                while (valores.length < expectedLen) {
                    valores.push("");
                }

                let etiqueta = null, gps = null, sector = null, ronda = null, wkt = null;
                let atributosJSON = {};

                cabeceras.forEach((cab, idx) => {
                    let valor = limpiarTextoSeguro(valores[idx]);
                    if (!valor) return;

                    let cabMin = cab.toLowerCase();

                    if (aliasEtiqueta.includes(cabMin) && !etiqueta) etiqueta = valor;
                    else if (aliasGps.includes(cabMin) && !gps) gps = valor;
                    else if (aliasSector.includes(cabMin) && !sector) sector = valor;
                    else if (aliasRonda.includes(cabMin) && !ronda) ronda = valor;
                    else if (aliasWkt.includes(cabMin) && !wkt) wkt = valor;
                    else {
                        atributosJSON[cab] = valor;
                    }
                });

                if (!etiqueta) etiqueta = `Sin Etiqueta Fila ${index + 1}`;

                listaTemporal.push({
                    "etiqueta": etiqueta,
                    "categoria": categoriaSeleccionada,
                    "sector": sector,
                    "ronda": ronda,
                    "punto_gps": gps,
                    "ubicacion_wkt": wkt ? parsearWkt(wkt) : null,
                    "atributos_tecnicos": atributosJSON
                });
            });

            datosConvertidosGlobal = listaTemporal;

            document.getElementById('admin-resultado-container').style.display = 'block';
            document.getElementById('admin-estado-texto').innerText = `¡Procesamiento Robusto e Impecable!`;
            document.getElementById('admin-contador-registros').innerText = `${datosConvertidosGlobal.length} elementos`;

            const previewDiv = document.getElementById('admin-preview-tabla');
            let tablaHtml = `<style>
                #admin-preview-tabla table { width: 100%; border-collapse: collapse; color: #ccc; }
                #admin-preview-tabla th, #admin-preview-tabla td { border: 1px solid #444; padding: 6px; text-align: left; }
                #admin-preview-tabla th { background: #2a2a2a; color: #38bdf8; position: sticky; top: 0; z-index: 2; }
            </style><table><thead><tr>`;
            
            const columnasMuestra = ['Etiqueta', 'Sector', 'Ronda', 'WKT (Decimal)', 'JSON Empaquetado'];
            columnasMuestra.forEach(col => {
                tablaHtml += `<th>${col}</th>`;
            });
            tablaHtml += `</tr></thead><tbody>`;

            datosConvertidosGlobal.slice(0, 20).forEach(row => {
                const jsonCorto = JSON.stringify(row.atributos_tecnicos).substring(0, 50) + '...';
                tablaHtml += `<tr>
                    <td>${row.etiqueta || ''}</td>
                    <td>${row.sector || ''}</td>
                    <td>${row.ronda || ''}</td>
                    <td style="color: #eab308;">${row.ubicacion_wkt || ''}</td>
                    <td style="color: #38bdf8; font-family: monospace;">${jsonCorto}</td>
                </tr>`;
            });
            tablaHtml += `</tbody></table>`;
            previewDiv.innerHTML = tablaHtml;
        };
    });

    // ==========================================
    // SINCRONIZACIÓN INTACTA CON LEU
    // ==========================================
    document.getElementById('btn-subir-supabase').addEventListener('click', async () => {
        if (datosConvertidosGlobal.length === 0) return;
        const categoriaSeleccionada = document.getElementById('admin-categoria-destino').value;

        if (!confirm(`¿Inyectar los ${datosConvertidosGlobal.length} registros limpios y robustos en LEU bajo la categoría "${categoriaSeleccionada}"?`)) {
            return;
        }

        const btnSubir = document.getElementById('btn-subir-supabase');
        btnSubir.innerText = 'Inyectando en LEU con precisión quirúrgica...';
        btnSubir.disabled = true;

        try {
            let maxId = 0;
            const { data: maxRes, error: errMax } = await clienteSupabase
                .from('leu')
                .select('id')
                .order('id', { ascending: false })
                .limit(1);

            if (!errMax && maxRes && maxRes.length > 0) {
                maxId = maxRes[0].id || 0;
            }

            const datosParaEnviar = datosConvertidosGlobal.map((item) => {
                maxId++;
                return { ...item, id: maxId };
            });

            btnSubir.innerText = `Sincronizando ${datosParaEnviar.length} registros con LEU...`;

            const chunkSize = 500;
            for (let i = 0; i < datosParaEnviar.length; i += chunkSize) {
                const chunk = datosParaEnviar.slice(i, i + chunkSize);
                const { error } = await clienteSupabase
                    .from('leu')
                    .insert(chunk);

                if (error) throw new Error("Error en sincronización: " + error.message);
            }

            alert(`¡Proceso impecable! Se guardaron exitosamente los ${datosConvertidosGlobal.length} registros de "${categoriaSeleccionada}" en LEU sin un solo desvío.`);
            btnSubir.innerText = '🚀 Inyectar en LEU de forma Impecable';
            btnSubir.disabled = false;

        } catch (err) {
            alert('Error durante la sincronización: ' + err.message);
            btnSubir.innerText = '🚀 Inyectar en LEU de forma Impecable';
            btnSubir.disabled = false;
        }
    });
}