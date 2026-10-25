# Agente-Caquitas — arquitectura de mayordomos de Centinela

## Identidad del sistema
- Nombre técnico: `agente-caquitas`.
- Tipo: servicio interno de backend; no es una cuenta humana.
- Rama de desarrollo: `agente-ia-lab`.

## Identidad de presentación y tareas
- Primer mayordomo: `EL_MAYORDOMO_001`.
- Etiqueta visible en informes, resultados y presentación de tareas: `EL_MAYORDOMO_001`.
- `EL_MAYORDOMO_001` es la identidad operativa del mayordomo, no el nombre del agente/plataforma.
- La arquitectura debe permitir ampliar sus capacidades y crear otros mayordomos especializados sin confundir la identidad técnica con la identidad operativa.

## Seguridad y alcance inicial
1. No incluir claves de Supabase, tokens, contraseñas ni secretos en el repositorio.
2. Nunca usar la clave `service_role` desde el navegador ni desde artefactos públicos.
3. No heredar roles humanos (`administrador`, `superadministrador`, `mantenimiento`, etc.).
4. Cada ejecución registra identidad técnica, identidad del mayordomo, fecha UTC, versión, tarea, comprobaciones, resultado y errores.
5. La primera versión es de solo lectura: no puede escribir, borrar ni corregir activos, controles, anomalías, usuarios ni historial.
6. Acceso a datos únicamente mediante interfaz de servidor con permisos mínimos y consultas explícitamente permitidas.
7. Los nombres/IDs de presentación no son autenticación: el backend debe autenticar cada ejecución.
8. No integrar en `main` hasta completar revisión de seguridad y pruebas.

## Diseño por fases
### Fase 1 — identidad y contratos
Definir identidad técnica, mayordomo, formato de auditoría y límites sin tocar datos de producción.

### Fase 2 — auditoría de solo lectura
Crear comprobaciones deterministas de integridad y consistencia, citando tabla/registro afectado sin exponer datos personales innecesarios.

### Fase 3 — ejecución en backend
Ejecutar en un entorno de servidor con secretos administrados por la plataforma. Elegir la implementación después de confirmar runtime y permisos disponibles.

### Fase 4 — ampliación y múltiples mayordomos
Permitir varios mayordomos especializados, cada uno con identificador propio, tareas permitidas, límites de acceso y bitácora. Mantener separadas la identidad técnica `agente-caquitas` y la identidad operativa `EL_MAYORDOMO_NNN`.

### Fase 5 — integración en Centinela
Mostrar el mayordomo responsable y el resultado de cada tarea en la interfaz. Mantener las identidades al integrar el código en `main`.

## Contrato mínimo del informe
Cada informe incluirá `agent_id`, `agent_name`, `mayordomo_id`, `mayordomo_name`, `run_id`, `task_id`, `started_at`, `finished_at` (UTC), `agent_version`, `mode` (inicialmente `read_only`), `checks`, `errors` sin secretos y `status` (`PASS`, `CHECK_REQUIRED` o `ERROR`).

## Pendientes antes de conectar a producción
- Revisar políticas RLS y permisos de lectura por tabla.
- Resolver la alerta sobre `public.spatial_ref_sys` mediante revisión, sin aplicar cambios automáticos.
- Decidir autenticación de servicio (credencial exclusiva, rotación y validación en servidor).
- Añadir pruebas que demuestren que el agente no puede escribir.
- Registrar auditorías en un almacén donde el agente no pueda alterar o borrar su propia bitácora.

> Este documento define la intención y los límites. No concede permisos ni accede a datos de producción.
