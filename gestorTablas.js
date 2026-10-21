// ==========================================
// MÓDULO: GESTOR UNIVERSAL DE TODAS LAS TABLAS (PWA)
// ==========================================

import { clienteSupabase } from './supabaseClient.js';

const TABLAS_DISPONIBLES = [
    { nombre: 'Enciclopedia Universal (LEU)', valor: 'leu' },
    { nombre: 'Anomalías Centralizadas', valor: 'anomalias' },
    { nombre: 'Controles Extintores (controles_e)', valor: 'controles_e' },
    { nombre: 'Controles Hidrantes (controles_h)', valor: 'controles_h' },
    { nombre: 'Controles Válvulas (controles_v)', valor: 'controles_v' },
    { nombre: 'Controles ECAS (controles_ecas)', valor: 'controles_ecas' },
    { nombre: 'Controles VECAS (controles_vecas)', valor: 'controles_vecas' },
    { nombre: 'Controles Ceniceros (controles_c)', valor: 'controles_c' },
    { nombre: 'Controles Puertas Cortafuego (controles_pc)', valor: 'controles_pc' },
    { nombre: 'Controles Espumígenos (controles_es)', valor: 'controles_es' },
    { nombre: 'Controles Permisos Fuego (controles_pfp)', valor: 'controles_pfp' }
];

