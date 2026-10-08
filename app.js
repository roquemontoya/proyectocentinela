// ==========================================
// SCRIPT PRINCIPAL: app.js (Controlador PWA Definitivo)
// ==========================================

import { cargarModuloAdminCsv } from './conversorMaestroUniversal.js';
import { cargarModuloGestorTablas } from './gestorTablas.js';

// 1. EXPONER TODAS LAS FUNCIONES GLOBALES QUE EL HTML LLAMA POR ONCLICK
window.toggleMenu = function() {
    const sidebar = document.querySelector('aside') || document.querySelector('.sidebar') || document.querySelector('.modules-sidebar') || document.querySelector('#sidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
        sidebar.classList.toggle('open');
        if (sidebar.style.display === 'block') {
            sidebar.style.display = 'none';
        } else {
            sidebar.style.display = 'block';
        }
    }
};

window.irInicio = function() {
    const contenedorPrincipal = document.getElementById('contenedor-principal');
    if (contenedorPrincipal) {
        contenedorPrincipal.innerHTML = ''; // Limpia el módulo actual y vuelve al panel principal
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // 2. Contenedor principal de la PWA
    let contenedorPrincipal = document.getElementById('contenedor-principal');
    if (!contenedorPrincipal) {
        contenedorPrincipal = document.createElement('main');
        contenedorPrincipal.id = 'contenedor-principal';
        contenedorPrincipal.style.cssText = 'flex: 1; height: 100vh; overflow: hidden; position: relative; background: #121212;';
        document.body.appendChild(contenedorPrincipal);
    }

    // 3. Inyectar automáticamente el botón del Gestor de Tablas en el menú lateral existente
    const sidebar = document.querySelector('aside') || document.querySelector('.modules-sidebar') || document.querySelector('.sidebar') || document.body;
    
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

    // 4. Vincular evento para el Bibliotecario (CMU)
    const linkCmu = document.getElementById('nav-cmu') || Array.from(document.querySelectorAll('a')).find(el => el.textContent.includes('CMU'));
    if (linkCmu) {
        linkCmu.addEventListener('click', (e) => {
            e.preventDefault();
            contenedorPrincipal.innerHTML = '';
            cargarModuloAdminCsv(contenedorPrincipal);
        });
    }

    // 5. Vincular evento para el Gestor Universal de Tablas
    btnGestor.addEventListener('click', (e) => {
        e.preventDefault();
        contenedorPrincipal.innerHTML = '';
        cargarModuloGestorTablas(contenedorPrincipal);
    });

    console.log('🚀 app.js definitivo: Funciones globales (toggleMenu, irInicio) y Gestor Universal activos.');
});