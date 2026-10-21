// ==========================================
// MÓDULO: Controles de Extintores
// Modelo operativo: LEU -> controles_e -> anomalias
// ==========================================

import { clienteSupabase } from './supabaseClient.js';
import { aplicarTituloControl, cargarBomberosEnModal, cerrarFormularioControl, subirFotoStorage } from './controlesBase.js';

let activoLEU = null;
let inventarioPulmon = [];

function atributosLEU(activo) {
    return activo?.atributos_tecnicos?.atributos_originales
        || activo?.atributos_tecnicos?.originales
        || activo?.atributos_tecnicos
        || {};
}

function valorAtributo(attrs, ...keys) {
    for (const key of keys) {
        if (attrs[key] !== undefined && attrs[key] !== null && String(attrs[key]).trim() !== '') {
            return attrs[key];
        }
    }
    return '';
}

function mesActual() {
    return ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][new Date().getMonth()];
}

function preCalcularEstadoExtintor(fechaStr) {
    if (!fechaStr) return 'Vigente';
    const f = String(fechaStr).toLowerCase().trim();
    const meses = {ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};
    let fecha = null;
    let m = f.match(/^([a-z]{3})[\s\-\/]+(\d{2,4})$/);
    if (m) {
        let y = parseInt(m[2],10); if (y < 100) y += 2000;
        if (meses[m[1]] !== undefined) fecha = new Date(y, meses[m[1]] + 1, 0);
    } else {
        m = f.match(/^(\d{1,2})[\s\-\/]+(\d{2,4})$/);
        if (m) {
            let y = parseInt(m[2],10); if (y < 100) y += 2000;
            fecha = new Date(y, parseInt(m[1],10), 0);
        } else {
            const parsed = new Date(fechaStr);
            if (!isNaN(parsed.getTime())) fecha = parsed;
        }
    }
    if (!fecha) return 'Vigente';
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    fecha.setHours(0,0,0,0);
    const dias = (fecha - hoy) / 86400000;
    if (dias < 0) return 'Vencido';
    if (dias <= 30) return 'Por Vencer';
    return 'Vigente';
}

async function cargarActivoExtintor(idElemento, dbId) {
    let query = clienteSupabase.from('leu').select('*').eq('categoria', 'Extintores');
    if (idElemento) query = query.eq('etiqueta', idElemento);
    else query = query.eq('id', Number(dbId));
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error('Error consultando LEU: ' + error.message);
    if (!data) throw new Error('No se encontró el extintor en LEU. El mapa todavía puede estar usando el registro histórico.');
    return data;
}

export async function abrirControlExtintor(dbId, idElemento) {
    const modal = document.getElementById('modal-control');
    const titulo = document.getElementById('modal-titulo-elemento');

    try {
        activoLEU = await cargarActivoExtintor(idElemento, dbId);
    } catch (err) {
        alert(err.message);
        return;
    }

    document.getElementById('input-id-db').value = activoLEU.id;
    document.getElementById('input-idch').value = activoLEU.id;
    document.getElementById('input-tabla').value = 'Extintores';

    const attrs = atributosLEU(activoLEU);
    const vencimiento = valorAtributo(attrs, 'Vencimiento', 'vencimiento');
    const estado = preCalcularEstadoExtintor(vencimiento);

    if (titulo) {
        aplicarTituloControl(titulo, 'Extintor', activoLEU.etiqueta, estado);
    }

    const { data: stockPulmon, error: errorPulmon } = await clienteSupabase
        .from('Extintores')
        .select('*')
        .in('PRP', ['En Pulmon', 'En Pulmón']);
    inventarioPulmon = errorPulmon ? [] : (stockPulmon || []).filter(item =>
        /pulm[oó]n/i.test(String(item.PRP || ''))
    );
    if (errorPulmon) console.warn('No se pudo cargar el stock del pulmón:', errorPulmon.message);

    renderizarFormularioExtintorHTML(activoLEU, attrs, estado);
    await cargarBomberosEnModal();
    if (modal) modal.style.display = 'flex';
}

