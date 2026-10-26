# J.A.R.V.I.S. — Auditoría integral de consistencia de Centinela

Estado: diseño técnico inicial en rama aislada `mayordomo-001-auditoria-integral`.
Base: `main` después de integrar J.A.R.V.I.S..
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


## Catálogo funcional para J.A.R.V.I.S.

Este catálogo distingue el propósito deducido del nombre/esquema de una tabla de las reglas ya codificadas. Debe confirmarse con el código de cada módulo antes de tratar una inferencia como requisito definitivo.

| Área | Tablas | Propósito funcional conocido o inferido |
|---|---|---|
| Maestro geográfico y de activos | `leu` | Registro común de activos, etiqueta, categoría, sector, ronda, geometría WKT y atributos. Es el punto de unión de controles y anomalías. |
| Fichas específicas | `Extintores`, `hidrantes`, `ecas`, `Valvulas`, `vecas`, `pecas`, `ipp` | Datos propios de cada familia de equipo, además de la ficha común del maestro. Las claves y campos obligatorios varían por familia. |
| Bomberos / inicio | `Bomberos`, `inicio` | Tablas auxiliares de la experiencia operativa/inicio; el propósito exacto debe confirmarse contra los módulos consumidores. |
| Territorios y caminos | `territorios_dinamicos`, `caminos_internos` | Geometrías/sectores territoriales y caminos internos; revisar jerarquía, geometría y vínculos con recorridos. |
| Inspecciones | `controles_e`, `controles_h`, `controles_ecas`, `controles_vecas`, `controles_v`, `controles_pecas`, `controles_pc`, `controles_c`, `controles_es`, `controles_pfp` | Historial de controles por tipo de activo o formulario. Cuando existe `id_activo`, debe enlazar al activo correcto en `leu`; los campos obligatorios y estados se validarán por módulo. |
| Incidencias | `anomalias` | Registro de anomalías vinculadas a activos y su resolución. El cierre debe ser coherente con fecha y detalle de resolución, según el flujo real. |
| Extintores y trazabilidad | `extintores_trazabilidad` | Historial/identidad de extintores, relacionado con `leu`; verificar serial, tarjeta, ubicación e identidad sin inventar valores faltantes. |
| Inventario Pulmón | `pulmon_alveolos` | Alvéolos/capacidad del pulmón y asignación de extintores. Un extintor no debería ocupar dos alvéolos simultáneamente; estado y asignación deben concordar. |
| Movimientos | `movimientos_extintores`, `reemplazos_temporales_extintores`, `movimientos_reemplazos_extintores` | Movimientos de inventario, reemplazos provisionales y eventos asociados. Fechas, activo titular/reemplazo y eventos de devolución deben concordar. |
| Recorridos GPS | `recorridos_gps`, `puntos_recorrido_gps` | Cabecera de recorrido y puntos ordenados por secuencia con coordenadas/tiempo. |
| Autorización | `app_roles`, `app_permissions`, `app_role_permissions`, `app_user_roles` | Catálogo de roles y permisos y asignación de roles a usuarios. Debe auditarse con consultas mínimas, sin extraer información personal innecesaria. |
| Perfil y auditoría de usuario | `app_user_profiles`, `app_user_audit` | Perfil y registro de actividad/acciones. Se excluyen de la lectura masiva del motor inicial por minimización de datos; requieren auditoría separada con campos explícitos y aprobados. |

## Reglas de validación: estado real

### Ya codificadas en el motor inicial
- `REL-001`: controles cuyo `id_activo` no existe en `leu`.
- `REL-002`: controles sin `id_activo` (incompleto, no corrupción confirmada).
- `DUP-001`: posibles duplicados de identificadores/etiquetas en tablas específicas de activos; requiere revisión humana.
- `TRACE-001`: trazabilidad que referencia activos inexistentes en `leu`.
- `PUL-001`: alvéolos asignados a un extintor inexistente.
- `PUL-002`: mismo extintor asignado a más de un alvéolo.
- `MOV-001`: movimientos de extintores sin activo maestro.
- `ANO-001`: anomalías que apuntan a activos inexistentes.
- `ANO-002`: anomalías con estado de resolución aparentemente resuelto y fecha/detalle faltante.
- `REP-001`: reemplazo con fin anterior al inicio o activo titular igual al reemplazo.
- `GPS-001`: fin de recorrido anterior al inicio, secuencia repetida dentro del recorrido o coordenadas fuera de rango.
- `GEO-001`: activo maestro sin `ubicacion_wkt` (dato incompleto; solo aplica cuando requiere georreferenciación).

