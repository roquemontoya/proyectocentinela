# Auditoria estatica inicial de codigo — Proyecto Centinela
Fecha: 27/10/2026
Rama revisada: main
Alcance: inventario de 91 archivos del repositorio y lectura de los principales modulos JS, HTML, CSS, Edge Functions y tests. No se modificaron datos de Supabase ni se desplego la PWA durante esta auditoria.

## Resumen ejecutivo
Se identificaron riesgos concretos de seguridad de DOM, oportunidades de rendimiento y una brecha entre la denominacion PWA y los archivos presentes en el repositorio. Esta es una auditoria estatica inicial; no equivale a ejecutar todos los flujos autenticados en navegador ni a revisar cada linea de los 91 archivos con herramientas de analisis dinamico.

## Hallazgos priorizados

### P1 — Riesgo de XSS almacenado en tarjetas de Bomberos
- Archivos: `bomberos.js:53-56`; `controlesBase.js:102-105,127-130,148-151`.
- Evidencia: se interpolan `b.Bombero` directamente en `innerHTML` (texto, `alt` y `title`) y `fotoUrl` en atributos HTML sin escapar/validar.
- Impacto: si un valor de nombre o ruta de foto almacenado contiene comillas/marcado malicioso, puede romper el HTML generado y potencialmente ejecutar contenido en la sesion del usuario.
- Recomendacion: construir nodos con `createElement`, usar `textContent` y asignar `img.src`/ `alt` por propiedades; validar URL contra origen permitido de Supabase Storage y usar fallback. Añadir prueba con nombre que contenga comillas y etiquetas.
- Estado: hallazgo estatico; no se intento explotar en produccion.

### P1 — Gestor universal permite editar/eliminar filas desde la interfaz y convierte todos los valores a texto
- Archivo: `gestorTablas.js:135-177,187-196`.
- Evidencia: cada columna no-ID se envia como string o null a `update`; los botones permiten `delete` en la tabla seleccionada. La interfaz no preserva tipos numericos, booleanos, JSON ni fechas.
- Impacto: errores de tipo/validacion o corrupcion logica si se editan tablas operativas; una eliminacion accidental puede borrar datos. La proteccion final depende de RLS/politicas de servidor, que no se validaron para cada tabla en este recorrido.
- Recomendacion: quitar la edicion/borrado generico de tablas operativas o restringirlo a una allowlist de tablas/campos; separar visor de editor; preservar/validar tipos con esquema explicito; exigir permisos de servidor y confirmacion reforzada para borrado; registrar auditoria y probar RLS directamente.
- Estado: no se ejecutaron updates/deletes.

### P1 — Errores de backend interpolados en HTML sin escape
- Archivos: `moduloPulmon.js:24-26`; `bomberos.js:25-27`; `gestorTablas.js:107-109`.
- Evidencia: `error.message` se concatena en `innerHTML` en estos caminos de error.
- Impacto: si el texto del error contiene contenido controlable o inesperado, puede interpretarse como HTML. Menor alcance que el XSS en nombres, pero es una superficie evitable.
- Recomendacion: renderizar mensajes con `textContent` o una funcion de escape consistente y no volcar errores internos completos al usuario.

### P1/P2 — Falta manifest y service worker en el arbol de main
- Evidencia: el arbol del repositorio contiene `index.html` y `app.js`, pero no se encontraron `manifest.json`/web manifest ni archivo de service worker; `index.html` no declara `rel="manifest"` ni registra un service worker.
- Impacto: la app puede funcionar como web responsive, pero no hay evidencia en el codigo revisado de instalabilidad PWA completa, estrategia offline ni cache versionada de assets. Los recorridos GPS tienen persistencia local propia, que no sustituye una PWA offline general.
- Recomendacion: decidir el nivel de soporte offline. Si se requiere PWA instalable, agregar manifest, iconos y service worker con cache selectiva/versionada; nunca cachear respuestas privadas o datos de controles sin una politica explicita. Probar actualizaciones y sesiones cerradas.
- Estado: no se agregaron estos componentes durante la auditoria.

