// ==========================================
// MÓDulo: Gestión de Pulmón y Reserva (Extintores)
// ==========================================

import { clienteSupabase } from './supabaseClient.js';
import { renderizarAlveolosPulmon } from './pulmonAlveolos.js';

export async function cargarModuloPulmon(contenedor) {
    contenedor.style.width = '100%';
    contenedor.style.padding = '20px';
    contenedor.style.boxSizing = 'border-box';
    contenedor.style.overflowY = 'auto';
    contenedor.style.height = 'calc(100vh - 65px)';
    contenedor.style.backgroundColor = '#121212';
    
    contenedor.innerHTML = `<div style="text-align: center; color: #fff; font-family: Arial; padding: 40px; font-size: 16px;">🔄 Cargando inventario del Pulmón y Recargas...</div>`;

    // 1. Traer todos los extintores que NO estén en planta
    const { data, error } = await clienteSupabase
        .from('Extintores')
        .select('*')
        .neq('PRP', 'En Planta');

    if (error) {
        contenedor.innerHTML = `<div style="color: #ef4444; padding: 20px; font-family: Arial;">Error al cargar el pulmón: ${error.message}</div>`;
        return;
    }

    const inventario = (data || []).filter(item => {
        const prp = item.PRP ? item.PRP.toLowerCase() : '';
        return prp.includes('pulmon') || prp.includes('pulmón') || prp.includes('recarga');
    });

    const totalPulmon = inventario.filter(i => (i.PRP || '').toLowerCase().includes('pulmon')).length;
    const totalRecarga = inventario.filter(i => (i.PRP || '').toLowerCase().includes('recarga')).length;

    let html = `
        <div style="max-width: 1100px; margin: 0 auto; color: #fff; font-family: Arial, sans-serif;">
            
            <!-- Encabezado y Contadores -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                <h2 style="margin: 0; color: #38bdf8;">📦 Inventario de Pulmón y Retorno de Recarga</h2>
                <div style="display: flex; gap: 15px;">
                    <span style="background: #22c55e; color: #000; padding: 6px 12px; border-radius: 5px; font-weight: bold; font-size: 14px;">En Pulmón: ${totalPulmon}</span>
                    <span style="background: #eab308; color: #000; padding: 6px 12px; border-radius: 5px; font-weight: bold; font-size: 14px;">En Recarga: ${totalRecarga}</span>
                </div>
            </div>

            <!-- Buscador en tiempo real -->
            <input type="text" id="buscador-pulmon" placeholder="🔍 Buscar por etiqueta, sector o tipo de extintor..." style="width: 100%; padding: 12px; margin-bottom: 20px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; box-sizing: border-box; font-size: 14px;">

            <!-- Tabla de Datos -->
            <div style="overflow-x: auto; background: #1e1e1e; border: 1px solid #333; border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; min-width: 700px;">
                    <thead>
                        <tr style="background: #2a2a2a; border-bottom: 2px solid #444;">
                            <th style="padding: 14px; text-align: left; color: #aaa; font-size: 13px;">ETIQUETA / ID</th>
                            <th style="padding: 14px; text-align: left; color: #aaa; font-size: 13px;">TIPO</th>
                            <th style="padding: 14px; text-align: left; color: #aaa; font-size: 13px;">VENCIMIENTO</th>
                            <th style="padding: 14px; text-align: left; color: #aaa; font-size: 13px;">ESTADO (PRP)</th>
                            <th style="padding: 14px; text-align: center; color: #aaa; font-size: 13px;">ACCIONES DE RETORNO / STOCK</th>
                        </tr>
                    </thead>
                    <tbody id="tabla-body-pulmon">
    `;

    if (inventario.length === 0) {
        html += `<tr><td colspan="5" style="padding: 30px; text-align: center; color: #888;">No hay extintores registrados en el pulmón o en recarga.</td></tr>`;
    } else {
        inventario.forEach(ext => {
            const etiqueta = ext.ETIQUETA || ext.Etiquetas || ext.etiquetas || ext.NombreEtiqueta || ext.NombreDeEtiqueta || `Ext #${ext.id}`;
            const tipo = ext.TIPO || ext.TipoExtintor || ext['Tipo de Extintor'] || 'N/D';
            const vencimiento = ext.Vencimiento || 'N/D';
            const prp = ext.PRP || 'N/D';
            
            let colorPrp = '#22c55e'; 
            if (prp.toLowerCase().includes('recarga')) colorPrp = '#eab308';

            const esRegistroPrueba = String(ext.Novedades || '').toUpperCase().includes('SUEÑOS Y ESPERANZAS') || String(ext.Referencia || '').includes('TEST CENTINELA');
            const textoBusqueda = `${etiqueta} ${tipo} ${vencimiento} ${prp} ${ext.Novedades || ''} ${ext.Referencia || ''}`.toLowerCase();

            // Vigencia calculada para decidir si el equipo debe rotar a línea o ir directamente a recarga.
            const diasRestantes = diasHastaVencimientoPulmon(vencimiento);
            const estaEnPulmon = /pulm[oó]n/i.test(prp);
            const requiereRecarga = diasRestantes !== null && diasRestantes <= 30;

            // Botón dinámico según estado y vencimiento.
            let botonAccion = '';
            if (estaEnPulmon && requiereRecarga) {
                botonAccion += `
                    <button onclick="window.enviarPulmonARecarga('${ext.id}', '${String(etiqueta).replace(/'/g, "\\'")}')" style="background: #f59e0b; color: #111; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; margin-right: 5px;">📤 Enviar a recarga</button>
                `;
            }
            if (estaEnPulmon && diasRestantes === null) {
                botonAccion += `<span title="No se pudo interpretar el vencimiento; revisar antes de asignar" style="display:inline-block;background:#7f1d1d;color:#fee2e2;padding:5px 7px;border-radius:4px;font-size:11px;margin-right:5px;">⚠️ Revisar fecha</span>`;
            }
            if (prp.toLowerCase().includes('recarga')) {
                // Si está en recarga, el botón permite registrar que el proveedor lo devolvió al pulmón
                botonAccion = `
                    <button onclick="window.marcarRecibidoPulmon('${ext.id}', '${etiqueta.replace(/'/g, "\\'")}')" style="background: #eab308; color: #000; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; margin-right: 5px;">📥 Recibido de Recarga</button>
                `;
            }

            html += `
                <tr class="fila-pulmon" data-texto="${textoBusqueda}" style="border-bottom: 1px solid #333; transition: background 0.2s;">
                    <td style="padding: 14px; font-weight: bold;">${etiqueta}${esRegistroPrueba ? '<small style="display:block;color:#fbbf24;margin-top:5px;font-weight:normal;">🧪 DATOS FICTICIOS DE PRUEBA</small>' : ''}</td>
                    <td style="padding: 14px; color: #38bdf8;">${tipo}</td>
                    <td style="padding: 14px; color: #ccc;">${vencimiento}
                        ${estaEnPulmon && diasRestantes !== null ? `<small style="display:block;margin-top:4px;color:${diasRestantes <= 30 ? '#fbbf24' : '#86efac'}">${diasRestantes < 0 ? 'Vencido' : diasRestantes === 0 ? 'Vence hoy' : diasRestantes + ' días restantes'}${requiereRecarga ? ' · Prioridad de recarga' : ''}</small>` : ''}
                    </td>
                    <td style="padding: 14px;">
                        <span style="background: ${colorPrp}; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${prp.toUpperCase()}</span>
                    </td>
                    <td style="padding: 14px; text-align: center;">
                        ${botonAccion}
                        <button onclick="window.abrirFormularioControl('Extintores', '${ext.id}', '${etiqueta.replace(/'/g, "\\'")}')" style="background: #2a2a2a; color: #fff; border: 1px solid #555; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">✏️ Auditar</button>
                    </td>
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    contenedor.innerHTML = html;
    await renderizarAlveolosPulmon(contenedor);

    // Reemplazos temporales activos: equipos fuera del stock hasta registrar devolución.
    const { data: activos, error: errorActivos } = await clienteSupabase
        .from('reemplazos_temporales_extintores')
        .select('*')
        .eq('estado', 'Activo')
        .order('fecha_hora_inicio', { ascending: true });
    if (errorActivos) {
        contenedor.insertAdjacentHTML('beforeend', `<p style="color:#f87171;margin:16px auto;max-width:1100px;">No se pudieron cargar los reemplazos activos: ${errorActivos.message}</p>`);
    } else if (activos?.length) {
        const idsTitulares = [...new Set(activos.map(x => x.activo_titular_id))];
        const idsStock = [...new Set(activos.map(x => x.inventario_reemplazo_id).filter(Boolean))];
        const [{ data: titulares }, { data: stock }, { data: bomberos }] = await Promise.all([
            clienteSupabase.from('leu').select('id,etiqueta,sector,ronda').in('id', idsTitulares),
            clienteSupabase.from('Extintores').select('id,ETIQUETA,TIPO,PRP').in('id', idsStock),
            clienteSupabase.from('Bomberos').select('Bombero').eq('Estado','Activo').order('Bombero')
        ]);
        const mapaTitulares = new Map((titulares || []).map(x => [String(x.id), x]));
        const mapaStock = new Map((stock || []).map(x => [String(x.id), x]));
        const opcionesBomberos = (bomberos || []).map(b => `<option value="${escHtmlPulmon(b.Bombero)}">${escHtmlPulmon(b.Bombero)}</option>`).join('');
        const filas = activos.map(x => {
            const titular = mapaTitulares.get(String(x.activo_titular_id));
            const provisorio = mapaStock.get(String(x.inventario_reemplazo_id));
            return `<tr style="border-bottom:1px solid #444">
                <td style="padding:10px">${escHtmlPulmon(titular?.etiqueta || ('LEU '+x.activo_titular_id))}<small style="display:block;color:#aaa">${escHtmlPulmon(titular?.sector || '')}</small></td>
                <td style="padding:10px">${escHtmlPulmon(provisorio?.ETIQUETA || ('Inventario '+x.inventario_reemplazo_id))} — ${escHtmlPulmon(x.tipo_reemplazo)}</td>
                <td style="padding:10px">${escHtmlPulmon(x.fecha_hora_inicio ? new Date(x.fecha_hora_inicio).toLocaleString('es-AR') : x.fecha_inicio)}</td>
                <td style="padding:10px;min-width:280px">
                    <select id="bombero-devolucion-${x.id}" style="width:100%;padding:8px;margin-bottom:6px;background:#222;color:#fff;border:1px solid #555;border-radius:4px">
                        <option value="">Bombero que devuelve...</option>${opcionesBomberos}
                    </select>
                    <select id="estado-titular-${x.id}" style="width:100%;padding:8px;margin-bottom:6px;background:#222;color:#fff;border:1px solid #555;border-radius:4px">
                        <option value="Reinstalado operativo">Titular: reinstalado operativo</option>
                        <option value="Retirado para mantenimiento">Titular: retirado para mantenimiento</option>
                        <option value="Fuera de servicio">Titular: fuera de servicio</option>
                    </select>
                    <select id="estado-provisorio-${x.id}" style="width:100%;padding:8px;margin-bottom:6px;background:#222;color:#fff;border:1px solid #555;border-radius:4px">
                        <option value="Operativo">Provisorio: operativo</option>
                        <option value="A recarga">Provisorio: requiere recarga</option>
                        <option value="Fuera de servicio">Provisorio: fuera de servicio</option>
                    </select>
                    <input id="obs-devolucion-${x.id}" placeholder="Observaciones (opcional)" style="width:100%;box-sizing:border-box;padding:8px;margin-bottom:6px;background:#222;color:#fff;border:1px solid #555;border-radius:4px">
                    <button onclick="window.registrarDevolucionReemplazo('${x.id}')" style="width:100%;background:#22c55e;color:#052e16;border:0;padding:9px;border-radius:4px;font-weight:bold;cursor:pointer">Registrar devolución y liberar stock</button>
                </td>
            </tr>`;
        }).join('');
        contenedor.insertAdjacentHTML('beforeend', `
            <section style="max-width:1100px;margin:24px auto;color:#fff;font-family:Arial,sans-serif">
                <h2 style="color:#fbbf24">🔁 Reemplazos temporales activos</h2>
                <p style="color:#bbb">Cada devolución queda como un movimiento independiente, con su propio bombero y hora. El equipo vuelve al stock solo después de confirmar este registro.</p>
                <div style="overflow-x:auto;background:#1e1e1e;border:1px solid #333;border-radius:8px">
                    <table style="width:100%;border-collapse:collapse;min-width:850px">
                        <thead><tr style="background:#2a2a2a"><th style="padding:10px;text-align:left">Titular</th><th style="padding:10px;text-align:left">Provisorio</th><th style="padding:10px;text-align:left">Instalado</th><th style="padding:10px;text-align:left">Registrar devolución</th></tr></thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
            </section>`);
    }

    // Buscador en tiempo real
    const buscador = document.getElementById('buscador-pulmon');
    if (buscador) {
        buscador.addEventListener('input', (e) => {
            const filtro = e.target.value.toLowerCase();
            const filas = document.querySelectorAll('.fila-pulmon');
            filas.forEach(fila => {
                const texto = fila.getAttribute('data-texto');
                if (texto.includes(filtro)) {
                    fila.style.display = '';
                } else {
                    fila.style.display = 'none';
                }
            });
        });
    }
}

// Devuelve días hasta el vencimiento; MM/AA y AAAA-MM se interpretan como fin de mes.
function diasHastaVencimientoPulmon(valor) {
    if (!valor) return null;
    const s = String(valor).trim();
    let fecha = null;
    let m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
    if (m) {
        const anio = Number(m[1]), mes = Number(m[2]);
        if (mes < 1 || mes > 12) return null;
        const dia = m[3] ? Number(m[3]) : new Date(anio, mes, 0).getDate();
        fecha = new Date(anio, mes - 1, dia);
    } else if ((m = s.match(/^(\d{1,2})[\/\-](\d{2,4})$/))) {
        const mes = Number(m[1]); let anio = Number(m[2]);
        if (anio < 100) anio += 2000;
        if (mes < 1 || mes > 12) return null;
        fecha = new Date(anio, mes, 0);
    } else if ((m = s.match(/^([a-z]{3})[\s\-\/]+(\d{2,4})$/i))) {
        const meses = {ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};
        const nombre = m[1].toLowerCase();
        let anio = Number(m[2]); if (anio < 100) anio += 2000;
        if (meses[nombre] === undefined) return null;
        fecha = new Date(anio, meses[nombre] + 1, 0);
    } else {
        const parsed = new Date(s);
        if (!Number.isNaN(parsed.getTime())) fecha = parsed;
    }
    if (!fecha || Number.isNaN(fecha.getTime())) return null;
    fecha.setHours(0,0,0,0);
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    return Math.floor((fecha.getTime() - hoy.getTime()) / 86400000);
}
window.enviarPulmonARecarga = async function(dbId, etiqueta) {
    if (!confirm(`El extintor "${etiqueta}" está vencido o le quedan 30 días o menos. ¿Confirmás enviarlo a recarga y retirarlo del stock disponible?`)) return;
    try {
        const { data: equipo, error: errorEquipo } = await clienteSupabase
            .from('Extintores').select('id,PRP,alveolo_id').eq('id', dbId).maybeSingle();
        if (errorEquipo || !equipo) throw new Error(errorEquipo?.message || 'No se encontró el extintor.');
        if (!/pulm[oó]n/i.test(String(equipo.PRP || ''))) throw new Error('El equipo ya no figura en el Pulmón; actualizá la vista antes de continuar.');

        const ahora = new Date().toISOString();
        const { error: errorEstado } = await clienteSupabase.from('Extintores')
            .update({ PRP: 'En Recarga', UBICACION: 'EN RECARGA', alveolo_id: null })
            .eq('id', dbId).in('PRP', ['En Pulmon', 'En Pulmón']);
        if (errorEstado) throw new Error(errorEstado.message);

        if (equipo.alveolo_id) {
            const { error: errorAlveolo } = await clienteSupabase.from('pulmon_alveolos')
                .update({ estado: 'Libre', activo_extintor_id: null, actualizado_en: ahora })
                .eq('id', equipo.alveolo_id).eq('activo_extintor_id', Number(dbId));
            if (errorAlveolo) {
                throw new Error('El equipo quedó marcado En Recarga, pero no se pudo liberar su alvéolo. Revisá el inventario antes de repetir la operación: ' + errorAlveolo.message);
            }
        }
        alert(`Se registró ${etiqueta} como En Recarga y dejó de estar disponible para reemplazos. Registrá el envío físico a Vertoles según el procedimiento de planta.`);
        window.cargarModulo('pulmon');
    } catch (err) {
        alert('No se pudo registrar el envío a recarga: ' + err.message);
    }
};

// ==========================================
// FUNCIÓN INVERSA: El proveedor trae el extintor recargado
// ==========================================
window.marcarRecibidoPulmon = async function(dbId, etiqueta) {
    if (!confirm(`¿Confirmar que el extintor "${etiqueta}" regresó de Vertoles y vuelve al stock del Pulmón?`)) return;

    let alveoloReservado = null;
    try {
        const { data: equipo, error: errorEquipo } = await clienteSupabase
            .from('Extintores').select('id,PRP,alveolo_id').eq('id', dbId).maybeSingle();
        if (errorEquipo || !equipo) throw new Error(errorEquipo?.message || 'No se encontró el extintor.');
        if (!String(equipo.PRP || '').toLowerCase().includes('recarga')) {
            throw new Error('El equipo ya no figura En Recarga. Actualizá la vista antes de continuar.');
        }

        const { data: libre, error: errorLibre } = await clienteSupabase
            .from('pulmon_alveolos').select('id,codigo')
            .eq('estado','Libre').is('activo_extintor_id',null)
            .order('id').limit(1).maybeSingle();
        if (errorLibre) throw new Error('No se pudo buscar un alvéolo libre: ' + errorLibre.message);
        if (!libre) throw new Error('No hay alvéolos libres. No se registró la recepción; liberá o asigná una ubicación antes de reintentar.');

        // Reservar primero el alvéolo con condición para reducir el riesgo de doble asignación.
        const ahora = new Date().toISOString();
        const { data: reserva, error: errorReserva } = await clienteSupabase
            .from('pulmon_alveolos')
            .update({ estado:'Ocupado', activo_extintor_id:Number(dbId), actualizado_en:ahora })
            .eq('id', libre.id).eq('estado','Libre').is('activo_extintor_id',null)
            .select('id').maybeSingle();
        if (errorReserva || !reserva) throw new Error(errorReserva?.message || 'Otro movimiento ocupó el alvéolo elegido. Volvé a intentar.');

        alveoloReservado = libre;
        const { error: errorEstado } = await clienteSupabase
            .from('Extintores')
            .update({ PRP:'En Pulmon', UBICACION:libre.codigo, alveolo_id:libre.id })
            .eq('id', dbId).ilike('PRP','%recarga%');
        if (errorEstado) throw new Error('No se pudo actualizar el inventario: ' + errorEstado.message);

        alert(`Recepción registrada: ${etiqueta} volvió de Vertoles y quedó asignado al alvéolo ${libre.codigo} del Pulmón.`);
        window.cargarModulo('pulmon');
    } catch (err) {
        if (alveoloReservado) {
            await clienteSupabase.from('pulmon_alveolos')
                .update({ estado:'Libre', activo_extintor_id:null, actualizado_en:new Date().toISOString() })
                .eq('id', alveoloReservado.id).eq('activo_extintor_id', Number(dbId));
        }
        alert('No se pudo completar la recepción: ' + err.message);
    }
};

function escHtmlPulmon(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Cierra el ciclo temporal, registra el movimiento de devolución y recién entonces libera el stock.
window.registrarDevolucionReemplazo = async function(id) {
    const bombero = document.getElementById(`bombero-devolucion-${id}`)?.value || '';
    const estadoTitular = document.getElementById(`estado-titular-${id}`)?.value || '';
    const estadoProvisorio = document.getElementById(`estado-provisorio-${id}`)?.value || '';
    const observaciones = document.getElementById(`obs-devolucion-${id}`)?.value || '';
    if (!bombero) { alert('Seleccioná el bombero que devuelve el provisorio.'); return; }
    if (!confirm('¿Confirmás la devolución del provisorio al Pulmón? Se registrará el movimiento y se actualizará su estado de inventario.')) return;

    try {
        const { data: ciclo, error: errorCiclo } = await clienteSupabase
            .from('reemplazos_temporales_extintores')
            .select('*').eq('id', id).eq('estado','Activo').single();
        if (errorCiclo || !ciclo) throw new Error(errorCiclo?.message || 'El reemplazo ya no está activo.');
        if (!ciclo.inventario_reemplazo_id) throw new Error('Este ciclo no tiene asociado un ID de inventario Pulmón; no se puede liberar automáticamente.');

        const ahora = new Date().toISOString();
        const { error: errorMovimiento } = await clienteSupabase
            .from('movimientos_reemplazos_extintores')
            .insert({
                reemplazo_id: ciclo.id,
                tipo_movimiento: 'Devolucion',
                activo_titular_id: ciclo.activo_titular_id,
                inventario_reemplazo_id: ciclo.inventario_reemplazo_id,
                bombero,
                fecha_hora: ahora,
                estado_titular: estadoTitular,
                estado_reemplazo: estadoProvisorio,
                observaciones: observaciones || null
            });
        if (errorMovimiento) throw new Error('No se registró el movimiento de devolución: ' + errorMovimiento.message);

        const prpNuevo = estadoProvisorio === 'Operativo' ? 'En Pulmon' : estadoProvisorio === 'A recarga' ? 'En Recarga' : 'Fuera de servicio';
        const { error: errorStock } = await clienteSupabase
            .from('Extintores').update({ PRP: prpNuevo })
            .eq('id', ciclo.inventario_reemplazo_id).eq('PRP','Instalado como provisorio');
        if (errorStock) throw new Error('Movimiento guardado, pero no se pudo actualizar el inventario: ' + errorStock.message);

        // Si el extintor vuelve operativo, asignarlo al primer alvéolo libre.
        if (prpNuevo === 'En Pulmon') {
            const { data: libre, error: errorLibre } = await clienteSupabase
                .from('pulmon_alveolos').select('id,codigo').eq('estado','Libre').is('activo_extintor_id',null).order('id').limit(1).maybeSingle();
            if (errorLibre) throw new Error('El extintor volvió al stock, pero no se pudo buscar un alvéolo libre: ' + errorLibre.message);
            if (!libre) throw new Error('El extintor volvió al stock, pero no quedan alvéolos libres. Hay que asignar una ubicación antes de continuar.');
            const { error: errorAsignacion } = await clienteSupabase.from('Extintores')
                .update({ alveolo_id: libre.id, UBICACION: libre.codigo })
                .eq('id', ciclo.inventario_reemplazo_id);
            if (errorAsignacion) throw new Error('No se pudo asignar ubicación al extintor devuelto: ' + errorAsignacion.message);
            const { error: errorOcupar } = await clienteSupabase.from('pulmon_alveolos')
                .update({ estado:'Ocupado', activo_extintor_id:Number(ciclo.inventario_reemplazo_id), actualizado_en:ahora })
                .eq('id',libre.id).eq('estado','Libre');
            if (errorOcupar) throw new Error('El extintor fue asignado pero no se pudo marcar el alvéolo como ocupado: ' + errorOcupar.message);
        } else {
            // En recarga o fuera de servicio no ocupa un alvéolo de stock disponible.
            await clienteSupabase.from('Extintores').update({ alveolo_id:null, UBICACION: prpNuevo === 'En Recarga' ? 'EN RECARGA' : 'FUERA DE SERVICIO' }).eq('id', ciclo.inventario_reemplazo_id);
        }

        const { error: errorCerrar } = await clienteSupabase
            .from('reemplazos_temporales_extintores')
            .update({
                estado: 'Finalizado',
                fecha_fin: ahora.slice(0,10),
                fecha_hora_fin: ahora,
                responsable_fin: bombero,
                bombero_devuelve_reemplazo_id: bombero,
                actualizado_en: ahora,
                observaciones: [ciclo.observaciones, observaciones].filter(Boolean).join(' | ') || null
            })
            .eq('id', ciclo.id).eq('estado','Activo');
        if (errorCerrar) throw new Error('El stock fue actualizado, pero no se pudo cerrar el ciclo: ' + errorCerrar.message);

        alert('Devolución registrada. El provisorio volvió al estado de inventario correspondiente.');
        window.cargarModulo('pulmon');
    } catch (err) {
        alert('No se pudo completar la devolución: ' + err.message + '. Verificá el ciclo y el inventario antes de repetir la operación.');
    }
};