### Reglas de negocio que deben implementarse antes de afirmar cobertura integral
- Validación de tipo/capacidad, vencimiento `MM/YY` y prueba hidráulica `YYYY` para extintores.
- Compatibilidad de reemplazos: PQS admite PQS/Halon/CO2; Halon solo Halon; CO2 admite CO2/Halon; K solo K.
- Estado de Pulmón versus alvéolo ocupado/libre, disponibilidad, recarga y devolución; prevenir doble recambio cuando el vencimiento está a menos de 30 días o en el mes de vencimiento, según reglas del proyecto.
- Cronología completa de movimientos, retornos del proveedor y reinstalación en línea.
- Reglas específicas de campos requeridos, estados válidos, fechas y duplicidad para hidrantes, ECAS, válvulas, VECAS, PECAS e IPP.
- Integridad de territorios: geometría válida, padres existentes y ausencia de ciclos.
- Auditoría de relaciones y asignaciones de roles/permisos con proyección de columnas mínima.
- Verificación de que cada módulo realmente consume/guarda la tabla esperada; el nombre de una tabla por sí solo no prueba su uso.

## Seguridad de lectura y privacidad

El motor de auditoría masiva excluye ahora las tablas de perfil y auditoría de usuario porque la primera versión no tenía reglas que las necesitasen. No deben leerse con `select=*`; una futura auditoría de autorización debe seleccionar solo columnas estrictamente necesarias. El motor sigue siendo de solo lectura y no debe corregir datos automáticamente.

## Pruebas sintéticas

Se añadieron pruebas para referencias huérfanas de controles, asignaciones inválidas de Pulmón, cronología imposible de reemplazos, coordenadas GPS fuera de rango y dataset vacío. La CI debe pasar estas pruebas antes de considerar lista la rama. Estas pruebas no sustituyen la validación con datos reales ni las pruebas de autorización autenticada.

## Estado de cobertura

La etiqueta “auditoría integral” describe el objetivo, no una cobertura ya terminada. El motor actual es un primer subconjunto determinista; no usa IA generativa. Los resultados son hallazgos para revisión, no órdenes de reparación. La interfaz PWA, despliegue de la nueva función y pruebas autenticadas siguen siendo pasos separados y pendientes.


## Nuevas reglas operativas solicitadas: perímetro GPS y proveedor de recarga

### Perímetro GPS de planta
No basta con validar latitud/longitud en el rango mundial. Un punto puede ser geográficamente válido y estar a 20 cuadras de la planta. J.A.R.V.I.S. debe comparar cada control y punto de recorrido con un perímetro operativo aprobado de la fábrica y, cuando corresponda, con la posición conocida del activo controlado.

Diseño recomendado:
- Crear una geometría oficial del perímetro de planta a partir de la cartografía existente y una fuente cartográfica pública (por ejemplo, OpenStreetMap) solo como referencia para digitalización y contraste. La fuente pública no reemplaza la validación del perímetro por personal autorizado de planta.
- Mantener polígonos o zonas con versión, fecha de vigencia, origen y aprobador. Si hay sectores internos o áreas con mala recepción GPS, registrarlos explícitamente para ajustar la evaluación sin falsear el perímetro global.
- Al guardar un control, calcular si la posición está dentro del perímetro y la distancia a la ubicación esperada del activo. Si está fuera, crear una advertencia de GPS sospechoso, no rechazar ni alterar automáticamente el control.
- Configurar umbrales iniciales y calibrables: dentro del perímetro = normal; punto fuera pero cercano = advertencia; punto muy alejado (por ejemplo, cientos de metros o kilómetros) = posible fallo fuerte de GPS. Los umbrales definitivos se determinan midiendo datos reales y el tamaño del predio.
- Guardar latitud/longitud original, precisión reportada por el dispositivo si está disponible, distancia al perímetro/activo, resultado de validación y versión de la regla. No sustituir la posición original.
- Evitar que una posición GPS sospechosa se convierta en una ubicación nueva del activo. Debe distinguirse “ubicación fija del equipo” de “posición del dispositivo durante la inspección”.
- Implementar pruebas con ubicaciones conocidas dentro de planta, zonas problemáticas y puntos simulados fuera del predio. Si no existe precisión GPS en el navegador, dejarla como desconocida, no inventarla.

