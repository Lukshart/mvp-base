# Etapa 15 — Revisión de seguridad de Taller

## Alcance y precedencia

Revisión de Vehículos, OT, Recepción, Diagnósticos, Servicios/Productos,
aprobación, materiales, Plazas, Historial y selectores. AGENTS.md prevalece;
se conserva el contrato Core de membresías y módulos. La SPEC definitiva MVP
(VIN opcional, checklist definida) es la utilizada, no la propuesta histórica
de actualización que aún exigía VIN y dejaba checklist pendiente.

## Hallazgos antes de modificar

1. Algunas mutaciones (Vehículos, creación OT, Recepción, Diagnósticos y
   planificación) autorizan antes de la transacción pero no releen la autoridad
   al escribir. Una revocación concurrente puede no participar en el conflicto.
2. Las capacidades de Taller están dispersas entre conjuntos de roles. El
   frontend recibe solo rol, perdiendo el contexto de perfil personalizado.
   Se explicitarán capacidades preservando la operación ya implementada para
   MEMBER con perfil Taller, como el precedente WORKS_OPERATE del Core.
3. El reintento de materiales devuelve el resultado interno previamente guardado
   por expansión de objeto. Un recibo legacy que incluya costos puede filtrarlos.
4. El selector de Clientes permite que clienteId almacenado reemplace la identidad
   de documento al construir su DTO. Debe omitir referencias inconsistentes.

## Riesgo Core detectado y límite de la etapa

`firestore.rules`, lectura de `negocios/{businessId}/inventario/{itemId}`:
TECNICO y perfiles con módulos como Inventario/Proyectos pueden leer el documento
completo, incluidos costoBase/costoPromedio/valorInventario. Firestore no permite
ocultar campos individuales en una lectura autorizada. Ocultarlos en React o en
los DTOs de Taller no cierra ese acceso independiente al Core.

No se cambia el contrato global de Inventario en esta etapa: otros módulos leen
estos documentos. Se recomienda al mantenedor definir proyección pública o lectura
backend de catálogo para todos sus consumidores, y luego restringir las lecturas
completas a la capacidad Core de costos. Requiere pruebas Core y compatibilidad.
La aceptación global «costos protegidos por cualquier vía» queda pendiente de
resolver ese contrato; no debe presentarse esta etapa como seguridad integral cerrada.

## Matriz compatible

| Perfil | Lectura | Operación | Crear Vehículo/OT | Aprobación | Administración | Costos Taller |
|---|---|---|---|---|---|---|
| OWNER / ADMIN sin perfil personalizado | Sí | Sí | Sí | Sí | Sí | Sí |
| TECNICO sin perfil personalizado | Sí | Sí | Sí | No | No | No |
| MEMBER legacy sin perfil personalizado | Sí | Sí | No | No | No | Sí (Core) |
| MEMBER con perfil activo que incluye Taller | Sí | Sí | No | No | No | No |
| Otros roles / sin módulo / membresía inactiva | No | No | No | No | No | No |

No se crean roles ni campos de permisos en membresías. El Core actual configura
módulos, no capacidades individuales de Taller; un perfil Taller de solo lectura
independiente requiere un contrato adicional y no se inventa en esta etapa.

## Verificación

Ejecutada el 13-10-2026, sobre emuladores sin importar ni exportar datos locales:

| Comando | Resultado |
|---|---|
| `npm run test:rbac` | OK: matriz frontend/backend, roles y perfiles |
| `npm run test:vehicles-model` | OK |
| `npm run test:vehicles-ui` | OK (smoke de código, no recorrido manual de navegador) |
| `npm run test:work-orders-model` | OK |
| `npm run test:work-orders-ui` | OK (smoke de código, no recorrido manual de navegador) |
| `npm run test:vehicles-integrated` | `VEHICLES_INTEGRATED_LOCAL_OK`, salida 0 |
| `npm run test:work-orders-integrated` | Salida 0: OT, Recepción, Diagnósticos, planificación, Plazas, aprobación, ejecución, materiales, cierre e Historial |
| `npm run test:rules` | `RULES_SMOKE_OK`, salida 0 |
| `npm --prefix functions run lint` | OK |
| `npm run build` | OK; advertencia de chunks mayores a 500 kB |
| `git diff --check` | OK |

La nueva matriz integrada cubre 37 Functions × 5 escenarios (185 rechazos):
sin sesión, usuario de otro negocio, membresía inactiva, perfil sin Taller y
usuario suspendido. Además verifica 65 denegaciones SDK sobre las 13 colecciones
internas (get/list/create/update/delete), incluyendo OWNER.

Se comprobó revocación entre la autorización inicial y la transacción: se rechaza
la creación sin persistir Vehículo ni recibo de idempotencia. Se inyectó costo
sintético en un recibo legacy y se verificó que el reintento de materiales no lo
expone. Las suites existentes verifican además estados inválidos, referencias
ajenas, permisos de aprobación/Plazas, costos, concurrencia e idempotencia.

La primera ejecución integrada detectó una capacidad denegada serializada como
null en lugar de false para perfiles sin módulos resueltos. Se corrigió el
retorno booleano y se añadió regresión; la repetición completa pasó.

La prueba sintética también **confirmó**, no resolvió, la exposición Core:
un TECNICO obtiene costoBase mediante lectura SDK de Inventario; el DTO Taller
del mismo ítem no devuelve campos de costo. El mensaje `WORKSHOP_SECURITY_OK`
acredita la matriz negativa de Taller, no la aceptación global del riesgo Core.

