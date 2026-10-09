// ==========================================
// MÓDULO: Controles de Hidrantes
// Modelo operativo: LEU -> controles_h -> anomalias
// ==========================================

import { clienteSupabase } from './supabaseClient.js';
import { aplicarTituloControl, verificarEstadoControl, cargarBomberosEnModal, cerrarFormularioControl, subirFotoStorage } from './controlesBase.js';

let activoLEU = null;

function atributosLEU(activo) {
    return activo?.atributos_tecnicos?.atributos_originales
        || activo?.atributos_tecnicos?.originales
        || activo?.atributos_tecnicos
        || {};
}

async function cargarActivoHidrante(idElemento, dbId) {
    let query = clienteSupabase.from('leu').select('*').eq('categoria', 'Hidrantes');
    if (idElemento) query = query.eq('etiqueta', idElemento);
    else query = query.eq('id', Number(dbId));
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error('Error consultando LEU: ' + error.message);
    if (!data) throw new Error('No se encontró el hidrante en LEU. Primero debe existir en LEU.');
    return data;
}

function parsearCoordenadaHidrante(raw) {
    const s = String(raw || '').trim();
    let m = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) {
        const a = Number(m[1]), b = Number(m[2]);
        if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [a, b];
        if (Math.abs(b) <= 90 && Math.abs(a) <= 180) return [b, a];
    }
    m = s.match(/^\s*POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)\s*$/i);
    if (m) return [Number(m[2]), Number(m[1])];
    return null;
}

function valorAtributo(attrs, ...keys) {
    for (const key of keys) {
        if (attrs[key] !== undefined && attrs[key] !== null && String(attrs[key]).trim() !== '') return attrs[key];
    }
    return '';
}

export function cambiarTipoControl() {
    const tipo = document.getElementById('input-tipocontrol')?.value;
    const bloque = document.getElementById('bloque-anual');
    const fecha = document.getElementById('input-fechapruebaanual');
    if (!bloque) return;
    const visible = tipo === 'Anual' || tipo === 'A Solicitud';
    bloque.style.display = visible ? 'block' : 'none';
    if (fecha) visible ? fecha.setAttribute('required','true') : fecha.removeAttribute('required');
}

export function verificarDetalleLlave(tipo) {
    const select = document.getElementById(`input-llave${tipo}`);
    const div = document.getElementById(`div-detalle-${tipo}`);
    const input = document.getElementById(`input-detalle-${tipo}`);
    if (!select || !div || !input) return;
    const noConforme = select.value === 'No conforme';
    div.style.display = noConforme ? 'block' : 'none';
    noConforme ? input.setAttribute('required','true') : input.removeAttribute('required');
    if (!noConforme) input.value = '';
}

export async function abrirControlHidrante(dbId, idElemento) {
    const modal = document.getElementById('modal-control');
    const titulo = document.getElementById('modal-titulo-elemento');

    try {
        activoLEU = await cargarActivoHidrante(idElemento, dbId);
    } catch (err) {
        alert(err.message);
        return;
    }

    document.getElementById('input-id-db').value = activoLEU.id;
    document.getElementById('input-idch').value = activoLEU.id;
    document.getElementById('input-tabla').value = 'Hidrantes';

    if (titulo) {
        aplicarTituloControl(titulo, 'Hidrante', activoLEU.etiqueta, 'Operativo');
    }

    renderizarFormularioHidranteHTML(activoLEU);
    await cargarBomberosEnModal();

    document.getElementById('input-tipocontrol').value = 'Mensual';
    cambiarTipoControl();
    document.getElementById('input-estado').value = 'Operativo';
    const tituloControl = document.getElementById('modal-titulo-elemento');
    const estadoControl = document.getElementById('input-estado');
    if (estadoControl) estadoControl.onchange = () => {
        verificarEstadoControl();
        aplicarTituloControl(tituloControl, 'Hidrante', activoLEU?.etiqueta, estadoControl.value);
    };
    verificarEstadoControl();

    ['alimentacion','teatroderecho','teatroizquierdo'].forEach(tipo => {
        const d=document.getElementById(`div-detalle-${tipo}`);
        const i=document.getElementById(`input-detalle-${tipo}`);
        if(d)d.style.display='none';
        if(i){i.removeAttribute('required');i.value='';}
    });

    if (modal) modal.style.display = 'flex';
}