function fechaISOParaInput(valor) {
    if (!valor) return '';
    const s = String(valor).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    let m = s.match(/^(\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
        let anio = Number(m[2]); if (anio < 100) anio += 2000;
        return `${anio}-${String(Number(m[1])).padStart(2,'0')}-01`;
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function crearOpcionesReemplazo(tipoOriginal) {
    const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
    const tipo = String(tipoOriginal || '').toLowerCase();
    const compatibles = inventarioPulmon.filter(item => {
        const tipoReserva = String(item.TIPO || item.TipoExtintor || item['Tipo de Extintor'] || '').toLowerCase();
        if (tipo.includes('pqs') || tipo.includes('polvo')) {
            return tipoReserva.includes('pqs') || tipoReserva.includes('polvo') || tipoReserva.includes('co2') || tipoReserva.includes('carbono');
        }
        if (tipo.includes('co2') || tipo.includes('carbono')) return tipoReserva.includes('co2') || tipoReserva.includes('carbono') || tipoReserva.includes('pqs') || tipoReserva.includes('polvo');
        if (tipo.includes('halon') || tipo.includes('halón')) return tipoReserva.includes('halon') || tipoReserva.includes('halón');
        if (tipo === 'k' || tipo.includes('tipo k') || tipo.includes('acetato')) {
            return tipoReserva === 'k' || tipoReserva.includes('tipo k') || tipoReserva.includes('acetato');
        }
        return true;
    });
    if (!compatibles.length) {
        return '<option value="">No hay extintores compatibles disponibles en el pulmón</option>';
    }
    return '<option value="">Seleccione un extintor de reserva...</option>' + compatibles.map(item => {
        const etiqueta = item.ETIQUETA || item.Etiquetas || item.etiquetas || item.NombreEtiqueta || item.NombreDeEtiqueta || `ID ${item.id}`;
        const tipoReserva = item.TIPO || item.TipoExtintor || item['Tipo de Extintor'] || 'Tipo sin especificar';
        return `<option value="${escapar(item.id)}">${escapar(etiqueta)} — ${escapar(tipoReserva)} (Venc.: ${escapar(item.Vencimiento || 'N/D')})</option>`;
    }).join('');
}

function renderizarFormularioExtintorHTML(leu, attrs, estadoSugerido) {
    const c = document.getElementById('contenedor-componentes-dinamicos');
    if (!c) return;

    const tipo = valorAtributo(attrs, 'Tipo de Extintor', 'TipoExtintor');
    const vencimiento = valorAtributo(attrs, 'Vencimiento', 'vencimiento');
    const prueba = valorAtributo(attrs, 'Prueba Hidraulica', 'PruebaHidraulica');
    const fechaVencimiento = fechaISOParaInput(vencimiento);
    const anioActual = new Date().getFullYear();
    const anioPrueba = Number(String(prueba).match(/\d{4}/)?.[0]) || anioActual;
    const opcionesTipo = ['PQS','Co2','Halon','K'];
    const tipoNormalizado = opcionesTipo.find(t => t.toLowerCase() === String(tipo).toLowerCase()) || 'PQS';
    const opcionesAnios = Array.from({length: 31}, (_, i) => anioActual + i)
        .map(anio => `<option value="${anio}" ${anio === Math.max(anioActual, anioPrueba) ? 'selected' : ''}>${anio}</option>`).join('');

    c.innerHTML = `
        <div style="display:grid;grid-template-columns:minmax(0,1.25fr) minmax(150px,0.75fr);gap:12px;align-items:stretch;margin-bottom:12px;">
            <fieldset style="min-width:0;border:1px solid #38bdf8;border-radius:5px;padding:10px;background:#182830;margin:0;">
                <legend style="font-size:13px;color:#38bdf8;padding:0 5px;font-weight:bold;">📌 Datos del elemento</legend>
                <div style="font-size:12px;color:#ddd;line-height:1.7;overflow-wrap:anywhere;">
                    <div><strong>Etiqueta:</strong> ${leu.etiqueta || 'N/D'}</div>
                    <div><strong>Sector:</strong> ${leu.sector || 'N/D'}</div>
                    <div><strong>Ronda:</strong> ${leu.ronda || 'N/D'}</div>
                </div>
            </fieldset>
            <div style="min-width:0;">
                <div style="font-size:12px;color:#ddd;margin-bottom:5px;font-weight:bold;">📍 Ubicación del extintor</div>
                <div id="mini-mapa-extintor" role="img" aria-label="Mapa centrado en la ubicación del extintor" style="width:100%;height:132px;border:1px solid #38bdf8;border-radius:5px;overflow:hidden;background:#111;"></div>
            </div>
        </div>

        <fieldset style="border:1px solid #444;border-radius:5px;padding:10px;margin-bottom:12px;">
            <legend style="font-size:13px;color:#aaa;padding:0 5px;">Control Mensual</legend>
            <label style="display:block;font-size:13px;margin-bottom:5px;">Condición:</label>
            <select id="input-condicion-extintor" required style="width:100%;padding:8px;margin-bottom:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:5px;">
                <option value="Vigente" ${estadoSugerido === 'Vigente' ? 'selected' : ''}>Vigente</option>
                <option value="Por Vencer" ${estadoSugerido === 'Por Vencer' ? 'selected' : ''}>Por Vencer</option>
                <option value="Vencido" ${estadoSugerido === 'Vencido' ? 'selected' : ''}>Vencido</option>
            </select>

            <div id="seccion-reemplazo-extintor" style="display:${estadoSugerido === 'Vencido' ? 'block' : 'none'};background:#2a1515;border:1px solid #ef4444;border-radius:7px;padding:12px;margin-bottom:14px;">
                <h3 style="margin:0 0 8px;color:#f87171;font-size:15px;">🔁 Recambio temporal desde Pulmón</h3>
                <p style="margin:0 0 10px;color:#fecaca;font-size:12px;line-height:1.5;">1. Seleccioná el equipo que se instala como provisorio. 2. El bombero elegido en “Realizado por” quedará registrado como responsable de la instalación. 3. La devolución se completa luego desde el módulo Pulmón con el bombero que retira el provisorio y el estado de ambos equipos.</p>
                <label for="input-nuevo-id-reemplazo" style="display:block;font-size:13px;color:#fff;font-weight:bold;margin-bottom:6px;">Equipo provisorio disponible:</label>
                <select id="input-nuevo-id-reemplazo" style="width:100%;padding:10px;background:#1e1e1e;border:1px solid #ef4444;color:#fff;border-radius:5px;">
                    ${crearOpcionesReemplazo(tipo)}
                </select>
                <small style="display:block;color:#fca5a5;margin-top:7px;">El titular conserva su tipo y su historial. El provisorio queda bloqueado en el stock hasta registrar su devolución.</small>
            </div>

            <label style="display:block;font-size:13px;margin-bottom:5px;">Tipo del extintor titular (no el provisorio):</label>
            <select id="input-tipo-extintor" required disabled style="width:100%;padding:8px;margin-bottom:10px;background:#222;border:1px solid #444;color:#aaa;border-radius:5px;opacity:0.9;">
                ${opcionesTipo.map(t => `<option value="${t}" ${t === tipoNormalizado ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <small style="display:block;color:#aaa;margin-top:-6px;margin-bottom:10px;">El tipo del titular no se modifica al instalar un reemplazo temporal.</small>

            <label style="display:block;font-size:13px;margin-bottom:5px;">Vencimiento:</label>
            <input type="date" id="input-vencimiento-extintor" value="${fechaVencimiento}" required style="width:100%;box-sizing:border-box;padding:8px;margin-bottom:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:5px;">

            <label style="display:block;font-size:13px;margin-bottom:5px;">Prueba hidráulica (año):</label>
            <select id="input-prueba-hidraulica-extintor" required style="width:100%;padding:8px;margin-bottom:10px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:5px;">
                ${opcionesAnios}
            </select>

            <label style="display:block;font-size:13px;margin-bottom:5px;">Ronda del control:</label>
            <input type="text" id="input-ronda-control" value="${leu.ronda || ''}" style="width:100%;box-sizing:border-box;padding:8px;margin-bottom:8px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:4px;">
            <label style="display:block;font-size:13px;margin-bottom:5px;">Mes del control:</label>
            <input type="text" id="input-control-mensual" value="${mesActual()}" readonly style="width:100%;box-sizing:border-box;padding:8px;background:#222;border:1px solid #444;color:#aaa;border-radius:4px;">
        </fieldset>
    `;

    const selectCondicion = document.getElementById('input-condicion-extintor');
    if (selectCondicion) {
        const seccionReemplazo = document.getElementById('seccion-reemplazo-extintor');
        const selectReemplazo = document.getElementById('input-nuevo-id-reemplazo');
        const actualizarReemplazo = () => {
            const vencido = selectCondicion.value === 'Vencido';
            if (seccionReemplazo) seccionReemplazo.style.display = vencido ? 'block' : 'none';
            if (selectReemplazo) {
                if (vencido) selectReemplazo.setAttribute('required', 'required');
                else {
                    selectReemplazo.removeAttribute('required');
                    selectReemplazo.value = '';
                }
            }
        };
        selectCondicion.addEventListener('change', () => {
            const titulo = document.getElementById('modal-titulo-elemento');
            aplicarTituloControl(titulo, 'Extintor', leu.etiqueta, selectCondicion.value);
            actualizarReemplazo();
        });
        actualizarReemplazo();
    }

    // Mapa mini: reutiliza Leaflet, con zoom máximo y marcador del activo.
    const mapaEl = document.getElementById('mini-mapa-extintor');
    if (mapaEl && window.L) {
        const raw = String(leu.ubicacion_wkt || '');
        const m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
        if (m) {
            const lat = Number(m[1]), lng = Number(m[2]);
            const mini = L.map(mapaEl, {zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false, doubleClickZoom:false, boxZoom:false, keyboard:false, tap:false});
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:22}).addTo(mini);
            L.circleMarker([lat,lng], {radius:7,color:'#fff',weight:2,fillColor:'#ef4444',fillOpacity:1}).addTo(mini);
            mini.setView([lat,lng], 18);
            setTimeout(() => mini.invalidateSize(), 100);
        } else {
            mapaEl.innerHTML = '<div style="padding:12px;color:#aaa;font-size:11px;text-align:center;">Ubicación no disponible</div>';
        }
    } else if (mapaEl) {
        mapaEl.innerHTML = '<div style="padding:12px;color:#aaa;font-size:11px;text-align:center;">Mapa no disponible</div>';
    }
}

export async function guardarControlExtintor(event) {
    event.preventDefault();

    const inputIdActivo = document.getElementById('input-id-db');
    if (!inputIdActivo) { alert('Error del formulario: falta el identificador del activo. Recargá la aplicación.'); return; }
    const idActivo = Number(inputIdActivo.value);
    const realizo = document.getElementById('input-realizo')?.value || '';
    const condicion = document.getElementById('input-condicion-extintor')?.value || 'Vigente';
    const observacion = document.getElementById('input-observacion')?.value || '';
    const selectReemplazo = document.getElementById('input-nuevo-id-reemplazo');
    const idReemplazo = condicion === 'Vencido' ? selectReemplazo?.value : '';
    const itemReemplazo = idReemplazo ? inventarioPulmon.find(item => String(item.id) === String(idReemplazo)) : null;
    const etiquetaReemplazo = itemReemplazo
        ? (itemReemplazo.ETIQUETA || itemReemplazo.Etiquetas || itemReemplazo.etiquetas || itemReemplazo.NombreEtiqueta || itemReemplazo.NombreDeEtiqueta || `ID ${itemReemplazo.id}`)
        : '';
    const fotoInput = document.getElementById('input-foto')?.files?.[0];
    const tipoExtintor = document.getElementById('input-tipo-extintor')?.value;
    const vencimientoControl = document.getElementById('input-vencimiento-extintor')?.value;
    const pruebaHidraulicaControl = document.getElementById('input-prueba-hidraulica-extintor')?.value;

    if (!idActivo || !activoLEU || Number(activoLEU.id) !== idActivo) {
        alert('No se pudo identificar correctamente el elemento LEU.');
        return;
    }
    if (!realizo) {
        alert('Por favor selecciona un inspector haciendo clic en su foto.');
        return;
    }
    if (!tipoExtintor || !vencimientoControl || !pruebaHidraulicaControl) {
        alert('Completá tipo de extintor, vencimiento y año de prueba hidráulica.');
        return;
    }
    if (!fotoInput) {
        alert('La foto de auditoría es obligatoria.');
        return;
    }
    if (condicion === 'Vencido' && !idReemplazo) {
        alert('Seleccioná un extintor compatible del pulmón para continuar.');
        selectReemplazo?.focus();
        return;
    }

    const btn = document.querySelector('#form-nuevo-control button[type="submit"]');
    const original = btn?.innerText || 'Guardar Control';
    if (btn) { btn.innerText = 'Guardando...'; btn.disabled = true; }

    try {
        const attrs = atributosLEU(activoLEU);
        const fotoUrl = await subirFotoStorage(fotoInput);
        const hoy = new Date().toISOString().split('T')[0];

        const registro = {
            id_activo: idActivo,
            nombreetiqueta: activoLEU.etiqueta || null,
            sector: activoLEU.sector || null,
            ronda: document.getElementById('input-ronda-control')?.value || activoLEU.ronda || null,
            controlmensual: document.getElementById('input-control-mensual')?.value || mesActual(),
            controlrealizadopor: realizo,
            tipoextintor: valorAtributo(attrs, 'Tipo de Extintor', 'TipoExtintor') || tipoExtintor || null,
            vencimiento: vencimientoControl || null,
            pruebahidraulica: pruebaHidraulicaControl || null,
            observacion: (condicion === 'Vencido'
                ? `[REEMPLAZO TEMPORAL PROPUESTO: ${etiquetaReemplazo}]${observacion ? ' ' + observacion : ''}`
                : observacion) || null,
            foto: fotoUrl,
            fechafoto: hoy
        };

        const datosAnomalia = condicion === 'Vencido' ? {
            id_activo: idActivo,
            modulo_origen: 'Extintores',
            anomalia_detectada: 'Extintor vencido',
            detalle_informe: `Extintor detectado como vencido durante control. Reemplazo de pulmón seleccionado: ${etiquetaReemplazo}.${observacion ? ' ' + observacion : ''}`,
            observacion: observacion || null,
            reportado_fecha: hoy,
            reportado_por: realizo,
            estado_resolucion: 'Abierta'
        } : null;
        const { data: resultado, error } = await clienteSupabase.rpc('guardar_control_con_anomalia', {
            p_tabla_control: 'controles_e',
            p_control: registro,
            p_anomalia: datosAnomalia
        });
        if (error) throw new Error(error.message);

        // Registrar el reemplazo como una entidad transversal, separada del control histórico.
        // El control original conserva su tipo; el provisorio conserva su propio tipo e inventario.
        if (condicion === 'Vencido' && itemReemplazo) {
            const tipoTitular = valorAtributo(attrs, 'Tipo de Extintor', 'TipoExtintor') || tipoExtintor;
            const tipoProvisorio = itemReemplazo.TIPO || itemReemplazo.TipoExtintor || itemReemplazo['Tipo de Extintor'] || 'Sin especificar';
            const resultadoControl = Array.isArray(resultado) ? resultado[0] : resultado;
            const idControlInicio = resultadoControl?.id_control || null;
            const { data: ciclo, error: errorCiclo } = await clienteSupabase
                .from('reemplazos_temporales_extintores')
                .insert({
                    activo_titular_id: idActivo,
                    inventario_reemplazo_id: Number(itemReemplazo.id),
                    control_inicio_id: idControlInicio,
                    tipo_titular: String(tipoTitular),
                    tipo_reemplazo: String(tipoProvisorio),
                    fecha_inicio: hoy,
                    fecha_hora_inicio: new Date().toISOString(),
                    motivo: 'Reemplazo temporal por extintor vencido',
                    responsable_inicio: realizo,
                    bombero_entrega_reemplazo_id: realizo,
                    estado: 'Activo',
                    observaciones: observacion || null,
                    creado_por: realizo
                })
                .select('id')
                .single();
            if (errorCiclo) {
                throw new Error('El control se guardó, pero no se pudo registrar el ciclo de reemplazo. No retires físicamente el equipo hasta resolverlo. Detalle: ' + errorCiclo.message);
            }

            const { error: errorMovimiento } = await clienteSupabase
                .from('movimientos_reemplazos_extintores')
                .insert({
                    reemplazo_id: ciclo.id,
                    tipo_movimiento: 'Instalacion',
                    activo_titular_id: idActivo,
                    inventario_reemplazo_id: Number(itemReemplazo.id),
                    bombero: realizo,
                    fecha_hora: new Date().toISOString(),
                    estado_titular: 'Vencido',
                    estado_reemplazo: 'Instalado como provisorio',
                    observaciones: observacion || null
                });
            if (errorMovimiento) {
                await clienteSupabase.from('reemplazos_temporales_extintores').delete().eq('id', ciclo.id);
                throw new Error('El control se guardó, pero falló la bitácora de instalación. El ciclo fue revertido; revisá antes de mover el equipo. Detalle: ' + errorMovimiento.message);
            }

            const { error: errorStock } = await clienteSupabase
                .from('Extintores')
                .update({ PRP: 'Instalado como provisorio' })
                .eq('id', itemReemplazo.id)
                .in('PRP', ['En Pulmon', 'En Pulmón']);
            if (errorStock) {
                throw new Error('Se registró el reemplazo, pero no se pudo bloquear el stock del Pulmón. No uses ese equipo para otro reemplazo hasta corregir el estado de inventario. Detalle: ' + errorStock.message);
            }
        }

        alert(condicion === 'Vencido'
            ? 'Control guardado y reemplazo temporal registrado. El provisorio quedó bloqueado en el Pulmón.'
            : 'Control de extintor guardado correctamente.');
        localStorage.setItem('centinela_inspector', realizo);
        cerrarFormularioControl();
        window.cargarModulo('extintores');
    } catch (err) {
        alert('Error al guardar el control: ' + err.message);
    } finally {
        if (btn) { btn.innerText = original; btn.disabled = false; }
    }
}
