# Proyecto Centinela — Plan maestro de acciones

**Versión:** 1.1  
**Fecha de creación:** 31/10/2026  
**Rama de referencia:** `main`  
**Estado:** Plan vivo; sujeto a revisión y reordenamiento según hallazgos, prioridades operativas y restricciones de infraestructura.

## Propósito y reglas de gestión

Este documento convierte los hallazgos de la auditoría estática y las necesidades funcionales conocidas en una hoja de ruta ejecutable. No reemplaza la bitácora: aquí se mantiene el plan y su estado; en `notas_contexto_pwa.txt` se registran cronológicamente decisiones, cambios, pruebas, incidentes y evidencias.

Reglas permanentes:
1. Los cambios no destructivos y sus pruebas van directamente a `main`.
2. Crear una rama separada solo si existe riesgo real (cambio destructivo/irreversible, seguridad o privacidad, alteración de datos operativos, aislamiento imprescindible) o si el usuario lo solicita.
3. No modificar datos operativos reales durante auditorías o pruebas. Las lecturas SELECT están permitidas; INSERT/UPDATE/DELETE requieren autorización explícita.
4. Para cambios importantes, completar implementación, pruebas automatizadas, revisión de seguridad, pruebas de roles/usuarios y regresión antes de dar el trabajo por terminado.
5. Los agentes deben ejecutar recorridos funcionales como usuarios/roles de prueba, no limitarse a producir informes.
6. Agrupar cambios y despliegues. Antes de publicar, comprobar cuota y estado de Vercel; no desplegar por cada commit.
7. No declarar pruebas, despliegues o validaciones exitosas sin evidencia verificable.
8. Registrar avances, bloqueos, decisiones y enlaces en la bitácora.
9. Este plan es revisable: nuevas necesidades pueden insertarse, reordenarse, dividirse o cancelarse, dejando constancia del motivo.

## Estado ejecutivo

- **En curso / siguiente prioridad:** Fase 1 — blindaje de frontend y prevención de corrupción accidental.
- **Pendiente:** validación autenticada integral de permisos y recorrido E2E del auditor Caquitas/Mayordomo.
- **Pendiente:** definición e implementación del alcance PWA/offline.
- **Pendiente:** completar módulos operativos y consolidar el ciclo del Pulmón.
- **Pendiente:** optimización, mantenimiento y automatizaciones.
- **No iniciado como trabajo de implementación:** las fases funcionales que siguen a continuación. Su inclusión en este plan no significa que estén implementadas.

---

## Fase 0 — Cerrar verificaciones de auditoría y establecer línea base

**Prioridad:** Alta  
**Estado:** Parcial; quedan verificaciones en vivo.

- [ ] Ejecutar la auditoría integral Caquitas a través de Mayordomo desde una sesión real autorizada.
- [ ] Verificar rechazo de sesión válida con rol no autorizado (403) y rechazo de anónimo/token inválido (401).
- [ ] Confirmar que la UI solicita explícitamente la tarea `auditoria-integral-leu`; el llamado actual observado en `mayordomo001.js` envía cuerpo vacío y por defecto ejecuta `auditoria-extintores-resumen`.
- [ ] Confirmar que un error de lectura en cualquier fuente se informa como auditoría incompleta y nunca como éxito total.
- [ ] Verificar deployment de producción de Vercel contra el SHA actual de `main`, sin disparar publicación innecesaria.
- [ ] Conservar los resultados de SQL de octubre como snapshot histórico; no tratarlos como inventario operativo actual.
- [ ] Registrar versión de funciones, SHA de frontend y evidencias de cada prueba.

**Criterio de cierre:** auditoría integral invocada desde la PWA con identidad autorizada, resultado verificable, denegación comprobada para rol no autorizado y límites/fallos informados correctamente.

## Fase 1 — Blindaje del frontend y prevención de corrupción accidental

**Prioridad:** Crítica  
**Estado:** Pendiente; próximo ciclo de implementación.

### 1.1 XSS y construcción segura del DOM
- [ ] Revisar y corregir inserciones de datos dinámicos mediante `innerHTML` en `bomberos.js` y `controlesBase.js`.
- [ ] Usar `createElement`, `textContent` y asignación segura de propiedades cuando corresponda.
- [ ] Validar URLs de fotografías: permitir solo HTTPS y orígenes/rutas de almacenamiento autorizados; rechazar protocolos peligrosos.
- [ ] Revisar atributos `alt`, `title`, enlaces y cualquier otro punto donde datos de usuario o base se interpolen en HTML.
- [ ] Agregar pruebas con comillas, etiquetas, atributos de evento, URLs maliciosas y texto Unicode.

