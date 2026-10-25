# Mayordomo_001 — Auditoría integral de consistencia de Centinela

Estado: diseño técnico inicial en rama aislada `mayordomo-001-auditoria-integral`.
Base: `main` después de integrar Mayordomo_001.
Principio no negociable: solo lectura. Ninguna regla puede corregir, borrar, normalizar ni mover datos automáticamente.

## Objetivo

Extender el auditor inicial (Extintores / trazabilidad / Pulmón) para cubrir la PWA de forma transversal: activos maestros, controles por familia, anomalías, movimientos, recorridos, territorios y configuración de roles/permisos. La cobertura se determina por el esquema real; no se presume que una tabla sin filas o un campo histórico sea un error.

## Catálogo de tablas observado en Supabase

### Activos y datos maestros
- `leu`: maestro común de activos (etiqueta, categoría, sector, ronda, ubicación WKT y atributos técnicos JSONB).
- `Extintores`, `hidrantes`, `ecas`, `Valvulas`, `vecas`, `pecas`, `ipp`, `Bomberos`, `inicio`, `territorios_dinamicos`.

### Controles e inspecciones
- `controles_e`, `controles_h`, `controles_ecas`, `controles_vecas`, `controles_v`, `controles_pecas`, `controles_pc`, `controles_c`, `controles_es`, `controles_pfp`.

### Trazabilidad, anomalías y movimientos
- `extintores_trazabilidad`, `anomalias`, `movimientos_extintores`, `reemplazos_temporales_extintores`, `movimientos_reemplazos_extintores`, `pulmon_alveolos`.

### Recorridos y caminos
- `recorridos_gps`, `puntos_recorrido_gps`, `caminos_internos`.

### Autorización y auditoría de usuarios
- `app_roles`, `app_permissions`, `app_role_permissions`, `app_user_roles`, `app_user_profiles`, `app_user_audit`.
- En auditoría de permisos, revisar estructura y relaciones; no exponer información personal innecesaria ni tokens de recorridos.

Tablas de catálogo espacial (`spatial_ref_sys`, `geometry_columns`, `geography_columns`) se excluyen de las reglas de calidad operativa; se evalúan aparte como configuración técnica.

## Relaciones confirmadas por claves foráneas

- Controles de activos y trazabilidad: `controles_*`.id_activo → `leu`.id.
- `anomalias`.id_activo → `leu`.id.
- `Extintores`.activo_leu_id → `leu`.id.
- `Extintores`.alveolo_id → `pulmon_alveolos`.id.
- `pulmon_alveolos`.activo_extintor_id → `Extintores`.id.
- `extintores_trazabilidad`.id_activo → `leu`.id.
- `movimientos_extintores`.id_activo → `leu`.id.
- Reemplazos temporales: activo titular y reemplazo → `leu`; control inicio/fin → `controles_e`.
- `movimientos_reemplazos_extintores` se relaciona con reemplazos temporales y activos titulares.
- Recorridos: `puntos_recorrido_gps`.recorrido_id → `recorridos_gps`.id; `caminos_internos`.recorrido_origen_id → `recorridos_gps`.id.
- Permisos: `app_role_permissions` relaciona `app_roles` con `app_permissions`; `app_user_roles`.role_id → `app_roles`.

Las claves foráneas detectan solo relaciones declaradas en la base. Las relaciones lógicas sin FK se deben documentar explícitamente y etiquetar con menor certeza.

## Reglas de auditoría por fases

### Fase A — Integridad estructural
1. Duplicados exactos o normalizados en identificadores de negocio (sin asumir que nombres/etiquetas son únicos sin confirmación).
2. Referencias huérfanas en columnas lógicas como `id_activo`, `activo_leu_id`, `alveolo_id`, `activo_extintor_id`, `recorrido_id` y `reemplazo_id`.
3. Campos de relación vacíos cuando la operación exige vínculo, distinguiendo registros históricos/importados.
4. Valores fuera de dominio (estados, categorías, tipos) y diferencias por mayúsculas/espacios.
5. Fechas inválidas, futuras o incoherentes; formatos mixtos de fechas y vencimientos.
6. Coordenadas/geom ausentes, inválidas o sospechosas, sin cambiar la ubicación.
7. Campos importados de relleno (`field_*`) o datos sin semántica confirmada: advertencia para revisión, no error automático.

