// Módulo auxiliar de administración: conversión de coordenadas decimales a GMS.
// Acepta una coordenada por línea, pares latitud/longitud separados por espacios,
// y tablas copiadas desde Markdown/Excel con barras verticales.
function extraerPares(texto) {
  const lineas = String(texto || '').split(/\r?\n/);
  const pares = [];
  const errores = [];

  for (let i = 0; i < lineas.length; i++) {
    const original = lineas[i].trim();
    if (!original) continue;

    // Ignorar separadores de tablas Markdown y encabezados sin coordenadas.
    const sinBordes = original.replace(/^\s*\|/, '').replace(/\|\s*$/, '').trim();
    if (/^[-:\s|]+$/.test(sinBordes)) continue;

    const numeros = sinBordes.match(/[+-]?\d+(?:[.,]\d+)?/g) || [];
    if (numeros.length === 0) continue;
    if (numeros.length !== 2) {
      errores.push({ linea: i + 1, texto: original, motivo: 'Se esperaban exactamente dos números: latitud y longitud.' });
      continue;
    }

    const lat = Number(numeros[0].replace(',', '.'));
    const lon = Number(numeros[1].replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      errores.push({ linea: i + 1, texto: original, motivo: 'Coordenadas fuera de rango.' });
      continue;
    }
    pares.push({ lat, lon, linea: i + 1 });
  }
  return { pares, errores };
}

function decimalAGms(valor, esLatitud) {
  const hemisferio = esLatitud ? (valor < 0 ? 'S' : 'N') : (valor < 0 ? 'W' : 'E');
  const absoluto = Math.abs(valor);
  const grados = Math.floor(absoluto);
  const minutosDecimales = (absoluto - grados) * 60;
  const minutos = Math.floor(minutosDecimales);
  const segundos = (minutosDecimales - minutos) * 60;
  const segundosTexto = segundos.toFixed(2).padStart(5, '0');
  return `${grados}° ${String(minutos).padStart(2, '0')}′ ${segundosTexto}″ ${hemisferio}`;
}

export function convertirCoordenadasGMS(texto) {
  const { pares, errores } = extraerPares(texto);
  return {
    resultados: pares.map(({ lat, lon, linea }) => ({
      linea,
      gms: `${decimalAGms(lat, true)} ${decimalAGms(lon, false)}`,
      latitud: lat,
      longitud: lon
    })),
    errores
  };
}

export function cargarModuloCoordenadasGms(contenedor) {
  contenedor.style.cssText = 'width:100%;height:calc(100vh - 65px);overflow:auto;box-sizing:border-box;padding:20px;background:#121212;color:#e5e7eb;font-family:Arial,sans-serif;';
  contenedor.innerHTML = `
    <section style="max-width:1000px;margin:0 auto;">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <div style="font-size:34px;">🧭</div>
        <div><h2 style="margin:0;color:#38bdf8;">Conversor de coordenadas a GMS</h2>
        <p style="margin:6px 0 0;color:#9ca3af;">Herramienta administrativa · Solo procesa texto local; no modifica Supabase.</p></div>
      </div>
      <div style="margin-top:18px;padding:14px;background:#1e293b;border:1px solid #334155;border-radius:8px;line-height:1.6;">
        <strong>Formatos aceptados</strong><br>
        <code>-31.4693651 -64.2395099</code><br>
        <code>| -31.4696715 | -64.2397172 |</code><br>
        Puedes pegar una sola fila o muchas filas copiadas de Excel/una tabla. La salida será una coordenada GMS por línea, lista para copiar en una sola columna de Excel.
      </div>
      <label for="gms-entrada" style="display:block;font-weight:bold;margin:18px 0 8px;">Coordenadas decimales de entrada</label>
      <textarea id="gms-entrada" rows="9" spellcheck="false" placeholder="-31.4693651 -64.2395099&#10;| -31.4696715 | -64.2397172 |" style="width:100%;box-sizing:border-box;background:#0b1220;color:#f8fafc;border:1px solid #475569;border-radius:8px;padding:12px;font:14px/1.6 ui-monospace,monospace;"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 18px;">
        <button id="gms-convertir" type="button" style="background:#0284c7;color:white;border:0;border-radius:6px;padding:10px 16px;font-weight:bold;cursor:pointer;">Convertir</button>
        <button id="gms-copiar" type="button" style="background:#15803d;color:white;border:0;border-radius:6px;padding:10px 16px;font-weight:bold;cursor:pointer;" disabled>Copiar columna</button>
        <button id="gms-limpiar" type="button" style="background:#374151;color:white;border:1px solid #4b5563;border-radius:6px;padding:10px 16px;cursor:pointer;">Limpiar</button>
      </div>
      <div id="gms-resumen" role="status" aria-live="polite" style="margin:8px 0;color:#cbd5e1;"></div>
      <label for="gms-salida" style="display:block;font-weight:bold;margin:8px 0;">Resultado GMS — una celda por línea</label>
      <textarea id="gms-salida" rows="9" readonly spellcheck="false" placeholder="Los resultados aparecerán aquí…" style="width:100%;box-sizing:border-box;background:#111827;color:#bbf7d0;border:1px solid #475569;border-radius:8px;padding:12px;font:14px/1.8 ui-monospace,monospace;"></textarea>
      <div id="gms-errores" role="alert" style="margin-top:12px;color:#fca5a5;white-space:pre-wrap;"></div>
      <p style="color:#94a3b8;font-size:12px;line-height:1.5;">Convención de salida: grados, minutos y segundos decimales; hemisferios N/S y E/W. Las coordenadas negativas se convierten a S y W. Las filas inválidas no se convierten y se informan por número de línea.</p>
    </section>`;

  const entrada = contenedor.querySelector('#gms-entrada');
  const salida = contenedor.querySelector('#gms-salida');
  const resumen = contenedor.querySelector('#gms-resumen');
  const erroresEl = contenedor.querySelector('#gms-errores');
  const copiar = contenedor.querySelector('#gms-copiar');
  const convertir = () => {
    const { resultados, errores } = convertirCoordenadasGMS(entrada.value);
    salida.value = resultados.map(r => r.gms).join('\n');
    resumen.textContent = `${resultados.length} coordenada(s) convertida(s).`;
    erroresEl.textContent = errores.length
      ? 'Filas que requieren corrección:\n' + errores.map(e => `Línea ${e.linea}: ${e.motivo} Entrada: ${e.texto}`).join('\n')
      : '';
    copiar.disabled = resultados.length === 0;
  };
  contenedor.querySelector('#gms-convertir').addEventListener('click', convertir);
  copiar.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(salida.value);
      resumen.textContent = 'Columna copiada. Pégala directamente en Excel.';
    } catch {
      salida.focus();
      salida.select();
      resumen.textContent = 'Seleccioné el resultado. Usa Ctrl+C (o Copiar en el menú del dispositivo).';
    }
  });
  contenedor.querySelector('#gms-limpiar').addEventListener('click', () => {
    entrada.value = '';
    salida.value = '';
    resumen.textContent = '';
    erroresEl.textContent = '';
    copiar.disabled = true;
    entrada.focus();
  });
  entrada.addEventListener('input', () => {
    // No convertir automáticamente mientras se pega un bloque grande.
    resumen.textContent = 'Entrada lista. Pulsa Convertir para revisar los resultados.';
  });
}
