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


/**
 * Convierte el WKT de IPP al formato de geometría que acepta public.ipp.geom.
 * La tabla ipp usa geometry(Polygon,4326), por lo que una GEOMETRYCOLLECTION
 * solo es convertible cuando contiene exactamente un POLYGON.
 */
function convertirWktIppAGeometria(valor) {
    if (valor === null || valor === undefined) return null;

    let wkt = String(valor)
        .replace(/^\uFEFF/, '')
        .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
        .trim();

    if (!wkt) return null;

    // Quitar SRID previo para normalizar la salida.
    wkt = wkt.replace(/^SRID=\s*\d+\s*;\s*/i, '').trim();

    // POLYGON ya es compatible; normalizamos siempre a SRID 4326.
    if (/^POLYGON\s*\(/i.test(wkt)) {
        return /^SRID=/i.test(wkt) ? wkt : `SRID=4326;${wkt}`;
    }

    // GEOMETRYCOLLECTION: aceptar únicamente una colección que contenga
    // exactamente un POLYGON. Si hay varios polígonos, no se puede insertar
    // directamente en geometry(Polygon,4326) sin decidir cómo fusionarlos.
    const gc = wkt.match(/^GEOMETRYCOLLECTION\s*\((.*)\)\s*$/is);
    if (gc) {
        const contenido = gc[1];
        const poligonos = contenido.match(/POLYGON\s*\(\((?:[^()]|\([^()]*\))*\)\)/gi) || [];

        if (poligonos.length === 1) {
            return `SRID=4326;${poligonos[0].trim()}`;
        }

        return null;
    }

    return null;
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
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');

    const detectarCategoria = (nombreArchivo) => {
        const name = normalizarClave(nombreArchivo);

        // Resolver primero las categorías específicas que pueden aparecer
        // junto a la palabra "Extintores" en el prefijo del archivo.
        // Ej.: "EXTINTORES- Centrales de Alarmas.csv" debe ser informativo,
        // no una importación de extintores.
        if (name.includes('centrales')) return 'Centrales de Alarmas';
        if (name.includes('equiposdesegundaintervencion') || name.includes('esi')) return 'ESI';
        if (name.includes('epi')) return 'EPI';
        if (name.includes('redtroncal') || name.includes('reddeincendio') || name.includes('tuberiastroncales')) return 'Red Troncal';
        if (name.includes('subestaci')) return 'Sub Estaciones';
        if (name.includes('permisopermanente') || name.includes('permiso')) return 'Permisos Permanentes';

        // Categorías controladas: generan LEU + controles_*.
        if (name.includes('extintor')) return 'Extintores';
        if (name.includes('hidrante')) return 'Hidrantes';
        if (name.includes('valvulasecas') || name.includes('valvulaseca') || name.includes('valvulaeca')) return 'VECAS';
        if (name.includes('valvula')) return 'Valvulas';
        // Priorizar PECAS antes de ECAS: "Purgas ECAS" contiene ambas palabras.
        if (name.includes('purga')) return 'Purgas ECAS (PECAS)';
        if (name.includes('ecas')) return 'ECAS';
        if (name.includes('cenicero')) return 'Ceniceros';
        if (name.includes('cortafuego') || name.includes('puertas')) return 'Puertas Cortafuego';
        if (name.includes('espumigeno')) return 'Espumigenos';

        // Otras categorías informativas conocidas: generan solamente LEU.
        if (name.includes('ipp')) return 'IPP (Macro Sectores)';

        // Categoría informativa genérica: cualquier CSV nuevo cuyo nombre no coincida
        // con una categoría operativa conocida se conserva como capa informativa en LEU.
        // No crea controles específicos. Se usa el nombre del archivo como subcategoría
        // para distinguir, por ejemplo, zonas de luminarias, caminos, áreas y futuras capas.
        const nombreBase = String(nombreArchivo || '')
            .replace(/\.[^.]+$/, '')
            .replace(/^(?:EXTINTORES|SEGURIDAD|CENTINELA)\s*[-_–—:]\s*/i, '')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (nombreBase) return 'Informativo - ' + nombreBase;
        return null;
    };

    // Nunca asumimos una categoría si el nombre del archivo no permite identificarla.
    // Esto evita importar silenciosamente un archivo desconocido como Extintores.
    let categoriaDetectadaGlobal = null;
    let datosConvertidosGlobal = [];
    let auditoriaCsvGlobal = null;
    let encabezadosOriginalesGlobal = [];

    // Utilidad compartida: el botón de importación se ejecuta fuera del
    // callback de Papa.parse(), por lo que no puede depender de helpers
    // declarados dentro de ese callback.
    const obtenerValorImportacion = (fila, indice) => {
        if (!Array.isArray(fila) || indice < 0 || indice >= fila.length) return null;
        const valor = fila[indice];
        if (valor === null || valor === undefined) return null;

        const texto = String(valor)
            .replace(/^\\uFEFF/, '')
            .replace(/[\\u00A0\\u1680\\u2000-\\u200B\\u202F\\u205F\\u3000]/g, ' ')
            .trim();

        if (!texto) return null;
        return texto.replace(/Â°/g, '°').replace(/Ã‚°/g, '°').trim() || null;
    };

    document.getElementById('admin-input-csv').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        categoriaDetectadaGlobal = detectarCategoria(file.name);

        if (!categoriaDetectadaGlobal) {
            document.getElementById('texto-cat-detectada').innerText =
                'Pendiente: la detectaré por la estructura del CSV';
            document.getElementById('badge-categoria-detectada').style.display = 'block';
            document.getElementById('iframe-container').innerHTML =
                '<div style="color:#aaa; padding:20px; text-align:center;">🧭 La categoría no está en el nombre del archivo. La identificaré por los encabezados al procesarlo.</div>';
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

            // En EPI, Punto GPS es redundante respecto del WKT. Además, algunos
            // registros traen coordenadas decimales sin comillas (dos campos) y otros
            // GMS con comillas de segundos sin escapar, que rompen el CSV. Eliminamos
            // esa columna del texto ANTES de parsearlo; la geometría WKT queda intacta.
            let fuenteCsv = fileInput.files[0];
            if (categoriaDetectadaGlobal === 'EPI') {
                let textoEpi = await fileInput.files[0].text();
                const lineasEpi = textoEpi.replace(/^\uFEFF/, '').split(/\r?\n/);
                if (lineasEpi.length > 0) {
                    lineasEpi[0] = lineasEpi[0].replace(/^WKT\s*,\s*Punto GPS\s*,/i, 'WKT,');
                }
                for (let i = 1; i < lineasEpi.length; i++) {
                    const linea = lineasEpi[i];
                    if (!linea.trim()) continue;
                    // Aceptar WKT POINT tanto entrecomillado como sin comillas.
                    // Algunas exportaciones alternan ambos formatos entre filas.
                    const inicio = linea.match(/^("?POINT\\s*\\([^)]*\\)"?),(.*)$/i);
                    if (!inicio) continue;
                    const wktEpi = inicio[1].replace(/^"|"$/g, '');
                    let resto = inicio[2];
                    // GPS decimal partido: latitud, longitud, siguiente columna.
                    const decimal = resto.match(/^-?\\d+(?:\\.\\d+)?\\s*,\\s*-?\\d+(?:\\.\\d+)?\\s*,/);
                    if (decimal) {
                        resto = resto.slice(decimal[0].length);
                    } else {
                        // GPS GMS o vacío: quitar el campo hasta la primera coma.
                        const separador = resto.indexOf(',');
                        if (separador >= 0) resto = resto.slice(separador + 1);
                    }
                    lineasEpi[i] = wktEpi + ',' + resto;
                }
                fuenteCsv = lineasEpi.join('\n');
            }

            Papa.parse(fuenteCsv, {
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
                            .replace(/^\uFEFF/, '')
                            .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
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
                            .replace(/[\u0300-\u036f]/g, '')
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '') || '';
                    };

                    const parsearWkt = (wktStr) => {
                        const limpio = limpiarTextoSeguro(wktStr);
                        if (!limpio) return null;

                        const match = limpio.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
                        if (match) {
                            // WKT de My Maps = POINT(longitud latitud).
                            // La PWA existente trabaja con "latitud, longitud".
                            return `${match[2]}, ${match[1]}`;
                        }

                        return limpio;
                    };

                    const encabezadosOriginales = filasCrudas[0].map((cabecera, indice) => {
                        const limpia = limpiarTextoSeguro(cabecera) || `Columna ${indice + 1}`;
                        return limpia;
                    });

                    // Estos encabezados también se necesitan al confirmar la importación,
                    // que ocurre fuera del callback de Papa.parse().
                    encabezadosOriginalesGlobal = encabezadosOriginales;

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

                    const detectarCategoriaPorCabeceras = () => {
                        const claves = new Set(
                            encabezadosOriginales.map(normalizarCabecera)
                        );

                        // IPP (Macro Sectores): basta con la firma estructural WKT + nombre +
                        // descripción y al menos una referencia de protección. No dependemos de que
                        // todas las columnas estén presentes o hayan conservado exactamente su nombre.
                        // Red Troncal: capa lineal de tuberías. Su CSV tiene una firma
                        // distinta a IPP: WKT + nombre + descripción + Punto GPS + atributos
                        // de inspección. No depende del nombre del archivo.
                        if (
                            claves.has('wkt') &&
                            claves.has('nombre') &&
                            claves.has('descripcion') &&
                            claves.has('puntogps') &&
                            claves.has('sector') &&
                            claves.has('ubicacion') &&
                            claves.has('cadenaycandado') &&
                            claves.has('chapa') &&
                            claves.has('observacion')
                        ) {
                            return 'Red Troncal';
                        }

                        if (
                            claves.has('wkt') &&
                            claves.has('nombre') &&
                            claves.has('descripcion') &&
                            (
                                claves.has('extintores') ||
                                claves.has('hidrantes') ||
                                claves.has('ecas')
                            )
                        ) {
                            return 'IPP (Macro Sectores)';
                        }

                        return null;
                    };

                    // La estructura del CSV tiene prioridad cuando identifica una categoría
                    // de forma inequívoca. Esto evita que un nombre de archivo genérico (por ejemplo,
                    // uno que contenga "Extintores") haga que una capa IPP sea procesada como otra cosa.
                    const categoriaPorEstructura = detectarCategoriaPorCabeceras();

                    if (categoriaPorEstructura) {
                        const categoriaAnterior = categoriaDetectadaGlobal;
                        categoriaDetectadaGlobal = categoriaPorEstructura;

                        document.getElementById('texto-cat-detectada').innerText =
                            categoriaAnterior && categoriaAnterior !== categoriaDetectadaGlobal
                                ? categoriaDetectadaGlobal + ' (corregida por estructura)'
                                : categoriaDetectadaGlobal + ' (detectada por estructura)';
                        document.getElementById('badge-categoria-detectada').style.display = 'block';

                        const midEstructural = MAPAS_CONFIG[categoriaDetectadaGlobal];
                        if (midEstructural) {
                            document.getElementById('iframe-container').innerHTML =
                                `<iframe src="https://www.google.com/maps/d/embed?mid=${midEstructural}" width="100%" height="100%" style="border:0; border-radius: 6px;" allowfullscreen></iframe>`;
                            document.getElementById('btn-ir-editor').href =
                                `https://www.google.com/maps/d/edit?mid=${midEstructural}`;
                        }
                    }

                    // "Punto GPS" está en GMS y es redundante para la PWA.
                    // No lo copiamos a atributos_tecnicos: WKT es la fuente geométrica.
                    const columnasRedundantes = new Set([
                        'puntogps',
                        'coordenadasgms',
                        'punto'
                    ]);

                    const obtenerValor = (fila, indice) => {
                        if (indice < 0 || indice >= fila.length) return null;
                        return limpiarTextoSeguro(fila[indice]);
                    };

                    const claveAtributoUnica = (cabecera, indice, usados) => {
                        const base = cabecera || `Columna ${indice + 1}`;
                        let clave = base;
                        let contador = 2;

                        while (usados.has(clave)) {
                            clave = `${base}__${contador}`;
                            contador++;
                        }

                        usados.add(clave);
                        return clave;
                    };

                    // ============================================================
                    // AUDITORÍA ESTRUCTURAL DEL CSV
                    //
                    // Regla principal:
                    // - La cantidad de columnas esperada la determina el encabezado
                    //   del CSV de ESTA categoría.
                    // - Una fila con exactamente ese número de columnas se procesa
                    //   normalmente, salvo que active una reparación determinística
                    //   (por ejemplo, GPS decimal partido con columnas vacías faltantes).
                    // - Una fila con una columna extra solo se repara si existe una causa
                    //   estructural inequívoca.
                    // - Cualquier otra longitud = fila sospechosa y BLOQUEADA.
                    //
                    // NO hacemos correcciones semánticas del tipo "esto parece
                    // una persona, entonces desplazo columnas". Eso fue precisamente
                    // lo que provocó los ciclos de corrección anteriores.
                    // ============================================================

                    const COLUMNAS_ESPERADAS = encabezadosOriginales.length;

                    const esNumeroFinito = (valor) => {
                        if (valor === null || valor === undefined) return false;
                        const texto = String(valor).trim();
                        if (!texto) return false;
                        const numero = Number(texto);
                        return Number.isFinite(numero);
                    };

                    const coordenadaValida = (valor, minimo, maximo) => {
                        if (!esNumeroFinito(valor)) return false;
                        const numero = Number(valor);
                        return numero >= minimo && numero <= maximo;
                    };

                    const wktEsValido = (valor) => {
                        if (valor === null || valor === undefined) return false;

                        // Aceptamos las geometrías WKT usadas por las capas informativas,
                        // además de los POINT de activos convencionales.
                        return /^(?:SRID=\d+;)?(?:POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(/i
                            .test(String(valor).trim());
                    };

                    // Algunas exportaciones CSV llegan con el WKT POLYGON/GEOMETRYCOLLECTION
                    // sin comillas. Papa Parse entonces divide el WKT en varias columnas porque
                    // contiene comas internas. Esta reparación recompone exclusivamente el WKT
                    // usando el balance de paréntesis y luego deja intactos nombre + descripción.
                    const recomponerWktIppSiEstaPartido = (fila) => {
                        if (
                            categoriaDetectadaGlobal !== 'IPP (Macro Sectores)' ||
                            !Array.isArray(fila) ||
                            fila.length === 0 ||
                            esTextoVacio(fila[0])
                        ) {
                            return null;
                        }

                        // Caso normal: Papa Parse ya entregó el WKT completo en fila[0].
                        if (wktEsValido(fila[0])) {
                            return [...fila];
                        }

                        const primerCampo = String(fila[0]).trim();
                        if (!/^(?:SRID=\d+;)?(?:POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(/i.test(primerCampo)) {
                            return null;
                        }

                        let profundidad = 0;

                        for (let i = 0; i < fila.length; i++) {
                            const campo = String(fila[i] ?? '');
                            for (const caracter of campo) {
                                if (caracter === '(') profundidad++;
                                else if (caracter === ')') profundidad--;
                            }

                            if (profundidad === 0) {
                                const wktReconstruido = fila.slice(0, i + 1).join(',').trim();

                                if (!wktEsValido(wktReconstruido)) {
                                    return null;
                                }

                                const resto = fila.slice(i + 1);

                                // Un registro IPP válido necesita el nombre inmediatamente después
                                // del WKT. Si no existe, no desplazamos columnas a ciegas.
                                if (esTextoVacio(resto[0])) {
                                    return null;
                                }

                                return [wktReconstruido, ...resto];
                            }
                        }

                        return null;
                    };

                    const esInicioRegistroIpp = (fila) => {
                        if (categoriaDetectadaGlobal !== 'IPP (Macro Sectores)' || !Array.isArray(fila)) {
                            return false;
                        }

                        const primerCampo = String(fila[0] ?? '').trim();
                        const pareceWktPartido = /^(?:SRID=\d+;)?(?:POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(/i.test(primerCampo);

                        if (wktEsValido(primerCampo)) {
                            return !esTextoVacio(fila[1]);
                        }

                        if (!pareceWktPartido) return false;

                        const normalizada = recomponerWktIppSiEstaPartido(fila);
                        return !!normalizada && wktEsValido(normalizada[0]) && !esTextoVacio(normalizada[1]);
                    };

                    // Exportación IPP especial:
                    // algunos CSV de zonas exportan "descripción" con saltos de línea
                    // SIN entrecomillarlos. Papa Parse interpreta cada línea como una fila
                    // física independiente. Cada registro lógico comienza con WKT + nombre
                    // y las filas siguientes hasta el próximo WKT forman su descripción.
                    const reconstruirRegistroIppMultilinea = (filas, indiceInicio) => {
                        if (!esInicioRegistroIpp(filas?.[indiceInicio])) return null;

                        const filaInicio = recomponerWktIppSiEstaPartido(filas[indiceInicio]);
                        if (!filaInicio) return null;

                        let indiceFin = indiceInicio + 1;
                        const partesDescripcion = [];

                        if (!esTextoVacio(filaInicio[2])) {
                            partesDescripcion.push(String(filaInicio[2]).trim());
                        }

                        while (
                            indiceFin < filas.length &&
                            !esInicioRegistroIpp(filas[indiceFin])
                        ) {
                            const parte = filas[indiceFin];

                            // En estos CSV las líneas de descripción también pueden contener
                            // comas sin entrecomillar. Papa Parse las reparte en varias columnas.
                            // Como ya estamos dentro de un bloque delimitado inequívocamente por WKT,
                            // recomponemos la línea concatenando sus campos físicos con comas.
                            const camposTexto = Array.isArray(parte)
                                ? parte
                                    .map(valor => valor === null || valor === undefined ? '' : String(valor).trim())
                                    .filter(valor => valor !== '')
                                : [];

                            if (camposTexto.length > 0) {
                                partesDescripcion.push(camposTexto.join(', '));
                            }

                            indiceFin++;
                        }

                        if (indiceFin === indiceInicio + 1) return null;

                        // La recomposición del WKT puede haber corrido las columnas a la izquierda,
                        // por lo que reconstruimos desde la fila ya normalizada, no desde la fila física.
                        const filaCanonica = new Array(COLUMNAS_ESPERADAS).fill(null);
                        filaCanonica[0] = filaInicio[0];
                        filaCanonica[1] = filaInicio[1];

                        // La descripción completa se conserva en su columna original.
                        filaCanonica[2] = partesDescripcion.join('\n');

                        // En este exporte, la descripción funciona también como contenedor
                        // de pares "Campo: valor". Recuperamos esos valores en sus columnas
                        // reales usando coincidencia exacta de encabezado; solo usamos la
                        // coincidencia normalizada cuando existe un único candidato.
                        const indicePorCabeceraExacta = new Map();
                        encabezadosOriginales.forEach((cabecera, indice) => {
                            indicePorCabeceraExacta.set(String(cabecera).trim(), indice);
                        });

                        const indicesPorCabeceraNormalizada = {};
                        encabezadosOriginales.forEach((cabecera, indice) => {
                            const clave = normalizarCabecera(cabecera);
                            if (!indicesPorCabeceraNormalizada[clave]) {
                                indicesPorCabeceraNormalizada[clave] = [];
                            }
                            indicesPorCabeceraNormalizada[clave].push(indice);
                        });

                        partesDescripcion.forEach((linea) => {
                            const posDosPuntos = String(linea).indexOf(':');
                            if (posDosPuntos <= 0) return;

                            const clave = String(linea).slice(0, posDosPuntos).trim();
                            const valor = String(linea).slice(posDosPuntos + 1).trim();
                            if (!clave || !valor) return;

                            let indiceCampo = indicePorCabeceraExacta.get(clave);

                            if (indiceCampo === undefined) {
                                const normalizada = normalizarCabecera(clave);
                                const candidatos = indicesPorCabeceraNormalizada[normalizada] || [];

                                // Solo aceptamos fallback normalizado si no hay ambigüedad.
                                if (candidatos.length === 1) {
                                    indiceCampo = candidatos[0];
                                }
                            }

                            // La columna "descripción" sigue conservando el texto completo;
                            // no la reemplazamos por el último par "clave: valor" encontrado.
                            if (
                                indiceCampo !== undefined &&
                                indiceCampo !== 0 &&
                                indiceCampo !== 1 &&
                                indiceCampo !== 2
                            ) {
                                filaCanonica[indiceCampo] = valor;
                            }
                        });

                        return {
                            fila: filaCanonica,
                            indiceFin: indiceFin - 1,
                            segura: true,
                            reparada: true,
                            motivo: 'Descripción IPP multilinea reconstruida y campos de control recuperados',
                            tipoReparacion: 'ipp_descripcion_multilinea'
                        };
                    };

// Conversión de WKT para la tabla histórica public.ipp.
const convertirWktIppAGeometria = (valor) => {
    if (valor === null || valor === undefined) return null;
    const limpio = String(valor)
        .replace(/^\uFEFF/, '')
        .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
        .trim();
    if (!limpio) return null;

    const sinSrid = limpio.replace(/^SRID=\d+;/i, '').trim();

    // public.ipp.geom es geometry(Polygon,4326).
    if (/^POLYGON\s*\(/i.test(sinSrid)) {
        return /^SRID=/i.test(limpio) ? limpio : 'SRID=4326;' + sinSrid;
    }

    // GEOMETRYCOLLECTION solo se reduce si contiene exactamente un POLYGON.
    const gc = sinSrid.match(/^GEOMETRYCOLLECTION\s*\((.*)\)$/i);
    if (!gc) return null;

    const contenido = gc[1];
    const componentes = [];
    let inicio = 0;
    let profundidad = 0;

    for (let i = 0; i < contenido.length; i++) {
        const ch = contenido[i];
        if (ch === '(') profundidad++;
        else if (ch === ')') profundidad--;
        else if (ch === ',' && profundidad === 0) {
            componentes.push(contenido.slice(inicio, i).trim());
            inicio = i + 1;
        }
    }
    componentes.push(contenido.slice(inicio).trim());

    if (
        componentes.length === 1 &&
        /^POLYGON\s*\(/i.test(componentes[0])
    ) {
        return 'SRID=4326;' + componentes[0];
    }

    // Si contiene varios polígonos u otro tipo geométrico, no inventamos ni
    // perdemos geometría; el WKT original permanece almacenado en LEU.
    return null;
};

                    const esTextoVacio = (valor) => {
                        return valor === null || valor === undefined || String(valor).trim() === '';
                    };

                    const coordenadaDmsEsValida = (valor) => {
                        if (valor === null || valor === undefined) return false;
                        const texto = String(valor).replace(/\u00a0/g, ' ').trim();
                        return /^\d{1,3}°\s*\d{1,2}'\s*\d{1,2}(?:[.,]\d+)?\"\s*[NS]\s+\d{1,3}°\s*\d{1,2}'\s*\d{1,2}(?:[.,]\d+)?\"\s*[EW]$/i.test(texto);
                    };

                    // Reparación determinística de GPS decimal partido cuando la fila
                    // conserva la cantidad de columnas esperada por tener campos vacíos faltantes al final.
                    // Solo inspeccionamos la posición canónica del GPS (índice 2) y el
                    // siguiente campo (índice 3). Ambos deben coincidir EXACTAMENTE con
                    // las coordenadas del WKT de ESA MISMA fila.
                    const repararGpsDecimalPartidoEnFilaCanonica = (fila) => {
                        if (!Array.isArray(fila) || fila.length !== COLUMNAS_ESPERADAS) {
                            return null;
                        }

                        const wkt = limpiarTextoSeguro(fila[0]);
                        const matchWkt = wkt?.match(
                            /POINT\\s*\\(\\s*([-\\d.]+)\\s+([-\\d.]+)\\s*\\)/i
                        );
                        if (!matchWkt) return null;

                        const longitudWkt = Number(matchWkt[1]);
                        const latitudWkt = Number(matchWkt[2]);
                        const a = Number(limpiarTextoSeguro(fila[2]));
                        const b = Number(limpiarTextoSeguro(fila[3]));

                        if (
                            !Number.isFinite(longitudWkt) ||
                            !Number.isFinite(latitudWkt) ||
                            !Number.isFinite(a) ||
                            !Number.isFinite(b)
                        ) {
                            return null;
                        }

                        const coincideLatLon = a === latitudWkt && b === longitudWkt;
                        const coincideLonLat = a === longitudWkt && b === latitudWkt;

                        if (!coincideLatLon && !coincideLonLat) return null;

                        const reparada = [...fila];
                        reparada[2] = `${String(fila[2]).trim()}, ${String(fila[3]).trim()}`;
                        reparada.splice(3, 1);

                        while (reparada.length < COLUMNAS_ESPERADAS) {
                            reparada.push(null);
                        }

                        return {
                            fila: reparada,
                            reparada: true,
                            motivo: 'Punto GPS decimal dividido por coma no entrecomillada dentro de una fila que conserva la cantidad de columnas esperada',
                            tipoReparacion: 'gps_decimal_partido'
                        };
                    };

                    // Repara un Punto decimal dividido en dos columnas, usando los encabezados reales.
                    // Solo actúa si la fila tiene exactamente una columna extra y ambos números
                    // coinciden con las coordenadas del WKT de esa misma fila.
                    const repararPuntoDecimalPorEncabezado = (fila) => {
                        if (!Array.isArray(fila) || ![COLUMNAS_ESPERADAS, COLUMNAS_ESPERADAS + 1].includes(fila.length)) return null;

                        // "Punto GPS" también es un encabezado válido; no exigir solo "Punto".
                        const indicePunto = encabezadosOriginales.findIndex(
                            cabecera => ['punto', 'puntogps'].includes(normalizarCabecera(cabecera))
                        );
                        const indiceWktCabecera = encabezadosOriginales.findIndex(
                            cabecera => ['wkt', 'geom', 'geometria', 'ubicacionwkt'].includes(normalizarCabecera(cabecera))
                        );
                        const indiceWkt = indiceWktCabecera >= 0 ? indiceWktCabecera : 0;
                        if (indicePunto < 0 || indicePunto + 1 >= fila.length) return null;

                        const wkt = String(fila[indiceWkt] ?? '').trim();
                        const matchWkt = wkt.match(/(?:SRID=\d+;)?POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
                        if (!matchWkt) return null;

                        const xWkt = Number(matchWkt[1]); // longitud
                        const yWkt = Number(matchWkt[2]); // latitud
                        const primeroTexto = String(fila[indicePunto] ?? '').trim();
                        const segundoTexto = String(fila[indicePunto + 1] ?? '').trim();
                        if (!primeroTexto || !segundoTexto) return null;

                        const primero = Number(primeroTexto.replace(',', '.'));
                        const segundo = Number(segundoTexto.replace(',', '.'));
                        const cerca = (a, b) => Math.abs(a - b) <= 0.000001;
                        let coincide = false;
                        let formato = '';

                        // Coordenadas decimales: aceptar latitud/longitud o longitud/latitud.
                        if ([xWkt, yWkt, primero, segundo].every(Number.isFinite)) {
                            coincide =
                                (cerca(primero, xWkt) && cerca(segundo, yWkt)) ||
                                (cerca(primero, yWkt) && cerca(segundo, xWkt));
                            formato = 'decimal';
                        } else {
                            // Coordenadas GMS separadas por la coma no entrecomillada.
                            const convertirDms = (texto, hemisferios) => {
                                const m = texto.match(/^\s*(\d{1,3})°\s*(\d{1,2})'\s*(\d{1,2}(?:[.,]\d+)?)"\s*([NSEW])\s*$/i);
                                if (!m || !hemisferios.includes(m[4].toUpperCase())) return null;
                                const grados = Number(m[1]);
                                const minutos = Number(m[2]);
                                const segundos = Number(m[3].replace(',', '.'));
                                if (minutos >= 60 || segundos >= 60) return null;
                                const magnitud = grados + minutos / 60 + segundos / 3600;
                                return ['S', 'W'].includes(m[4].toUpperCase()) ? -magnitud : magnitud;
                            };
                            const a = convertirDms(primeroTexto, 'NS');
                            const b = convertirDms(segundoTexto, 'EW');
                            if (a !== null && b !== null) {
                                coincide = cerca(a, yWkt) && cerca(b, xWkt);
                                formato = 'GMS';
                            }
                        }

                        if (!coincide) return null;

                        const reparada = [...fila];
                        reparada[indicePunto] = primeroTexto + ', ' + segundoTexto;
                        reparada.splice(indicePunto + 1, 1);
                        while (reparada.length < COLUMNAS_ESPERADAS) reparada.push(null);

                        if (reparada.length !== COLUMNAS_ESPERADAS) return null;
                        return {
                            fila: reparada,
                            reparada: true,
                            motivo: 'Campo Punto GPS dividido por coma no entrecomillada; coordenadas ' + formato + ' verificadas contra el WKT',
                            tipoReparacion: 'gps_decimal_partido'
                        };
                    };
                    // Reparación específica de CSV de Válvulas: algunas exportaciones dejan sin
                    // comillas las comas de Punto GPS y de campos descriptivos. Primero verificamos
                    // el GPS contra el WKT; luego redistribuimos únicamente las columnas sobrantes
                    // dentro de campos de texto libre, usando los encabezados y anclas de fecha/mes.
                    const repararCsvValvulasConComasInternas = (fila) => {
                        if (categoriaDetectadaGlobal !== 'Valvulas' || !Array.isArray(fila) ||
                            fila.length <= COLUMNAS_ESPERADAS || fila.length < 6) return null;

                        const wkt = String(fila[0] ?? '').trim();
                        const matchWkt = wkt.match(/(?:SRID=\d+;)?POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i);
                        if (!matchWkt || esTextoVacio(fila[1])) return null;

                        const lat = Number(String(fila[2] ?? '').trim());
                        const lon = Number(String(fila[3] ?? '').trim());
                        const lonWkt = Number(matchWkt[1]);
                        const latWkt = Number(matchWkt[2]);
                        const cerca = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.000001;
                        if (!((cerca(lat, latWkt) && cerca(lon, lonWkt)) ||
                              (cerca(lat, lonWkt) && cerca(lon, latWkt)))) return null;

                        // El encabezado confirma el diseño esperado: WKT, etiqueta, Punto GPS,
                        // Sector y Ubicación. No aplicar esta regla a otro esquema accidentalmente.
                        const claves = encabezadosOriginales.map(normalizarCabecera);
                        if (claves[0] !== 'wkt' ||
                            !['nombredeetiqueta', 'etiqueta', 'nombre'].includes(claves[1]) ||
                            !['puntogps', 'punto'].includes(claves[2]) ||
                            claves[3] !== 'sector') return null;

                        const canonica = [...fila];
                        canonica[2] = String(fila[2]).trim() + ', ' + String(fila[3]).trim();
                        canonica.splice(3, 1);
                        if (canonica.length <= COLUMNAS_ESPERADAS) return null;

                        const exceso = canonica.length - COLUMNAS_ESPERADAS;
                        const columnasTextoLibre = new Set([
                            'observacion', 'observaciones', 'detalleinforme', 'motivo', 'informe'
                        ]);
                        const meses = new Set([
                            'enero','febrero','marzo','abril','mayo','junio',
                            'julio','agosto','septiembre','setiembre','octubre','noviembre','diciembre'
                        ]);
                        const esFecha = (v) => {
                            const s = String(v ?? '').trim();
                            return !s || /^(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}-\d{2}-\d{2})$/.test(s);
                        };
                        const puntuar = (cabecera, valor) => {
                            const h = normalizarCabecera(cabecera);
                            const v = String(valor ?? '').trim();
                            if (!v) return 0;
                            if (h.includes('fecha')) return esFecha(v) ? 3 : -8;
                            if (h === 'mes' || h.includes('mes')) return meses.has(normalizarCabecera(v)) ? 3 : -3;
                            if (h.includes('anomaliasi')) {
                                return /^(si|no|sí|null)$/i.test(v) ? 2 : -4;
                            }
                            if (h === 'estado') {
                                return /^(conforme|pendiente|operativa|operativo|inoperativa|inoperativo|null|si|no|sí)$/i.test(v) ? 2 : -2;
                            }
                            return 0;
                        };
                        const puntuarFusion = (cabecera, valor) => {
                            const h = normalizarCabecera(cabecera);
                            const v = String(valor ?? '').toLowerCase();
                            if (h === 'observacion' || h === 'observaciones') {
                                return /se prueba|falta qr|falta|no funciona|se observa/.test(v) ? 6 : 0;
                            }
                            if (h === 'detalleinforme' || h === 'motivo' || h === 'informe') {
                                return /finaliz|trabajo|se realiza|sistema|valvula|válvula|apertura|presuriz|operativ|colocad|cambio de/.test(v) ? 6 : 0;
                            }
                            return 0;
                        };

                        const memo = new Map();
                        const resolver = (col, tok, extras) => {
                            const key = col + ':' + tok + ':' + extras;
                            if (memo.has(key)) return memo.get(key);
                            if (col === COLUMNAS_ESPERADAS) {
                                return tok === canonica.length && extras === 0
                                    ? { score: 0, valores: [] }
                                    : null;
                            }
                            const restantesColumnas = COLUMNAS_ESPERADAS - col;
                            const restantesTokens = canonica.length - tok;
                            if (restantesTokens < restantesColumnas || extras < 0) return null;

                            const cabecera = encabezadosOriginales[col];
                            const esTextoLibre = columnasTextoLibre.has(normalizarCabecera(cabecera));
                            const maxConsumir = esTextoLibre ? Math.min(extras + 1, restantesTokens - (restantesColumnas - 1)) : 1;
                            let mejor = null;

                            for (let consumir = 1; consumir <= maxConsumir; consumir++) {
                                const usados = consumir - 1;
                                if (usados > extras) continue;
                                const valor = canonica.slice(tok, tok + consumir)
                                    .map(x => x === null || x === undefined ? '' : String(x).trim())
                                    .join(consumir > 1 ? ', ' : '');
                                const sub = resolver(col + 1, tok + consumir, extras - usados);
                                if (!sub) continue;
                                // Penalizar moderadamente los campos fusionados para preferir la
                                // alineación más conservadora, salvo que las anclas favorezcan otra.
                                const score = puntuar(cabecera, valor) + (consumir > 1 ? puntuarFusion(cabecera, valor) : 0) + sub.score - usados * 0.15;
                                if (!mejor || score > mejor.score) {
                                    mejor = { score, valores: [valor || null, ...sub.valores] };
                                }
                            }
                            memo.set(key, mejor);
                            return mejor;
                        };

                        const resultado = resolver(5, 5, exceso);
                        if (!resultado || resultado.valores.length !== COLUMNAS_ESPERADAS - 5) return null;
                        const filaReparada = [...canonica.slice(0, 5), ...resultado.valores];
                        if (filaReparada.length !== COLUMNAS_ESPERADAS) return null;

                        return {
                            fila: filaReparada,
                            reparada: true,
                            motivo: 'CSV de Válvulas: GPS verificado contra WKT y comas internas de campos descriptivos recompuestas según encabezados',
                            tipoReparacion: 'valvulas_gps_y_textos_con_comas'
                        };
                    };

                    const repararFilaEstructuralmente = (fila, numeroFilaCsv) => {
                        let filaOriginal = Array.isArray(fila) ? [...fila] : [];

                        // Purgas ECAS (PECAS): el CSV tiene tres columnas (WKT, etiqueta,
                        // descripción), pero algunas descripciones incluyen comas sin comillas.
                        // Si el WKT POINT y la etiqueta están intactos, todos los campos desde
                        // la tercera columna pertenecen a la descripción y se pueden recomponer
                        // sin desplazar ni descartar información.
                        if (
                            categoriaDetectadaGlobal === 'Purgas ECAS (PECAS)' &&
                            filaOriginal.length > COLUMNAS_ESPERADAS &&
                            COLUMNAS_ESPERADAS === 3 &&
                            wktEsValido(filaOriginal[0]) &&
                            /^POINT\s*\(/i.test(String(filaOriginal[0] ?? '').trim()) &&
                            !esTextoVacio(filaOriginal[1]) &&
                            filaOriginal.slice(2).some(valor => !esTextoVacio(valor))
                        ) {
                            const descripcion = filaOriginal
                                .slice(2)
                                .map(valor => String(valor ?? '').trim())
                                .filter(valor => valor !== '')
                                .join(', ');

                            return {
                                fila: [filaOriginal[0], filaOriginal[1], descripcion],
                                reparada: true,
                                motivo: 'Descripción de PECAS dividida por comas no entrecomilladas; campos reunidos en la tercera columna',
                                tipoReparacion: 'pecas_descripcion_con_comas'
                            };
                        }

                        // EPI: al quitar "Punto GPS" del encabezado, algunos CSV siguen
                        // entregando latitud y longitud como dos celdas sin encabezado.
                        // Quitarlas solo si ambas son coordenadas válidas y la fila empieza
                        // con POINT; después reinsertar el campo vacío que existe en el encabezado.
                        if (
                            categoriaDetectadaGlobal === 'EPI' &&
                            filaOriginal.length === COLUMNAS_ESPERADAS + 1 &&
                            wktEsValido(filaOriginal[0]) &&
                            /^POINT\s*\(/i.test(String(filaOriginal[0] ?? '').trim()) &&
                            coordenadaValida(filaOriginal[1], -90, 90) &&
                            coordenadaValida(filaOriginal[2], -180, 180)
                        ) {
                            const filaEpi = [filaOriginal[0], ...filaOriginal.slice(3)];
                            const indiceCampoVacio = encabezadosOriginales.findIndex((h, i) =>
                                i > 0 && /^Columna\s+\d+$/i.test(String(h).trim())
                            );
                            if (indiceCampoVacio >= 0 && filaEpi.length < COLUMNAS_ESPERADAS) {
                                filaEpi.splice(indiceCampoVacio, 0, null);
                            }
                            while (filaEpi.length < COLUMNAS_ESPERADAS) filaEpi.push(null);
                            if (filaEpi.length === COLUMNAS_ESPERADAS) {
                                return {
                                    fila: filaEpi,
                                    reparada: true,
                                    motivo: 'EPI: coordenadas redundantes de Punto GPS retiradas; campo vacío de encabezado conservado',
                                    tipoReparacion: 'epi_gps_redundante'
                                };
                            }
                        }

                        const valvulasReconstruida = repararCsvValvulasConComasInternas(filaOriginal);
                        if (valvulasReconstruida) return valvulasReconstruida;

                        // Centrales de Alarmas: algunas exportaciones dejan sin comillas
                        // la lista de ECAS en el campo Control (p. ej. "Reportan ECAS 1, 3, 4, 5").
                        // El parser divide esa lista en columnas adicionales. Reparar únicamente
                        // si WKT, etiqueta, latitud, longitud y sector son reconocibles, el control
                        // comienza con "Reportan ECAS" y todos los campos sobrantes son números
                        // (o vacíos). Así se conservan todas las referencias sin desplazar el sector.
                        if (
                            categoriaDetectadaGlobal === 'Centrales de Alarmas' &&
                            filaOriginal.length > COLUMNAS_ESPERADAS &&
                            wktEsValido(filaOriginal[0]) &&
                            !esTextoVacio(filaOriginal[1]) &&
                            coordenadaValida(filaOriginal[2], -90, 90) &&
                            coordenadaValida(filaOriginal[3], -180, 180) &&
                            !esTextoVacio(filaOriginal[4]) &&
                            /^\s*Reportan\s+ECAS\b/i.test(String(filaOriginal[5] ?? '')) &&
                            filaOriginal.slice(6).every(valor =>
                                esTextoVacio(valor) || /^\s*\d+(?:\s+\d+)*\s*$/.test(String(valor))
                            )
                        ) {
                            // Algunos campos residuales contienen más de un número sin coma
                            // (p. ej. "50 51"). Dentro de esta lista ECAS, convertir cada token
                            // numérico en una referencia independiente sin tocar el resto de la fila.
                            // Conservar literalmente el prefijo descriptivo de Control
                            // ("Reportan ECAS ...") y separar solo los campos extra que el CSV
                            // partió por comas. Si uno trae "50 51", dividir ese campo numérico.
                            const valoresControl = [
                                String(filaOriginal[5] ?? '').trim(),
                                ...filaOriginal.slice(6)
                                    .flatMap(valor => String(valor ?? '').trim().split(/\s+/))
                            ].filter(Boolean);

                            const filaReparada = [
                                filaOriginal[0],
                                filaOriginal[1],
                                `${String(filaOriginal[2]).trim()}, ${String(filaOriginal[3]).trim()}`,
                                filaOriginal[4],
                                valoresControl.join(', ')
                            ];

                            return {
                                fila: filaReparada,
                                reparada: true,
                                motivo: 'GPS dividido y lista ECAS reconstruida en Control',
                                tipoReparacion: 'gps_y_lista_ecas_partidos'
                            };
                        }

                        // Espumígenos: el WKT es la geometría útil para la PWA; ignorar Punto GPS.
                        // Algunas filas traen GMS en una celda y otras latitud/longitud decimales
                        // partidas en dos celdas. Además, Observaciones puede contener comas sin comillas.
                        if (
                            categoriaDetectadaGlobal === 'Espumigenos' &&
                            filaOriginal.length >= COLUMNAS_ESPERADAS &&
                            wktEsValido(filaOriginal[0]) &&
                            /^POINT\s*\(/i.test(String(filaOriginal[0] ?? '').trim())
                        ) {
                            const filaEspumigenos = [...filaOriginal];
                            const gpsGms = /^\s*\d{1,3}°\s*\d{1,2}'\s*\d*(?:[.,]\d+)?["]\s*[NS]\s*$/i.test(String(filaEspumigenos[1] ?? '').trim());
                            const gpsDecimalPartido =
                                /^\s*-?\d+(?:\.\d+)?\s*$/.test(String(filaEspumigenos[1] ?? '').trim()) &&
                                /^\s*-?\d+(?:\.\d+)?\s*$/.test(String(filaEspumigenos[2] ?? '').trim()) &&
                                /espum[ií]geno/i.test(String(filaEspumigenos[3] ?? ''));

                            if (
                                (gpsGms && /espum[ií]geno/i.test(String(filaEspumigenos[2] ?? ''))) ||
                                gpsDecimalPartido
                            ) {
                                if (gpsDecimalPartido) {
                                    // Retirar latitud y longitud decimales redundantes, dejando Punto GPS vacío.
                                    filaEspumigenos.splice(1, 2, '');
                                } else {
                                    // Retirar/ignorar el campo GMS redundante.
                                    filaEspumigenos[1] = '';
                                }

                                // En el esquema de 8 columnas, Observaciones está en índice 7.
                                // Reunir allí los campos extra generados por comas no entrecomilladas.
                                const extras = filaEspumigenos.length - COLUMNAS_ESPERADAS;
                                if (extras > 0) {
                                    const indiceObservaciones = 7;
                                    if (indiceObservaciones + extras < filaEspumigenos.length) {
                                        filaEspumigenos.splice(
                                            indiceObservaciones,
                                            extras + 1,
                                            filaEspumigenos.slice(indiceObservaciones, indiceObservaciones + extras + 1)
                                                .map(valor => String(valor ?? '').trim())
                                                .join(', ')
                                        );
                                    }
                                }

                                if (filaEspumigenos.length === COLUMNAS_ESPERADAS) {
                                    return {
                                        fila: filaEspumigenos,
                                        reparada: true,
                                        motivo: 'Espumígenos: coordenadas redundantes de Punto GPS ignoradas y comas de Observaciones recompuestas',
                                        tipoReparacion: 'espumigenos_gps_y_observaciones'
                                    };
                                }
                            }
                        }

                        // Regla general para Ceniceros: la PWA utiliza el WKT como geometría.
                        // Las coordenadas GMS de "Punto GPS" son redundantes y se dejan vacías.
                        // Si la coma separó latitud/longitud en dos celdas, se retiran ambas
                        // manteniendo una columna vacía para no desplazar los encabezados.
                        // Las comas extra en Observaciones se recomponen sin tocar los controles.
                        if (
                            categoriaDetectadaGlobal === 'Ceniceros' &&
                            filaOriginal.length >= COLUMNAS_ESPERADAS &&
                            wktEsValido(filaOriginal[0]) &&
                            /^POINT\s*\(/i.test(String(filaOriginal[0] ?? '').trim()) &&
                            !esTextoVacio(filaOriginal[1]) &&
                            /^\d{1,3}°\s*\d{1,2}'\s*\d*(?:[.,]\d+)?["]\s*[NS](?:\s*,.*)?$/i.test(String(filaOriginal[2] ?? '').trim()) &&
                            !esTextoVacio(filaOriginal[4]) &&
                            (filaOriginal.length === COLUMNAS_ESPERADAS ||
                                /^\d{1,3}°\s*\d{1,2}'\s*\d*(?:[.,]\d+)?["]\s*[EW]$/i.test(String(filaOriginal[3] ?? '').trim())) &&
                            (filaOriginal.length === COLUMNAS_ESPERADAS ||
                                esTextoVacio(filaOriginal[filaOriginal.length - 1]) ||
                                /^\d+(?:\.0+)?$/.test(String(filaOriginal[filaOriginal.length - 1] ?? '').trim()))
                        ) {
                            const filaCeniceros = [...filaOriginal];

                            if (
                                filaCeniceros.length > COLUMNAS_ESPERADAS &&
                                /^\d{1,3}°\s*\d{1,2}'\s*\d*(?:[.,]\d+)?["]\s*[EW]$/i.test(String(filaCeniceros[3] ?? '').trim())
                            ) {
                                // El parser dividió Punto GPS en dos celdas GMS: retirar ambas.
                                filaCeniceros.splice(2, 2, '');
                            } else {
                                // Punto GPS ya ocupa una sola celda: ignorar su contenido GMS.
                                filaCeniceros[2] = '';
                            }

                            // Si quedan columnas extra, corresponden a comas no entrecomilladas
                            // en Observaciones (índice 15); reunirlas sin desplazar el resto.
                            const extrasRestantes = filaCeniceros.length - COLUMNAS_ESPERADAS;
                            if (extrasRestantes > 0) {
                                const indiceObservaciones = 15;
                                const finObservaciones = indiceObservaciones + extrasRestantes;
                                if (finObservaciones < filaCeniceros.length - 2) {
                                    filaCeniceros.splice(
                                        indiceObservaciones,
                                        extrasRestantes + 1,
                                        filaCeniceros.slice(indiceObservaciones, finObservaciones + 1)
                                            .map(valor => String(valor ?? '').trim())
                                            .join(', ')
                                    );
                                }
                            }

                            if (filaCeniceros.length === COLUMNAS_ESPERADAS) {
                                return {
                                    fila: filaCeniceros,
                                    reparada: true,
                                    motivo: 'Ceniceros: coordenadas GMS redundantes ignoradas; WKT conservado y Observaciones recompuestas si contienen comas',
                                    tipoReparacion: 'ceniceros_gms_ignoradas'
                                };
                            }
                        }

                        if (filaOriginal.length === COLUMNAS_ESPERADAS) {
                            const gpsPorEncabezado = repararPuntoDecimalPorEncabezado(filaOriginal);
                            if (gpsPorEncabezado) return gpsPorEncabezado;

                            const gpsPartido = repararGpsDecimalPartidoEnFilaCanonica(filaOriginal);
                            if (gpsPartido) return gpsPartido;

                            return {
                                fila: filaOriginal,
                                reparada: false,
                                motivo: null,
                                tipoReparacion: null
                            };
                        }

                        // Intentar primero la reconstrucción del Punto GPS dividido.
                        // Si se recortan antes los campos vacíos finales, la fila puede quedar
                        // con cinco columnas pero con la longitud ubicada erróneamente en Sector.
                        if (filaOriginal.length === COLUMNAS_ESPERADAS + 1) {
                            const gpsPorEncabezado = repararPuntoDecimalPorEncabezado(filaOriginal);
                            if (gpsPorEncabezado) return gpsPorEncabezado;
                        }

                        // CASO 0: algunos exportes agregan campos vacíos al final.
                        // Primero los eliminamos SOLO si son realmente vacíos. Esto permite
                        // llegar al tamaño esperado (+1) para reparar después un GPS decimal
                        // partido por una coma no entrecomillada.
                        if (filaOriginal.length > COLUMNAS_ESPERADAS) {
                            const sinVaciosFinales = [...filaOriginal];

                            while (
                                sinVaciosFinales.length > COLUMNAS_ESPERADAS &&
                                esTextoVacio(sinVaciosFinales[sinVaciosFinales.length - 1])
                            ) {
                                sinVaciosFinales.pop();
                            }

                            filaOriginal = sinVaciosFinales;

                            // Si al eliminar únicamente campos vacíos sobrantes la fila
                            // quedó exactamente en el tamaño canónico, todavía debemos
                            // comprobar el caso determinístico de GPS partido.
                            if (filaOriginal.length === COLUMNAS_ESPERADAS) {
                                const gpsPartido = repararGpsDecimalPartidoEnFilaCanonica(filaOriginal);
                                if (gpsPartido) return gpsPartido;

                                return {
                                    fila: filaOriginal,
                                    reparada: false,
                                    motivo: null,
                                    tipoReparacion: null
                                };
                            }
                        }

                        // CASO 1A: Punto decimal dividido, localizado por el encabezado real.
                        // Es más seguro que asumir posiciones fijas: en este CSV Punto está en la columna 2.
                        if (filaOriginal.length === COLUMNAS_ESPERADAS + 1) {
                            const puntoPartido = repararPuntoDecimalPorEncabezado(filaOriginal);
                            if (puntoPartido) return puntoPartido;
                        }

                        // CASO 1: Punto GPS decimal partido por una coma no entrecomillada.
                        if (filaOriginal.length === COLUMNAS_ESPERADAS + 1) {
                            const wkt = filaOriginal[0];
                            const posibleLatitud = filaOriginal[2];
                            const posibleLongitud = filaOriginal[3];

                            const gpsPartidoReconocible =
                                wktEsValido(wkt) &&
                                coordenadaValida(posibleLatitud, -90, 90) &&
                                coordenadaValida(posibleLongitud, -180, 180);

                            if (gpsPartidoReconocible) {
                                const reparada = [...filaOriginal];
                                reparada[2] = `${String(posibleLatitud).trim()}, ${String(posibleLongitud).trim()}`;
                                reparada.splice(3, 1);

                                return {
                                    fila: reparada,
                                    reparada: true,
                                    motivo: 'Punto GPS decimal dividido por coma no entrecomillada',
                                    tipoReparacion: 'gps_decimal_partido'
                                };
                            }
                        }

                        // CASO 2: La coma del Nombre de etiqueta no fue entrecomillada.
                        // La presencia inequívoca de un GPS DMS en la posición 3 demuestra
                        // que la posición 2 pertenece todavía al nombre.
                        if (
                            filaOriginal.length >= COLUMNAS_ESPERADAS + 1 &&
                            wktEsValido(filaOriginal[0]) &&
                            !esTextoVacio(filaOriginal[1]) &&
                            !esTextoVacio(filaOriginal[2]) &&
                            coordenadaDmsEsValida(filaOriginal[3])
                        ) {
                            const reparada = [...filaOriginal];
                            reparada[1] = `${String(reparada[1]).trim()}, ${String(reparada[2]).trim()}`;
                            reparada.splice(2, 1);

                            if (reparada.length === COLUMNAS_ESPERADAS) {
                                return {
                                    fila: reparada,
                                    reparada: true,
                                    motivo: 'Nombre de etiqueta dividido por coma no entrecomillada',
                                    tipoReparacion: 'nombre_partido'
                                };
                            }

                            filaOriginal = reparada;
                        }

                        // CASO 3: Algunas filas traen campos vacíos sobrantes al final.
                        // Solo se eliminan si TODOS los campos eliminados están vacíos.
                        if (filaOriginal.length > COLUMNAS_ESPERADAS) {
                            const reparada = [...filaOriginal];

                            while (
                                reparada.length > COLUMNAS_ESPERADAS &&
                                esTextoVacio(reparada[reparada.length - 1])
                            ) {
                                reparada.pop();
                            }

                            if (reparada.length === COLUMNAS_ESPERADAS) {
                                return {
                                    fila: reparada,
                                    reparada: true,
                                    motivo: 'Campos vacíos sobrantes al final',
                                    tipoReparacion: 'vacios_finales'
                                };
                            }
                        }

                        return {
                            fila: null,
                            reparada: false,
                            motivo: `Fila ${numeroFilaCsv}: contiene ${filaOriginal.length} columnas; se esperaban ${COLUMNAS_ESPERADAS}. No se pudo reparar de forma determinista. Inicio: [${filaOriginal.slice(0, 6).map(v => String(v ?? '').replace(/\s+/g, ' ').slice(0, 45)).join(' | ')}]; final: [${filaOriginal.slice(-3).map(v => String(v ?? '').replace(/\s+/g, ' ').slice(0, 45)).join(' | ')}].`,
                            tipoReparacion: null
                        };
                    };

                    const auditoria = {
                        archivo: fileInput.files[0]?.name || 'CSV',
                        columnasEsperadas: COLUMNAS_ESPERADAS,
                        filasTotales: Math.max(0, filasCrudas.length - 1),
                        registrosLogicos: null,
                        filasNormales: 0,
                        filasGpsPartidas: 0,
                        filasReparadas: 0,
                        filasSospechosas: 0,
                        filasDescartadas: 0,
                        sospechosas: []
                    };

                    const filasCanonicas = [];
                    const filasDatos = filasCrudas.slice(1);

                    // En la exportación de Red Troncal, la descripción con etiquetas
                    // ("Punto GPS:", "Sector:", "Ubicación:", etc.) contiene saltos de línea
                    // sin comillas CSV. Papa Parse la divide en filas físicas. Cada bloque
                    // lógico comienza inequívocamente con LINESTRING + nombre de la tubería.
                    const esInicioRegistroRedTroncal = (fila) => {
                        return categoriaDetectadaGlobal === 'Red Troncal' &&
                            Array.isArray(fila) &&
                            /^(?:SRID=\d+;)?LINESTRING\s*\(/i.test(String(fila[0] ?? '').trim()) &&
                            !esTextoVacio(fila[1]);
                    };

                    const reconstruirRegistroRedTroncalMultilinea = (filas, indiceInicio) => {
                        const inicio = filas[indiceInicio];
                        if (!esInicioRegistroRedTroncal(inicio)) return null;

                        let indiceFin = indiceInicio + 1;
                        const lineasDescripcion = [];
                        const agregarCelda = (valor) => {
                            const texto = valor === null || valor === undefined ? '' : String(valor).trim();
                            if (texto) lineasDescripcion.push(texto);
                        };

                        // La tercera columna puede contener la primera etiqueta ("Punto GPS:").
                        agregarCelda(inicio[2]);

                        while (indiceFin < filas.length && !esInicioRegistroRedTroncal(filas[indiceFin])) {
                            const parte = filas[indiceFin];
                            if (Array.isArray(parte)) {
                                parte.forEach(agregarCelda);
                            } else {
                                agregarCelda(parte);
                            }
                            indiceFin++;
                        }

                        const filaCanonica = new Array(COLUMNAS_ESPERADAS).fill(null);
                        filaCanonica[0] = String(inicio[0]).trim();
                        filaCanonica[1] = String(inicio[1]).trim();
                        filaCanonica[2] = lineasDescripcion.join('\n');

                        // Recuperar cualquier valor "Campo: valor" en su columna
                        // únicamente cuando el nombre coincide con un encabezado real.
                        const indicePorCabecera = new Map();
                        encabezadosOriginales.forEach((cabecera, indice) => {
                            indicePorCabecera.set(normalizarCabecera(cabecera), indice);
                        });

                        for (const linea of lineasDescripcion) {
                            const coincidencia = String(linea).match(/^\s*([^:]+?)\s*:\s*(.*?)\s*$/);
                            if (!coincidencia) continue;
                            const indiceCampo = indicePorCabecera.get(normalizarCabecera(coincidencia[1]));
                            const valor = coincidencia[2].trim();
                            if (indiceCampo === undefined || indiceCampo <= 1 || indiceCampo === 2 || !valor) continue;
                            filaCanonica[indiceCampo] = valor;
                        }

                        return {
                            fila: filaCanonica,
                            indiceFin: indiceFin - 1,
                            segura: true,
                            reparada: true,
                            motivo: 'Registro multilinea de Red Troncal reconstruido desde LINESTRING y etiquetas de campos',
                            tipoReparacion: 'red_troncal_multilinea'
                        };
                    };

                    for (let index = 0; index < filasDatos.length; index++) {
                            const fila = filasDatos[index];
                            const numeroFilaCsv = index + 2;

                            // Red Troncal: reconstruir los bloques de etiquetas multilinea
                            // antes de auditar filas físicas individuales.
                            if (esInicioRegistroRedTroncal(fila)) {
                                const redReconstruida = reconstruirRegistroRedTroncalMultilinea(filasDatos, index);
                                if (redReconstruida?.fila) {
                                    filasCanonicas.push(redReconstruida.fila);
                                    auditoria.filasReparadas++;
                                    index = redReconstruida.indiceFin;
                                    continue;
                                }
                            }

                            // IPP: reconstrucción determinística de descripciones multilinea
                            // antes de aplicar las reglas estructurales generales.
                            if (esInicioRegistroIpp(fila)) {
                                const ippReconstruido = reconstruirRegistroIppMultilinea(filasDatos, index);

                                if (ippReconstruido?.fila) {
                                    filasCanonicas.push(ippReconstruido.fila);
                                    auditoria.filasReparadas++;
                                    index = ippReconstruido.indiceFin;
                                    continue;
                                }

                                if (ippReconstruido && ippReconstruido.segura === false) {
                                    auditoria.filasSospechosas++;
                                    auditoria.filasDescartadas++;
                                    if (auditoria.sospechosas.length < 20) {
                                        auditoria.sospechosas.push(ippReconstruido.motivo);
                                    }
                                    index = ippReconstruido.indiceFin;
                                    continue;
                                }
                            }

                            let resultado = repararFilaEstructuralmente(fila, numeroFilaCsv);

                            // CASO 4: un registro lógico fue partido en dos filas físicas.
                            // A) La primera fila contiene parte del registro y la siguiente lo completa.
                            // B) La primera fila contiene WKT + etiqueta y la siguiente aporta
                            //    sector + latitud + longitud + resto de campos.
                            if (!resultado.fila && wktEsValido(fila?.[0]) && fila.length < COLUMNAS_ESPERADAS) {
                                const siguiente = filasDatos[index + 1];

                                if (Array.isArray(siguiente) && !wktEsValido(siguiente[0])) {
                                    let reparacionUnida = null;

                                    // Patrón B: WKT + etiqueta en una fila y el resto en la siguiente.
                                    if (
                                        fila.length === 2 &&
                                        siguiente.length >= 3 &&
                                        coordenadaValida(siguiente[1], -90, 90) &&
                                        coordenadaValida(siguiente[2], -180, 180)
                                    ) {
                                        const gps = String(siguiente[1]).trim() + ', ' + String(siguiente[2]).trim();
                                        const candidataReconstruida = [
                                            fila[0],
                                            fila[1],
                                            gps,
                                            siguiente[0],
                                            ...siguiente.slice(3)
                                        ];

                                        reparacionUnida = repararFilaEstructuralmente(
                                            candidataReconstruida,
                                            numeroFilaCsv
                                        );
                                    } else {
                                        const candidataUnida = [...fila, ...siguiente];

                                        reparacionUnida = repararFilaEstructuralmente(
                                            candidataUnida,
                                            numeroFilaCsv
                                        );
                                    }

                                    if (reparacionUnida?.fila) {
                                        resultado = {
                                            ...reparacionUnida,
                                            reparada: true,
                                            motivo: 'Registro lógico dividido en dos filas físicas',
                                            tipoReparacion: 'fila_partida'
                                        };
                                        index++;
                                    }
                                }
                            }
                            if (!resultado.fila) {
                                auditoria.filasSospechosas++;
                                auditoria.filasDescartadas++;
                                if (auditoria.sospechosas.length < 20) {
                                    auditoria.sospechosas.push(resultado.motivo);
                                }
                                continue;
                            }

                            filasCanonicas.push(resultado.fila);

                            if (resultado.reparada) {
                                auditoria.filasReparadas++;
                                if (resultado.tipoReparacion === 'gps_decimal_partido') {
                                    auditoria.filasGpsPartidas++;
                                }
                            } else {
                                auditoria.filasNormales++;
                            }
                    }

                    auditoriaCsvGlobal = auditoria;

                    // A partir de aquí SOLO trabajamos con filas canónicas.
                    // La reparación estructural ya fue realizada por repararFilaEstructuralmente().
                    // NO se vuelve a reinterpretar una fila canónica por sus valores numéricos:
                    // hacerlo reabría las 604 filas que ya habíamos descartado como falso positivo
                    // de este segundo detector.
                    let listaTemporal = [];

                    filasCanonicas.forEach((fila, index) => {
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
                        // EPI no tiene una columna de etiqueta propia; usar el Sector
                        // como identificador legible del activo, sin inventar números.
                        if (!etiqueta && categoriaDetectadaGlobal === 'EPI' && sector) {
                            etiqueta = 'EPI - ' + sector;
                        }
                        if (!etiqueta && categoriaDetectadaGlobal === 'ESI' && sector) {
                            etiqueta = 'ESI - ' + sector;
                        }
                        if (!etiqueta) etiqueta = `Sin Etiqueta Fila ${index + 2}`;

                        listaTemporal.push({
                            etiqueta,
                            categoria: categoriaDetectadaGlobal,
                            sector,
                            ronda,
                            ubicacion_wkt: wkt ? (
                                categoriaDetectadaGlobal === 'IPP (Macro Sectores)'
                                    ? wkt
                                    : parsearWkt(wkt)
                            ) : null,
                            atributos_tecnicos: atributosJSON,
                            __filaOriginalIpp: categoriaDetectadaGlobal === 'IPP (Macro Sectores)' ? fila : null
                        });
                    });
                    if (listaTemporal.length === 0) {
                        const firmaWkt = filasDatos.filter(f =>
                            Array.isArray(f) &&
                            /^(?:SRID=\d+;)?(?:POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*\(/i.test(String(f?.[0] ?? '').trim())
                        ).length;

                        console.error('CMU - CSV sin registros:', {
                            categoria: categoriaDetectadaGlobal,
                            columnasEsperadas: COLUMNAS_ESPERADAS,
                            filasFisicas: filasDatos.length,
                            filasConInicioWkt: firmaWkt,
                            encabezados: encabezadosOriginales
                        });

                        alert(
                            '❌ No se encontraron registros de datos después de procesar el CSV.\\n\\n' +
                            'Diagnóstico CMU: ' +
                            (categoriaDetectadaGlobal || 'sin categoría') +
                            ' · ' + COLUMNAS_ESPERADAS + ' columnas · ' +
                            filasDatos.length + ' filas físicas · ' +
                            firmaWkt + ' posibles inicios WKT.'
                        );
                        return;
                    }

                    datosConvertidosGlobal = listaTemporal;
                    auditoria.registrosLogicos = listaTemporal.length;

                    document.getElementById('admin-resultado-container').style.display = 'block';

                    const estadoTexto = document.getElementById('admin-estado-texto');
                    const contadorRegistros = document.getElementById('admin-contador-registros');
                    const btnSubir = document.getElementById('btn-subir-supabase');

                    if (auditoria.filasSospechosas > 0) {
                        estadoTexto.innerText = '⛔ IMPORTACIÓN BLOQUEADA: CSV con filas sospechosas';
                        estadoTexto.style.color = '#ef4444';
                        contadorRegistros.innerText =
                            categoriaDetectadaGlobal === 'IPP (Macro Sectores)'
                                ? `${auditoria.registrosLogicos ?? 0} registros · ${auditoria.filasReparadas} reparadas · ${auditoria.filasSospechosas} sospechosas`
                                : `${auditoria.filasTotales} filas · ${auditoria.filasReparadas} reparadas · ${auditoria.filasSospechosas} sospechosas`;
                        btnSubir.disabled = true;
                        btnSubir.innerText = '⛔ Importación bloqueada hasta corregir el CSV';
                    } else {
                        estadoTexto.innerText =
                            `✅ Auditoría limpia: ${categoriaDetectadaGlobal}`;
                        estadoTexto.style.color = '#22c55e';
                        contadorRegistros.innerText =
                            categoriaDetectadaGlobal === 'IPP (Macro Sectores)'
                                ? `${auditoria.registrosLogicos ?? 0} registros · ${auditoria.filasReparadas} reparadas · 0 sospechosas`
                                : `${auditoria.filasTotales} filas · ${auditoria.filasReparadas} reparadas · 0 sospechosas`;
                        btnSubir.disabled = false;
                        btnSubir.innerText = '🚀 Inyectar en LEU, Controles y Anomalías (Supabase)';
                    }

                    const previewDiv = document.getElementById('admin-preview-tabla');
                    const resumenAuditoria = `
                        <div style="background:${auditoria.filasSospechosas > 0 ? '#3f1212' : '#0f2f1c'}; border:1px solid ${auditoria.filasSospechosas > 0 ? '#ef4444' : '#22c55e'}; padding:12px; border-radius:6px; margin-bottom:12px; color:#ddd;">
                            <div style="font-weight:bold; color:${auditoria.filasSospechosas > 0 ? '#ef4444' : '#22c55e'}; margin-bottom:8px;">
                                🔎 Auditoría estructural del CSV
                            </div>
                            <div>Archivo: <strong>${auditoria.archivo}</strong></div>
                            <div>Columnas esperadas: <strong>${auditoria.columnasEsperadas}</strong></div>
                            <div>Filas físicas: <strong>${auditoria.filasTotales}</strong></div>
                            <div>${categoriaDetectadaGlobal === 'IPP (Macro Sectores)' ? 'Registros lógicos' : 'Filas normales'}: <strong>${categoriaDetectadaGlobal === 'IPP (Macro Sectores)' ? (auditoria.registrosLogicos ?? 0) : auditoria.filasNormales}</strong></div>
                            <div>Filas GPS partidas detectadas: <strong>${auditoria.filasGpsPartidas}</strong></div>
                            <div>Filas reparadas: <strong>${auditoria.filasReparadas}</strong></div>
                            <div>Filas sospechosas: <strong>${auditoria.filasSospechosas}</strong></div>
                            <div>Filas descartadas: <strong>${auditoria.filasDescartadas}</strong></div>
                            ${auditoria.sospechosas.length > 0 ? `
                                <div style="margin-top:8px; color:#fca5a5;">
                                    <strong>Motivos:</strong>
                                    <ul style="margin:5px 0 0 20px; padding:0;">
                                        ${auditoria.sospechosas.map(x => `<li>${String(x).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>
                    `;

                    previewDiv.innerHTML = resumenAuditoria;

                    let tablaHtml = `<style>
                        #admin-preview-tabla table { width: 100%; border-collapse: collapse; color: #ccc; }
                        #admin-preview-tabla th, #admin-preview-tabla td { border: 1px solid #444; padding: 6px; text-align: left; }
                        #admin-preview-tabla th { background: #2a2a2a; color: #38bdf8; position: sticky; top: 0; }
                    </style><table><thead><tr><th>Etiqueta</th><th>Sector</th><th>Ronda</th><th>WKT</th><th>JSON Atributos</th></tr></thead><tbody>`;

                    datosConvertidosGlobal.slice(0, 15).forEach(row => {
                        tablaHtml += `<tr>
                            <td>${row.etiqueta || ''}</td>
                            <td>${row.sector || ''}</td>
                            <td>${row.ronda || ''}</td>
                            <td style="color: #eab308;">${row.ubicacion_wkt || ''}</td>
                            <td style="color: #38bdf8; font-family: monospace;">${JSON.stringify(row.atributos_tecnicos).substring(0, 80)}...</td>
                        </tr>`;
                    });

                    tablaHtml += '</tbody></table>';
                    previewDiv.innerHTML += tablaHtml;
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

        if (auditoriaCsvGlobal?.filasSospechosas > 0) {
            alert(
                `⛔ Importación bloqueada.\\n\\n` +
                `El CSV contiene ${auditoriaCsvGlobal.filasSospechosas} fila(s) que no pudieron reconstruirse de forma determinista.\\n` +
                `No se insertó ningún registro en Supabase.\\n\\n` +
                `Corregí el CSV original y volvé a procesarlo.`
            );
            return;
        }

        if (!confirm(`¿Inyectar los ${datosConvertidosGlobal.length} registros exactos como "${categoriaDetectadaGlobal}"?`)) return;

        const btnSubir = document.getElementById('btn-subir-supabase');
        btnSubir.innerText = 'Inyectando...';
        btnSubir.disabled = true;

        const exigir = (respuesta, tabla) => {
            if (respuesta.error) {
                throw new Error(`Error insertando en ${tabla}: ${respuesta.error.message}`);
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
            const arrayControlesIpp = [];
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

            // Convierte fechas de exportación argentina (DD/MM/AAAA) a ISO (AAAA-MM-DD)
            // antes de enviarlas a columnas PostgreSQL de tipo DATE.
            const normalizarFechaParaPostgres = (valor) => {
                if (valor === null || valor === undefined || String(valor).trim() === '') return null;
                const texto = String(valor).trim();

                // Ya está en formato ISO: conservar únicamente la parte de fecha.
                const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
                if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

                // Exportaciones locales: día/mes/año, opcionalmente seguido de una hora.
                const local = texto.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s.*)?$/);
                if (local) {
                    const dia = Number(local[1]);
                    const mes = Number(local[2]);
                    const anio = Number(local[3]);
                    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
                    if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
                        throw new Error(`Fecha inválida en el CSV: "${texto}"`);
                    }
                    return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                }

                // No adivinar otros formatos: dejar que el error identifique el valor inesperado.
                return texto;
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

                let textoAnomalia = obtenerAtributo(attrs, [
                    'ANOMALIAS SI / NO',
                    'anomalias',
                    'Novedades'
                ]);

                // En exportaciones IPP antiguas la anomalía puede venir dentro de
                // la descripción multilinea como "ANOMALIAS: ...".
                if (!textoAnomalia && categoriaDetectadaGlobal === 'IPP (Macro Sectores)') {

                    // El texto completo de descripción permanece en los atributos originales.
                    const claveDescripcion = Object.keys(attrs).find(k =>
                        normalizarClave(k) === normalizarClave('descripción') ||
                        normalizarClave(k) === normalizarClave('descripcion')
                    );

                    const descripcionCompleta = claveDescripcion ? attrs[claveDescripcion] : null;
                    if (descripcionCompleta) {
                        const lineas = String(descripcionCompleta).split(/\r?\n/);

                        for (const linea of lineas) {
                            const match = linea.match(/^\s*(ANOMALIAS(?: SI \/ NO)?|NOVEDADES)\s*:\s*(.+)\s*$/i);
                            if (match && match[2].trim()) {
                                textoAnomalia = match[2].trim();
                                break;
                            }
                        }
                    }
                }

                if (
                    !String(categoriaDetectadaGlobal || '').startsWith('Informativo - ') &&
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
                const matchNum = String(item.etiqueta || '').match(/(?:^|\s)(\d+)(?=\s|['´¨"”]|$)/);
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
                        habilitada: obtenerAtributo(attrs, ['Habilitada']),
                        control_semanal: obtenerAtributo(attrs, ['CONTROL SEMANAL']),
                        control_s_realizado_por: obtenerAtributo(attrs, ['Control S. realizado por', 'Control S realizado por']),
                        auditoria_fecha: normalizarFechaParaPostgres(obtenerAtributo(attrs, ['AUDITORIA (Fecha)', 'Auditoria Fecha'])),
                        auditoria_semana: obtenerAtributo(attrs, ['Auditoria Semana']),
                        auditoria_realizada_por: obtenerAtributo(attrs, ['Auditoria realizada por']),
                        estado: obtenerAtributo(attrs, ['Estado']),
                        empresa: obtenerAtributo(attrs, ['Empresa']),
                        ubicacion: obtenerAtributo(attrs, ['Ubicación', 'Ubicacion']),
                        fecha_inicio: normalizarFechaParaPostgres(obtenerAtributo(attrs, ['Fecha Inicio'])),
                        fecha_cierre: normalizarFechaParaPostgres(obtenerAtributo(attrs, ['Fecha Cierre'])),
                        activa: obtenerAtributo(attrs, ['Activa'])
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
                } else if (categoriaDetectadaGlobal === 'IPP (Macro Sectores)') {
                    const valorColumnaIpp = (nombreColumna) => {
                        const indice = encabezadosOriginalesGlobal.findIndex(h =>
                            String(h).trim() === nombreColumna
                        );
                        return indice >= 0 ? obtenerValorImportacion(item.__filaOriginalIpp || [], indice) : null;
                    };

                    arrayControlesIpp.push({
                        id: idActivo,
                        geom: convertirWktIppAGeometria(item.ubicacion_wkt),
                        fid: null,
                        Centroide: null,
                        nombre: item.etiqueta,
                        "CONTROL MENSUAL (Mes)": valorColumnaIpp("CONTROL MENSUAL (Mes)"),
                        "Control Mensual Fecha": valorColumnaIpp("Control Mensual Fecha"),
                        "Control M realizado por": valorColumnaIpp("Control M. realizado por"),
                        "ACCESOS E INTERIOR DEL EDIFICIO": valorColumnaIpp("ACCESOS E INTERIOR DEL EDIFICIO"),
                        "Pasillos portones obstruidos": valorColumnaIpp("Pasillos portones obstruidos"),
                        "INF VIA SEC": valorColumnaIpp("INF. VIA SEC"),
                        "INF VIA Whatsapp": valorColumnaIpp("INF. VIA Whatsapp"),
                        "Combustible Fachada": valorColumnaIpp("Combustible Fachada"),
                        "INF_ VIA SEC_": valorColumnaIpp("INF. VIA SEC."),
                        "INF_ VIA Whatsapp_": valorColumnaIpp("INF. VIA Whatsapp."),
                        "Derrames": valorColumnaIpp("Derrames"),
                        "INF_ VIA_ SEC_": valorColumnaIpp("INF. VIA SEC.."),
                        "INF_ VIA_ Whatsapp_": valorColumnaIpp("INF. VIA Whatsapp.."),
                        "CONSIGNAS GENERALES": valorColumnaIpp("CONSIGNAS GENERALES"),
                        "Senalizacion Fumadores": valorColumnaIpp("Señalizacion Fumadores"),
                        "INF_ VIA SEC-": valorColumnaIpp("INF. VIA SEC-"),
                        "INF_ VIA Whatsapp-": valorColumnaIpp("INF. VIA Whatsapp-"),
                        "Carteleria Fumadores": valorColumnaIpp("Carteleria Fumadores"),
                        "INF_ VIA SEC_1": valorColumnaIpp("INF. VIA SEC,"),
                        "field_24": valorColumnaIpp("INF. VIA SEC,,"),
                        "INF_ VIA Whatsapp_1": valorColumnaIpp("INF. VIA Whatsapp,"),
                        "field_26": valorColumnaIpp("INF. VIA Whatsapp,,"),
                        "PROTEC_ CONTRA INCENDIO": valorColumnaIpp("PROTEC. CONTRA INCENDIO"),
                        "Extintores": valorColumnaIpp("Extintores"),
                        "INF_ VIA SEC*": valorColumnaIpp("INF. VIA SEC*"),
                        "INF_ VIA Whatsapp*": valorColumnaIpp("INF. VIA Whatsapp*"),
                        "Hidrantes": valorColumnaIpp("Hidrantes"),
                        "INF- VIA SEC_": valorColumnaIpp("INF. VIA SEC_"),
                        "Ecas": valorColumnaIpp("Ecas"),
                        "AreA": valorColumnaIpp("AreA")
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
                { data: arrayControlesEs, tabla: 'controles_es' },
                { data: arrayControlesIpp, tabla: 'ipp' }
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
                arrayControlesEs.length +
                arrayControlesIpp.length;

            alert(
                `¡Carga masiva completada!\n\nLEU: ${arrayLEU.length}\nControles: ${totalControles}\nAnomalías: ${arrayAnomalias.length}\n\nCategoría: ${categoriaDetectadaGlobal}`
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