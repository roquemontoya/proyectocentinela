// ==========================================
// MÓDULO: Controles de Extintores (Lógica Avanzada de Reemplazo / Swap)
// ==========================================

import { clienteSupabase } from './supabaseClient.js';
import { cargarBomberosEnModal, cerrarFormularioControl, subirFotoStorage } from './controlesBase.js';

let inventarioPulmon = []; // Almacenará el stock disponible en tiempo real

function preCalcularEstadoExtintor(fechaStr, estadoReferencia) {
    if (estadoReferencia && String(estadoReferencia).toLowerCase().includes('anomalo')) return 'Vencido';
    if (!fechaStr) return 'Vigente';
    
    const f = fechaStr.toString().toLowerCase().trim();
    const meses = { 'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11 };
    
    let match = f.match(/^([a-z]{3})[\s\-\/]+(\d{2,4})$/);
    let fechaVenc = null;
    if (match) {
        let m = meses[match[1]];
        let y = parseInt(match[2], 10);
        if (y < 100) y += 2000;
        if (m !== undefined) fechaVenc = new Date(y, m + 1, 0);
    } else {
        match = f.match(/^(\d{1,2})[\s\-\/]+(\d{2,4})$/);
        if (match) {
            let m = parseInt(match[1], 10) - 1;
            let y = parseInt(match[2], 10);
            if (y < 100) y += 2000;
            fechaVenc = new Date(y, m + 1, 0);
        } else {
            let parsed = new Date(fechaStr);
            if (!isNaN(parsed.getTime())) fechaVenc = parsed;
        }
    }
    
    if (fechaVenc) {
        let hoy = new Date();
        hoy.setHours(0,0,0,0);
        fechaVenc.setHours(0,0,0,0);
        let diffDias = (fechaVenc.getTime() - hoy.getTime()) / (1000 * 3600 * 24);
        
        if (diffDias < 0) return 'Vencido';
        if (diffDias <= 30) return 'Por Vencer';
        return 'Vigente';
    }
    return 'Vigente';
}

export async function abrirControlExtintor(dbId, idElemento) {
    const modal = document.getElementById('modal-control');
    const titulo = document.getElementById('modal-titulo-elemento');
    
    document.getElementById('input-id-db').value = dbId;
    document.getElementById('input-idch').value = idElemento;
    document.getElementById('input-tabla').value = 'Extintores';

    // 1. Consultar datos actuales del extintor
    const { data: extData } = await clienteSupabase
        .from('Extintores')
        .select('*')
        .eq('id', dbId)
        .single();

    // 2. Consultar el stock disponible en el Pulmón
    const { data: pulmonData } = await clienteSupabase
        .from('Extintores')
        .select('*')
        .eq('PRP', 'En Pulmon');
        
    inventarioPulmon = pulmonData || [];

    const datos = extData || {};
    const estadoSugerido = preCalcularEstadoExtintor(datos.Vencimiento, datos.EstadoReferencia);

    if (titulo) {
        let colorTitulo = '#22c55e';
        if (estadoSugerido === 'Por Vencer') colorTitulo = '#eab308';
        if (estadoSugerido === 'Vencido') colorTitulo = '#ef4444';

        const tipoStr = datos.TipoExtintor || datos['Tipo de Extintor'] || '';
        const nroStr = datos.Etiquetas || datos.etiquetas || datos.NombreEtiqueta || datos.NombreDeEtiqueta || idElemento;
        const sectorStr = datos.Sector || datos.sector || '';

        let tituloArmado = 'Control del Extintor';
        if (tipoStr) tituloArmado += ` ${tipoStr}`;
        if (nroStr) tituloArmado += ` Nro: ${nroStr}`;
        if (sectorStr) tituloArmado += ` - ${sectorStr}`;

        titulo.innerText = tituloArmado.trim();
        titulo.style.color = colorTitulo;
    }

    renderizarFormularioExtintorHTML(datos, estadoSugerido);
    await cargarBomberosEnModal();

    if (modal) modal.style.display = 'flex';
}

function renderizarFormularioExtintorHTML(ext, estadoSugerido) {
    const contenedorComponentes = document.getElementById('contenedor-componentes-dinamicos');
    if (!contenedorComponentes) return;

    const parteEtiqueta = ext.Etiquetas || ext.etiquetas || ext.NombreEtiqueta || ext.NombreDeEtiqueta || '';
    const parteReferencia = ext.Referencia || ext.referencia || '';
    const parteSector = ext.Sector || ext.sector || '';
    
    const nombreCombinado = [parteEtiqueta, parteReferencia, parteSector].filter(val => val && String(val).trim() !== '').join(' - ');

    const tipoVal = String(ext.TipoExtintor || ext['Tipo de Extintor'] || '').toLowerCase();
    let selPQS = (tipoVal.includes('pqs') || tipoVal.includes('polvo')) ? 'selected' : '';
    let selCO2 = (tipoVal.includes('co2') || tipoVal.includes('carbono')) ? 'selected' : '';
    let selHalon = (tipoVal.includes('halon') || tipoVal.includes('halón')) ? 'selected' : '';
    let selK = (tipoVal === 'k' || tipoVal.includes('tipo k') || tipoVal.includes('acetato')) ? 'selected' : '';

    // ==========================================
    // LÓGICA DE COMPATIBILIDAD (EL FILTRO INTELIGENTE)
    // ==========================================
    let opcionesReemplazo = '<option value="">Seleccione un equipo de reserva...</option>';
    
    const disponibles = inventarioPulmon.filter(p => {
        const t = String(p.TipoExtintor || p['Tipo de Extintor'] || '').toLowerCase();
        
        // PQS se reemplaza por PQS o Co2
        if (selPQS) return t.includes('pqs') || t.includes('polvo') || t.includes('co2') || t.includes('carbono');
        // Co2 se reemplaza por Co2
        if (selCO2) return t.includes('co2') || t.includes('carbono');
        // Halon se reemplaza por Halon
        if (selHalon) return t.includes('halon') || t.includes('halón');
        // Tipo K se reemplaza por Tipo K
        if (selK) return t === 'k' || t.includes('tipo k') || t.includes('acetato');
        
        return true; // Si no detectamos el tipo original, mostramos todos por seguridad
    });

    if (disponibles.length === 0) {
        opcionesReemplazo = '<option value="">⚠️ No hay equipos compatibles en el Pulmón</option>';
    } else {
        disponibles.forEach(p => {
            const etiq = p.Etiquetas || p.etiquetas || p.NombreEtiqueta || p.NombreDeEtiqueta || `ID ${p.id}`;
            const tipo = p.TipoExtintor || p['Tipo de Extintor'] || 'N/D';
            opcionesReemplazo += `<option value="${p.id}">${etiq} - ${tipo} (Venc: ${p.Vencimiento || 'N/D'})</option>`;
        });
    }

    contenedorComponentes.innerHTML = `
        <label style="display: block; font-size: 14px; margin-bottom: 5px; color: #22c55e; font-weight: bold;">Estado del Extintor:</label>
        <select id="input-condicion-extintor" onchange="toggleReemplazoExtintor()" style="width: 100%; padding: 8px; margin-bottom: 12px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; font-size: 13px;">
            <option value="Vigente" ${estadoSugerido === 'Vigente' ? 'selected' : ''}>Vigente</option>
            <option value="Por Vencer" ${estadoSugerido === 'Por Vencer' ? 'selected' : ''}>Por Vencer</option>
            <option value="Vencido" ${estadoSugerido === 'Vencido' ? 'selected' : ''}>Vencido (Reemplazo)</option>
        </select>

        <!-- Bloque de reemplazo interactivo (Swap) -->
        <div id="seccion-reemplazo" style="display: ${estadoSugerido === 'Vencido' ? 'block' : 'none'}; background: #2a1515; padding: 12px; border-radius: 6px; border: 1px dashed #ef4444; margin-bottom: 12px;">
            <h4 style="margin: 0 0 10px 0; color: #ef4444; font-size: 14px;">🚨 Asignar Reemplazo del Pulmón</h4>
            <label style="display: block; font-size: 12px; color: #ff8888; font-weight: bold; margin-bottom: 5px;">Equipo a instalar (Filtro automático aplicado):</label>
            <select id="input-nuevo-id-reemplazo" style="width: 100%; padding: 8px; background: #1e1e1e; border: 1px solid #ef4444; color: #fff; border-radius: 4px; font-size: 12px;">
                ${opcionesReemplazo}
            </select>
        </div>

        <fieldset style="border: 1px solid #38bdf8; border-radius: 5px; padding: 12px; margin-bottom: 12px; background: #182830;">
            <legend style="font-size: 13px; color: #38bdf8; padding: 0 5px; font-weight: bold;">📋 Datos de Control (Extintores)</legend>
            
            <label style="display: block; font-size: 12px; margin-top: 6px; color: #ccc;">Nombre de etiqueta:</label>
            <input type="text" id="input-nombre-etiqueta" value="${nombreCombinado}" style="width: 100%; padding: 6px; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 13px;">

            <label style="display: block; font-size: 12px; color: #ccc;">Punto GPS:</label>
            <input type="text" id="input-punto-gps" value="${ext.PuntoGPS || ''}" style="width: 100%; padding: 6px; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 13px;">

            <label style="display: block; font-size: 12px; color: #ccc;">Sector:</label>
            <input type="text" id="input-sector" value="${ext.Sector || ''}" style="width: 100%; padding: 6px; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 13px;">

            <label style="display: block; font-size: 12px; color: #ccc;">Ronda:</label>
            <input type="text" id="input-ronda" value="${ext.Ronda || ''}" style="width: 100%; padding: 6px; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 13px;">

            <label style="display: block; font-size: 12px; color: #ccc;">CONTROL MENSUAL (Mes):</label>
            <input type="text" id="input-control-mensual" value="${ext.ControlMensual || ext['CONTROL MENSUAL (Mes)'] || ''}" placeholder="Ej: Septiembre" style="width: 100%; padding: 6px; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 13px;">

            <label style="display: block; font-size: 12px; color: #ccc;">Tipo de Extintor:</label>
            <select id="input-tipo-extintor" style="width: 100%; padding: 6px; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 13px;">
                <option value="">Seleccione un tipo...</option>
                <option value="PQS" ${selPQS}>PQS</option>
                <option value="Co2" ${selCO2}>Co2</option>
                <option value="Halon" ${selHalon}>Halon</option>
                <option value="Tipo K" ${selK}>Tipo K</option>
            </select>

            <label style="display: block; font-size: 12px; color: #ccc;">Vencimiento:</label>
            <input type="text" id="input-vencimiento" value="${ext.Vencimiento || ''}" placeholder="Ej: ene-27" style="width: 100%; padding: 6px; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 13px;">

            <label style="display: block; font-size: 12px; color: #ccc;">Prueba Hidraulica:</label>
            <input type="text" id="input-prueba-hidraulica" value="${ext.PruebaHidraulica || ext['Prueba Hidraulica'] || ''}" placeholder="Ej: 2027" style="width: 100%; padding: 6px; margin-bottom: 8px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 4px; font-size: 13px;">
        </fieldset>
    `;

    window.toggleReemplazoExtintor = function() {
        const condicion = document.getElementById('input-condicion-extintor').value;
        const seccionReemplazo = document.getElementById('seccion-reemplazo');
        if (seccionReemplazo) {
            seccionReemplazo.style.display = (condicion === 'Vencido') ? 'block' : 'none';
        }
    };
}

export async function guardarControlExtintor(event) {
    event.preventDefault();
    
    const dbId = document.getElementById('input-id-db').value; 
    const realizo = document.getElementById('input-realizo').value; 
    const observacion = document.getElementById('input-observacion').value;
    const fotoInput = document.getElementById('input-foto').files[0];
    const condicion = document.getElementById('input-condicion-extintor').value;
    
    // Obtenemos el ID del equipo seleccionado del pulmón
    const selectReemplazo = document.getElementById('input-nuevo-id-reemplazo');
    const idReemplazo = selectReemplazo ? selectReemplazo.value : '';
    let etiquetaReemplazo = '';

    if (!realizo) {
        alert('Por favor selecciona un inspector haciendo clic en su foto.');
        return;
    }

    if (condicion === 'Vencido' && !idReemplazo) {
        alert('Debes seleccionar un equipo de reemplazo compatible desde el Pulmón.');
        return;
    }

    if (condicion === 'Vencido' && idReemplazo) {
        etiquetaReemplazo = selectReemplazo.options[selectReemplazo.selectedIndex].text;
    }

    const btnSubmit = document.querySelector('button[type="submit"]');
    const textoOriginal = btnSubmit.innerText;
    btnSubmit.innerText = 'Realizando Enroque...';
    btnSubmit.disabled = true;

    try {
        const fotoUrl = await subirFotoStorage(fotoInput);
        const fechaHoy = new Date().toISOString().split('T')[0];

        const nombreEtiquetaVal = document.getElementById('input-nombre-etiqueta').value;
        const puntoGpsVal = document.getElementById('input-punto-gps').value;
        const sectorVal = document.getElementById('input-sector').value;
        const rondaVal = document.getElementById('input-ronda').value;
        const controlMensualVal = document.getElementById('input-control-mensual').value;
        const tipoExtintorVal = document.getElementById('input-tipo-extintor').value;
        const vencimientoVal = document.getElementById('input-vencimiento').value;
        const pruebaHidraulicaVal = document.getElementById('input-prueba-hidraulica').value;

        let observacionFinal = observacion || '';
        let estadoRef = 'Operativo';

        if (condicion === 'Vencido') {
            estadoRef = 'Anómalo';
            observacionFinal = `[REEMPLAZADO / SWAP] El equipo fue dado de baja y enviado a recarga. Se instaló en su lugar: ${etiquetaReemplazo}. ${observacionFinal}`.trim();
        } else if (condicion === 'Por Vencer') {
            estadoRef = 'Observado';
        }

        // 1. Guardar el registro de control (Siempre asociado al equipo que estamos auditando)
        const registroNuevo = {
            "id_extintor": Number(dbId),
            "NombreEtiqueta": nombreEtiquetaVal || null,
            "PuntoGPS": puntoGpsVal || null,
            "Sector": sectorVal || null,
            "Ronda": rondaVal || null,
            "CONTROLMENSUAL": controlMensualVal || null,
            "ControlRealizadoPor": realizo,
            "TipoExtintor": tipoExtintorVal || null,
            "Vencimiento": vencimientoVal || null,
            "PruebaHidraulica": pruebaHidraulicaVal || null,
            "Observacion": observacionFinal,
            "Foto": fotoUrl,
            "FechaFoto": fechaHoy
        };

        const { error: insertError } = await clienteSupabase.from('Controles_E').insert([registroNuevo]);
        if (insertError) throw new Error(insertError.message);

        // 2. LÓGICA DE ROTACIÓN (EL ENROQUE / SWAP EN LA BASE DE DATOS)
        if (condicion === 'Vencido' && idReemplazo) {
            
            // A. El equipo VIEJO sale de la planta, pierde sus coordenadas GPS y se va a Recarga
            const { error: errViejo } = await clienteSupabase.from('Extintores').update({
                NombreEtiqueta: nombreEtiquetaVal,
                TipoExtintor: tipoExtintorVal,
                Vencimiento: vencimientoVal,
                EstadoReferencia: 'Anómalo',
                PRP: 'En Recarga',  // <--- Automáticamente enviado a recarga
                PuntoGPS: null,     // <--- Borramos su GPS para que desaparezca
                Sector: null
            }).eq('id', dbId);

            if (errViejo) throw new Error("Error actualizando equipo viejo: " + errViejo.message);

            // B. El equipo NUEVO sale del pulmón, entra a la planta, hereda las coordenadas y recibe la foto
            const { error: errNuevo } = await clienteSupabase.from('Extintores').update({
                EstadoReferencia: 'Operativo',
                PRP: 'En Planta',   // <--- Ingresa a la planta oficialmente
                PuntoGPS: puntoGpsVal, // Hereda el GPS exacto
                Sector: sectorVal,     // Hereda el Sector
                Ronda: rondaVal,
                Foto: fotoUrl          // Se le asigna la foto de la instalación
            }).eq('id', idReemplazo);

            if (errNuevo) throw new Error("Error ingresando equipo nuevo a planta: " + errNuevo.message);

        } else {
            // Actualización Normal (No hubo reemplazo)
            const { error: updateError } = await clienteSupabase.from('Extintores').update({
                NombreEtiqueta: nombreEtiquetaVal,
                PuntoGPS: puntoGpsVal,
                Sector: sectorVal,
                Ronda: rondaVal,
                TipoExtintor: tipoExtintorVal,
                Vencimiento: vencimientoVal,
                PruebaHidraulica: pruebaHidraulicaVal,
                EstadoReferencia: estadoRef,
                Foto: fotoUrl 
            }).eq('id', dbId);

            if (updateError) console.error("Error al actualizar la tabla padre:", updateError);
        }

        localStorage.setItem('centinela_inspector', realizo);
        btnSubmit.innerText = textoOriginal;
        btnSubmit.disabled = false;
        cerrarFormularioControl();

        // Refrescamos la vista (Si estábamos en el pulmón, recargamos la tabla, si no, el mapa)
        const vistaDinamica = document.getElementById('vista-dinamica');
        const moduloActual = vistaDinamica.querySelector('table') ? 'pulmon' : 'extintores';
        window.cargarModulo(moduloActual);

    } catch (err) {
        alert('Error al guardar el control: ' + err.message);
        btnSubmit.innerText = textoOriginal;
        btnSubmit.disabled = false;
    }
}