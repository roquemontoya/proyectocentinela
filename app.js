// ==========================================
// SCRIPT PRINCIPAL: app.js (Controlador PWA)
// ==========================================

import { cargarModuloAdminCsv } from './conversorMaestroUniversal.js';
import { cargarModuloGestorTablas } from './gestorTablas.js';
import { cargarModuloMapa } from './mapas.js';
import { cargarModuloPulmon } from './moduloPulmon.js';
import { cargarModuloBomberos } from './bomberos.js';
import { abrirControlExtintor, guardarControlExtintor } from './controlesExtintores.js';
import { abrirControlHidrante, guardarControlHidrante } from './controlesHidrantes.js';
import { cerrarFormularioControl } from './controlesBase.js';

// Control del menú lateral.
window.toggleMenu = function() {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('drawer-overlay');

    if (!menu) {
        console.error('❌ No se encontró #side-menu en el DOM.');
        return;
    }

    const isOpen = menu.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active', isOpen);
};

// Volver al dashboard principal.
window.irInicio = function() {
    const pantallaInicio = document.getElementById('main-content');
    const vistaDinamica = document.getElementById('vista-dinamica');

    if (pantallaInicio) pantallaInicio.style.display = '';
    if (vistaDinamica) {
        vistaDinamica.innerHTML = '';
        vistaDinamica.style.display = 'none';
    }

    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('drawer-overlay');
    if (menu) menu.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Funciones globales requeridas por los onclick del HTML y los popups de Leaflet.
window.cerrarFormularioControl = cerrarFormularioControl;

window.abrirFormularioControl = async function(tabla, dbId, idElemento) {
    const tablaNormalizada = String(tabla || '').toLowerCase();

    if (tablaNormalizada === 'extintores' || tablaNormalizada === 'extintor') {
        return abrirControlExtintor(dbId, idElemento);
    }

    if (tablaNormalizada === 'hidrantes' || tablaNormalizada === 'hidrante') {
        return abrirControlHidrante(dbId, idElemento);
    }

    alert(`El módulo de controles para "${tabla}" todavía no está implementado.`);
    console.warn('⚠️ No existe un formulario de control registrado para:', tabla);
};

window.guardarControl = async function(event) {
    const tabla = String(document.getElementById('input-tabla')?.value || '').toLowerCase();

    if (tabla === 'extintores' || tabla === 'extintor') {
        return guardarControlExtintor(event);
    }

    if (tabla === 'hidrantes' || tabla === 'hidrante') {
        return guardarControlHidrante(event);
    }

    alert(`No existe un guardado de control implementado para "${tabla}".`);
};

// Enrutador único de la PWA.
// index.html utiliza onclick="cargarModulo('...')", por eso debe existir en window.
window.cargarModulo = async function(modulo) {
    const pantallaInicio = document.getElementById('main-content');
    const vistaDinamica = document.getElementById('vista-dinamica');
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('drawer-overlay');

    if (!vistaDinamica) {
        console.error('❌ No se encontró #vista-dinamica en el DOM.');
        return;
    }

    if (pantallaInicio) pantallaInicio.style.display = 'none';
    vistaDinamica.style.display = 'block';
    vistaDinamica.innerHTML = '';

    if (menu) menu.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

    try {
        switch (modulo) {
            case 'adminCsv':
                cargarModuloAdminCsv(vistaDinamica);
                break;

            case 'gestorTablas':
                cargarModuloGestorTablas(vistaDinamica);
                break;

            case 'pulmon':
                await cargarModuloPulmon(vistaDinamica);
                break;

            case 'bomberos':
                await cargarModuloBomberos(vistaDinamica);
                break;

            case 'ecas':
            case 'extintores':
            case 'hidrantes':
            case 'valvulas':
            case 'vecas':
            case 'pecas':
            case 'ipp':
                await cargarModuloMapa(modulo, vistaDinamica);
                break;

            default:
                vistaDinamica.innerHTML = `
                    <div style="padding: 40px; text-align: center; color: #ef4444; font-family: Arial, sans-serif;">
                        ❌ Módulo no reconocido: <strong>${modulo}</strong>
                    </div>
                `;
                console.error('❌ Módulo no reconocido:', modulo);
        }
    } catch (error) {
        console.error(`❌ Error cargando el módulo "${modulo}":`, error);
        vistaDinamica.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #ef4444; font-family: Arial, sans-serif;">
                ❌ Error al cargar el módulo: ${error.message}
            </div>
        `;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const menu = document.getElementById('side-menu');
    const listaMenu = menu ? menu.querySelector('.drawer-list') : null;

    if (!listaMenu) {
        console.error('❌ No se encontró .drawer-list dentro de #side-menu.');
        return;
    }

    // El Gestor de Tablas pertenece al menú real, no al body ni a un sidebar inexistente.
    let btnGestor = document.getElementById('nav-gestor-tablas');
    if (!btnGestor) {
        btnGestor = document.createElement('li');
        btnGestor.id = 'nav-gestor-tablas';
        btnGestor.textContent = '🎛️ Gestor de Tablas';
        btnGestor.style.cssText = 'color: #38bdf8; font-weight: bold; border-left: 3px solid #38bdf8; margin-top: 8px; background: rgba(56, 189, 248, 0.08); cursor: pointer;';
        listaMenu.appendChild(btnGestor);
    }

    btnGestor.onclick = (e) => {
        e.preventDefault();
        window.cargarModulo('gestorTablas');
    };

    // El CMU ya es un <li> con onclick en index.html.
    // No agregamos otro listener para evitar ejecuciones duplicadas.
    const itemCmu = Array.from(listaMenu.querySelectorAll('li'))
        .find(el => el.textContent.includes('CMU'));

    if (itemCmu) {
        itemCmu.id = 'nav-cmu';
    }

    console.log('🚀 Centinela 2.0: enrutador y navegación inicializados.');
});
