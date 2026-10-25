# Agente-Caquitas — arquitectura inicial

## Identidad
- ID estable: `AGENTE-CAQUITAS-001`
- Nombre visible en Centinela: `Agente-Caquitas`
- Tipo: servicio interno de backend, no una cuenta humana.
- Alcance inicial: diagnóstico y auditoría de solo lectura.
- Rama de desarrollo: `agente-ia-lab`.

## Reglas de seguridad
1. No incluir claves de Supabase, tokens, contraseñas ni secretos en el repositorio.
2. Nunca usar la clave `service_role` desde el navegador ni desde artefactos públicos.
3. El agente no hereda roles humanos (`administrador`, `superadministrador`, `mantenimiento`, etc.).
4. Toda ejecución debe registrar ID del agente, fecha UTC, versión, tipo de comprobación, resultado y errores.
5. La primera versión no debe escribir, borrar ni corregir activos, controles, anomalías, usuarios ni historial.
6. Acceso a datos solo mediante una interfaz de servidor con permisos mínimos y consultas explícitamente permitidas.
7. No considerar el nombre del agente como autenticación: el backend debe validar la identidad de ejecución.
8. No integrar en `main` hasta completar revisión de seguridad y pruebas.

## Diseño por fases
### Fase 1 — identidad y contratos (esta etapa)
Definir ID, formato de auditoría y límites de operación sin tocar datos de producción.

### Fase 2 — auditoría de solo lectura
Crear comprobaciones deterministas de integridad y consistencia, con informes que citen tabla/registro afectado sin exponer datos personales innecesarios.

### Fase 3 — ejecución en backend
Ejecutar en un entorno de servidor (por ejemplo, una función de backend) con secretos administrados por la plataforma. La implementación concreta se elige después de confirmar el runtime y los permisos disponibles.

### Fase 4 — integración en Centinela
Mostrar resultados y estado del agente en la interfaz. Mantener la misma identidad estable al integrar el código en `main`.

## Contrato mínimo del informe
Cada informe incluirá:
- `agent_id`
- `agent_name`
- `run_id`
- `started_at` y `finished_at` en UTC
- `agent_version`
- `mode` (inicialmente `read_only`)
- `checks` con identificador, estado y evidencia mínima
- `errors` sin secretos ni datos sensibles
- `status`: `PASS`, `CHECK_REQUIRED` o `ERROR`

## Pendientes antes de conectar a producción
- Revisar políticas RLS y permisos de lectura por tabla.
- Resolver la alerta sobre `public.spatial_ref_sys` sin aplicar cambios automáticos.
- Decidir el mecanismo de autenticación de servicio (credencial exclusiva, rotación y validación en servidor).
- Añadir pruebas que demuestren que el agente no puede escribir.
- Registrar auditorías sin permitir que el agente altere o borre su propia bitácora.

> Este documento define la intención y los límites. No concede permisos, no crea usuarios y no accede a datos de producción.
