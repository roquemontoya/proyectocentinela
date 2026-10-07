// ==========================================
// MÓDULO: Controles de Hidrantes
// ==========================================

import { clienteSupabase } from './supabaseClient.js';
import { verificarEstadoControl, cargarBomberosEnModal, cerrarFormularioControl, subirFotoStorage } from './controlesBase.js';

export function cambiarTipoControl() {
    const tipo = document.getElementById('input-tipocontrol') ? document.getElementById('input-tipocontrol').value : null;
    const bloqueAnual = document.getElementById('bloque-anual');
    
    if (bloqueAnual && tipo) {
        if (tipo === 'Anual' || tipo === 'A Solicitud') {
            bloqueAnual.style.display = 'block';
            document.getElementById('input-fechapruebaanual').setAttribute('required', 'true');
        } else {
            bloqueAnual.style.display = 'none';
            document.getElementById('input-fechapruebaanual').removeAttribute('required');
        }
    }
}

export function verificarDetalleLlave(tipo) {
    const selectElem = document.getElementById(`input-llave${tipo}`);
    const divDetalle = document.getElementById(`div-detalle-${tipo}`);
    const inputDetalle = document.getElementById(`input-detalle-${tipo}`);

    if (selectElem && divDetalle && inputDetalle) {
        const valor = selectElem.value;
        if (valor === 'No conforme') {
            divDetalle.style.display = 'block';
            inputDetalle.setAttribute('required', 'true');
        } else {
            divDetalle.style.display = 'none';
            inputDetalle.removeAttribute('required');
            inputDetalle.value = '';
        }
    }
}

export async function abrirControlHidrante(dbId, idElemento) {
    const modal = document.getElementById('modal-control');
    const titulo = document.getElementById('modal-titulo-elemento');
    
    document.getElementById('input-id-db').value = dbId;
    document.getElementById('input-idch').value = idElemento;
    document.getElementById('input-tabla').value = 'hidrantes';
    
    // Configurar título y RESTABLECER color a verde por defecto
    if (titulo) {
        titulo.innerText = `Control Hidrante: ${idElemento}`;
        titulo.style.color = '#22c55e'; 
    }

    // 1. Inyectamos SÓLO los campos de Hidrantes (incluyendo los antiguos generales)
    renderizarFormularioHidranteHTML();
    
    // 2. Cargamos bomberos SÓLO después de inyectar, para que encuentre las cajas dinámicas de anomalías
    await cargarBomberosEnModal();
    
    // 3. Inicializamos los valores por defecto
    const inputTipo = document.getElementById('input-tipocontrol');
    if (inputTipo) {
        inputTipo.value = 'Mensual';
        cambiarTipoControl();
    }

    const inputEstado = document.getElementById('input-estado');
    if (inputEstado) {
        inputEstado.value = 'Operativo';
        verificarEstadoControl();
    }

    ['alimentacion', 'teatroderecho', 'teatroizquierdo'].forEach(tipo => {
        const div = document.getElementById(`div-detalle-${tipo}`);
        const inp = document.getElementById(`input-detalle-${tipo}`);
        if (div) div.style.display = 'none';
        if (inp) {
            inp.removeAttribute('required');
            inp.value = '';
        }
    });

    if (modal) modal.style.display = 'flex';
}