### Fase B — Consistencia cruzada
1. Activos del maestro `leu` que no corresponden a un registro de la tabla específica, y registros de módulo que no encuentran activo maestro.
2. Extintores ↔ Pulmón: un extintor asignado a más de un alvéolo; alvéolo asignado a múltiples activos; estado del alvéolo incompatible con la asignación; referencias cruzadas que no coinciden.
3. Extintores ↔ trazabilidad ↔ controles ↔ movimientos: IDs/etiquetas/ubicación que no concuerdan, controles sin activo, movimientos sin activo, movimientos cronológicamente imposibles.
4. Reemplazos temporales: titular = reemplazo, reemplazo simultáneo en más de un lugar, fecha de fin anterior a inicio, estado abierto con devolución registrada o estado cerrado sin devolución, ausencia de eventos de instalación/devolución cuando la regla de negocio lo exige.
5. Anomalías: vínculo a activo/control inexistente, estados de resolución inconsistentes con fecha/detalle de resolución.
6. Hidrantes, ECAS, válvulas, VECAS, PECAS, IPP y demás familias: controles sin activo, IDs de origen duplicados cuando deberían identificar unívocamente, fechas y estados incompatibles.
7. Recorridos: secuencias de puntos duplicadas, puntos fuera de rango, recorrido finalizado antes de iniciado, conteo/distancia incompatibles con puntos, caminos sin recorrido origen válido.
8. Territorios: padre inexistente (si no está cubierto por FK), jerarquías circulares, polígonos vacíos o geometrías inválidas.
9. Roles y permisos: asignaciones duplicadas, referencias inválidas, permisos sin rol asociado y discrepancias entre la ruta protegida y los permisos configurados. No cambiar roles automáticamente.

### Fase C — Reglas operativas y semánticas
- Validar reglas de reemplazo de extintores conocidas: PQS admite PQS/Halon/CO2; Halon solo Halon; CO2 admite CO2/Halon; K solo K. Reportar incompatibilidades como hallazgo, nunca ejecutar el reemplazo.
- Revisar la regla de vencimientos/PH según formato existente, sin normalizar fechas ni inferir años ausentes.
- Detectar contradicciones entre estado operativo, ubicación, disponibilidad, movimientos y controles, solo donde la semántica de cada estado esté documentada.
- Cada regla debe registrar código, descripción, severidad, evidencia, tablas/campos involucrados, ejemplos limitados, fecha de ejecución y versión de reglas.

## Clasificación y confianza

- `error_confirmado`: restricción técnica o contradicción demostrable con evidencia.
- `inconsistencia_probable`: patrón contradictorio que necesita revisión humana.
- `dato_incompleto`: falta de un dato que puede ser legítimamente pendiente/histórico.
- `revision_humana`: el esquema o la semántica no permite decidir de forma segura.
- Severidades separadas: crítica/alta/media/baja/informativa. La severidad no equivale a certeza.

No convertir “pendiente de relevamiento” en error por sí solo. No marcar duplicados por nombres parecidos sin clave de negocio acordada. No considerar una tabla vacía como fallo automáticamente.

## Seguridad y ejecución

- El frontend nunca recibe service-role/secret keys ni tokens internos.
- El acceso interactivo sigue restringido a administrador/superadministrador; validar la autorización también en backend.
- El motor de reglas usa consultas de lectura explícitas, listas permitidas de tablas/campos y límites/paginación.
- No aceptar nombres de tabla/SQL arbitrario enviados por el cliente.
- Excluir secretos, tokens de recorrido y datos personales no necesarios de los resultados.
- No ejecutar UPDATE/INSERT/DELETE, triggers correctivos ni normalización automática.
- Exportación de informe JSON/CSV con resumen, reglas, evidencia y advertencias.
- Añadir pruebas de regresión con casos sintéticos; probar acceso anónimo denegado y sesión autenticada autorizada/no autorizada.

## Hallazgo técnico de seguridad pendiente

El análisis de esquema de Supabase devolvió una advertencia de RLS deshabilitado en `public.spatial_ref_sys`. Es una tabla de catálogo espacial y queda fuera de las reglas de calidad operativa, pero se debe revisar su exposición/permisos. No se habilitó RLS automáticamente porque hacerlo sin políticas podría afectar el funcionamiento.

## Orden de implementación recomendado

1. Inventario de esquema y catálogo de reglas, versionado.
2. Auditoría estructural de las tablas operativas y de las relaciones FK.
3. Reglas cruzadas para `leu`, controles, anomalías y trazabilidad.
4. Reglas de Pulmón/reemplazos/movimientos.
5. Reglas específicas para hidrantes, ECAS, válvulas, VECAS, PECAS, IPP y recorridos.
6. Informe por módulos, severidad, confianza y ejemplos.
7. Pruebas con datos sintéticos, control de acceso y regresión.
8. Comparar resultados con revisión humana antes de desplegar a producción.

## Estado actual

Este documento define el alcance inicial. No implica que todas las reglas estén implementadas ni verificadas. La auditoría existente sigue limitada principalmente a Extintores, trazabilidad y alvéolos hasta que se desarrollen y prueben las fases anteriores.
