OCULUS — INFORME INICIAL DE AUDITORÍA
Proyecto: Centinela
Rama: feature/oculus-inspector
Fecha: 2026-10-26
Alcance: inspección estática de configuración de roles y vista previa responsive aislada.

RESUMEN EJECUTIVO
- 12 perfiles incluidos en la inspección.
- Se identificaron discrepancias declaradas entre tarjetas del dashboard y las reglas de permisos del simulador.
- El visor Oculus es una maqueta independiente; no inicia sesión, no conecta con Supabase y no modifica datos.
- La vista escritorio/móvil es una simulación responsive. No equivale a una captura del navegador ejecutando la aplicación real.
- No se validaron las políticas RLS ni la autorización efectiva de la API.

HALLAZGOS CONCRETOS
1. Bombero / Inspector: la tarjeta “Recorridos GPS” figura en el dashboard declarado, pero recorridosGps no pertenece al conjunto permitido MODULOS_BOMBEROS. El renderizador del simulador puede ocultarla.
2. Bombero: misma discrepancia con “Recorridos GPS”.
3. Jefe Seguridad Patrimonial: “Mapa de supervisión” figura declarado, pero panelGeografico no está en MODULOS_LECTURA; la tarjeta puede quedar oculta.
4. Jefe Guardia Física: “Mapa de supervisión”, “Recorridos GPS” y “Ubicación GPS” figuran declarados, pero no están habilitados por la regla de solo lectura actual; pueden quedar ocultos.
5. Jefe Prevención de Incendios: “Mapa de supervisión” figura declarado, pero panelGeografico no está en MODULOS_LECTURA.
6. Gerencia: “Mapa de supervisión” figura declarado, pero panelGeografico no está en MODULOS_LECTURA.

IMPACTO
Las pantallas configuradas para esos perfiles pueden no coincidir con lo que finalmente se renderiza. Antes de cambiar permisos hay que confirmar la matriz funcional aprobada; Oculus no debe ampliar permisos automáticamente.

ARQUITECTURA OBSERVADA
La estructura común y la navegación están en index.html; el enrutamiento de vistas está en app.js; la autenticación y autorización están en auth.js; el simulador y el dashboard por perfil están en simuladorRoles.js. Esto duplica parte de la configuración y permite que las listas diverjan.

SIGUIENTE PASO TÉCNICO RECOMENDADO
Crear un módulo de configuración común para el catálogo de roles, módulos, tarjetas, navegación y modo de solo lectura. Hacer que simuladorRoles.js y Oculus consuman la misma configuración. Mantener auth.js y las políticas RLS como autoridad de seguridad; la configuración compartida solo describe la interfaz y nunca sustituye permisos del servidor.

LIMITACIÓN DE PRUEBAS
No se ejecutó una automatización de navegador real ni se tomaron capturas de la aplicación en escritorio y móvil. Para certificar desbordes, superposiciones, clics y estilos de la aplicación real se necesita una ejecución de navegador (por ejemplo, Playwright) contra una vista de prueba con datos ficticios. El HTML de Oculus permite revisar las variantes visuales, pero sus resultados son una inspección estática inicial.