export function cargarModuloGestorTablas(contenedor) {
    contenedor.style.width = '100%';
    contenedor.style.padding = '20px';
    contenedor.style.boxSizing = 'border-box';
    contenedor.style.overflowY = 'auto';
    contenedor.style.height = 'calc(100vh - 65px)';
    contenedor.style.backgroundColor = '#121212';

    let opcionesHtml = '';
    TABLAS_DISPONIBLES.forEach(t => {
        opcionesHtml += `<option value="${t.valor}">${t.nombre} (${t.valor})</option>`;
    });

    contenedor.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto; color: #fff; font-family: Arial, sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h2 style="color: #38bdf8; margin: 0;">🎛️ Gestor Universal de Bases de Datos</h2>
                <button id="btn-recargar-tabla" style="background: #2563eb; color: #fff; border: none; padding: 8px 14px; border-radius: 5px; font-weight: bold; cursor: pointer;">🔄 Actualizar Vista</button>
            </div>
            
            <p style="color: #aaa; font-size: 13px; margin-bottom: 20px;">
                Selecciona cualquier tabla del sistema para auditar, corregir campos específicos o eliminar registros erróneos en tiempo real.
            </p>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 12px;">
                <div>
                    <label style="display: block; font-size: 12px; font-weight: bold; margin-bottom: 5px; color: #38bdf8;">Seleccionar Tabla:</label>
                    <select id="select-tabla-activa" style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; font-size: 13px;">
                        ${opcionesHtml}
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 12px; font-weight: bold; margin-bottom: 5px; color: #38bdf8;">Buscar universal (vista cargada):</label>
                    <input type="text" id="input-filtro-tabla" placeholder="Filtro rápido..." style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; font-size: 13px; box-sizing: border-box;">
                </div>
            </div>

            <div style="background:#17212b;border:1px solid #28506a;border-radius:7px;padding:12px;margin-bottom:15px;">
                <div style="color:#38bdf8;font-weight:bold;font-size:13px;margin-bottom:9px;">🔎 Búsqueda avanzada en la base de datos</div>
                <div style="display:grid;grid-template-columns:1.2fr 1fr 1.2fr 1.5fr auto;gap:9px;align-items:end;">
                    <div>
                        <label style="display:block;font-size:11px;color:#cbd5e1;margin-bottom:5px;">1. Tabla</label>
                        <select id="busqueda-tabla" style="width:100%;box-sizing:border-box;padding:9px;background:#2a2a2a;border:1px solid #475569;color:#fff;border-radius:5px;">${opcionesHtml}</select>
                    </div>
                    <div>
                        <label style="display:block;font-size:11px;color:#cbd5e1;margin-bottom:5px;">2. Buscar por</label>
                        <select id="busqueda-modo" style="width:100%;box-sizing:border-box;padding:9px;background:#2a2a2a;border:1px solid #475569;color:#fff;border-radius:5px;">
                            <option value="campo">Campo de tabla</option>
                            <option value="id">ID de registro</option>
                        </select>
                    </div>
                    <div id="busqueda-campo-wrap">
                        <label style="display:block;font-size:11px;color:#cbd5e1;margin-bottom:5px;">3. Campo</label>
                        <select id="busqueda-campo" style="width:100%;box-sizing:border-box;padding:9px;background:#2a2a2a;border:1px solid #475569;color:#fff;border-radius:5px;"></select>
                    </div>
                    <div>
                        <label style="display:block;font-size:11px;color:#cbd5e1;margin-bottom:5px;">4. Valor a buscar</label>
                        <input id="busqueda-valor" type="text" placeholder="Ej.: Extintor 235 CO2" style="width:100%;box-sizing:border-box;padding:9px;background:#2a2a2a;border:1px solid #475569;color:#fff;border-radius:5px;">
                    </div>
                    <button id="btn-busqueda-avanzada" style="padding:10px 13px;background:#0284c7;color:white;border:0;border-radius:5px;font-weight:bold;cursor:pointer;">Buscar</button>
                </div>
                <div id="busqueda-estado" aria-live="polite" style="font-size:12px;color:#cbd5e1;margin-top:8px;">La búsqueda avanzada consulta la tabla completa, no solo los 100 registros que muestra la vista inicial.</div>
            </div>

            <div style="background: #1e1e1e; padding: 15px; border-radius: 8px; border: 1px solid #333; max-height: 600px; overflow: auto;">
                <div id="tabla-contenedor-dinamico" style="color: #666; text-align: center; padding: 30px;">
                    Cargando registros...
                </div>
            </div>
        </div>
    `;

    let datosActuales = [];
    let tablaSeleccionada = 'leu';

    const cargarRegistrosTabla = async (nombreTabla) => {
        tablaSeleccionada = nombreTabla;
        const contenedorTabla = document.getElementById('tabla-contenedor-dinamico');
        contenedorTabla.innerHTML = `<p style="color: #888;">Cargando registros de ${nombreTabla}...</p>`;

        const { data, error } = await clienteSupabase
            .from(nombreTabla)
            .select('*')
            .order('id', { ascending: false })
            .limit(100);

        if (error) {
            contenedorTabla.innerHTML = `<p style="color: #ef4444;">❌ Error al cargar la tabla: ${error.message}</p>`;
            return;
        }

        datosActuales = data || [];
        renderizarTablaDinamica(datosActuales);
    };

    const renderizarTablaDinamica = (registros) => {
        const contenedorTabla = document.getElementById('tabla-contenedor-dinamico');
        if (registros.length === 0) {
            contenedorTabla.innerHTML = `<p style="color: #888;">La tabla está vacía.</p>`;
            return;
        }

        const columnas = Object.keys(registros[0]);

        let html = `<table style="width: 100%; border-collapse: collapse; color: #ccc; font-size: 11px; white-space: nowrap;">
            <thead>
                <tr style="background: #2a2a2a; color: #38bdf8; text-align: left;">`;
        
        columnas.forEach(col => {
            html += `<th style="padding: 8px; border: 1px solid #444;">${col}</th>`;
        });
        html += `<th style="padding: 8px; border: 1px solid #444; text-align: center; position: sticky; right: 0; background: #2a2a2a;">Acciones</th>`;
        html += `</tr></thead><tbody>`;

        registros.forEach(row => {
            html += `<tr data-id="${row.id}">`;
            columnas.forEach(col => {
                let valor = row[col];
                if (typeof valor === 'object' && valor !== null) {
                    valor = JSON.stringify(valor);
                }
                const esId = col === 'id';
                html += `<td style="padding: 6px; border: 1px solid #444;">
                    <input type="text" data-col="${col}" value="${valor !== null ? String(valor).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}" ${esId ? 'disabled' : ''} 
                    style="background: ${esId ? '#151515' : '#252525'}; border: 1px solid #444; color: ${esId ? '#38bdf8' : '#fff'}; padding: 4px; border-radius: 3px; width: 150px;">
                </td>`;
            });

            html += `<td style="padding: 6px; border: 1px solid #444; text-align: center; position: sticky; right: 0; background: #1e1e1e;">
                <button class="btn-guardar-fila" data-id="${row.id}" style="background: #22c55e; color: #000; border: none; padding: 4px 8px; border-radius: 3px; font-weight: bold; cursor: pointer; margin-right: 4px;">💾 Guardar</button>
                <button class="btn-borrar-fila" data-id="${row.id}" style="background: #ef4444; color: #fff; border: none; padding: 4px 8px; border-radius: 3px; font-weight: bold; cursor: pointer;">🗑️ Borrar</button>
            </td>`;
            html += `</tr>`;
        });

        html += `</tbody></table>`;
        contenedorTabla.innerHTML = html;

        document.querySelectorAll('.btn-guardar-fila').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const tr = e.target.closest('tr');
                const inputs = tr.querySelectorAll('input[data-col]');
                
                let objetoActualizacion = {};
                inputs.forEach(input => {
                    const col = input.getAttribute('data-col');
                    if (col !== 'id') {
                        const valorIngresado = input.value;
                        objetoActualizacion[col] = valorIngresado === '' ? null : valorIngresado;
                    }
                });

                const { error } = await clienteSupabase
                    .from(tablaSeleccionada)
                    .update(objetoActualizacion)
                    .eq('id', id);

                if (error) {
                    alert('❌ Error al actualizar: ' + error.message);
                } else {
                    alert(`✅ Registro #${id} actualizado con éxito en ${tablaSeleccionada}.`);
                }
            });
        });

        document.querySelectorAll('.btn-borrar-fila').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                const tr = e.target.closest('tr');
                if (!confirm(`¿Estás seguro de eliminar el registro ID ${id} de ${tablaSeleccionada}?`)) return;

                const { error } = await clienteSupabase
                    .from(tablaSeleccionada)
                    .delete()
                    .eq('id', id);

                if (error) {
                    alert('❌ Error al eliminar: ' + error.message);
                } else {
                    tr.remove();
                    alert(`🗑️ Registro ID ${id} eliminado correctamente.`);
                }
            });
        });
    };

    document.getElementById('select-tabla-activa').addEventListener('change', (e) => {
        cargarRegistrosTabla(e.target.value);
    });

    document.getElementById('btn-recargar-tabla').addEventListener('click', () => {
        cargarRegistrosTabla(document.getElementById('select-tabla-activa').value);
    });

    document.getElementById('input-filtro-tabla').addEventListener('input', (e) => {
        const texto = e.target.value.toLowerCase();
        const filtrados = datosActuales.filter(item => {
            return Object.values(item).some(val =>
                val !== null && String(val).toLowerCase().includes(texto)
            );
        });
        renderizarTablaDinamica(filtrados);
    });

    const selectorBusquedaTabla = document.getElementById('busqueda-tabla');
    const selectorBusquedaModo = document.getElementById('busqueda-modo');
    const selectorBusquedaCampo = document.getElementById('busqueda-campo');
    const campoWrap = document.getElementById('busqueda-campo-wrap');
    const estadoBusqueda = document.getElementById('busqueda-estado');

    const cargarCamposBusqueda = async () => {
        const tabla = selectorBusquedaTabla.value;
        selectorBusquedaCampo.innerHTML = '<option value="">Cargando campos...</option>';
        const { data, error } = await clienteSupabase.from(tabla).select('*').limit(1);
        if (error) {
            selectorBusquedaCampo.innerHTML = '<option value="">No se pudieron cargar los campos</option>';
            estadoBusqueda.textContent = 'Error al consultar la estructura: ' + error.message;
            return;
        }
        const muestra = data && data[0] ? data[0] : null;
        if (!muestra) {
            selectorBusquedaCampo.innerHTML = '<option value="">Tabla sin registros</option>';
            return;
        }
        const camposTexto = Object.keys(muestra).filter(campo =>
            campo !== 'id' && (typeof muestra[campo] === 'string' || muestra[campo] === null)
        );
        selectorBusquedaCampo.innerHTML = camposTexto.map(campo =>
            '<option value="' + campo.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '">' +
            campo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</option>'
        ).join('');
        if (!camposTexto.length) {
            selectorBusquedaCampo.innerHTML = '<option value="">No hay campos de texto detectables</option>';
        }
    };

    selectorBusquedaTabla.addEventListener('change', cargarCamposBusqueda);
    selectorBusquedaModo.addEventListener('change', () => {
        campoWrap.style.display = selectorBusquedaModo.value === 'id' ? 'none' : 'block';
    });

    const ejecutarBusquedaAvanzada = async () => {
        const tabla = selectorBusquedaTabla.value;
        const modo = selectorBusquedaModo.value;
        const valor = document.getElementById('busqueda-valor').value.trim();
        if (!valor) {
            estadoBusqueda.textContent = 'Escribí un valor para buscar.';
            return;
        }

        estadoBusqueda.textContent = 'Buscando en toda la tabla ' + tabla + '...';
        let consulta = clienteSupabase.from(tabla).select('*');
        if (modo === 'id') {
            const idNumerico = Number(valor);
            if (!Number.isInteger(idNumerico) || idNumerico < 0) {
                estadoBusqueda.textContent = 'Para buscar por ID, ingresá un número entero.';
                return;
            }
            consulta = consulta.eq('id', idNumerico);
        } else {
            const campo = selectorBusquedaCampo.value;
            if (!campo) {
                estadoBusqueda.textContent = 'Seleccioná un campo de texto.';
                return;
            }
            consulta = consulta.ilike(campo, '%' + valor + '%');
        }

        const { data, error } = await consulta.order('id', { ascending: false }).limit(1000);
        if (error) {
            estadoBusqueda.textContent = 'Error en la búsqueda: ' + error.message;
            return;
        }
        const resultados = data || [];
        renderizarTablaDinamica(resultados);
        estadoBusqueda.textContent = resultados.length
            ? 'Encontrados ' + resultados.length + ' registro(s) en ' + tabla + (resultados.length === 1000 ? ' (límite de 1000; refiná la búsqueda si hace falta).' : '.')
            : 'No se encontraron coincidencias en ' + tabla + '. Probá otro campo o término.';
    };

    document.getElementById('btn-busqueda-avanzada').addEventListener('click', ejecutarBusquedaAvanzada);
    document.getElementById('busqueda-valor').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') ejecutarBusquedaAvanzada();
    });

    cargarCamposBusqueda();
    cargarRegistrosTabla('leu');
}