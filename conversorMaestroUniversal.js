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
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');

    const detectarCategoria = (nombreArchivo) => {
        const name = normalizarClave(nombreArchivo);

        // Categorías controladas: generan LEU + controles_*.
        // Un archivo puede contener más de una palabra de categoría
        // (ej.: "EXTINTORES- Permisos Permanentes.csv").
        // Priorizamos la categoría específica "Permisos Permanentes"
        // antes de la coincidencia genérica "extintor".
        if (name.includes('permisopermanente') || name.includes('permiso')) return 'Permisos Permanentes';
        if (name.includes('extintor')) return 'Extintores';
        if (name.includes('hidrante')) return 'Hidrantes';
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

    // Nunca asumimos una categoría si el nombre del archivo no permite identificarla.
    // Esto evita importar silenciosamente un archivo desconocido como Extintores.
    let categoriaDetectadaGlobal = null;
    let datosConvertidosGlobal = [];
    let auditoriaCsvGlobal = null;

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

                    const esInicioRegistroIpp = (fila) => {
                        return (
                            categoriaDetectadaGlobal === 'IPP (Macro Sectores)' &&
                            Array.isArray(fila) &&
                            wktEsValido(fila[0]) &&
                            !esTextoVacio(fila[1])
                        );
                    };

                    // Exportación IPP especial:
                    // algunos CSV de zonas exportan "descripción" con saltos de línea
                    // SIN entrecomillarlos. Papa Parse interpreta cada línea como una fila
                    // física independiente. Cada registro lógico comienza con WKT + nombre
                    // y las filas siguientes hasta el próximo WKT forman su descripción.
                    const reconstruirRegistroIppMultilinea = (filas, indiceInicio) => {
                        if (!esInicioRegistroIpp(filas?.[indiceInicio])) return null;

                        const filaInicio = filas[indiceInicio];
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

                            // Solo reparamos de forma segura si la continuación tiene texto
                            // en la primera posición y el resto de columnas están vacías.
                            const hayDatosFueraDeDescripcion = Array.isArray(parte) &&
                                parte.slice(1).some(valor => !esTextoVacio(valor));

                            if (hayDatosFueraDeDescripcion) {
                                return {
                                    fila: null,
                                    indiceFin,
                                    segura: false,
                                    motivo: 'IPP: la continuación de la descripción en la fila ' +
                                        (indiceFin + 2) +
                                        ' contiene datos fuera de la primera columna; reparación no determinista.'
                                };
                            }

                            if (!esTextoVacio(parte?.[0])) {
                                partesDescripcion.push(String(parte[0]).trim());
                            }

                            indiceFin++;
                        }

                        if (indiceFin === indiceInicio + 1) return null;

                        const filaCanonica = new Array(COLUMNAS_ESPERADAS).fill(null);
                        filaCanonica[0] = filaInicio[0];
                        filaCanonica[1] = filaInicio[1];
                        filaCanonica[2] = partesDescripcion.join('\n');

                        return {
                            fila: filaCanonica,
                            indiceFin: indiceFin - 1,
                            segura: true,
                            reparada: true,
                            motivo: 'Descripción IPP multilinea reconstruida desde varias filas físicas',
                            tipoReparacion: 'ipp_descripcion_multilinea'
                        };
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

                    const repararFilaEstructuralmente = (fila, numeroFilaCsv) => {
                        let filaOriginal = Array.isArray(fila) ? [...fila] : [];

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
                            motivo: `Fila ${numeroFilaCsv}: contiene ${filaOriginal.length} columnas; se esperaban ${COLUMNAS_ESPERADAS} y no existe una reparación estructural determinista.`,
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

                    for (let index = 0; index < filasDatos.length; index++) {
                            const fila = filasDatos[index];
                            const numeroFilaCsv = index + 2;

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
                        if (!etiqueta) etiqueta = `Sin Etiqueta Fila ${index + 2}`;

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
                        sector: item.sector,
                        habilitada: obtenerAtributo(attrs, ['Habilitada']),
                        control_semanal: obtenerAtributo(attrs, ['CONTROL SEMANAL']),
                        control_s_realizado_por: obtenerAtributo(attrs, ['Control S. realizado por', 'Control S realizado por']),
                        auditoria_fecha: obtenerAtributo(attrs, ['AUDITORIA (Fecha)', 'Auditoria Fecha']),
                        auditoria_semana: obtenerAtributo(attrs, ['Auditoria Semana']),
                        auditoria_realizada_por: obtenerAtributo(attrs, ['Auditoria realizada por']),
                        estado: obtenerAtributo(attrs, ['Estado']),
                        empresa: obtenerAtributo(attrs, ['Empresa']),
                        ubicacion: obtenerAtributo(attrs, ['Ubicación', 'Ubicacion']),
                        fecha_inicio: obtenerAtributo(attrs, ['Fecha Inicio']),
                        fecha_cierre: obtenerAtributo(attrs, ['Fecha Cierre']),
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