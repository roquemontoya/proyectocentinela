// ==========================================
// MÓDULO: Gestión de Pulmón y Reserva (Extintores)
// ==========================================

import { clienteSupabase } from './supabaseClient.js';

export async function cargarModuloPulmon(contenedor) {
    // Configurar el contenedor para que sea una vista con scroll (sin mapa)
    contenedor.style.width = '100%';
    contenedor.style.padding = '20px';
    contenedor.style.boxSizing = 'border-box';
    contenedor.style.overflowY = 'auto';
    contenedor.style.height = 'calc(100vh - 65px)';
    contenedor.style.backgroundColor = '#121212';
    
    contenedor.innerHTML = `<div style="text-align: center; color: #fff; font-family: Arial; padding: 40px; font-size: 16px;">🔄 Cargando inventario del Pulmón...</div>`;

    // 1. Traer todos los extintores que NO estén en planta (que estén en pulmón o recarga)
    const { data, error } = await clienteSupabase
        .from('Extintores')
        .select('*')
        .neq('PRP', 'En Planta');

    if (error) {
        contenedor.innerHTML = `<div style="color: #ef4444; padding: 20px; font-family: Arial;">Error al cargar el pulmón: ${error.message}</div>`;
        return;
    }

    // Normalizar por si hay textos en minúsculas/mayúsculas o acentos
    const inventario = (data || []).filter(item => {
        const prp = item.PRP ? item.PRP.toLowerCase() : '';
        return prp.includes('pulmon') || prp.includes('pulmón') || prp.includes('recarga');
    });

    const totalPulmon = inventario.filter(i => (i.PRP || '').toLowerCase().includes('pulmon')).length;
    const totalRecarga = inventario.filter(i => (i.PRP || '').toLowerCase().includes('recarga')).length;

    let html = `
        <div style="max-width: 1000px; margin: 0 auto; color: #fff; font-family: Arial, sans-serif;">
            
            <!-- Encabezado y Contadores -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                <h2 style="margin: 0; color: #38bdf8;">📦 Inventario de Pulmón y Recarga</h2>
                <div style="display: flex; gap: 15px;">
                    <span style="background: #22c55e; color: #000; padding: 6px 12px; border-radius: 5px; font-weight: bold; font-size: 14px;">En Pulmón: ${totalPulmon}</span>
                    <span style="background: #eab308; color: #000; padding: 6px 12px; border-radius: 5px; font-weight: bold; font-size: 14px;">En Recarga: ${totalRecarga}</span>
                </div>
            </div>

            <!-- Buscador en tiempo real -->
            <input type="text" id="buscador-pulmon" placeholder="🔍 Buscar por etiqueta, sector o tipo de extintor..." style="width: 100%; padding: 12px; margin-bottom: 20px; background: #2a2a2a; border: 1px solid #444; color: #fff; border-radius: 5px; box-sizing: border-box; font-size: 14px;">

            <!-- Tabla de Datos -->
            <div style="overflow-x: auto; background: #1e1e1e; border: 1px solid #333; border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                    <thead>
                        <tr style="background: #2a2a2a; border-bottom: 2px solid #444;">
                            <th style="padding: 14px; text-align: left; color: #aaa; font-size: 13px;">ETIQUETA / ID</th>
                            <th style="padding: 14px; text-align: left; color: #aaa; font-size: 13px;">TIPO</th>
                            <th style="padding: 14px; text-align: left; color: #aaa; font-size: 13px;">VENCIMIENTO</th>
                            <th style="padding: 14px; text-align: left; color: #aaa; font-size: 13px;">ESTADO (PRP)</th>
                            <th style="padding: 14px; text-align: center; color: #aaa; font-size: 13px;">ACCIÓN</th>
                        </tr>
                    </thead>
                    <tbody id="tabla-body-pulmon">
    `;

    if (inventario.length === 0) {
        html += `<tr><td colspan="5" style="padding: 30px; text-align: center; color: #888;">No hay extintores registrados en el pulmón o en recarga.</td></tr>`;
    } else {
        inventario.forEach(ext => {
            const etiqueta = ext.Etiquetas || ext.etiquetas || ext.NombreEtiqueta || ext.NombreDeEtiqueta || `Ext #${ext.id}`;
            const tipo = ext.TipoExtintor || ext['Tipo de Extintor'] || 'N/D';
            const vencimiento = ext.Vencimiento || 'N/D';
            const prp = ext.PRP || 'N/D';
            
            let colorPrp = '#22c55e'; // Verde para Pulmón
            if (prp.toLowerCase().includes('recarga')) colorPrp = '#eab308'; // Amarillo para Recarga

            // Atributo 'data-texto' invisible para el motor de búsqueda
            const textoBusqueda = `${etiqueta} ${tipo} ${vencimiento} ${prp}`.toLowerCase();

            html += `
                <tr class="fila-pulmon" data-texto="${textoBusqueda}" style="border-bottom: 1px solid #333; transition: background 0.2s;">
                    <td style="padding: 14px; font-weight: bold;">${etiqueta}</td>
                    <td style="padding: 14px; color: #38bdf8;">${tipo}</td>
                    <td style="padding: 14px; color: #ccc;">${vencimiento}</td>
                    <td style="padding: 14px;">
                        <span style="background: ${colorPrp}; color: #000; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${prp.toUpperCase()}</span>
                    </td>
                    <td style="padding: 14px; text-align: center;">
                        <button onclick="window.abrirFormularioControl('Extintores', '${ext.id}', '${etiqueta.replace(/'/g, "\\'")}')" style="background: #2a2a2a; color: #fff; border: 1px solid #555; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: 0.2s;">✏️ Auditar</button>
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

    // 2. Lógica del buscador en tiempo real
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