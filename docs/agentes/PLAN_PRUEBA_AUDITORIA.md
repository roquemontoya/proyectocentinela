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

## Pruebas preparadas
### A. Red Team seguro (black-box)
El script `tests/security/audit-red-team.mjs` comprueba:
1. GET a informe y lectura → deben responder `405 method_not_allowed` (Mayordomo exige JWT en la capa gateway y se prueba por separado).
2. POST a lectura e informe sin `x-agent-token` → `401 unauthorized`.
3. POST a lectura e informe con token incorrecto → `401 unauthorized`.
4. POST a Mayordomo sin sesión → HTTP `401`.
El script no intenta explotar servicios externos, no modifica datos y bloquea la URL conocida de producción.

Se agregó un workflow manual `.github/workflows/audit-red-team-staging.yml`. Solo corre si se confirma literalmente `CONFIRMO-STAGING` y existen los secretos de repositorio `CENTINELA_STAGING_SUPABASE_URL` y `AGENTE_CAQ_AUDIT_TOKEN`. Estos secretos deben apuntar a una instancia de prueba aislada; nunca usar la URL de producción ni registrar el token en logs.

### B. Pruebas todavía necesarias
- [ ] Ejecutar Red Team real contra un proyecto Supabase aislado con las funciones de auditoría desplegadas allí.
- [ ] Añadir usuario de prueba no administrador para comprobar `403 insufficient_role` y administrador de prueba para validar el flujo autorizado completo.
- [ ] Comparar conteos e identificadores antes/después de la prueba para acreditar que no hubo escrituras.
- [ ] Caquitas (Blue Team) revisa resultados y logs; Mayordomo entrega el informe consolidado.
- [ ] Revisión funcional desde interfaz con una sesión de administrador y otra sin privilegios.
- [ ] Aprobación del usuario antes de integrar a `main`.

## Estado de ejecución
- [x] Inspección estática de los tres códigos y columnas reales de las tablas.
- [x] Consulta de solo lectura de calidad de datos y reglas preliminares.
- [x] Corrección del falso positivo de severidad para fichas ya marcadas pendientes en rama aislada.
- [x] Preparación de pruebas HTTP negativas no destructivas y workflow manual protegido para staging.
- [ ] Ejecución HTTP real: todavía no realizada; requiere URL de un entorno aislado y secretos configurados.
- [ ] Prueba funcional completa de autorización positiva y negativa.

## Nota de privilegios mínimos
La función de lectura usa una clave de servidor y consultas GET/select codificadas de forma fija. Eso limita la superficie de consulta en el código actual, pero no equivale a que PostgreSQL aplique privilegios de solo lectura al rol de base de datos. La separación efectiva mediante credenciales de privilegio mínimo sigue pendiente y debe revisarse antes de producción.