### P2 — Carga excesiva de columnas y registros
- Archivos: `mapas.js:321-335`; `controlesBase.js:68-74`; `moduloPulmon.js:18-22,132-140`; `gpsActivosCercanos.js:92-105); `bomberos.js:18-21`.
- Evidencia: varias consultas usan `select('*')`; el mapa pagina todos los registros LEU y luego construye objetos de mapa. Pulmon obtiene todos los campos de Extintores y filtra localmente por PRP.
- Impacto: transferencia de columnas no usadas, mayor memoria y tiempo de parseo/render a medida que crece el inventario.
- Recomendacion: seleccionar solo campos necesarios, filtrar Pulmon en PostgREST cuando el esquema lo permita, medir tamaño/latencia con volumen real y mantener paginacion ordenada. Evitar cambiar consultas sin contrastar columnas y reglas actuales.
- Prioridad: optimizacion incremental; el volumen actual (~miles de activos) puede ser manejable, pero conviene preparar crecimiento.

### P2 — El mapa de hidrantes pagina el historial completo de controles para resolver ultimo estado
- Archivo: `mapas.js:348-363` y bloque de agregacion posterior.
- Evidencia: consulta todos los controles_h no vacios en paginas de 1000 ordenadas por fecha para construir el ultimo estado por activo en el cliente.
- Impacto: con el crecimiento del historial, cada apertura del mapa puede transferir muchos controles antiguos.
- Recomendacion: crear/usar una vista o RPC que devuelva unicamente el ultimo control por activo (con indices apropiados), y probar empates por fecha/id. Requiere revisar el esquema antes de migrar.

### P2 — Carga masiva de puntos GPS y dibujo de polilineas sin simplificacion
- Archivo: `recorridosGps.js:296-304`.
- Evidencia: se pueden consultar hasta 20.000 puntos de un recorrido y dibujar todos como una polilinea.
- Impacto: render pesado en celulares y consumo de memoria si los recorridos son largos.
- Recomendacion: simplificacion geometrica para visualizacion, limites por ventana/zoom, carga progresiva o consulta por segmentos; conservar el registro original sin modificarlo.

### P2 — HTML dinamico extenso y mantenimiento
- Archivos: `conversorMaestroUniversal.js` (2453 lineas), `mapas.js` (870), `controlesExtintores.js` (540), `miCuenta.js` (373), `moduloPulmon.js` (377).
- Evidencia: modulos largos con plantillas HTML y logica de datos/DOM mezcladas.
- Impacto: aumenta el costo de revisar regresiones, duplicacion y errores de escape; no implica por si mismo un bug.
- Recomendacion: refactor por funciones pequeñas (consulta, validacion, render, persistencia) y helpers compartidos; conservar contratos y tests antes de mover logica.

### P2 — Estado de inspeccion guardado en localStorage
- Archivos: `controlesBase.js:88`, `controlesExtintores.js:531`, `controlesHidrantes.js:361`, `controlesOtros.js:292`.
- Evidencia: se guarda el nombre del inspector en localStorage para preseleccionarlo.
- Impacto: en dispositivos compartidos puede persistir una identidad anterior; no debe tomarse como prueba de identidad ni como control de autorizacion.
- Recomendacion: mostrar claramente la preseleccion, invalidarla al cerrar sesion/cambiar usuario y vincular autor del control a identidad autenticada del servidor cuando el flujo lo permita.

### P3 — Archivo Version.txt contiene una orden de Git, no una version
- Archivo: `Version.txt`.
- Evidencia: su unico contenido es `git commit --allow-empty -m "Forzar sincronizacion con Vercel"`.
- Impacto: confunde el versionado, documentacion y automatizacion; parece un comando que termino guardado como contenido.
- Recomendacion: reemplazar por version semantica/commit/tag o eliminar si ningun proceso lo consume; buscar referencias antes de cambiarlo.

### P3 — CDN externos sin estrategia de disponibilidad/offline visible
- Archivo: `index.html:62,64,193`.
- Evidencia: Leaflet y Supabase JS se cargan desde CDN externos; no se observa fallback local ni precarga especifica.
- Impacto: si el CDN falla o hay conectividad intermitente, la PWA puede no iniciar o los mapas no funcionar.
- Recomendacion: fijar versiones (ya se fijan en los URL vistos), vigilar dependencias y evaluar hosting local/bundle o estrategia de fallback. No copiar recursos sin revisar licencias y actualizaciones.

## Controles positivos observados
- El cliente usa la clave publica anon de Supabase en frontend; no es por si misma una clave de privilegios elevados. La seguridad real depende de RLS, grants y funciones de servidor.
- Se encontraron migraciones de RLS/RBAC, funciones RPC atomicas y tests de auditoria/red-team en el repositorio.
- `recorridosGps.js` usa IndexedDB/localStorage para cola local de puntos y maneja errores de sincronizacion.
- Varias areas ya usan funciones de escape y control de roles; conviene unificar los patrones para reducir errores.
- El auditor Caquitas integrado en main tiene pruebas automatizadas para reglas, paginacion y validacion HTTP, pero eso no equivale a una auditoria dinamica completa de toda la PWA.

## Limitaciones de esta entrega
- No se ejecutaron flujos autenticados de navegador con todas las cuentas/roles.
- No se hicieron escrituras ni correcciones de datos reales.
- No se verifico visualmente cada pantalla en dispositivo real ni se midieron Core Web Vitals.
- No se declara vulnerabilidad explotada; los riesgos de DOM son hallazgos estaticos que deben corregirse y probarse.
- No se desplego nada durante esta auditoria.

## Orden recomendado de remediacion
1. Eliminar XSS potencial de `bomberos.js` y `controlesBase.js`; neutralizar errores en HTML.
2. Endurecer/restringir el gestor universal de tablas y preservar tipos.
3. Definir y completar requisitos reales de PWA (manifest/service worker/offline) sin cachear datos sensibles indebidamente.
4. Optimizar consultas de mapas, Pulmon e historial GPS con mediciones antes/despues.
5. Normalizar identidad del inspector y revisar autorizacion efectiva/RLS de cada mutacion.
6. Limpiar versionado y refactorizar modulos largos de forma incremental.
