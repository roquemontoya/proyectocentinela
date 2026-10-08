// ==========================================
// MÓDULO: CMU (Conversor Maestro Universal)
// El Bibliotecario de Honor (Mapeo Exacto Supabase)
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
                <span style="background: #22c55e; color: #000; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold;">MODO INTELIGENTE WKT / JSONB</span>
            </div>
            
            <p style="color: #aaa; font-size: 13px; margin-bottom: 20px; line-height: 1.4;">
                El motor procesa la categoría seleccionada limpiando nomenclaturas redundantes y enviando atributos técnicos en JSONB.
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

                <button id="btn-procesar-csv" style="background: #22c55e; color: #000; border: none; padding: 12px 20px; border-radius: 5px; font-weight: bold; cursor: pointer; width: 100%; font-size: 14px; transition: opacity 0.2s;">⚙️ Procesar Datos para LEU</button>
            </div>

            <!-- Contenedor de Previsualización -->
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
    // MOTOR DE NORMALIZACIÓN INTELIGENTE
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

            const aliasEtiqueta = ['nombre de etiqueta', 'nombre', 'etiqueta', 'identificador', 'elemento', 'valvula eca', 'valvula eca 1'];
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

                while (valores.length > expectedLen) {
                    valores[1] = valores[1] + ", " + valores[2];
                    valores.splice(2, 1);
                }
                while (valores.length < expectedLen) {
                    valores.push("");
                }

                let etiqueta = null, sector = null, ronda = null, wkt = null;
                let atributosJSON = {};

                cabeceras.forEach((cab, idx) => {
                    let valor = limpiarTextoSeguro(valores[idx]);
                    if (!valor) return;

                    let cabMin = cab.toLowerCase();

                    if (aliasEtiqueta.includes(cabMin) && !etiqueta) etiqueta = valor;
                    else if (aliasSector.includes(cabMin) && !sector) sector = valor;
                    else if (aliasRonda.includes(cabMin) && !ronda) ronda = valor;
                    else if (aliasWkt.includes(cabMin) && !wkt) wkt = valor;
                    else {
                        atributosJSON[cab] = valor;
                    }
                });

                if (!etiqueta) etiqueta = `Sin Etiqueta Fila ${index + 1}`;

                let etiquetaLimpia = etiqueta;
                if (categoriaSeleccionada === 'Extintores') {
                    etiquetaLimpia = etiqueta.replace(/^extintor\s*/i, '');
                }

                listaTemporal.push({
                    "etiqueta": etiquetaLimpia,
                    "categoria": categoriaSeleccionada,
                    "sector": sector,
                    "ronda": ronda,
                    "ubicacion_wkt": wkt ? parsearWkt(wkt) : null,
                    "atributos_tecnicos": atributosJSON
                });
            });

            datosConvertidosGlobal = listaTemporal;

            document.getElementById('admin-resultado-container').style.display = 'block';
            document.getElementById('admin-estado-texto').innerText = `¡Procesamiento Inteligente Completado!`;
            document.getElementById('admin-contador-registros').innerText = `${datosConvertidosGlobal.length} elementos`;

            const previewDiv = document.getElementById('admin-preview-tabla');
            let tablaHtml = `<style>
                #admin-preview-tabla table { width: 100%; border-collapse: collapse; color: #ccc; }
                #admin-preview-tabla th, #admin-preview-tabla td { border: 1px solid #444; padding: 6px; text-align: left; }
                #admin-preview-tabla th { background: #2a2a2a; color: #38bdf8; position: sticky; top: 0; z-index: 2; }
            </style><table><thead><tr>`;
            
            const columnasMuestra = ['Etiqueta Limpia', 'Sector', 'Ronda', 'WKT (Decimal)', 'JSON Empaquetado'];
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
    // SINCRONIZACIÓN BIFURCADA (LEU + CONTROLES + ANOMALÍAS)
    // ==========================================
    document.getElementById('btn-subir-supabase').addEventListener('click', async () => {
        if (datosConvertidosGlobal.length === 0) return;
        const categoriaSeleccionada = document.getElementById('admin-categoria-destino').value;

        if (!confirm(`¿Inyectar los ${datosConvertidosGlobal.length} registros de "${categoriaSeleccionada}" en LEU, Controles y Anomalías?`)) {
            return;
        }

        const btnSubir = document.getElementById('btn-subir-supabase');
        btnSubir.innerText = 'Consultando base de datos...';
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

            const arrayLEU = [];
            const arrayControlesH = [];
            const arrayControlesE = [];
            const arrayControlesV = [];
            const arrayControlesEcas = [];
            const arrayControlesVecas = [];
            const arrayControlesC = [];
            const arrayControlesPc = [];
            const arrayControlesEs = [];
            const arrayAnomalias = [];

            datosConvertidosGlobal.forEach((item) => {
                maxId++;
                const idActivo = maxId;
                const attrs = item.atributos_tecnicos;

                // 1. Guardar en LEU (Enciclopedia Universal)
                arrayLEU.push({
                    id: idActivo,
                    categoria: item.categoria,
                    etiqueta: item.etiqueta,
                    sector: item.sector, 
                    ronda: item.ronda,
                    ubicacion_wkt: item.ubicacion_wkt,
                    atributos_tecnicos: { fuente: 'My Maps CSV', atributos_originales: attrs }
                });

                // 2. Extracción transversal de anomalías (si el registro reporta anomalía)
                const textoAnomalia = attrs['ANOMALIAS SI / NO'] || attrs['anomalias'] || attrs['Novedades'] || null;
                if (textoAnomalia && String(textoAnomalia).trim() !== '' && String(textoAnomalia).toUpperCase() !== 'NULL' && String(textoAnomalia).toUpperCase() !== 'NO' && String(textoAnomalia).toUpperCase() !== '0') {
                    arrayAnomalias.push({
                        id_activo: idActivo,
                        modulo_origen: categoriaSeleccionada.toLowerCase(),
                        evento_numero: attrs['Evento Numero'] || null,
                        anomalia_detectada: String(textoAnomalia),
                        detalle_informe: attrs['Detalle Informe'] || attrs['Observacion'] || attrs['Observaciones'] || null,
                        observacion: attrs['Observacion'] || attrs['Comentario'] || null,
                        reportado_fecha: parseFecha(attrs['Reportado Fecha']),
                        reportado_por: attrs['Reportado Por'] || attrs['Reportado por'] || null,
                        estado_resolucion: 'Abierta'
                    });
                }

                // 3. Distribución inteligente según tablas de control
                const matchNum = item.etiqueta.match(/([0-9]+)/);

                // A. Hidrantes
                if (attrs['Prueba 2026 Fecha'] !== undefined || attrs['Llave Alimentacion'] !== undefined) {
                    arrayControlesH.push({
                        id_activo: idActivo,
                        idch_original: matchNum ? matchNum[1] : null,
                        prueba_anual: parseFecha(attrs['Prueba 2026 Fecha']),
                        prueba_aprobada: attrs['Prueba Aprobada SI / NO'] || null,
                        realizo: attrs['Realizo la Prueba '] || null,
                        planing_prueba_mes: attrs['Planing Prueba Mes'] || null,
                        control_mensual: attrs['CONTROL MENSUAL (Mes)'] || null,
                        estado: attrs['ESTADO'] || null,
                        llave_alimentacion: attrs['Llave Alimentacion'] || null,
                        detalle_llave_alimentacion: attrs['Detalle Llave Alimentacion'] || null,
                        llave_teatro_derecho: attrs['Llave Teatro Derecho'] || null,
                        detalle_t_derecho: attrs['Detalle T. Derecho'] || null,
                        llave_teatro_izquierdo: attrs['Llave Teatro Izquierdo'] || null,
                        detalle_t_izquierdo: attrs['Detalle T Izquierdo'] || null,
                        observacion: attrs['Observacion'] || null,
                        anomalias: attrs['ANOMALIAS SI / NO'] || null,
                        reportado_fecha: parseFecha(attrs['Reportado Fecha']),
                        reportado_por: attrs['Reportado Por'] || null
                    });
                }
                // B. Extintores
                else if (categoriaSeleccionada === 'Extintores') {
                    let tipoDetectado = attrs['Tipo de Extintor'] || attrs['tipo'] || null;
                    if (!tipoDetectado) {
                        const textoCompleto = (item.etiqueta + ' ' + JSON.stringify(attrs)).toUpperCase();
                        if (textoCompleto.includes('CO2')) tipoDetectado = 'CO2';
                        else if (textoCompleto.includes('PQS')) tipoDetectado = 'PQS';
                        else if (textoCompleto.includes('HALON')) tipoDetectado = 'HALON';
                        else if (textoCompleto.includes('K')) tipoDetectado = 'K';
                        else tipoDetectado = 'GENERAL';
                    }

                    arrayControlesE.push({
                        id_extintor: matchNum ? parseInt(matchNum[1], 10) : null,
                        nombreetiqueta: item.etiqueta,
                        puntogps: attrs['Punto GPS'] || null,
                        sector: item.sector,
                        ronda: item.ronda,
                        controlmensual: attrs['CONTROL MENSUAL (Mes)'] || null,
                        controlrealizadopor: attrs['Control M. realizado por'] || attrs['Realizo'] || null,
                        tipoextintor: tipoDetectado ? tipoDetectado.trim() : 'GENERAL',
                        vencimiento: parseFecha(attrs['Vencimiento']),
                        pruebahidraulica: attrs['Prueba Hidraulica'] || null,
                        observacion: attrs['Observacion'] || null
                    });
                }
                // C. Válvulas
                else if (attrs['Prueba 2026 Fecha'] !== undefined && attrs['Vueltas1'] !== undefined) {
                    arrayControlesV.push({
                        id_activo: idActivo,
                        idv_original: matchNum ? matchNum[1] : null,
                        nombreetiqueta: item.etiqueta,
                        puntogps: attrs['Punto GPS'] || null,
                        sector: item.sector,
                        ubicacion: attrs['Ubicación'] || null,
                        estado: attrs['Estado'] || null,
                        prueba_fecha: parseFecha(attrs['Prueba 2026 Fecha']),
                        prueba_mes: attrs['PRUEBA MES.'] || null,
                        realizo_prueba: attrs['Realizo la Prueba.'] || null,
                        planing_prueba_mes: attrs['Planing Prueba Mes'] || null,
                        control_mensual: attrs['CONTROL MENSUAL (Mes)'] || null,
                        control_realizado_por: attrs['Control M. realizado por'] || null,
                        tipo: attrs['Tipo'] || null,
                        nivel: attrs['Nivel'] || null,
                        vueltas: attrs['Vueltas1'] ? parseFloat(attrs['Vueltas1']) : null,
                        prueba_con: attrs['Prueba Con'] || null,
                        cadena_candado: attrs['Cadena y Candado'] || null,
                        chapa: attrs['Chapa'] || null,
                        observacion: attrs['Observacion'] || null,
                        observaciones: attrs['Observaciones'] || null,
                        anomalias: attrs['ANOMALIAS SI / NO'] || null,
                        evento_numero: attrs['Evento Numero'] || null,
                        reportado_fecha: parseFecha(attrs['Reportado Fecha']),
                        reportado_por: attrs['Reportado Por'] || null,
                        detalle_informe: attrs['Detalle Informe'] || null,
                        programado: attrs['Programado'] || null,
                        intervencion_realizada_por: attrs['Intervencion  realizada por'] || null,
                        fecha: parseFecha(attrs['Fecha']),
                        motivo: attrs['Motivo'] || null,
                        informe: attrs['Informe'] || null
                    });
                }
                // D. ECAS
                else if (attrs['Central que reporta'] !== undefined && attrs['P/ENTRADA'] !== undefined) {
                    arrayControlesEcas.push({
                        id_activo: idActivo,
                        ideca_original: matchNum ? matchNum[1] : null,
                        nombreetiqueta: item.etiqueta,
                        puntogps: attrs['Punto GPS'] || null,
                        ubicacion: attrs['Ubicación'] || null,
                        sector: item.sector,
                        central_que_reporta: attrs['Central que reporta'] || null,
                        estado: attrs['Estado'] || null,
                        fecha_inspeccion_2025: parseFecha(attrs['Fecha Inspeccion 2025']),
                        mes: attrs['Mes'] || null,
                        p_entrada: attrs['P/ENTRADA'] || null,
                        p_salida: attrs['P/SALIDA'] || null,
                        t_gong: attrs['T/GONG'] || null,
                        t_central: attrs['T central'] || null,
                        t_monitoreo: attrs['T.monitoreo'] || null,
                        rotulo_central: attrs['ROTULO CENTRAL'] || null,
                        rotulo_base: attrs['ROTULO BASE'] || null,
                        observaciones: attrs['Observaciones'] || null,
                        parametros_reporte: attrs['Parametros / Reporte 2025'] || null,
                        control_semana_n: attrs['CONTROL SEMANA N°'] || null,
                        control_s_realizado_por: attrs['Control S. realizado por'] || null,
                        p_entrada_semanal: attrs['P/ Entrada Semanal'] || null,
                        p_salida_semanal: attrs['P/ Salida Semanal'] || null,
                        status: attrs['STATUS'] || null,
                        anomalias: attrs['ANOMALIAS SI / NO'] || null,
                        evento_numero: attrs['Evento Numero'] || null,
                        observacion: attrs['Observacion'] || null,
                        reportado_fecha: parseFecha(attrs['Reportado Fecha']),
                        reportado_por: attrs['Reportado Por'] || null
                    });
                }
                // E. VECAS (Válvulas de ECAS)
                else if (attrs['Valvula ECA'] !== undefined) {
                    arrayControlesVecas.push({
                        id_activo: idActivo,
                        idvecas_original: matchNum ? matchNum[1] : null,
                        valvula_eca: attrs['Valvula ECA'] || null,
                        puntogps: attrs['Punto GPS'] || null,
                        ubicacion: attrs['Ubicación'] || null,
                        sector: item.sector,
                        central_que_reporta: attrs['Central que reporta'] || null,
                        estado: attrs['Estado'] || null,
                        reporta: attrs['Reporta'] || null,
                        fecha: parseFecha(attrs['Fecha']),
                        tiempo: attrs['Tiempo'] ? parseFloat(attrs['Tiempo']) : null,
                        rotulo: attrs['Rotulo'] || null,
                        cadena_candado: attrs['Cadena y Candado'] || null,
                        realizo_la_prueba: attrs['Realizo la Prueba'] || null,
                        comentario: attrs['Comentario'] || null
                    });
                }
                // F. Ceniceros
                else if (attrs['Arena OK/NO'] !== undefined || attrs['Colillas OK/NO'] !== undefined) {
                    arrayControlesC.push({
                        id_activo: idActivo,
                        idcenicero_original: attrs['N° serial'] ? parseFloat(attrs['N° serial']) : (matchNum ? parseInt(matchNum[1], 10) : null),
                        nombreetiqueta: item.etiqueta,
                        puntogps: attrs['Punto GPS'] || null,
                        sector: item.sector,
                        responsable_de_area: attrs['Responsable De Area'] || null,
                        controlado_semana: attrs['CONTROLADO SEMANA'] || null,
                        control_realizado_por: attrs['Control realizado por'] || null,
                        limpieza: attrs['Limpieza OK/NO.'] || null,
                        carteleria: attrs['Carteleria OK/NO'] || null,
                        pintura: attrs['Pintura OK/NO'] || null,
                        demarcacion: attrs['Demarcacion OK/NO '] || null,
                        arena: attrs['Arena OK/NO'] || null,
                        colillas: attrs['Colillas OK/NO'] || null,
                        cadena: attrs['Cadena OK/NO'] || null,
                        estado_de_cenicero: attrs['Estado de Cenicero'] || null,
                        observaciones: attrs['Observaciones'] || null,
                        novedades: attrs['Novedades'] || null,
                        n_serial: attrs['N° serial'] ? parseFloat(attrs['N° serial']) : null
                    });
                }
                // G. Puertas Cortafuego
                else if (attrs['CONTROL SEMANAL'] !== undefined && attrs['Observaciones1'] !== undefined) {
                    arrayControlesPc.push({
                        id_activo: idActivo,
                        idpc_original: matchNum ? matchNum[1] : null,
                        nombreetiqueta: item.etiqueta,
                        puntogps: attrs['Punto GPS'] || null,
                        sector: item.sector,
                        ubicacion: attrs['Ubicación'] || null,
                        control_semanal: attrs['CONTROL SEMANAL'] || null,
                        control_s_realizado_por: attrs['Control S. realizado por'] || null,
                        observaciones1: attrs['Observaciones1'] || null,
                        anomalias: attrs['ANOMALIAS SI / NO'] || null,
                        reportado_fecha: parseFecha(attrs['Reportado Fecha']),
                        reportado_por: attrs['Reportado por'] || null
                    });
                }
                // H. Espumígenos
                else if (attrs['CONTROL SEMANAL'] !== undefined && (attrs['Observaciones'] !== undefined || attrs['Punto GPS'] !== undefined)) {
                    arrayControlesEs.push({
                        id_activo: idActivo,
                        idesp_original: matchNum ? matchNum[1] : null,
                        puntogps: attrs['Punto GPS'] || null,
                        nombreetiqueta: item.etiqueta,
                        sector: item.sector,
                        ubicacion: attrs['Ubicación'] || null,
                        control_semanal: attrs['CONTROL SEMANAL'] || null,
                        control_s_realizado_por: attrs['Control S. realizado por'] || null,
                        observaciones: attrs['Observaciones'] || null
                    });
                }
            });

            const chunkSize = 500;

            // 4. Inyección en LEU
            btnSubir.innerText = `Inyectando ${arrayLEU.length} activos en LEU...`;
            for (let i = 0; i < arrayLEU.length; i += chunkSize) {
                const chunk = arrayLEU.slice(i, i + chunkSize);
                const { error } = await clienteSupabase.from('leu').insert(chunk);
                if (error) throw new Error("Fallo inyectando en LEU: " + error.message);
            }

            // 5. Inyección en la Tabla Transversal de Anomalías
            if (arrayAnomalias.length > 0) {
                btnSubir.innerText = `Inyectando ${arrayAnomalias.length} anomalías en tabla general...`;
                for (let i = 0; i < arrayAnomalias.length; i += chunkSize) {
                    const chunk = arrayAnomalias.slice(i, i + chunkSize);
                    const { error } = await clienteSupabase.from('anomalias').insert(chunk);
                    if (error) throw new Error("Fallo inyectando en anomalias: " + error.message);
                }
            }

            // 6. Inyección en Tablas de Control Específicas
            const tablasControlMap = [
                { data: arrayControlesH, tabla: 'controles_h' },
                { data: arrayControlesE, tabla: 'controles_e' },
                { data: arrayControlesV, tabla: 'controles_v' },
                { data: arrayControlesEcas, tabla: 'controles_ecas' },
                { data: arrayControlesVecas, tabla: 'controles_vecas' },
                { data: arrayControlesC, tabla: 'controles_c' },
                { data: arrayControlesPc, tabla: 'controles_pc' },
                { data: arrayControlesEs, tabla: 'controles_es' }
            ];

            for (const itemCtrl of tablasControlMap) {
                if (itemCtrl.data.length > 0) {
                    btnSubir.innerText = `Inyectando ${itemCtrl.data.length} registros en ${itemCtrl.tabla}...`;
                    for (let i = 0; i < itemCtrl.data.length; i += chunkSize) {
                        const chunk = itemCtrl.data.slice(i, i + chunkSize);
                        const { error } = await clienteSupabase.from(itemCtrl.tabla).insert(chunk);
                        if (error) throw new Error(`Fallo inyectando en ${itemCtrl.tabla}: ` + error.message);
                    }
                }
            }

            let msgExito = `¡Migración exitosa para la categoría "${categoriaSeleccionada}"!\n\nSe procesaron:\n- ${arrayLEU.length} Activos registrados en LEU.`;
            if (arrayAnomalias.length > 0) msgExito += `\n- ${arrayAnomalias.length} Anomalías centralizadas.`;
            if (arrayControlesH.length > 0) msgExito += `\n- ${arrayControlesH.length} Historiales de Hidrantes.`;
            if (arrayControlesE.length > 0) msgExito += `\n- ${arrayControlesE.length} Historiales de Extintores.`;
            if (arrayControlesV.length > 0) msgExito += `\n- ${arrayControlesV.length} Historiales de Válvulas.`;
            if (arrayControlesEcas.length > 0) msgExito += `\n- ${arrayControlesEcas.length} Historiales de ECAS.`;
            if (arrayControlesVecas.length > 0) msgExito += `\n- ${arrayControlesVecas.length} Historiales de VECAS.`;
            if (arrayControlesC.length > 0) msgExito += `\n- ${arrayControlesC.length} Historiales de Ceniceros.`;
            if (arrayControlesPc.length > 0) msgExito += `\n- ${arrayControlesPc.length} Historiales de Puertas Cortafuego.`;
            if (arrayControlesEs.length > 0) msgExito += `\n- ${arrayControlesEs.length} Historiales de Espumígenos.`;

            alert(msgExito);
            btnSubir.innerText = '🚀 Inyectar en LEU, Controles y Anomalías (Supabase)';
            btnSubir.disabled = false;

        } catch (err) {
            alert('❌ Ocurrió un error crítico:\n' + err.message);
            btnSubir.innerText = '🚀 Inyectar en LEU, Controles y Anomalías (Supabase)';
            btnSubir.disabled = false;
        }
    });
}

function parseFecha(val) {
    if (!val || typeof val !== 'string' || val.trim() === '' || val.toUpperCase() === 'NULL') return null;
    const parts = val.split('/');
    if (parts.length === 3) {
        const parsed = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
    }
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}