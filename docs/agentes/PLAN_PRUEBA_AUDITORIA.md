# Plan de prueba previa — agentes de auditoría

## Alcance y seguridad
- Rama aislada: `test/agentes-auditoria-pre-funcional`.
- Funciones: `mayordomo-001-audit`, `agente-caquitas-audit-report`, `agente-caquitas-audit-read`.
- La auditoría es estrictamente de lectura. No se insertan datos falsos ni se ejecutan operaciones destructivas sobre producción.
- Las funciones internas de informe/lectura usan `verify_jwt=false` y deben rechazar solicitudes sin el secreto interno correcto. Mayordomo exige JWT de Supabase y rol administrador/superadministrador.

## Corrección incluida en la rama
Las 1.410 fichas de `extintores_trazabilidad` que se inspeccionaron están explícitamente en estados `pendiente_verificacion` / `pendiente_relevamiento`, con campos de serie, tarjeta y ubicación vacíos. La regla anterior las elevaba también a hallazgo de severidad alta, aunque ya estaban marcadas como pendientes. Ahora:
- los registros incompletos marcados como pendientes se informan como `informativa` (`TRAZABILIDAD_PENDIENTE_DATOS`);
- solo los incompletos no marcados como pendientes generan `alta` (`TRAZABILIDAD_DATOS_INCOMPLETOS`);
- el detalle incluye conteos separados para ambos grupos.
No se completan identificadores ni se modifica ningún dato operativo.

## Casos de prueba negativos (sin datos reales ni escrituras)
1. GET a cada endpoint → debe responder `405 method_not_allowed`.
2. POST a `agente-caquitas-audit-read` sin `x-agent-token` → `401 unauthorized`.
3. POST con token incorrecto → `401 unauthorized`.
4. POST con token correcto pero JSON inválido → `400 invalid_json`.
5. POST con token correcto y `task_id` diferente del permitido → `400 task_not_allowed`.
6. POST a `agente-caquitas-audit-report` con token incorrecto → `401 unauthorized`.
7. POST a Mayordomo sin Bearer → `401 authentication_required`.
8. POST a Mayordomo con sesión inválida → `401 invalid_session`.
9. POST con sesión válida de usuario sin rol administrador/superadministrador → `403 insufficient_role`.
10. POST con administrador válido → `200`, `read_only: true`, los tres conteos y hallazgos; la respuesta no debe contener claves secretas ni credenciales.
11. Repetir el punto 10 con `?format=csv` en el endpoint de informe interno → CSV válido con cabecera y filas de hallazgos.
12. Comparar `counts` del informe con la función de lectura; deben coincidir en las tres tablas.

## Prueba de integridad de solo lectura
Antes y después de la ejecución autorizada, comparar conteos y máximos de `updated_at`/identificadores de las tres tablas. Deben permanecer iguales. No crear registros señuelo en producción.

## Estado de ejecución
- [x] Inspección estática de los tres códigos desplegados y de las columnas reales de las tablas.
- [x] Consulta de solo lectura de calidad de datos y reglas preliminares.
- [x] Corrección del falso positivo de severidad para fichas ya marcadas pendientes en rama aislada.
- [ ] Ejecución HTTP real de los casos negativos y positivos. El conector disponible permite inspeccionar y desplegar funciones, pero no ofrece un invocador HTTP para ejecutar solicitudes arbitrarias. No afirmar que estos casos fueron ejecutados hasta correrlos en un entorno de prueba autorizado.
- [ ] Confirmar el secreto interno configurado en Supabase sin mostrarlo ni copiarlo al repositorio.
- [ ] Prueba funcional desde la interfaz con una sesión de administrador y otra de usuario sin privilegios.
- [ ] Revisión del informe generado y aprobación del usuario antes de integrar a `main`.

## Nota sobre la cobertura
La función de lectura usa una clave de servidor y consultas GET/select codificadas de forma fija. Eso limita la superficie de consulta en el código actual, pero no equivale a que PostgreSQL aplique privilegios de solo lectura al rol de base de datos; el diseño de privilegios mínimos del agente sigue siendo una mejora de seguridad pendiente.