### 1.2 Errores de backend
- [ ] Corregir la visualización de errores en `moduloPulmon.js`, `bomberos.js` y `gestorTablas.js`.
- [ ] Mostrar errores como texto, no como HTML.
- [ ] Evitar exponer tokens, SQL, rutas internas, nombres de secretos o detalles sensibles del backend.

### 1.3 Gestor universal de tablas
- [ ] Separar explícitamente modo visor y modo editor.
- [ ] Deshabilitar edición/borrado genérico de tablas operativas salvo allowlist justificada.
- [ ] Preservar tipos reales: números, booleanos, fechas, JSON, null y relaciones; no convertir todo a texto.
- [ ] Verificar permisos en backend/RLS; ocultar botones no constituye control de acceso.
- [ ] Incorporar confirmación reforzada, registro/auditoría y validaciones por tabla/campo donde la edición sea necesaria.
- [ ] Probar que roles sin permiso no pueden editar ni borrar mediante llamadas directas.
- [ ] No ejecutar UPDATE/DELETE reales como parte de la validación.

### 1.4 Identidad del inspector
- [ ] Revisar persistencia del nombre del inspector en `localStorage`.
- [ ] Evitar que un equipo compartido conserve o reutilice la identidad del usuario anterior.
- [ ] Asociar autoría de controles a la identidad autenticada del usuario en backend.
- [ ] Limpiar o invalidar datos locales sensibles al cerrar sesión y al cambiar de cuenta.

**Criterio de cierre:** pruebas de seguridad/regresión aprobadas, sin interpolaciones peligrosas conocidas en los puntos revisados y sin capacidad de edición/borrado genérico no autorizada.

## Fase 2 — Autorización efectiva y pruebas por perfil

**Prioridad:** Crítica  
**Estado:** Pendiente; parcialmente cubierta por matriz informativa.

- [x] Definir criterio funcional de permisos del Pulmón (acuerdo del usuario, 31/10/2026): Bombero Referente y niveles superiores pueden administrar extintores y alvéolos; Bombero Inspector solo puede ejecutar rotaciones de extintores entre Pulmón y Producción, con trazabilidad obligatoria y sin permisos de administración del inventario.
- [ ] Traducir el criterio a permisos granulares y políticas RLS verificadas. No reutilizar `pulmon.update` para el Inspector.
- [ ] Probar cada acción en interfaz y directamente contra API/RPC/Edge Functions.
- [ ] Verificar RLS, grants, funciones SECURITY DEFINER, políticas de Storage y validación de roles en Edge Functions.
- [ ] Probar acceso a controles, anomalías, inventario, trazabilidad, usuarios, reportes, fotos/archivos y movimientos.
- [ ] Probar sesiones expiradas, logout, cambio de usuario, passkeys, 2FA y recuperación de cuenta.
- [ ] Confirmar que perfiles de consulta no puedan ejecutar escrituras aunque manipulen frontend o llamadas HTTP.
- [ ] Ejecutar recorridos completos como usuarios de prueba y conservar evidencias reproducibles.

**Criterio de cierre:** matriz de permisos respaldada por pruebas efectivas en backend para todos los perfiles relevantes.

## Fase 3 — PWA, instalación y comportamiento offline

**Prioridad:** Alta  
**Estado:** Pendiente de definición/implementación.

- [ ] Definir qué funciones deben operar offline y cuáles requieren conexión.
- [ ] Incorporar manifest, nombre, iconos, colores y configuración de instalación.
- [ ] Implementar service worker con caché selectiva y versionada.
- [ ] No cachear respuestas privadas, tokens, datos sensibles ni información de controles sin una política explícita y segura.
- [ ] Diseñar cola offline para operaciones permitidas, con identificador idempotente, fecha, usuario y sincronización controlada.
- [ ] Evitar duplicados o pérdida de controles al recuperar conexión.
- [ ] Probar instalación y actualización en Windows/Android, pérdida/restablecimiento de conexión y cierre de sesión.
- [ ] Mantener la cola GPS existente compatible y documentar su comportamiento.

