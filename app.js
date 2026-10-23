// ==========================================
// SCRIPT PRINCIPAL: app.js (Controlador PWA)
// ==========================================

import { inicializarAutenticacion, verificarPermisoModulo } from './auth.js';

import { cargarModuloAdminCsv } from './conversorMaestroUniversal.js';
import { cargarModuloGestorTablas } from './gestorTablas.js';
import { cargarFormularioCorreccionEcas } from './formularioCorreccionEcas.js';
import { cargarModuloMapa, detenerModuloMapa } from './mapas.js';
import { cargarModuloGPS, detenerModuloGPS } from './gpsActivosCercanos.js';
import { cargarModuloRecorridosGPS, detenerModuloRecorridosGPS } from './recorridosGps.js';
import { cargarModuloPulmon } from './moduloPulmon.js';
import { cargarModuloBomberos } from './bomberos.js';
import { cargarModuloAnomalias } from './anomalias.js';
import { cargarModuloHistorialFotos } from './historialFotos.js';
import { cargarModuloEditorUbicaciones } from './editorUbicaciones.js';
import { cargarModuloEditorTerritorios } from './editorTerritorios.js';
import { cargarModuloPanelGeografico, detenerModuloPanelGeografico } from './panelGeograficoAdmin.js';
import { cargarModuloSimulacionControlin } from './simulacionControlin.js';
import { cargarModuloAdministracionUsuarios } from './administracionUsuarios.js';
import { abrirSeguridadCuenta } from './seguridadCuenta.js';
import { cargarModuloMiCuenta } from './miCuenta.js';
import { inicializarPreferenciasVisuales } from './preferenciasVisuales.js';
import { abrirControlExtintor, guardarControlExtintor } from './controlesExtintores.js';
import { abrirControlHidrante, guardarControlHidrante, cambiarTipoControl, verificarDetalleLlave } from './controlesHidrantes.js';
import { cerrarFormularioControl, verificarEstadoControl } from './controlesBase.js';
import { abrirControlOtro, guardarControlOtro } from './controlesOtros.js';

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
    detenerModuloGPS();
    detenerModuloRecorridosGPS();
    detenerModuloPanelGeografico();
    detenerModuloMapa();
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

// Funciones globales requeridas por los onchange/onclick del formulario dinámico.
// Las funciones importadas por módulos ES no quedan disponibles automáticamente en window.
window.cambiarTipoControl = cambiarTipoControl;
window.verificarEstadoControl = verificarEstadoControl;
window.verificarDetalleLlave = verificarDetalleLlave;
window.cerrarFormularioControl = cerrarFormularioControl;

window.abrirFormularioControl = async function(tabla, dbId, idElemento) {
    const tablaNormalizada = String(tabla || '').toLowerCase();

    if (tablaNormalizada === 'extintores' || tablaNormalizada === 'extintor') {
        return abrirControlExtintor(dbId, idElemento);
    }

    if (tablaNormalizada === 'hidrantes' || tablaNormalizada === 'hidrante') {
        return abrirControlHidrante(dbId, idElemento);
    }

    if (['ecas', 'pecas', 'vecas', 'valvulas', 'válvulas'].includes(tablaNormalizada)) {
        const modulo = tablaNormalizada === 'válvulas' ? 'valvulas' : tablaNormalizada;
        return abrirControlOtro(modulo, dbId, idElemento);
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

    if (['ecas', 'pecas', 'vecas', 'valvulas', 'válvulas'].includes(tabla)) {
        return guardarControlOtro(event);
    }

    alert(`No existe un guardado de control implementado para "${tabla}".`);
};

// Enrutador único de la PWA.
// index.html utiliza onclick="cargarModulo('...')", por eso debe existir en window.
window.cargarModulo = async function(modulo) {
    detenerModuloGPS();
    detenerModuloRecorridosGPS();
    detenerModuloMapa();
    if (modulo !== 'miCuenta' && !verificarPermisoModulo(modulo)) {
        alert('Tu rol actual no tiene permiso para acceder a este módulo.');
        return;
    }
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

            case 'anomalias':
                await cargarModuloAnomalias(vistaDinamica);
                break;

            case 'historialFotos':
                await cargarModuloHistorialFotos(vistaDinamica);
                break;

            case 'editorUbicaciones':
                await cargarModuloEditorUbicaciones(vistaDinamica);
                break;

            case 'editorTerritorios':
                await cargarModuloEditorTerritorios(vistaDinamica);
                break;

            case 'gps':
                await cargarModuloGPS(vistaDinamica);
                break;

            case 'recorridosGps':
                await cargarModuloRecorridosGPS(vistaDinamica);
                break;

            case 'panelGeografico':
                await cargarModuloPanelGeografico(vistaDinamica);
                break;

            case 'simulacionControlin':
                await cargarModuloSimulacionControlin(vistaDinamica);
                break;

            case 'administracionUsuarios':
                await cargarModuloAdministracionUsuarios(vistaDinamica);
                break;

            case 'miCuenta':
                await cargarModuloMiCuenta(vistaDinamica);
                break;

            case 'correccionEcas':
                await cargarFormularioCorreccionEcas(vistaDinamica);
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
    inicializarPreferenciasVisuales().catch(error => console.warn('No se pudieron cargar las preferencias visuales:', error));
    const menu = document.getElementById('side-menu');
    const listaMenu = menu ? menu.querySelector('.drawer-list') : null;

    if (!listaMenu) {
        console.error('❌ No se encontró .drawer-list dentro de #side-menu.');
        return;
    }

    // Mi cuenta es una opción personal disponible para cualquier usuario autenticado.
    let btnMiCuenta = document.getElementById('nav-mi-cuenta');
    if (!btnMiCuenta) {
        btnMiCuenta = document.createElement('li');
        btnMiCuenta.id = 'nav-mi-cuenta';
        btnMiCuenta.textContent = '👤 Mi cuenta';
        listaMenu.insertBefore(btnMiCuenta, listaMenu.firstChild?.nextSibling || null);
    }
    btnMiCuenta.onclick = (e) => {
        e.preventDefault();
        window.cargarModulo('miCuenta');
    };

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

    let btnHistorialFotos = document.getElementById('nav-historial-fotos');
    if (!btnHistorialFotos) {
        btnHistorialFotos = document.createElement('li');
        btnHistorialFotos.id = 'nav-historial-fotos';
        btnHistorialFotos.textContent = '📷 Historial de fotos de controles';
        btnHistorialFotos.style.cssText = 'color: #38bdf8; font-weight: bold; cursor: pointer;';
        listaMenu.appendChild(btnHistorialFotos);
    }
    btnHistorialFotos.onclick = (e) => {
        e.preventDefault();
        window.cargarModulo('historialFotos');
    };

    // El CMU ya es un <li> con onclick en index.html.
    // No agregamos otro listener para evitar ejecuciones duplicadas.
    const itemCmu = Array.from(listaMenu.querySelectorAll('li'))
        .find(el => el.textContent.includes('CMU'));

    if (itemCmu) {
        itemCmu.id = 'nav-cmu';
    }

    console.log('🚀 Centinela 3.0: enrutador y navegación inicializados.');
    inicializarAutenticacion();
});