function renderizarFormularioHidranteHTML(leu) {
    const c=document.getElementById('contenedor-componentes-dinamicos');
    if(!c)return;
    c.innerHTML=`
        <div style="display:grid;grid-template-columns:minmax(0,1.25fr) minmax(150px,0.75fr);gap:12px;align-items:stretch;margin-bottom:12px;">
            <fieldset style="min-width:0;border:1px solid #38bdf8;border-radius:5px;padding:10px;background:#182830;margin:0;">
                <legend style="font-size:13px;color:#38bdf8;padding:0 5px;font-weight:bold;">📌 Datos del elemento</legend>
                <div style="font-size:12px;color:#ddd;line-height:1.7;overflow-wrap:anywhere;">
                    <div><strong>Etiqueta:</strong> ${leu.etiqueta || 'N/D'}</div>
                    <div><strong>Sector:</strong> ${leu.sector || 'N/D'}</div>
                    <div><strong>Ronda:</strong> ${leu.ronda || 'N/D'}</div>
                    <div><strong>Ubicación:</strong> ${leu.ubicacion_wkt || 'N/D'}</div>
                </div>
            </fieldset>
            <div style="min-width:0;">
                <div style="font-size:12px;color:#ddd;margin-bottom:5px;font-weight:bold;">📍 Ubicación del hidrante</div>
                <div id="mini-mapa-hidrante" role="img" aria-label="Mapa centrado en la ubicación del hidrante" style="width:100%;height:132px;border:1px solid #38bdf8;border-radius:5px;overflow:hidden;background:#111;"></div>
            </div>
        </div>

        <label style="display:block;margin-bottom:5px;font-size:14px;font-weight:bold;color:#22c55e;">Tipo de Control:</label>
        <select id="input-tipocontrol" onchange="cambiarTipoControl()" required style="width:100%;padding:8px;margin-bottom:12px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:5px;">
            <option value="Mensual">Mensual</option><option value="Anual">Anual</option><option value="A Solicitud">A Solicitud</option>
        </select>

        <label style="display:block;margin-bottom:5px;font-size:14px;">Estado General:</label>
        <select id="input-estado" onchange="verificarEstadoControl()" required style="width:100%;padding:8px;margin-bottom:12px;background:#2a2a2a;border:1px solid #444;color:#fff;border-radius:5px;">
            <option value="Operativo">Operativo</option><option value="Observado">Observado</option><option value="Anomalo">Anómalo</option>
        </select>

        <div id="bloque-anomalia" style="display:none;background:#2a1515;padding:12px;border-radius:6px;margin-bottom:12px;border:1px dashed #ef4444;">
            <h4 style="margin:0 0 10px 0;color:#ef4444;font-size:14px;">🚨 Registro de Anomalía</h4>
            <label style="display:block;margin-bottom:5px;font-size:13px;color:#ff8888;">Razón:</label>
            <textarea id="input-anomalia-razon" rows="2" style="width:100%;padding:6px;margin-bottom:10px;background:#1e1e1e;border:1px solid #ef4444;color:#fff;border-radius:4px;font-size:12px;"></textarea>
            <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:0;margin-bottom:10px;">
                <div><label>Núm. de Evento:</label><input type="number" id="input-evento-numero" style="width:100%;padding:6px;background:#1e1e1e;border:1px solid #444;color:#fff;"></div>
                <div><label>Fecha:</label><input type="date" id="input-reportado-fecha" style="width:100%;padding:6px;background:#1e1e1e;border:1px solid #444;color:#fff;"></div>
            </div>
            <label style="display:block;margin-bottom:5px;font-size:13px;color:#ff8888;">Reportado por:</label>
            <input type="hidden" id="input-reportado-por">
            <div id="grid-seleccion-reportado" style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;margin-bottom:5px;"></div>
        </div>

        <div id="bloque-anual" style="display:none;background:#252525;padding:10px;border-radius:6px;margin-bottom:12px;border:1px dashed #444;">
            <label style="display:block;margin-bottom:5px;">Fecha de Prueba Anual:</label>
            <input type="date" id="input-fechapruebaanual" style="width:100%;padding:6px;margin-bottom:10px;background:#2a2a2a;border:1px solid #444;color:#fff;">
            <label style="display:block;margin-bottom:5px;">Prueba Aprobada:</label>
            <select id="input-pruebaaprobada" style="width:100%;padding:6px;margin-bottom:10px;background:#2a2a2a;border:1px solid #444;color:#fff;"><option value="Si">Sí</option><option value="No">No</option></select>
            <label style="display:block;margin-bottom:5px;">Planificación del mes:</label>
            <input type="text" id="input-fechapruebamensual" style="width:100%;padding:6px;background:#2a2a2a;border:1px solid #444;color:#fff;">
        </div>

        <fieldset style="border:1px solid #444;border-radius:5px;padding:10px;margin-bottom:12px;">
            <legend style="font-size:13px;color:#aaa;">Evaluación de Componentes</legend>
            <label>Llave de Alimentación:</label>
            <select id="input-llavealimentacion" onchange="verificarDetalleLlave('alimentacion')" required style="width:100%;padding:6px;margin-bottom:5px;background:#2a2a2a;border:1px solid #444;color:#fff;"><option>Conforme</option><option>No conforme</option><option>No posee</option></select>
            <div id="div-detalle-alimentacion" style="display:none;margin-bottom:8px;"><input type="text" id="input-detalle-alimentacion" placeholder="Detalle" style="width:100%;padding:6px;"></div>
            <label>Llave Teatro Derecho:</label>
            <select id="input-llaveteatroderecho" onchange="verificarDetalleLlave('teatroderecho')" required style="width:100%;padding:6px;margin-bottom:5px;background:#2a2a2a;border:1px solid #444;color:#fff;"><option>Conforme</option><option>No conforme</option><option>No posee</option></select>
            <div id="div-detalle-teatroderecho" style="display:none;margin-bottom:8px;"><input type="text" id="input-detalle-teatroderecho" placeholder="Detalle" style="width:100%;padding:6px;"></div>
            <label>Llave Teatro Izquierdo:</label>
            <select id="input-llaveteatroizquierdo" onchange="verificarDetalleLlave('teatroizquierdo')" required style="width:100%;padding:6px;margin-bottom:5px;background:#2a2a2a;border:1px solid #444;color:#fff;"><option>Conforme</option><option>No conforme</option><option>No posee</option></select>
            <div id="div-detalle-teatroizquierdo" style="display:none;margin-bottom:8px;"><input type="text" id="input-detalle-teatroizquierdo" placeholder="Detalle" style="width:100%;padding:6px;"></div>
            <label>Gabinete:</label><select id="input-gabinete" required style="width:100%;padding:6px;margin-bottom:8px;background:#2a2a2a;border:1px solid #444;color:#fff;"><option>Conforme</option><option>No conforme</option><option>No posee</option></select>
            <label>Pintura:</label><select id="input-pintura" required style="width:100%;padding:6px;margin-bottom:8px;background:#2a2a2a;border:1px solid #444;color:#fff;"><option>Conforme</option><option>No conforme</option></select>
            <label>Limpieza:</label><select id="input-limpieza" required style="width:100%;padding:6px;margin-bottom:8px;background:#2a2a2a;border:1px solid #444;color:#fff;"><option>Conforme</option><option>No conforme</option></select>
            <label>Engrasado:</label><select id="input-engrasado" required style="width:100%;padding:6px;background:#2a2a2a;border:1px solid #444;color:#fff;"><option>Conforme</option><option>No conforme</option></select>
        </fieldset>
    `;

    const mapaEl = document.getElementById('mini-mapa-hidrante');
    const coords = parsearCoordenadaHidrante(leu.ubicacion_wkt);
    if (mapaEl && coords && window.L) {
        const mini = L.map(mapaEl, {zoomControl:false, attributionControl:false, dragging:false, scrollWheelZoom:false, doubleClickZoom:false, boxZoom:false, keyboard:false});
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:22}).addTo(mini);
        L.circleMarker(coords, {radius:7, color:'#fff', weight:2, fillColor:'#ef4444', fillOpacity:1}).addTo(mini);
        mini.setView(coords, 18);
        setTimeout(() => mini.invalidateSize(), 100);
    } else if (mapaEl) {
        mapaEl.innerHTML = '<div style="padding:12px;color:#aaa;font-size:11px;text-align:center;">Ubicación no disponible</div>';
    }
}

