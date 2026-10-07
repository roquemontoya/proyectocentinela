// ==========================================
// MÓDULO PRINCIPAL: Enrutador y Control de UI (app.js)
// ==========================================

import { cargarModuloMapa } from './mapas.js';
import { cargarModuloPulmon } from './moduloPulmon.js';
import { abrirControlExtintor, guardarControlExtintor } from './controlesExtintores.js';
import { abrirControlHidrante, guardarControlHidrante } from './controlesHidrantes.js';

// --- Navegación de Vistas ---

window.cargarModulo = async function(moduloKey) {
    const grid = document.getElementById('main-content');
    const vistaDinamica = document.getElementById('vista-dinamica');

    // Ocultar pantalla de inicio (tarjetas) y mostrar vista dinámica
    grid.style.display = 'none';
    vistaDinamica.style.display = 'block';

    // ENRUTAMIENTO INTELIGENTE: ¿Mapa o Tabla?
    if (moduloKey === 'pulmon') {
        // Carga la tabla de inventario y reservas
        await cargarModuloPulmon(vistaDinamica);
    } else {
        // Carga el mapa satelital de Leaflet
        await cargarModuloMapa(moduloKey, vistaDinamica);
    }

    // Cierra el menú lateral (drawer) de forma automática si estaba abierto
    const sideMenu = document.getElementById('side-menu');
    const overlay = document.getElementById('drawer-overlay');
    if (sideMenu && sideMenu.classList.contains('open')) {
        sideMenu.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    }
};

window.irInicio = function() {
    // Volver a mostrar las tarjetas principales y limpiar el mapa/tabla
    document.getElementById('main-content').style.display = 'grid';
    document.getElementById('vista-dinamica').style.display = 'none';
    document.getElementById('vista-dinamica').innerHTML = ''; 
    
    // Cierra el menú lateral si está abierto
    const sideMenu = document.getElementById('side-menu');
    const overlay = document.getElementById('drawer-overlay');
    if (sideMenu && sideMenu.classList.contains('open')) {
        sideMenu.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    }
};

window.toggleMenu = function() {
    const sideMenu = document.getElementById('side-menu');
    const overlay = document.getElementById('drawer-overlay');
    sideMenu.classList.toggle('open');
    overlay.classList.toggle('open');
};


// --- Enrutador de Formularios (Modal) ---

// Esta función es llamada desde el popup del mapa o desde la tabla del pulmón
window.abrirFormularioControl = function(tabla, dbId, idElemento) {
    const t = tabla.toLowerCase();
    
    // Deriva la apertura del modal al archivo JS correspondiente
    if (t === 'extintores' || t === 'extintor') {
        abrirControlExtintor(dbId, idElemento);
    } else if (t === 'hidrantes' || t === 'hidrante') {
        abrirControlHidrante(dbId, idElemento);
    } else {
        alert(`El módulo de controles para ${tabla.toUpperCase()} se encuentra en desarrollo.`);
    }
};

// Esta función captura el "Submit" del formulario y lo envía al archivo correspondiente
window.guardarControl = function(event) {
    event.preventDefault(); // Evita que la página se recargue
    
    const tabla = document.getElementById('input-tabla').value.toLowerCase();
    
    if (tabla === 'extintores' || tabla === 'extintor') {
        guardarControlExtintor(event);
    } else if (tabla === 'hidrantes' || tabla === 'hidrante') {
        guardarControlHidrante(event);
    } else {
        alert(`La función de guardado para ${tabla.toUpperCase()} aún no está implementada.`);
    }
};