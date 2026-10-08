// ==========================================
// SCRIPT PRINCIPAL: app.js (Controlador PWA Definitivo)
// ==========================================

import { cargarModuloAdminCsv } from './conversorMaestroUniversal.js';
import { cargarModuloGestorTablas } from './gestorTablas.js';

// 1. CONTROL DEL DRAWER LATERAL
// index.html define #side-menu.side-drawer y #drawer-overlay.overlay.
// style.css controla la apertura mediante .open y .active respectivamente.
window.toggleMenu = function() {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('drawer-overlay');

    if (!menu) {
        console.error('❌ No se encontró #side-menu en el DOM.');
        return;
    }

    const isOpen = menu.classList.toggle('open');
    if (overlay) {
        overlay.classList.toggle('active', isOpen);
    }
};

// 2. FUNCIÓN GLOBAL PARA EL BOTÓN DE INICIO
window.irInicio = function() {
    const pantallaInicio = document.getElementById('main-content');
    const vistaDinamica = document.getElementById('vista-dinamica');

    // Restaurar la pantalla principal real definida en index.html.
    if (pantallaInicio) {
        pantallaInicio.style.display = '';
    }

    // Ocultar y limpiar el contenido del módulo actualmente abierto.
    if (vistaDinamica) {
        vistaDinamica.innerHTML = '';
        vistaDinamica.style.display = 'none';
    }

    // Cerrar el menú lateral si estaba abierto.
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('drawer-overlay');
    if (menu) menu.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.addEventListener('DOMContentLoaded', () => {
    // 3. Contenedor principal de la PWA
    let contenedorPrincipal = document.getElementById('contenedor-principal');
    if (!contenedorPrincipal) {
        contenedorPrincipal = document.createElement('main');
        contenedorPrincipal.id = 'contenedor-principal';
        contenedorPrincipal.style.cssText = 'flex: 1; height: 100vh; overflow: hidden; position: relative; background: #121212;';
        document.body.appendChild(contenedorPrincipal);
    }

    // 4. Inyectar automáticamente el botón del Gestor de Tablas en el menú lateral
    const sidebar = document.querySelector('.sidebar') || document.querySelector('aside') || document.querySelector('#sidebar') || document.body;
    
    let btnGestor = document.getElementById('nav-gestor-tablas');
    if (!btnGestor) {
        btnGestor = document.createElement('a');
        btnGestor.href = '#';
        btnGestor.id = 'nav-gestor-tablas';
        btnGestor.className = 'menu-item';
        btnGestor.innerHTML = '🎛️ Gestor de Tablas';
        btnGestor.style.cssText = 'color: #38bdf8; font-weight: bold; display: block; padding: 12px 15px; text-decoration: none; border-left: 3px solid #38bdf8; margin-top: 8px; background: rgba(56, 189, 248, 0.08); cursor: pointer; font-family: Arial, sans-serif; font-size: 13px;';
        
        const linkCmu = document.getElementById('nav-cmu') || sidebar.querySelector('[href*="CMU"]') || sidebar.querySelector('a');
        if (linkCmu && linkCmu.parentNode) {
            linkCmu.parentNode.insertBefore(btnGestor, linkCmu.nextSibling);
        } else {
            sidebar.appendChild(btnGestor);
        }
    }

    // 5. Vincular evento para el Bibliotecario (CMU)
    const linkCmu = document.getElementById('nav-cmu') || Array.from(document.querySelectorAll('a')).find(el => el.textContent.includes('CMU'));
    if (linkCmu) {
        linkCmu.addEventListener('click', (e) => {
            e.preventDefault();
            contenedorPrincipal.innerHTML = '';
            cargarModuloAdminCsv(contenedorPrincipal);
        });
    }

    // 6. Vincular evento para el Gestor Universal de Tablas
    btnGestor.addEventListener('click', (e) => {
        e.preventDefault();
        contenedorPrincipal.innerHTML = '';
        cargarModuloGestorTablas(contenedorPrincipal);
    });

    console.log('🚀 app.js reparado: toggleMenu y Gestor Universal enlazados.');
});