**Criterio de cierre:** instalación verificada y comportamiento offline documentado/probado, sin exposición de información privada ni sincronizaciones duplicadas.

## Fase 4 — Completar módulos operativos

**Prioridad:** Alta  
**Estado:** Parcial.

- [ ] **Extintores:** mantener lo implementado; verificar controles, historial, estados y trazabilidad.
- [ ] **Hidrantes:** mantener lo implementado; verificar controles e historial.
- [ ] **ECAS:** completar flujo de control y guardado sobre el mapa existente.
- [ ] **Válvulas:** implementar mapa, identificación, control, historial y anomalías.
- [ ] **VECAS:** definir alcance/datos y completar módulo.
- [ ] **PECAS:** definir alcance/datos y completar módulo.
- [ ] **IPP:** definir alcance/datos y completar módulo.
- [ ] Unificar criterios de estados, formularios, validación, autoría, fechas, historial y reportes.
- [ ] Probar recorridos de punta a punta por cada módulo y por rol.

**Criterio de cierre:** cada instalación contemplada tiene identificación, control, persistencia, historial, anomalías y permisos probados.

## Fase 5 — Pulmón: inventario, movimientos y ciclo de vida

### Matriz de permisos acordada (31/10/2026)

| Perfil | Crear/cambiar/eliminar alvéolos | Crear/cambiar/eliminar extintores del inventario | Rotar extintores Pulmón ↔ Producción |
|---|---:|---:|---:|
| Bombero Inspector | No | No | Sí |
| Bombero Referente | Sí | Sí | Sí |
| Supervisor y jefaturas superiores | Sí | Sí | Sí |
| Gerencia | Sí, por jerarquía acordada | Sí, por jerarquía acordada | Sí |
| Administrador / Superadministrador | Sí | Sí | Sí |

**Alcance de la rotación del Bombero Inspector:** consultar el stock necesario para elegir un equipo, seleccionar un reemplazo compatible, registrar la salida del Pulmón y la instalación en Producción; registrar el movimiento inverso cuando el extintor titular vuelva al Pulmón. Debe quedar identificado el usuario autenticado, fecha/hora, equipo titular, equipo reemplazante, origen, destino y motivo. El permiso no habilita altas/bajas/cambios generales de inventario ni creación/edición/eliminación de alvéolos.

**Regla de operación:** no se exige autorización individual previa para cada recambio. La autorización se concede al rol; la trazabilidad y las validaciones automáticas constituyen el control posterior. El sistema debe bloquear incompatibilidades, doble asignación, equipo no disponible y vencimiento con 30 días o menos (o fecha no verificable).

**Nota de jerarquía:** `Mantenimiento` es un rol técnico separado de la línea jerárquica operativa; su alcance sobre el Pulmón debe conservarse/revisarse explícitamente, no inferirse como si fuera Bombero Referente. Los perfiles Administrador y Superadministrador mantienen sus capacidades administrativas.

**Prioridad:** Alta  
**Estado:** Parcial; requiere consolidación funcional.

- [ ] Confirmar modelo de datos y relaciones entre inventario, alvéolos, trazabilidad y ubicaciones.
- [ ] Mantener estados claros: disponible, en recarga, en uso/instalado, enviado a Bertolez y retornado.
- [ ] Validar asignación única de extintor/alvéolo y bloquear doble asignación concurrente.
- [ ] Registrar cada movimiento con origen, destino, responsable, fecha, motivo y activo relacionado.
- [ ] Controlar vencimiento MM/YY y prueba hidráulica YYYY con validación de formatos y fechas.
- [ ] Incorporar calendario/reglas de recarga anual y alertas por vencimiento.
- [ ] Aplicar compatibilidad de reemplazo:
  - PQS → PQS, Halón o CO2.
  - Halón → Halón.
  - CO2 → CO2 o Halón.
  - K → K.
- [ ] Para reemplazos provisorios, excluir vencidos, fechas ausentes/ inválidas y equipos con 30 días o menos de vigencia; exigir más de 30 días.
- [ ] Evitar doble recambio cuando un equipo de Pulmón está próximo a vencer y coordinar la programación de recargas.
- [ ] Revisar candidatos del Pulmón y duplicados de serie con reglas verificables; no inventar ni eliminar activos automáticamente.
- [ ] Dimensionar alvéolos según inventario real validado, no según registros ficticios.
- [ ] Probar concurrencia, bloqueos, devoluciones, fallos de red y trazabilidad completa.

