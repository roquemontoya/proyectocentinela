// ==========================================
// MÓDULO: CMU (Conversor Maestro Universal)
// Versión Definitiva con Papa Parse (Cero Pérdida de Datos)
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

// Función para cargar Papa Parse dinámicamente si no está presente
async function asegurarPapaParse() {
    if (window.Papa) return window.Papa;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
        script.onload = () => resolve(window.Papa);
        script.onerror = () => reject(new Error('No se pudo cargar Papa Parse desde el CDN.'));
        document.head.appendChild(script);
    });
}

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
                <h2 style="color: #38bdf8; margin: 0;">📚 CMU: Bibliotecario con Papa Parse</h2>
                <span style="background: #22c55e; color: #000; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold;">Papa Parse · CONTROL DE DATOS</span>
            </div>
            
            <p style="color: #aaa; font-size: 13px; margin-bottom: 20px; line-height: 1.4;">
                Procesa tus archivos CSV asegurando que se lean absolutamente todos los registros físicos sin cortes ni omisiones.
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

    const normalizarClave = (texto) => String(texto || '')
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');

    const detectarCategoria = (nombreArchivo) => {
        const name = normalizarClave(nombreArchivo);

        // Categorías controladas: generan LEU + controles_*.
        if (name.includes('extintor')) return 'Extintores';
        if (name.includes('hidrante')) return 'Hidrantes';
        if (name.includes('permiso')) return 'Permisos Permanentes';
        if (name.includes('valvulasecas') || name.includes('valvulaseca') || name.includes('valvulaeca')) return 'VECAS';
        if (name.includes('valvula')) return 'Valvulas';
        if (name.includes('ecas')) return 'ECAS';
        if (name.includes('cenicero')) return 'Ceniceros';
        if (name.includes('cortafuego') || name.includes('puertas')) return 'Puertas Cortafuego';
        if (name.includes('espumigeno')) return 'Espumigenos';

        // Categorías informativas: generan solamente LEU.
        if (name.includes('centrales')) return 'Centrales de Alarmas';
        if (name.includes('subestaci')) return 'Sub Estaciones';
        if (name.includes('ipp')) return 'IPP (Macro Sectores)';
        if (name.includes('purga')) return 'Purgas ECAS (PECAS)';

        return null;
    };

    let categoriaDetectadaGlobal = 'Extintores';
    let datosConvertidosGlobal = [];

    document.getElementById('admin-input-csv').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        categoriaDetectadaGlobal = detectarCategoria(file.name);

        if (!categoriaDetectadaGlobal) {
            document.getElementById('texto-cat-detectada').innerText = 'NO RECONOCIDA';
            document.getElementById('badge-categoria-detectada').style.display = 'block';
            document.getElementById('iframe-container').innerHTML =
                '<div style="color:#ef4444; padding:20px; text-align:center;">❌ No pude identificar la categoría por el nombre del archivo. Renómbralo con una categoría conocida antes de procesarlo.</div>';
            document.getElementById('btn-procesar-csv').disabled = true;
            return;
        }

        document.getElementById('btn-procesar-csv').disabled = false;
        document.getElementById('texto-cat-detectada').innerText = categoriaDetectadaGlobal;
        document.getElementById('badge-categoria-detectada').style.display = 'block';

        const mid = MAPAS_CONFIG[categoriaDetectadaGlobal];
        if (mid) {
            document.getElementById('iframe-container').innerHTML = `<iframe src="https://www.google.com/maps/d/embed?mid=${mid}" width="100%" height="100%" style="border:0; border-radius: 6px;" allowfullscreen></iframe>`;
            document.getElementById('btn-ir-editor').href = `https://www.google.com/maps/d/edit?mid=${mid}`;
        }
    });

    document.getElementById('btn-procesar-csv').addEventListener('click', async () => {
        const fileInput = document.getElementById('admin-input-csv');
        if (!fileInput.files[0]) {
            alert('Por favor selecciona un archivo CSV.');
            return;
        }

        try {
            const Papa = await asegurarPapaParse();

            Papa.parse(fileInput.files[0], {
                // header:false es intencional:
                // el CSV real contiene columnas duplicadas (Ronda/ronda). Así no perdemos
                // ninguna columna ni dependemos del tratamiento interno de Papa Parse
                // para encabezados repetidos.
                header: false,
                skipEmptyLines: true,
                encoding: 'UTF-8',
                complete: function(results) {
                    const filasCrudas = results.data;

                    if (!filasCrudas || filasCrudas.length < 2) {
                        alert('El archivo CSV está vacío o no contiene una fila de encabezados y datos.');
                        return;
                    }

                    if (results.errors && results.errors.length > 0) {
                        const erroresRelevantes = results.errors.slice(0, 5)
                            .map(e => e.message || 'Error de parseo')
                            .join(' | ');
                        alert('❌ Papa Parse detectó errores en el CSV: ' + erroresRelevantes);
                        return;
                    }

                    // Normalización segura: conserva letras, números, símbolos válidos y
                    // convierte espacios especiales (NBSP, espacios estrechos, etc.) en
                    // espacios normales. NO transforma símbolos como ´ o ¨.
                    const limpiarTextoSeguro = (val) => {
                        if (val === null || val === undefined) return null;

                        let s = String(val)
                            .replace(/^\\uFEFF/, '')
                            .replace(/[\\u00A0\\u1680\\u2000-\\u200B\\u202F\\u205F\\u3000]/g, ' ')
                            .trim();

                        if (!s) return null;

                        // Correcciones conservadoras de mojibake de grados. No sustituimos
                        // caracteres arbitrarios (por ejemplo â‚¬) por ° porque eso destruye datos.
                        s = s.replace(/Â°/g, '°').replace(/Ã‚°/g, '°');

                        return s.trim() || null;
                    };

                    const normalizarCabecera = (valor) => {
                        return limpiarTextoSeguro(valor)
                            ?.normalize('NFD')
                            .replace(/[\\u0300-\\u036f]/g, '')
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '') || '';
                    };

                    const parsearWkt = (wktStr) => {
                        const limpio = limpiarTextoSeguro(wktStr);
                        if (!limpio) return null;

                        const match = limpio.match(/POINT\\s*\\(\\s*([-\\d.]+)\\s+([-\\d.]+)\\s*\\)/i);
                        if (match) {
                            // WKT de My Maps = POINT(longitud latitud).
                            // La PWA existente trabaja con "latitud, longitud".
                            return \`${match[2]}, ${match[1]}\`;
                        }

                        return limpio;
                    };

                    const encabezadosOriginales = filasCrudas[0].map((cabecera, indice) => {
                        const limpia = limpiarTextoSeguro(cabecera) || \`Columna ${indice + 1}\`;
                        return limpia;
                    });

                    const indicesPorCabecera = {};
                    encabezadosOriginales.forEach((cabecera, indice) => {
                        const clave = normalizarCabecera(cabecera);
                        if (!indicesPorCabecera[clave]) indicesPorCabecera[clave] = [];
                        indicesPorCabecera[clave].push(indice);
                    });

                    const buscarIndice = (alias, opciones = {}) => {
                        const candidatos = alias.map(normalizarCabecera);

                        // Para Ronda priorizamos deliberadamente la columna escrita
                        // exactamente como "Ronda", no la segunda "ronda".
                        if (opciones.exacto) {
                            const indiceExacto = encabezadosOriginales.findIndex(
                                h => h === opciones.exacto
                            );
                            if (indiceExacto >= 0) return indiceExacto;
                        }

                        for (const candidato of candidatos) {
                            if (indicesPorCabecera[candidato]?.length) {
                                return indicesPorCabecera[candidato][0];
                            }
                        }

                        return -1;
                    };

                    const indiceEtiqueta = buscarIndice([
                        'Nombre de etiqueta', 'Nombre', 'Etiqueta', 'Identificador',
                        'Elemento', 'Valvula ECA', 'Valvula ECA 1'
                    ]);

                    const indiceSector = buscarIndice(['Sector', 'Departamento']);
                    const indiceRonda = buscarIndice(['Ronda', 'UET'], { exacto: 'Ronda' });
                    const indiceWkt = buscarIndice(['WKT', 'Geom']);

                    // "Punto GPS" está en GMS y es redundante para la PWA.
                    // No lo copiamos a atributos_tecnicos: WKT es la fuente geométrica.
                    const columnasRedundantes = new Set([
                        'puntogps',
                        'coordenadasgms'
                    ]);

                    const obtenerValor = (fila, indice) => {
                        if (indice < 0 || indice >= fila.length) return null;
                        return limpiarTextoSeguro(fila[indice]);
                    };

                    const claveAtributoUnica = (cabecera, indice, usados) => {
                        const base = cabecera || \`Columna ${indice + 1}\`;
                        let clave = base;
                        let contador = 2;

                        while (usados.has(clave)) {
                            clave = \`${base}__${contador}\`;
                            contador++;
                        }

                        usados.add(clave);
                        return clave;
                    };

                    let listaTemporal = [];

                    filasCrudas.slice(1).forEach((fila, index) => {
                        if (!Array.isArray(fila)) return;

                        let etiqueta = obtenerValor(fila, indiceEtiqueta);
                        const sector = obtenerValor(fila, indiceSector);
                        const ronda = obtenerValor(fila, indiceRonda);
                        const wkt = obtenerValor(fila, indiceWkt);
                        const atributosJSON = {};
                        const clavesUsadas = new Set();

                        encabezadosOriginales.forEach((cabeceraOriginal, indice) => {
                            const claveNormalizada = normalizarCabecera(cabeceraOriginal);
                            if (columnasRedundantes.has(claveNormalizada)) return;
                            if (indice === indiceWkt || indice === indiceEtiqueta || indice === indiceSector || indice === indiceRonda) return;

                            const valor = limpiarTextoSeguro(fila[indice]);
                            if (valor === null) return;

                            const clave = claveAtributoUnica(cabeceraOriginal, indice, clavesUsadas);
                            atributosJSON[clave] = valor;
                        });

                        // IMPORTANTE:
                        // Ya NO eliminamos la palabra "Extintor". En LEU conviven todos
                        // los elementos y necesitamos que "Extintor 54 PQS", "Extintor 54
                        // HALON" y "Extintor 54 CO2" sean identificables sin ambigüedad.
                        if (!etiqueta) etiqueta = \`Sin Etiqueta Fila ${index + 2}\`;

                        listaTemporal.push({
                            etiqueta,
                            categoria: categoriaDetectadaGlobal,
                            sector,
                            ronda,
                            ubicacion_wkt: wkt ? parsearWkt(wkt) : null,
                            atributos_tecnicos: atributosJSON
                        });
                    });

                    if (listaTemporal.length === 0) {
                        alert('❌ No se encontraron registros de datos después de procesar el CSV.');
                        return;
                    }

                    datosConvertidosGlobal = listaTemporal;

                    document.getElementById('admin-resultado-container').style.display = 'block';
                    document.getElementById('admin-estado-texto').innerText =
                        \`¡Procesado con Papa Parse: ${categoriaDetectadaGlobal}!\`;
                    document.getElementById('admin-contador-registros').innerText =
                        \`${datosConvertidosGlobal.length} elementos\`;

                    const previewDiv = document.getElementById('admin-preview-tabla');
                    let tablaHtml = \`<style>
                        #admin-preview-tabla table { width: 100%; border-collapse: collapse; color: #ccc; }
                        #admin-preview-tabla th, #admin-preview-tabla td { border: 1px solid #444; padding: 6px; text-align: left; }
                        #admin-preview-tabla th { background: #2a2a2a; color: #38bdf8; position: sticky; top: 0; }
                    </style><table><thead><tr><th>Etiqueta</th><th>Sector</th><th>Ronda</th><th>WKT</th><th>JSON Atributos</th></tr></thead><tbody>\`;

                    datosConvertidosGlobal.slice(0, 15).forEach(row => {
                        tablaHtml += \`<tr>
                            <td>${row.etiqueta || ''}</td>
                            <td>${row.sector || ''}</td>
                            <td>${row.ronda || ''}</td>
                            <td style="color: #eab308;">${row.ubicacion_wkt || ''}</td>
                            <td style="color: #38bdf8; font-family: monospace;">${JSON.stringify(row.atributos_tecnicos).substring(0, 80)}...</td>
                        </tr>\`;
                    });

                    tablaHtml += '</tbody></table>';
                    previewDiv.innerHTML = tablaHtml;
                },
                error: function(err) {
                    alert('❌ Error analizando el CSV con Papa Parse: ' + err.message);
                }
            });
        } catch (err) {
            alert('❌ Error al inicializar el procesador: ' + err.message);
        }
    });

    document.getElementById('btn-subir-supabase').addEventListener('click', async () => {
        if (datosConvertidosGlobal.length === 0) return;
        if (!categoriaDetectadaGlobal) {
            alert('❌ No hay una categoría válida para importar.');
            return;
        }

        if (!confirm(\`¿Inyectar los ${datosConvertidosGlobal.length} registros exactos como "${categoriaDetectadaGlobal}"?\`)) return;

        const btnSubir = document.getElementById('btn-subir-supabase');
        btnSubir.innerText = 'Inyectando...';
        btnSubir.disabled = true;

        const exigir = (respuesta, tabla) => {
            if (respuesta.error) {
                throw new Error(\`Error insertando en ${tabla}: ${respuesta.error.message}\`);
            }
        };

        try {
            let maxId = 0;
            const { data: maxRes, error: maxError } = await clienteSupabase
                .from('leu')
                .select('id')
                .order('id', { ascending: false })
                .limit(1);

            if (maxError) throw new Error('No se pudo obtener el último ID de LEU: ' + maxError.message);
            if (maxRes && maxRes.length > 0) maxId = Number(maxRes[0].id) || 0;

            const arrayLEU = [];
            const arrayControlesH = [];
            const arrayControlesE = [];
            const arrayControlesPfp = [];
            const arrayControlesV = [];
            const arrayControlesEcas = [];
            const arrayControlesVecas = [];
            const arrayControlesC = [];
            const arrayControlesPc = [];
            const arrayControlesEs = [];
            const arrayAnomalias = [];

            const obtenerAtributo = (attrs, nombres) => {
                for (const nombre of nombres) {
                    const clave = Object.keys(attrs).find(k =>
                        k === nombre ||
                        normalizarClave(k) === normalizarClave(nombre)
                    );
                    if (clave && attrs[clave] !== null && attrs[clave] !== undefined && String(attrs[clave]).trim() !== '') {
                        return attrs[clave];
                    }
                }
                return null;
            };

            datosConvertidosGlobal.forEach((item) => {
                maxId++;
                const idActivo = maxId;
                const attrs = item.atributos_tecnicos || {};

                arrayLEU.push({
                    id: idActivo,
                    categoria: item.categoria,
                    etiqueta: item.etiqueta,
                    sector: item.sector,
                    ronda: item.ronda,
                    ubicacion_wkt: item.ubicacion_wkt,
                    atributos_tecnicos: {
                        fuente: 'My Maps CSV',
                        atributos_originales: attrs
                    }
                });

                const textoAnomalia = obtenerAtributo(attrs, [
                    'ANOMALIAS SI / NO',
                    'anomalias',
                    'Novedades'
                ]);

                if (
                    textoAnomalia &&
                    String(textoAnomalia).trim() !== '' &&
                    String(textoAnomalia).trim().toUpperCase() !== 'NULL' &&
                    String(textoAnomalia).trim().toUpperCase() !== 'NO'
                ) {
                    arrayAnomalias.push({
                        id_activo: idActivo,
                        modulo_origen: categoriaDetectadaGlobal.toLowerCase(),
                        evento_numero: obtenerAtributo(attrs, ['Evento Numero']),
                        anomalia_detectada: String(textoAnomalia),
                        detalle_informe: obtenerAtributo(attrs, ['Detalle Informe', 'Observacion']),
                        reportado_fecha: null,
                        reportado_por: obtenerAtributo(attrs, ['Reportado Por']),
                        estado_resolucion: 'Abierta'
                    });
                }

                // El número que aparece en el nombre del extintor NO es una FK.
                // Hay series independientes (PQS, HALON, CO2, etc.) y pueden repetirse.
                // La FK real es SIEMPRE el ID generado para esta fila de LEU.
                const matchNum = String(item.etiqueta || '').match(/(?:^|\\s)(\\d+)(?=\\s|['´¨"”]|$)/);
                const numeroOriginal = matchNum ? matchNum[1] : null;

                if (categoriaDetectadaGlobal === 'Extintores') {
                    arrayControlesE.push({
                        id_activo: idActivo,
                        nombreetiqueta: item.etiqueta,
                        sector: item.sector,
                        ronda: item.ronda,
                        controlmensual: obtenerAtributo(attrs, ['CONTROL MENSUAL (Mes)']),
                        controlrealizadopor: obtenerAtributo(attrs, ['Control M. realizado por']),
                        tipoextintor: obtenerAtributo(attrs, ['Tipo de Extintor']),
                        vencimiento: obtenerAtributo(attrs, ['Vencimiento']),
                        pruebahidraulica: obtenerAtributo(attrs, ['Prueba Hidraulica']),
                        observacion: obtenerAtributo(attrs, ['Observacion'])
                    });
                } else if (categoriaDetectadaGlobal === 'Hidrantes') {
                    arrayControlesH.push({
                        id_activo: idActivo,
                        idch_original: numeroOriginal
                    });
                } else if (categoriaDetectadaGlobal === 'Permisos Permanentes') {
                    arrayControlesPfp.push({
                        id_activo: idActivo,
                        nombreetiqueta: item.etiqueta,
                        sector: item.sector
                    });
                } else if (categoriaDetectadaGlobal === 'Valvulas') {
                    arrayControlesV.push({
                        id_activo: idActivo,
                        nombreetiqueta: item.etiqueta,
                        sector: item.sector
                    });
                } else if (categoriaDetectadaGlobal === 'ECAS') {
                    arrayControlesEcas.push({
                        id_activo: idActivo,
                        nombreetiqueta: item.etiqueta,
                        sector: item.sector
                    });
                } else if (categoriaDetectadaGlobal === 'VECAS') {
                    arrayControlesVecas.push({
                        id_activo: idActivo,
                        valvula_eca: item.etiqueta,
                        sector: item.sector
                    });
                } else if (categoriaDetectadaGlobal === 'Ceniceros') {
                    arrayControlesC.push({
                        id_activo: idActivo,
                        nombreetiqueta: item.etiqueta,
                        sector: item.sector
                    });
                } else if (categoriaDetectadaGlobal === 'Puertas Cortafuego') {
                    arrayControlesPc.push({
                        id_activo: idActivo,
                        nombreetiqueta: item.etiqueta,
                        sector: item.sector
                    });
                } else if (categoriaDetectadaGlobal === 'Espumigenos') {
                    arrayControlesEs.push({
                        id_activo: idActivo,
                        nombreetiqueta: item.etiqueta,
                        sector: item.sector
                    });
                }
            });

            const chunkSize = 500;

            for (let i = 0; i < arrayLEU.length; i += chunkSize) {
                const respuesta = await clienteSupabase
                    .from('leu')
                    .insert(arrayLEU.slice(i, i + chunkSize));
                exigir(respuesta, 'LEU');
            }

            if (arrayAnomalias.length > 0) {
                for (let i = 0; i < arrayAnomalias.length; i += chunkSize) {
                    const respuesta = await clienteSupabase
                        .from('anomalias')
                        .insert(arrayAnomalias.slice(i, i + chunkSize));
                    exigir(respuesta, 'anomalias');
                }
            }

            const mapTablas = [
                { data: arrayControlesE, tabla: 'controles_e' },
                { data: arrayControlesH, tabla: 'controles_h' },
                { data: arrayControlesPfp, tabla: 'controles_pfp' },
                { data: arrayControlesV, tabla: 'controles_v' },
                { data: arrayControlesEcas, tabla: 'controles_ecas' },
                { data: arrayControlesVecas, tabla: 'controles_vecas' },
                { data: arrayControlesC, tabla: 'controles_c' },
                { data: arrayControlesPc, tabla: 'controles_pc' },
                { data: arrayControlesEs, tabla: 'controles_es' }
            ];

            for (const t of mapTablas) {
                if (t.data.length === 0) continue;

                for (let i = 0; i < t.data.length; i += chunkSize) {
                    const respuesta = await clienteSupabase
                        .from(t.tabla)
                        .insert(t.data.slice(i, i + chunkSize));
                    exigir(respuesta, t.tabla);
                }
            }

            const totalControles =
                arrayControlesE.length +
                arrayControlesH.length +
                arrayControlesPfp.length +
                arrayControlesV.length +
                arrayControlesEcas.length +
                arrayControlesVecas.length +
                arrayControlesC.length +
                arrayControlesPc.length +
                arrayControlesEs.length;

            alert(
                \`¡Carga masiva completada!\n\nLEU: ${arrayLEU.length}\nControles: ${totalControles}\nAnomalías: ${arrayAnomalias.length}\n\nCategoría: ${categoriaDetectadaGlobal}\`
            );

            btnSubir.innerText = '🚀 Inyectar en LEU, Controles y Anomalías (Supabase)';
            btnSubir.disabled = false;
        } catch (err) {
            console.error('CMU - error de carga:', err);
            alert('❌ Error durante la carga. No se confirmó la importación completa: ' + err.message);
            btnSubir.innerText = '🚀 Reintentar inyección';
            btnSubir.disabled = false;
        }
    });
}