El runtime Java del emulador de reglas imprimió un NullPointerException durante
el apagado, después de `RULES_SMOKE_OK` y salida 0. No hubo aserciones fallidas;
se registra esta incidencia del entorno sin ocultarla. Build y emuladores
requirieron ejecución fuera del sandbox tras restricciones locales; no hubo
deploy ni acceso a datos productivos.

## Correcciones aplicadas

- `functions/tallerAccess.js` centraliza capacidades de Taller sin reemplazar
  la autorización Core. Reutiliza `requireOperationalBusinessAccess`,
  `assertBusinessCanOperate` y `resolveBaseTaxSettings`.
- Vehículos, OT, Recepción, Diagnósticos, planificación, ejecución, materiales,
  aprobación, cierre y Plazas releen membresía, perfil, usuario, negocio y
  configuración de impuestos dentro de la transacción. La lectura participa
  en la detección de cambios concurrentes; no se usa negocioActivoId como permiso.
- Se conserva la comprobación específica de aprobación y los permisos
  administrativos de Plazas y modificación de Vehículos.
- Materiales devuelve una lista explícita de campos también en reintentos;
  un resultado legacy con costos no se propaga al DTO de operación.
- El selector de Clientes omite identidades inconsistentes; sus respuestas,
  catálogo, responsables e Historial siguen acotadas sin costos internos.
- Las páginas reciben el contexto completo de acceso, incluido perfil y módulos,
  y utilizan `hasBusinessPermission` en lugar de conjuntos de roles locales.
  La ruta protegida Core se conserva; la interfaz no sustituye al backend.
- No se modifican reglas globales, roles, stock, kernel económico ni persistencia
  local de emuladores. Los cambios preexistentes de etapa 14 se preservan.

## Controles inspeccionados

| Superficie | Control |
|---|---|
| Todas las Functions Taller | Sesión autenticada, negocio operativo y membresía activa del negocio solicitado |
| Referencias | Documentos bajo negocio autorizado; validación de negocio/identidad de OT, Vehículo, Cliente, Servicio, Producto y Plaza |
| Mutaciones sensibles | Capacidades backend y revalidación transaccional de autoridad, además de invariantes y estados existentes |
| Aprobación y Plazas | Aprobación separada de operación; administración de Plazas reservada a OWNER/ADMIN |
| Materiales | Escritura económica exclusiva del backend; DTO de movimientos con costos según capacidad; reintentos acotados |
| Historial | Eventos inmutables por SDK, lectura mediante DTO sin costo; sin reconstrucción artificial de eventos |
| Rutas y botones | Protección Core y capacidades coherentes con membresía/perfil; sin autorización basada solo en UI |
| Colecciones internas | Reglas explícitas o denegación final; sin lectura/escritura SDK incluso para OWNER |

Colecciones internas cubiertas por pruebas de get/list/create/update/delete:
`vehiclePlateKeys`, `vehicleVinKeys`, `vehicleCreateRequests`, `otCounters`,
`otCreateRequests`, `otApprovalState`, `otApprovalRequests`,
`otServiceExecutionRequests`, `otClosureRequests`, `tallerMaterialRequests`,
`tallerMaterialBalances`, `plazaOccupancyKeys` y la subcolección `historial` de OT.

## Archivos de esta etapa

- Backend: `functions/tallerAccess.js`, `vehiclePersistence.js`,
  `workOrderPersistence.js`, `workOrderMaterials.js`, `workOrderPlazas.js`;
  `functions/package.json` incorpora el helper al lint.
- Frontend: `src/domain/rbac.mjs`, `workshopPlazaModel.mjs`, `src/app/App.jsx`,
  páginas de Vehículos/OT, `DiagnosisPanel.jsx` y `ServicePlanningPanel.jsx`.
- Pruebas: `scripts/workshop-security-cases.mjs`, `rbac-smoke.mjs`,
  `work-orders-integrated-local.mjs`, `work-order-material-cases.mjs`,
  `work-order-model-smoke.mjs`, `work-order-ui-smoke.mjs`, `vehicle-ui-smoke.mjs`.

El diff de trabajo también contiene cambios previos de Historial y persistencia
local; no deben atribuirse a esta revisión de seguridad ni descartarse.

## Dictamen y riesgos residuales

**Etapa 15 no cerrada para aceptación integral.** Los controles de Taller
probados funcionan; queda abierta la protección de costos por la lectura
directa del catálogo Core. El contrato `docs/MODULE_DEVELOPMENT_CONTRACT.md`
requiere revisión explícita del mantenedor antes de alterar Rules globales.

Propuesta para esa revisión:

1. Contrato afectado: lectura SDK de `negocios/{businessId}/inventario/{itemId}`
   en `firestore.rules` y consumidores Core del catálogo.
2. Necesidad: negar costos a Técnico/perfiles sin capacidad, no solo ocultarlos.
3. Integración aislada insuficiente: el cliente puede omitir los DTOs de Taller
   y consultar el documento completo con sus credenciales.
4. Cambio mínimo a acordar: ofrecer datos no sensibles por DTO/proyección y
   reservar el documento económico completo a usuarios con capacidad de costos.
5. Riesgo de compatibilidad: negar la lectura completa sin adaptar consumidores
   rompería selectores/listados de Inventario, Proyectos y otros módulos.
6. Verificación requerida: SDK get/list y consultas, capacidades de todos los
   roles/perfiles y regresión de todos los consumidores afectados, sin migrar
   ni alterar economía, stock o snapshots históricos.

No se incorporaron capacidades configurables nuevas en membresías ni se cambió
la semántica legacy de MEMBER. No se realizó despliegue ni prueba manual completa
de interfaz. Las carpetas `firebase-export-*` ya presentes siguen sin seguimiento
en Git; no fueron leídas, borradas, restauradas ni añadidas. No deben incluirse
en el commit del módulo.