export async function guardarControlHidrante(event) {
    event.preventDefault();

    const btn=document.querySelector('#form-nuevo-control button[type="submit"]');
    const original=btn?.innerText || 'Guardar Control';
    if(btn){btn.innerText='Guardando...';btn.disabled=true;}

    try {
        const idActivo=Number(document.getElementById('input-id-db').value);
        const tipoControl=document.getElementById('input-tipocontrol')?.value || 'Mensual';
        const estado=document.getElementById('input-estado')?.value || 'Operativo';
        const realizo=document.getElementById('input-realizo')?.value;
        const observacion=document.getElementById('input-observacion')?.value || '';
        const fotoInput=document.getElementById('input-foto')?.files?.[0];

        if(!idActivo || !activoLEU || Number(activoLEU.id)!==idActivo) throw new Error('No se pudo identificar correctamente el hidrante en LEU.');
        if(!realizo) throw new Error('Por favor selecciona un inspector haciendo clic en su foto.');

        const fotoUrl=await subirFotoStorage(fotoInput);
        const ahora=new Date();
        const fechaHoy=ahora.toISOString().split('T')[0];
        const meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

        const registro={
            id_activo:idActivo,
            idch_original:String(activoLEU.id),
            tipo_control:tipoControl,
            prueba_anual:(tipoControl==='Anual'||tipoControl==='A Solicitud') ? (document.getElementById('input-fechapruebaanual')?.value || null) : null,
            prueba_aprobada:(tipoControl==='Anual'||tipoControl==='A Solicitud') ? (document.getElementById('input-pruebaaprobada')?.value || null) : null,
            realizo,
            planing_prueba_mes:document.getElementById('input-fechapruebamensual')?.value || null,
            control_mensual:meses[ahora.getMonth()],
            estado,
            llave_alimentacion:document.getElementById('input-llavealimentacion').value,
            detalle_llave_alimentacion:document.getElementById('input-detalle-alimentacion').value || null,
            llave_teatro_derecho:document.getElementById('input-llaveteatroderecho').value,
            detalle_t_derecho:document.getElementById('input-detalle-teatroderecho').value || null,
            llave_teatro_izquierdo:document.getElementById('input-llaveteatroizquierdo').value,
            detalle_t_izquierdo:document.getElementById('input-detalle-teatroizquierdo').value || null,
            pintura:document.getElementById('input-pintura').value,
            gabinete:document.getElementById('input-gabinete').value,
            limpieza:document.getElementById('input-limpieza').value,
            engrasado:document.getElementById('input-engrasado').value,
            observacion:observacion || null,
            anomalias:estado==='Anomalo' ? (document.getElementById('input-anomalia-razon')?.value || null) : null,
            reportado_fecha:estado==='Anomalo' ? (document.getElementById('input-reportado-fecha')?.value || null) : null,
            reportado_por:estado==='Anomalo' ? (document.getElementById('input-reportado-por')?.value || null) : null,
            foto:fotoUrl,
            fecha_foto:fechaHoy
        };

        if(estado==='Anomalo' && !registro.reportado_por) throw new Error('Por favor selecciona quién reportó la anomalía.');

        const {error}=await clienteSupabase.from('controles_h').insert([registro]);
        if(error) throw new Error(error.message);

        if(estado==='Anomalo'){
            const {error:errAnomalia}=await clienteSupabase.from('anomalias').insert([{
                id_activo:idActivo,
                modulo_origen:'Hidrantes',
                evento_numero:document.getElementById('input-evento-numero')?.value || null,
                anomalia_detectada:registro.anomalias,
                detalle_informe:observacion || registro.anomalias,
                observacion:observacion || null,
                reportado_fecha:registro.reportado_fecha,
                reportado_por:registro.reportado_por,
                estado_resolucion:'Abierta'
            }]);
            if(errAnomalia) throw new Error('Control guardado, pero falló la anomalía: '+errAnomalia.message);
        }

        localStorage.setItem('centinela_inspector',realizo);
        cerrarFormularioControl();
        window.cargarModulo('hidrantes');
    } catch(err){
        alert('Error al guardar el control de hidrante: '+err.message);
    } finally {
        if(btn){btn.innerText=original;btn.disabled=false;}
    }
}
