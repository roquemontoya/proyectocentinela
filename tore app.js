[1mdiff --git a/app.js b/app.js[m
[1mindex 94f07b4..a9c8bd2 100644[m
[1m--- a/app.js[m
[1m+++ b/app.js[m
[36m@@ -5,9 +5,8 @@[m
 import { cargarModuloAdminCsv } from './conversorMaestroUniversal.js';[m
 import { cargarModuloGestorTablas } from './gestorTablas.js';[m
 [m
[31m-// 1. FUNCIÓN GLOBAL ROBUSTA PARA EL MENÚ LATERAL (Tres rayitas)[m
[32m+[m[32m// 1. FUNCIÓN GLOBAL DE MENÚ: Alterna apertura/cierre de la barra lateral correctamente[m
 window.toggleMenu = function() {[m
[31m-    // Buscar la barra lateral por cualquier selector posible en el proyecto[m
     const sidebar = document.querySelector('.sidebar') || [m
                     document.querySelector('aside') || [m
                     document.querySelector('#sidebar') || [m
[36m@@ -16,22 +15,18 @@[m [mwindow.toggleMenu = function() {[m
                     document.querySelector('[class*="menu"]');[m
     [m
     if (sidebar) {[m
[31m-        // Alternar visibilidad de forma directa y segura[m
         const currentDisplay = window.getComputedStyle(sidebar).display;[m
[32m+[m[32m        // Si está oculta, la mostramos; si está visible, la ocultamos[m
         if (currentDisplay === 'none' || sidebar.style.display === 'none') {[m
             sidebar.style.display = 'block';[m
[31m-            sidebar.style.width = '260px';[m
         } else {[m
             sidebar.style.display = 'none';[m
         }[m
[31m-        sidebar.classList.toggle('active');[m
[31m-        sidebar.classList.toggle('open');[m
     } else {[m
[31m-        console.error("❌ No se encontró la barra lateral en el DOM.");[m
[32m+[m[32m        console.error("❌ No se encontró la barra lateral.");[m
     }[m
 };[m
 [m
[31m-// 2. FUNCIÓN GLOBAL PARA EL BOTÓN DE INICIO[m
 window.irInicio = function() {[m
     const contenedorPrincipal = document.getElementById('contenedor-principal');[m
     if (contenedorPrincipal) {[m
[36m@@ -40,7 +35,7 @@[m [mwindow.irInicio = function() {[m
 };[m
 [m
 document.addEventListener('DOMContentLoaded', () => {[m
[31m-    // 3. Contenedor principal de la PWA[m
[32m+[m[32m    // 2. Contenedor principal de la PWA[m
     let contenedorPrincipal = document.getElementById('contenedor-principal');[m
     if (!contenedorPrincipal) {[m
         contenedorPrincipal = document.createElement('main');[m
[36m@@ -49,7 +44,7 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
         document.body.appendChild(contenedorPrincipal);[m
     }[m
 [m
[31m-    // 4. Inyectar automáticamente el botón del Gestor de Tablas en el menú lateral[m
[32m+[m[32m    // 3. Inyectar automáticamente el botón del Gestor de Tablas en el menú lateral[m
     const sidebar = document.querySelector('.sidebar') || document.querySelector('aside') || document.querySelector('#sidebar') || document.body;[m
     [m
     let btnGestor = document.getElementById('nav-gestor-tablas');[m
[36m@@ -69,7 +64,7 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
         }[m
     }[m
 [m
[31m-    // 5. Vincular evento para el Bibliotecario (CMU)[m
[32m+[m[32m    // 4. Vincular evento para el Bibliotecario (CMU)[m
     const linkCmu = document.getElementById('nav-cmu') || Array.from(document.querySelectorAll('a')).find(el => el.textContent.includes('CMU'));[m
     if (linkCmu) {[m
         linkCmu.addEventListener('click', (e) => {[m
[36m@@ -79,12 +74,12 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
         });[m
     }[m
 [m
[31m-    // 6. Vincular evento para el Gestor Universal de Tablas[m
[32m+[m[32m    // 5. Vincular evento para el Gestor Universal de Tablas[m
     btnGestor.addEventListener('click', (e) => {[m
         e.preventDefault();[m
         contenedorPrincipal.innerHTML = '';[m
         cargarModuloGestorTablas(contenedorPrincipal);[m
     });[m
 [m
[31m-    console.log('🚀 app.js reparado: toggleMenu y Gestor Universal enlazados.');[m
[32m+[m[32m    console.log('🚀 app.js sincronizado: toggleMenu y Gestor Universal funcionando.');[m
 });[m
\ No newline at end of file[m