**Criterio de cierre:** ciclo completo de salida, reemplazo, recarga, devolución y reasignación trazable, sin dobles asignaciones ni movimientos perdidos.

## Fase 6 — Rendimiento, calidad y mantenimiento

**Prioridad:** Media  
**Estado:** Pendiente.

- [ ] Reemplazar `select('*')` por selección explícita de columnas.
- [ ] Llevar filtros y paginación al servidor donde corresponda.
- [ ] Optimizar la consulta del último control de hidrantes y el filtrado del Pulmón.
- [ ] Evaluar simplificación geométrica para visualización GPS sin alterar coordenadas originales.
- [ ] Medir tiempos y volumen de carga en mapas, listados, Pulmón y recorridos.
- [ ] Incorporar análisis estático/lint y un conjunto de pruebas frontend repetible compatible con ES Modules.
- [ ] Revisar módulos extensos y refactorizar gradualmente, sin reescrituras masivas.
- [ ] Verificar y limpiar artefactos residuales (`tore app.js`, `controles.js.bak`) solo después de comprobar referencias.
- [ ] Corregir `Version.txt` para que contenga una versión real o eliminarlo si no tiene uso.
- [ ] Definir fallback para CDN externos y documentar dependencias.
- [ ] Añadir métricas básicas de errores y rendimiento sin registrar datos personales innecesarios.

**Criterio de cierre:** mejora medida, regresiones aprobadas y mantenimiento reproducible.

## Fase 7 — Automatización, informes y gestión

**Prioridad:** Media  
**Estado:** Pendiente / evolución funcional.

- [ ] Distribuir anomalías y tareas con matriz Eisenhower.
- [ ] Gestionar responsables, plazos, vencimientos, recordatorios y escalamiento.
- [ ] Generar borradores de correo y notificaciones con destinatarios autorizados.
- [ ] Producir informes por sector, responsable, tipo de instalación y período.
- [ ] Incorporar KPI de cumplimiento, vencimientos, reincidencias, tiempos de resolución y estado de inventario.
- [ ] Mantener historial de decisiones y cambios.
- [ ] Evaluar integración Microsoft corporativa (SharePoint, Power Automate, Power Apps) si TI exige migración o integración.
- [ ] Mantener interoperabilidad/exportación para evitar dependencia innecesaria de un único proveedor.

**Criterio de cierre:** automatizaciones con responsables y trazabilidad, notificaciones verificadas y métricas consistentes con los datos fuente.

---

## Método de ejecución por ciclos

1. **Ciclo A — Blindaje:** Fase 1 completa y pruebas de regresión.
2. **Ciclo B — Permisos:** Fase 2 y cierre de las verificaciones pendientes de Fase 0.
3. **Ciclo C — PWA:** Fase 3, con política offline definida antes de cachear datos.
4. **Ciclo D — Operación:** Fases 4 y 5, priorizando los flujos que impactan la seguridad industrial diaria.
5. **Ciclo E — Calidad y automatización:** Fases 6 y 7.

El orden no es rígido: un riesgo crítico nuevo puede adelantar una tarea; una dependencia técnica puede reordenar ciclos. Todo cambio de prioridad debe quedar explicado en la bitácora.

## Registro de cambios del plan

| Fecha | Versión | Cambio |
|---|---|---|
| 31/10/2026 | 1.0 | Creación del plan maestro a partir de auditoría estática, pendientes de validación y hoja de ruta funcional. |
| 31/10/2026 | 1.1 | Se incorpora matriz explícita de permisos Pulmón: Bombero Inspector rota; Bombero Referente y niveles superiores administran inventario y alvéolos. Sin autorización individual por recambio; trazabilidad obligatoria. |

## Enlaces de referencia

- [Rama main](https://github.com/roquemontoya/proyectocentinela/tree/main)
- [Bitácora](https://github.com/roquemontoya/proyectocentinela/blob/main/notas_contexto_pwa.txt)
- [Auditoría estática inicial](https://github.com/roquemontoya/proyectocentinela/blob/main/AUDITORIA_CODIGO_PWA_2026-10-27.md)
- [Plan de auditorías](https://github.com/roquemontoya/proyectocentinela/blob/main/PLAN_AUDITORIAS_CENTINELA.txt)
