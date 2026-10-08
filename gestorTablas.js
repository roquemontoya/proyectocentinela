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

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; font-size: 12px; font-weight: bold; margin-bottom: 5px; color: #38bdf8;">Seleccionar Tabla:</label>
                    <select id="select-tabla-activa" style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; font-size: 13px;">
                        ${opcionesHtml}
                    </select>
                </div>
                <div>
                    <label style="display: block; font-size: 12px; font-weight: bold; margin-bottom: 5px; color: #38bdf8;">Buscar en registros:</label>
                    <input type="text" id="input-filtro-tabla" placeholder="Filtro rápido..." style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; font-size: 13px; box-sizing: border-box;">
                </div>
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
                    <input type="text" data-col="${col}" value="${valor !== null ? encodeURI(String(valor)) : ''}" ${esId ? 'disabled' : ''} 
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
                        let valDecodificado = decodeURI(input.value);
                        objetoActualizacion[col] = valDecodificado === '' ? null : valDecodificado;
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

    cargarRegistrosTabla('leu');
}