function renderizarFormularioHidranteHTML() {
    const contenedorComponentes = document.getElementById('contenedor-componentes-dinamicos');
    if (!contenedorComponentes) return;

    contenedorComponentes.innerHTML = `
        <!-- BLOQUE TIPO DE CONTROL -->
        <label style="display: block; margin-bottom: 5px; font-size: 14px; font-weight: bold; color: #22c55e;">Tipo de Control:</label>
        <select id="input-tipocontrol" onchange="cambiarTipoControl()" required style="width: 100%; padding: 8px; margin-bottom: 12px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px;">
            <option value="Mensual">Mensual</option>
            <option value="Anual">Anual</option>
            <option value="A Solicitud">A Solicitud</option>
        </select>

        <!-- ESTADO GENERAL -->
        <label style="display: block; margin-bottom: 5px; font-size: 14px;">Estado General:</label>
        <select id="input-estado" onchange="verificarEstadoControl()" required style="width: 100%; padding: 8px; margin-bottom: 12px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px;">
            <option value="Operativo">Operativo</option>
            <option value="Observado">Observado</option>
            <option value="Anomalo">Anómalo</option>
        </select>

        <!-- BLOQUE ANOMALIA -->
        <div id="bloque-anomalia" style="display: none; background: #2a1515; padding: 12px; border-radius: 6px; margin-bottom: 12px; border: 1px dashed #ef4444;">
            <h4 style="margin: 0 0 10px 0; color: #ef4444; font-size: 14px;">🚨 Registro de Anomalía (Fuera de Servicio)</h4>
            
            <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #ff8888;">Razón de la salida de servicio (Anomalía):</label>
            <textarea id="input-anomalia-razon" rows="2" placeholder="Describa el motivo detallado de la anomalía..." style="width: 100%; padding: 6px; margin-bottom: 10px; background: #1e1e1e; border: 1px solid #ef4444; color: #fff; border-radius: 4px; font-size: 12px;"></textarea>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-size: 13px;">Núm. de Anomalía / Evento:</label>
                    <input type="number" id="input-evento-numero" placeholder="Ej: 202601" style="width: 100%; padding: 6px; background: #1e1e1e; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 12px;">
                </div>
                <div>
                    <label style="display: block; margin-bottom: 5px; font-size: 13px;">Fecha de Reporte:</label>
                    <input type="date" id="input-reportado-fecha" style="width: 100%; padding: 6px; background: #1e1e1e; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 12px;">
                </div>
            </div>

            <label style="display: block; margin-bottom: 5px; font-size: 13px; color: #ff8888;">Reportado por (Bombero):</label>
            <input type="hidden" id="input-reportado-por">
            <div id="grid-seleccion-reportado" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 5px; scrollbar-width: thin;">
                <p style="color: #aaa; font-size: 13px;">Cargando personal...</p>
            </div>
        </div>

        <!-- BLOQUE ANUAL -->
        <div id="bloque-anual" style="display: none; background: #252525; padding: 10px; border-radius: 6px; margin-bottom: 12px; border: 1px dashed #444;">
            <h4 style="margin: 0 0 10px 0; color: #38bdf8; font-size: 14px;">Parámetros de Prueba Anual / Solicitud</h4>
            
            <label style="display: block; margin-bottom: 5px; font-size: 13px;">Fecha de Prueba Anual:</label>
            <input type="date" id="input-fechapruebaanual" style="width: 100%; padding: 6px; margin-bottom: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px;">

            <label style="display: block; margin-bottom: 5px; font-size: 13px;">Prueba Aprobada:</label>
            <select id="input-pruebaaprobada" style="width: 100%; padding: 6px; margin-bottom: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px;">
                <option value="Si">Sí</option>
                <option value="No">No</option>
            </select>

            <label style="display: block; margin-bottom: 5px; font-size: 13px;">Movimiento de Agua (MovAgua):</label>
            <select id="input-movagua" style="width: 100%; padding: 6px; margin-bottom: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px;">
                <option value="Si">Sí</option>
                <option value="No">No</option>
            </select>

            <label style="display: block; margin-bottom: 5px; font-size: 13px;">Próxima Fecha Mensual (Planificación):</label>
            <input type="date" id="input-fechapruebamensual" style="width: 100%; padding: 6px; margin-bottom: 5px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px;">
        </div>

        <fieldset style="border: 1px solid #444; border-radius: 5px; padding: 10px; margin-bottom: 12px;">
            <legend style="font-size: 13px; color: #aaa; padding: 0 5px;">Evaluación de Componentes (Hidrante)</legend>
            
            <label style="display: block; font-size: 13px; margin-top: 5px;">Llave de Alimentación:</label>
            <select id="input-llavealimentacion" onchange="verificarDetalleLlave('alimentacion')" required style="width: 100%; padding: 6px; margin-bottom: 5px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px;">
                <option value="Conforme">Conforme</option>
                <option value="No conforme">No conforme</option>
                <option value="No posee">No posee</option>
            </select>
            <div id="div-detalle-alimentacion" style="display: none; margin-bottom: 8px;">
                <input type="text" id="input-detalle-alimentacion" placeholder="Detalle: ¿Por qué no es conforme la alimentación?" style="width: 100%; padding: 6px; background: #2a2a2a; border: 1px solid #eab308; color: #fff; border-radius: 4px; font-size: 12px;">
            </div>

            <label style="display: block; font-size: 13px;">Llave Teatro Derecho:</label>
            <select id="input-llaveteatroderecho" onchange="verificarDetalleLlave('teatroderecho')" required style="width: 100%; padding: 6px; margin-bottom: 5px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px;">
                <option value="Conforme">Conforme</option>
                <option value="No conforme">No conforme</option>
                <option value="No posee">No posee</option>
            </select>
            <div id="div-detalle-teatroderecho" style="display: none; margin-bottom: 8px;">
                <input type="text" id="input-detalle-teatroderecho" placeholder="Detalle: ¿Por qué no es conforme el teatro derecho?" style="width: 100%; padding: 6px; background: #2a2a2a; border: 1px solid #eab308; color: #fff; border-radius: 4px; font-size: 12px;">
            </div>

            <label style="display: block; font-size: 13px;">Llave Teatro Izquierdo:</label>
            <select id="input-llaveteatroizquierdo" onchange="verificarDetalleLlave('teatroizquierdo')" required style="width: 100%; padding: 6px; margin-bottom: 5px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px;">
                <option value="Conforme">Conforme</option>
                <option value="No conforme">No conforme</option>
                <option value="No posee">No posee</option>
            </select>
            <div id="div-detalle-teatroizquierdo" style="display: none; margin-bottom: 5px;">
                <input type="text" id="input-detalle-teatroizquierdo" placeholder="Detalle: ¿Por qué no es conforme el teatro izquierdo?" style="width: 100%; padding: 6px; background: #2a2a2a; border: 1px solid #eab308; color: #fff; border-radius: 4px; font-size: 12px;">
            </div>
        </fieldset>

        <fieldset style="border: 1px solid #444; border-radius: 5px; padding: 10px; margin-bottom: 12px;">
            <legend style="font-size: 13px; color: #aaa; padding: 0 5px;">Estado Físico y Conservación</legend>
            
            <label style="display: block; font-size: 13px; margin-top: 5px;">Gabinete:</label>
            <select id="input-gabinete" required style="width: 100%; padding: 6px; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px;">
                <option value="Conforme">Conforme</option>
                <option value="No conforme">No conforme</option>
                <option value="No posee">No posee</option>
            </select>

            <label style="display: block; font-size: 13px;">Pintura:</label>
            <select id="input-pintura" required style="width: 100%; padding: 6px; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px;">
                <option value="Conforme">Conforme</option>
                <option value="No conforme">No conforme</option>
            </select>

            <label style="display: block; font-size: 13px;">Limpieza:</label>
            <select id="input-limpieza" required style="width: 100%; padding: 6px; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px;">
                <option value="Conforme">Conforme</option>
                <option value="No conforme">No conforme</option>
            </select>

            <label style="display: block; font-size: 13px;">Engrasado:</label>
            <select id="input-engrasado" required style="width: 100%; padding: 6px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px;">
                <option value="Conforme">Conforme</option>
                <option value="No conforme">No conforme</option>
            </select>
        </fieldset>
    `;
}

