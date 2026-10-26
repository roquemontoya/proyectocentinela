# Plan de prueba previa — agentes de auditoría

## Alcance y seguridad
- Rama aislada: `test/agentes-auditoria-pre-funcional`.
- Funciones: `mayordomo-001-audit`, `agente-caquitas-audit-report`, `agente-caquitas-audit-read`.
- La auditoría de funciones es de solo lectura. No se insertan datos falsos ni se ejecutan operaciones destructivas sobre producción.
- Las funciones internas de informe/lectura usan `verify_jwt=false` y deben rechazar solicitudes sin el secreto interno correcto. Mayordomo exige JWT de Supabase y rol administrador/superadministrador.

## Corrección de severidad de trazabilidad
Las 1.410 fichas de `extintores_trazabilidad` inspeccionadas están explícitamente en estados `pendiente_verificacion` / `pendiente_relevamiento`, con campos de serie, tarjeta y ubicación vacíos. La regla anterior las elevaba también a severidad alta aunque ya estaban marcadas como pendientes. En la rama:
- los registros incompletos marcados como pendientes se informan como informativos (`TRAZABILIDAD_PENDIENTE_DATOS`);
- solo los incompletos no marcados como pendientes generan severidad alta (`TRAZABILIDAD_DATOS_INCOMPLETOS`);
- el detalle separa los conteos de ambos grupos.
No se completan identificadores ni se modifica ningún dato operativo.

## Pasada local de CSV — SOLO PRUEBAS
- Se recibieron 19 CSV y se procesaron localmente: 3.433 filas de datos.
- No se conectó a Supabase y los archivos originales no se modificaron.
- El prototipo `tests/data-quality/csv_two_pass_audit.py` genera copias separadas y marca las anomalías sin reparación segura como pendientes.
- La regla `EXTINTOR_CAPACIDAD_3_5_NOMBRE_PARTIDO` propuso 3 reparaciones de alta confianza. Reconstruye la etiqueta dividida en `3` y `5 Kg` solo cuando coinciden nombre, patrón WKT, fragmento esperado y firma GPS.
- Quedan 16 archivos con anomalías estructurales para análisis específico; esto no demuestra pérdida de datos. Exportaciones con comas, WKT y campos multilínea requieren reglas por capa y no deben repararse por conjetura.

## Pruebas de regresión del reparador CSV
Se añadió `tests/data-quality/test_csv_two_pass_audit.py` y se integró al workflow de validación:
1. patrón de alta confianza 3,5 kg se repara y vuelve a alinear la fila;
2. ausencia de firma GPS impide reparar;
3. la regla no se aplica a otras capas;
4. no se modifica una fila ya alineada;
5. la función de reparación no altera el archivo original.
La ejecución local equivalente de estas cinco pruebas pasó (5/5). El workflow de GitHub debe confirmar la ejecución en CI; no se declara un resultado remoto hasta observarlo.

## Red Team seguro
El script `tests/security/audit-red-team.mjs` está diseñado para comprobar:
1. GET a informe/lectura debe responder 405;
2. POST a lectura/informe sin token interno debe responder 401;
3. POST a lectura/informe con token incorrecto debe responder 401;
4. POST a Mayordomo sin sesión debe responder 401.
El script bloquea la URL conocida de producción y requiere una URL HTTPS de staging y un token de prueba. No se ejecutó contra producción.

## Revisión estática de seguridad
- [x] Las tres Edge Functions limitan métodos a POST/OPTIONS en el código de aplicación.
- [x] Lectura e informe validan el token interno con comparación de longitud fija y comparación byte a byte.
- [x] Mayordomo valida el JWT consultando Auth y exige `administrador` o `superadministrador` mediante `current_user_role()`.
- [x] Se revisó el código desplegado de las tres funciones; no se hicieron despliegues en esta tarea.
- [ ] Prueba HTTP real de Red Team contra staging: pendiente; no hay URL/secretos de staging disponibles.
- [ ] Pruebas positivas/negativas por rol: pendientes hasta disponer de usuarios y entorno aislados.
- [ ] Comprobar invariancia de datos antes/después de los tests HTTP: pendiente.
- [ ] Mitigación antes de producción: la función de lectura aún usa una clave privilegiada de servidor con selects fijos. Se recomienda migrar a credenciales de mínimo privilegio/rol estrictamente de solo lectura y probarlo antes de integrar.

## Revisión del asesor de seguridad de Supabase (solo lectura, 2026-10-26)
El asesor del proyecto reportó:
- ERROR: `public.spatial_ref_sys` sin RLS.
- WARN: tres variantes de `public.st_estimatedextent` ejecutables por `anon` como SECURITY DEFINER.
- WARN: 15 funciones SECURITY DEFINER ejecutables por `authenticated`.
- WARN: una función con `search_path` mutable.
- WARN: protección de contraseñas filtradas deshabilitada.
- WARN: extensión PostGIS instalada en `public`.
Son alertas que requieren análisis individual; no prueban por sí solas explotación. No se modificaron permisos, tablas, extensiones ni ajustes de Auth.

## Estado de ejecución y puerta de integración
- [x] Inspección estática del código de agentes.
- [x] Auditoría local inicial de 19 CSV sin conexión a Supabase.
- [x] Pruebas locales de regresión de la regla 3,5 kg (5/5).
- [x] Preparación del Red Team HTTP de solo solicitudes negativas.
- [ ] CI remoto confirmado después de añadir pruebas de regresión.
- [ ] Ejecución HTTP real en staging.
- [ ] Validación funcional de autorización positiva y negativa por rol.
- [ ] Confirmación de ausencia de escrituras.
- [ ] Revisión de privilegios mínimos para el lector.
- [ ] Aprobación antes de integrar a `main`.

**Decisión:** mantener el PR como borrador y no integrar en `main` hasta completar las pruebas dinámicas y resolver o aceptar explícitamente los riesgos pendientes.
