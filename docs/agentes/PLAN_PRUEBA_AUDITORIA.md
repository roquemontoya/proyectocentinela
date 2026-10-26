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


## Pasada local de CSV — solo pruebas (2026-10-26)
Se recibieron y revisaron 19 CSV originales (3.433 filas de datos en total). No se conectó a Supabase ni se modificaron los archivos originales. El prototipo local está en `tests/data-quality/csv_two_pass_audit.py` y genera copias separadas con la etiqueta de uso de prueba.

Hallazgos iniciales del parser de estructura:
- Extintores: 1.412 filas; 614 filas tienen una columna adicional en la lectura CSV simple. Se detectaron 3 casos de alta confianza en que la etiqueta del extintor quedó partida en `3` y `5 Kg`; la prueba los reconstruye como `3,5 Kg` conservando el orden posterior. Las demás filas anómalas quedan pendientes.
- IPP: 432 filas; gran parte de las filas no se interpreta como una fila tabular completa en una lectura CSV simple, por lo que requiere un reparador específico de WKT/GEOMETRYCOLLECTION y delimitación.
- Red troncal: 462 filas; se observan grupos con 1, 3 y 12 columnas frente a 14 en cabecera. No se reparan por conjetura.
- Hidrantes: 464 filas; hay 87 filas con más columnas que la cabecera. Requieren análisis de campos entrecomillados/estructuras.
- Válvulas, ECAS, ceniceros, espumígenos, puertas cortafuego y otras capas presentan anomalías estructurales de distinta magnitud.

Estos números son señales del parser estándar, no un veredicto de pérdida de datos: las exportaciones contienen comillas internas, geometrías, comas y campos multilínea que exigen parsers/reglas por categoría. El prototipo es una segunda pasada conservadora, no reemplaza todavía al CMU de navegador ni autoriza importación. La salida local debe tratarse como **SOLO PRUEBAS — NO IMPORTAR A PRODUCCIÓN**.

## Revisión estática de seguridad
- [x] Las tres Edge Functions limitan los métodos a POST/OPTIONS en el código de aplicación.
- [x] Lectura e informe validan un token interno con comparación de longitud fija y comparación byte a byte.
- [x] Mayordomo valida el JWT consultando Auth y exige `administrador` o `superadministrador` mediante `current_user_role()`.
- [x] Se ajustó el Red Team para probar GET solo en informe/lectura (Mayordomo puede ser bloqueado antes por el gateway JWT) y se amplió el bloqueo de la URL conocida de producción.
- [ ] Prueba HTTP real contra staging: pendiente; no hay URL/secretos de staging disponibles en esta sesión.
- [ ] Pruebas positivas/negativas por rol: pendientes hasta disponer de usuarios y entorno aislados.
- [ ] Mitigación antes de producción: lectura aún usa una clave privilegiada de servidor con selects fijos. Se recomienda reemplazarla por credenciales de mínimo privilegio/rol estrictamente de solo lectura, y probarlo antes de considerar integración.