export async function guardarControlHidrante(event) {
    event.preventDefault();
    
    const btnSubmit = document.querySelector('button[type="submit"]');
    const textoOriginal = btnSubmit.innerText;
    btnSubmit.innerText = 'Subiendo...';
    btnSubmit.disabled = true;
    
    const dbId = document.getElementById('input-id-db').value; 
    const idch = document.getElementById('input-idch').value;
    
    // Obtener los valores dinámicos
    const tipoControl = document.getElementById('input-tipocontrol') ? document.getElementById('input-tipocontrol').value : 'Mensual';
    const estado = document.getElementById('input-estado') ? document.getElementById('input-estado').value : 'Operativo'; 
    const realizo = document.getElementById('input-realizo').value;
    const observacion = document.getElementById('input-observacion').value;
    const fotoInput = document.getElementById('input-foto').files[0];

    const gabinete = document.getElementById('input-gabinete').value;
    const pintura = document.getElementById('input-pintura').value;
    const limpieza = document.getElementById('input-limpieza').value;
    const engrasado = document.getElementById('input-engrasado').value;

    if (!realizo) {
        alert('Por favor selecciona un inspector haciendo clic en su foto.');
        btnSubmit.innerText = textoOriginal;
        btnSubmit.disabled = false;
        return;
    }

    let razonAnomalia = null;
    let eventoNumero = null;
    let reportadoFecha = null;
    let reportadoPor = null;

    if (estado === 'Anomalo') {
        razonAnomalia = document.getElementById('input-anomalia-razon').value || null;
        eventoNumero = document.getElementById('input-evento-numero').value || null;
        reportadoFecha = document.getElementById('input-reportado-fecha').value || null;
        reportadoPor = document.getElementById('input-reportado-por').value || null;

        if (!reportadoPor) {
            alert('Por favor selecciona qué bombero reportó la anomalía haciendo clic en su foto.');
            btnSubmit.innerText = textoOriginal;
            btnSubmit.disabled = false;
            return;
        }
    }

    try {
        const fotoUrl = await subirFotoStorage(fotoInput);

        const ahora = new Date();
        const dia = String(ahora.getDate()).padStart(2, '0');
        const mes = String(ahora.getMonth() + 1).padStart(2, '0');
        const anio = ahora.getFullYear();
        const horas = String(ahora.getHours()).padStart(2, '0');
        const minutos = String(ahora.getMinutes()).padStart(2, '0');

        const idUnicoGenerado = `${dbId}_${dia}-${mes}-${anio}:${horas}:${minutos}`;
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const mesActual = meses[ahora.getMonth()];
        const fechaHoy = ahora.toISOString().split('T')[0];

        const registroNuevo = {
            "ID": Number(dbId),
            "IDCH": idUnicoGenerado,
            "TipoControl": tipoControl,
            "Realizo": realizo,
            "Controlrealizado": realizo,
            "CONTROLMENSUAL": mesActual,
            "ESTADO": estado.toUpperCase(),
            "LlaveAlimentacion": document.getElementById('input-llavealimentacion').value,
            "DetalleLlaveAlimentacion": document.getElementById('input-detalle-alimentacion').value || null,
            "LlaveTeatroDerecho": document.getElementById('input-llaveteatroderecho').value,
            "DetalleTDerecho": document.getElementById('input-detalle-teatroderecho').value || null,
            "LlaveTeatroIzquierdo": document.getElementById('input-llaveteatroizquierdo').value,
            "DetalleTIzquierdo": document.getElementById('input-detalle-teatroizquierdo').value || null,
            "Gabinete": gabinete,
            "Pintura": pintura,
            "Limpieza": limpieza,
            "Engrasado": engrasado,
            "Observacion": observacion || null,
            "ANOMALIAS": razonAnomalia,
            "EventoNumero": eventoNumero ? Number(eventoNumero) : null,
            "ReportadoFecha": reportadoFecha,
            "ReportadoPor": reportadoPor,
            "Foto": fotoUrl,
            "FechaFoto": fechaHoy
        };

        if (tipoControl === 'Anual' || tipoControl === 'A Solicitud') {
            registroNuevo["PRUEBAANUAL"] = document.getElementById('input-fechapruebaanual').value || null;
            registroNuevo["PruebaAprobada"] = document.getElementById('input-pruebaaprobada').value || null;
            registroNuevo["MovAgua"] = document.getElementById('input-movagua').value || null;
        }

        const { error: insertError } = await clienteSupabase
            .from('Controles_H')
            .insert([registroNuevo]);

        if (insertError) throw new Error(insertError.message);

        const { error: updateError } = await clienteSupabase
            .from('hidrantes')
            .update({ EstadoReferencia: estado }) 
            .eq('id', dbId);

        if (updateError) console.error("Error al actualizar la tabla padre hidrantes:", updateError);

        localStorage.setItem('centinela_inspector', realizo);
        btnSubmit.innerText = textoOriginal;
        btnSubmit.disabled = false;
        cerrarFormularioControl();

        window.cargarModulo('hidrantes');

    } catch (err) {
        alert('Error al guardar el control de hidrante: ' + err.message);
        btnSubmit.innerText = textoOriginal;
        btnSubmit.disabled = false;
    }
}