Estado: propuesta documentada; aún no implementada en el motor. La regla GPS-001 actual solo detecta coordenadas imposibles en el rango mundial, secuencias duplicadas y fechas invertidas.

### Seguimiento de equipos enviados a proveedor
El sistema necesita una vista de ciclo completo para saber cuántos extintores están con el proveedor, cuántos están pendientes de envío, cuántos están programados para salir, cuántos fueron despachados, cuántos debe devolver el proveedor, cuántos volvieron y cuáles están demorados.

Nombre del proveedor: en los registros anteriores del proyecto aparece “Vertoles”, pero el usuario ahora escribió “Bertoles”. No fijar todavía un nombre canónico sin verificarlo contra remitos/órdenes de compra o la razón social correcta. La tabla debe almacenar el nombre legal del proveedor y, si corresponde, su nombre comercial; evitar que ambas variantes creen proveedores duplicados.

Modelo de datos sugerido:
- `proveedores`: proveedor_id, razon_social, nombre_comercial, CUIT opcional, activo, contacto operativo.
- `ordenes_servicio_extintores`: orden_id, proveedor_id, tipo_servicio (recarga/prueba hidráulica/mantenimiento), estado, fecha_programada_envio, fecha_envio_real, fecha_devolucion_comprometida, fecha_cierre, remito_salida, remito_retorno y observaciones.
- `ordenes_servicio_extintores_detalle`: orden_id, extintor_id/activo_leu_id, vencimiento/PH al envío si aplica, estado_por_equipo, fecha de devolución individual y observación. Cada extintor debe estar identificable; no confiar solo en cantidades agregadas.
- Si el esquema actual de `movimientos_extintores` y `extintores_trazabilidad` ya permite reconstruir todos los eventos de envío y retorno de manera inequívoca, reutilizarlo y agregar las relaciones faltantes en vez de duplicar la fuente de verdad. Primero se audita su estructura y uso real en el código.
- Registrar eventos de envío, recepción parcial, devolución parcial, observación/rechazo y cierre; nunca asumir que una orden completa volvió porque llegó un lote.
- Reporte derivado: en proveedor actualmente, programados para envío, pendientes de programación, vencidos de retorno, devolución comprometida por semana/mes, retornados, y conciliación entre unidades despachadas y devueltas.
- Reglas de integridad: un extintor no puede figurar simultáneamente en dos órdenes abiertas incompatibles; las fechas deben ser coherentes; retorno no puede superar despacho por equipo; una orden solo se cierra cuando cada ítem está devuelto, cancelado justificadamente o conciliado por un responsable.
- Vincular el flujo con Pulmón para reflejar la etapa “en proveedor” y evitar que el extintor aparezca disponible para reemplazos mientras está físicamente fuera de planta.

Estado: el inventario/los movimientos existentes se deben inspeccionar antes de decidir si hace falta una tabla nueva. El esquema propuesto no se ha creado en Supabase y no se deben contar cantidades hasta reconciliar la identidad de cada equipo.


### Proveedor confirmado para el seguimiento de recargas

El usuario confirmó como proveedor a **Bertolez**, sitio oficial https://bertolez.com. La web oficial indica venta y recarga de extintores y prueba hidráulica; publica el domicilio comercial Corrientes 1680, Córdoba, teléfono 0351 867-8581, celular/WhatsApp +54 9 351 704-8630 y correo info@bertolez.com. Fuente: https://bertolez.com/ (consultada para esta documentación).

Registrar en Centinela como nombre comercial **Bertolez** y usar ese nombre en las vistas e informes. La web se identifica como “Bertolez SRL”; para campos fiscales/razón social y CUIT, confirmar con una factura/remito o constancia fiscal del proveedor antes de fijarlos como datos legales definitivos. No usar las variantes “Bertoles” o “Vertoles” como proveedores diferentes; si aparecen en registros históricos, normalizarlos al proveedor canónico solo después de revisar los documentos asociados.
