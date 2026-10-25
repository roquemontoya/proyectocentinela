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

    // Alta de reemplazo: seleccionar titular y extintor real disponible en Pulmón.
    const { data: titularesReemplazo, error: errTitulares } = await clienteSupabase
        .from('leu').select('id,etiqueta,sector,atributos_tecnicos').ilike('categoria','%extintor%').order('etiqueta');
    const { data: stockReemplazo, error: errStock } = await clienteSupabase
        .from('Extintores').select('id,ETIQUETA,TIPO,numero_serie,numero_tarjeta,activo_leu_id,alveolo_id,UBICACION,PRP')
        .in('PRP',['En Pulmon','En Pulmón']).not('activo_leu_id','is',null).not('alveolo_id','is',null).order('ETIQUETA');
    const { data: responsablesReemplazo } = await clienteSupabase.from('Bomberos').select('Bombero').eq('Estado','Activo').order('Bombero');
    const titularesElegibles = (titularesReemplazo || []).filter(t => !((t.atributos_tecnicos || {}).reemplazo_temporal_id));
    if (errTitulares || errStock) {
        contenedor.insertAdjacentHTML('beforeend', '<p style="color:#f87171;max-width:1100px;margin:18px auto">No se pudo preparar el formulario de instalación. Revisá los permisos y actualizá el módulo.</p>');
    } else {
        const sectionInstalacion = document.createElement('section');
        sectionInstalacion.style.cssText = 'max-width:1100px;margin:24px auto;padding:18px;background:#1e1e1e;border:1px solid #444;border-radius:8px;color:#fff;font-family:Arial,sans-serif';
        sectionInstalacion.innerHTML = `
          <h2 style="color:#38bdf8;margin-top:0">↔️ Instalar reemplazo temporal</h2>
          <p style="color:#bbb">La operación registra el movimiento, libera el alvéolo y bloquea el extintor hasta su devolución. No se modifica la identidad de ninguno de los activos.</p>
          <label style="display:block;margin:10px 0 5px">Extintor titular a cubrir</label>
          <select id="pulmon-titular-select" style="width:100%;padding:10px;background:#111;color:#fff;border:1px solid #555;border-radius:5px">
            <option value="">Seleccionar titular…</option>
            ${titularesElegibles.map(t => `<option value="${t.id}">${escHtmlPulmon(t.etiqueta)} · ${escHtmlPulmon(t.sector || 'Sin sector')} · LEU ${t.id}</option>`).join('')}
          </select>
          <label style="display:block;margin:10px 0 5px">Extintor disponible en Pulmón</label>
          <select id="pulmon-reemplazo-select" style="width:100%;padding:10px;background:#111;color:#fff;border:1px solid #555;border-radius:5px">
            <option value="">Seleccionar extintor del Pulmón…</option>
            ${(stockReemplazo || []).map(e => `<option value="${e.id}">${escHtmlPulmon(e.ETIQUETA || ('ID '+e.id))} · ${escHtmlPulmon(e.TIPO || 'Tipo N/D')} · Serie ${escHtmlPulmon(e.numero_serie || 'N/D')} · Alvéolo ${escHtmlPulmon(e.UBICACION || e.alveolo_id)}</option>`).join('')}
          </select>
          <label style="display:block;margin:10px 0 5px">Responsable que entrega</label>
          <select id="pulmon-responsable-select" style="width:100%;padding:10px;background:#111;color:#fff;border:1px solid #555;border-radius:5px">
            <option value="">Seleccionar bombero…</option>
            ${(responsablesReemplazo || []).map(b => `<option value="${escHtmlPulmon(b.Bombero)}">${escHtmlPulmon(b.Bombero)}</option>`).join('')}
          </select>
          <label style="display:block;margin:10px 0 5px">Motivo del reemplazo</label>
          <input id="pulmon-motivo-input" placeholder="Ej.: titular vencido, enviado a recarga, daño detectado…" style="width:100%;box-sizing:border-box;padding:10px;background:#111;color:#fff;border:1px solid #555;border-radius:5px">
          <label style="display:block;margin:10px 0 5px">Observaciones (opcional)</label>
          <input id="pulmon-obs-instalacion" placeholder="Novedad, orden o referencia documental…" style="width:100%;box-sizing:border-box;padding:10px;background:#111;color:#fff;border:1px solid #555;border-radius:5px">
          <button id="pulmon-confirmar-instalacion" style="margin-top:14px;background:#0284c7;color:#fff;border:0;padding:11px 16px;border-radius:5px;font-weight:bold;cursor:pointer">Registrar instalación y movimiento</button>
          <p style="color:#aaa;font-size:12px;margin-bottom:0">Disponibles: ${(stockReemplazo || []).length}. Titulares elegibles en LEU: ${titularesElegibles.length}.</p>
        `;
        contenedor.appendChild(sectionInstalacion);
        sectionInstalacion.querySelector('#pulmon-confirmar-instalacion').addEventListener('click', async () => {
            const titularId = Number(sectionInstalacion.querySelector('#pulmon-titular-select').value);
            const reemplazoId = Number(sectionInstalacion.querySelector('#pulmon-reemplazo-select').value);
            const responsable = sectionInstalacion.querySelector('#pulmon-responsable-select').value;
            const motivo = sectionInstalacion.querySelector('#pulmon-motivo-input').value.trim();
            const observaciones = sectionInstalacion.querySelector('#pulmon-obs-instalacion').value.trim();
            if (!titularId || !reemplazoId || !responsable || !motivo) return alert('Seleccioná titular, extintor del Pulmón, responsable e indicá el motivo.');
            if (titularId === Number((stockReemplazo || []).find(e => e.id === reemplazoId)?.activo_leu_id)) return alert('No se puede reemplazar un activo por sí mismo.');
            if (!confirm('¿Confirmás la instalación temporal? Se registrarán los movimientos del titular y del provisorio en una única transacción.')) return;
            const boton = sectionInstalacion.querySelector('#pulmon-confirmar-instalacion');
            boton.disabled = true; boton.textContent = 'Registrando…';
            try {
                const { data, error } = await clienteSupabase.rpc('registrar_instalacion_reemplazo_pulmon', {
                    p_activo_titular_id: titularId,
                    p_inventario_reemplazo_id: reemplazoId,
                    p_bombero: responsable,
                    p_motivo: motivo,
                    p_tipo_titular: 'Extintor titular',
                    p_tipo_reemplazo: 'Extintor Pulmón',
                    p_observaciones: observaciones || null
                });
                if (error) throw new Error(error.message);
                if (!data?.ok) throw new Error('La base de datos no confirmó el movimiento.');
                alert('Reemplazo registrado. El alvéolo quedó libre y el extintor del Pulmón está bloqueado hasta registrar su devolución.');
                window.cargarModulo('pulmon');
            } catch (err) {
                alert('No se registró el reemplazo. No se deberían haber aplicado cambios: ' + (err.message || err));
                boton.disabled = false; boton.textContent = 'Registrar instalación y movimiento';
            }
        });
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
        const { data: equipoActualizado, error: errorEstado } = await clienteSupabase
            .from('Extintores')
            .update({ PRP:'En Pulmon', UBICACION:libre.codigo, alveolo_id:libre.id })
            .eq('id', dbId).ilike('PRP','%recarga%').select('id').maybeSingle();
        if (errorEstado || !equipoActualizado) throw new Error(errorEstado?.message || 'El equipo ya no estaba En Recarga; se canceló la recepción.');

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

    if (!bombero) {
        alert('Seleccioná el bombero que devuelve el provisorio.');
        return;
    }
    if (!confirm('¿Confirmás la devolución del provisorio al Pulmón? Se registrará el movimiento y se actualizará su estado de inventario.')) return;

    try {
        // Una sola RPC de base de datos hace toda la devolución en una transacción:
        // reserva el alvéolo, actualiza el stock, registra el movimiento y cierra el ciclo.
        const { data, error } = await clienteSupabase.rpc('registrar_devolucion_reemplazo_pulmon', {
            p_ciclo_id: Number(id),
            p_bombero: bombero,
            p_estado_titular: estadoTitular,
            p_estado_reemplazo: estadoProvisorio,
            p_observaciones: observaciones || null
        });
        if (error) throw new Error(error.message || 'La base de datos rechazó la devolución.');
        if (!data?.ok) throw new Error('La base de datos no confirmó la devolución.');

        const destino = data.estado === 'En Pulmon'
            ? `Pulmón, alvéolo ${data.alveolo_codigo || data.alveolo_id}`
            : data.estado;
        alert(`Devolución registrada correctamente. El provisorio quedó en: ${destino}. El movimiento y el cierre del ciclo se guardaron juntos.`);
        window.cargarModulo('pulmon');
    } catch (err) {
        alert('No se completó la devolución. La operación se revirtió y no debe repetirse sin revisar el mensaje: ' + (err.message || err));
    }
};
