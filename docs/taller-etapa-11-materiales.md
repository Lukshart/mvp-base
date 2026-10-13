# Taller Automotriz: etapa 11 — consumo y devolución

## Resumen

Backend e interfaz implementados; verificaciones automáticas satisfactorias el 08-10-2026. La etapa no se declara cerrada: falta la comprobación visual autenticada y responsive. Contrato: SPEC Taller Automotriz MVP, secciones 8 y 11; modelo definitivo, secciones 15 y 16.6–16.7. AGENTS.md mantiene precedencia arquitectónica y de seguridad.

## Alcance

Salidas y devoluciones del ledger Core asociadas a OT y ServicioOT. Sin reservas, ventas, gastos, movimientos de Proyectos ni cambios del kernel económico.

## Implementación

### Revisión previa y extensión localizada necesaria

- El kernel `functions/inventoryAcquisition.js` ya resuelve baseline legacy, Q/V, promedio, moneda y salida valorizada. Se reutiliza sin modificarlo.
- Proyectos aporta el precedente de request idempotente, balance por salida y devolución compensatoria. Sus endpoints y cálculos de balance de Proyecto no se invocan desde Taller.
- Conflicto identificado: las Rules actuales del ledger conceden lectura completa a perfiles operacionales. Copiar ese permiso expondría costos de Taller contra la SPEC. Firestore no oculta campos individuales.
- Protección implementada y pendiente de decisión de Core: la lectura SDK de los dos tipos Taller se limita a roles con capacidad de costos; la operación usa un DTO backend sin costos. Retirar esta condición sin reemplazo puede exponer el ledger económico a perfiles sin esa capacidad.
- Las consultas compartidas de Proyectos y Reportes y sus índices también están en revisión de Core. El filtro actual de Reportes excluye consumos de Taller y documentos sin `tipo`; por tanto, no representa fielmente todos los movimientos físicos. No debe considerarse solución definitiva ni ocultarse ese efecto.
- Registro de Functions, Rules, consultas consumidoras e índices aparecen en el diff del PR y requieren la decisión de Core antes de declarar la integración lista. No se modificó el kernel económico protegido.
- Pruebas necesarias: Rules existentes, consultas de Proyectos/Reportes, rechazos de lectura de costos, integración OT y regresiones del kernel económico.

### Reglas de operación

- Salida: OT en reparación, aprobación vigente y huella del alcance coincidente; ServicioOT en progreso; producto perteneciente a la planificación de ese servicio. La cantidad consumida es independiente de la planificada: la SPEC no define un tope físico igual a la planificación.
- Devolución: parte de una salida real de la misma OT y servicio; admite servicio completado para corregir consumos. Rechaza OTs terminales. No requiere volver a aprobar una corrección compensatoria.
- Cantidades físicas: positivas y enteras. Aunque el kernel Core admite cantidades canónicas decimales, Taller restringe salidas y devoluciones a unidades enteras por decisión de UX solicitada el 08-10-2026. La restricción se valida en frontend y backend; la planificación ya era entera.
- El costo de salida usa el promedio Q/V del kernel (cuatro decimales), nunca el precio de venta. La salida que agota stock absorbe el saldo de valor exacto.
- Devoluciones parciales acumulan el valor a costo original, sin exceder el total de origen; la última repone el remanente monetario exacto. No se reescribe la salida ni se recalcula su costo con precios actuales.
- Actor, fecha, timestamps, stock, costo, moneda y snapshots se resuelven en backend.
- Colecciones internas: `tallerMaterialRequests/{requestId}` y `tallerMaterialBalances/{movimientoOrigenId}`, bajo el negocio. Acceso SDK denegado.

### Autoridad, transacciones e interfaz

- `registrarSalidaMaterialOT` y `registrarDevolucionMaterialOT` validan nuevamente negocio, membresía y perfil dentro de la transacción. Todos los registros pertenecen al mismo `negocioId`.
- Una única transacción escribe producto, movimiento, balance, recibo idempotente, timestamp de OT y evento de auditoría. La escritura común de la OT serializa consumo con cambios de alcance/estado. Todos los reads preceden a los writes.
- El recibo idempotente compara operación, actor, OT, servicio, referencia y cantidad. Nunca incluye costos, ni siquiera al reintentar con permisos distintos. Cambiar el payload con el mismo requestId se rechaza.
- `obtenerMaterialesOT` entrega cantidades, stock, movimientos y máximo devolvible. Solo agrega costos cuando la membresía posee capacidad Core de costos. Los eventos operacionales no contienen valores económicos internos.
- `ServiceMaterialsPanel` reutiliza `Button`, `ResponsiveDialog`, tablas y clases `erp-*` existentes. Se revisaron como precedentes los materiales de `WorksPage` y los formularios de diagnóstico/servicios. Muestra carga, vacío, error, reintento, confirmación y resultado; diferencia planificación de consumo neto y devuelve desde una salida concreta. El historial detallado queda plegado de forma predeterminada para reducir la carga cognitiva; se añadió un estilo localizado con tokens existentes porque el disclosure de Proyectos pertenece a ese dominio.
- El diff actual incluye los índices `movimientosInventario(negocioId,tipo)` y `movimientosInventario(negocioId,trabajoId,tipo)`; su permanencia depende de la consulta final acordada con Core. No se realizó deploy.

### Revisión explícita de consistencia económica

- Salida: `Q' = Q - cantidad`, `V' = V - costoTotal`; el kernel calcula el promedio resultante. No modifica el precio comercial ni crea reserva.
- Devolución: `Q' = Q + cantidad`, `V' = V + costoTotalDevuelto`. La cantidad y el valor acumulados no superan los de la salida original; el retorno final cierra exactamente ambos saldos.
- Prueba integrada: baseline de 13 unidades / 43,33 de valor; tres salidas agotan ambos saldos. Una adquisición sintética posterior, aplicada con el kernel Core, agrega 2 unidades / 20 de valor. Las devoluciones parciales y concurrentes restauran exactamente el costo histórico: saldo final 15 unidades / 63,33, sin modificar salidas originales. Hay 10 movimientos y 10 eventos, sin duplicados por reintento.
- La adquisición intermedia de este caso utiliza un fixture económico, no el endpoint de Compras. La suite de Inventario Core también se ejecutó como regresión independiente.

### Riesgos y pendientes reales

- Revisión PR #4 pendiente de Core: `firestore.rules` conserva la barrera de lectura de costos de movimientos Taller. `scripts/work-order-material-cases.mjs` verifica que un perfil sin capacidad de costos no pueda leerlos; retirarla aisladamente vulneraría la SPEC. `reportService.js` conserva provisionalmente un filtro que omite consumos Taller y documentos sin `tipo`; no resuelve Reportes y necesita un contrato de Core para lectura/clasificación segura. `workService.js` conserva el filtro de tipos Proyecto para que las consultas de perfiles personalizados no abarquen movimientos Taller protegidos. `firestore.indexes.json` conserva índices requeridos por esas consultas mientras no se defina el reemplazo. Estos cuatro cambios compartidos no deben considerarse aprobados por esta nota.
- `ClientSelector.jsx` mantiene por ahora `loadClients`: `NewVehiclePage` lo usa para seleccionar Clientes Core como técnico mediante el Callable acotado, ya que la consulta Core directa no concede ese acceso. Retirar la prop sin alternativa rompería el alta autorizada. La decisión de integración del selector corresponde a Core. La variante global `ui-button--warning` de `components.css` sí se retiró: el botón de finalización usa una clase local de Taller con tokens existentes.
- Sugerencias revisadas: los movimientos nuevos de Taller incorporan `modeloEconomiaInventarioVersion` del kernel Core. `listarCatalogoTaller` todavía entrega precio comercial a roles sin `PRICING_READ`; no entrega costos, pero restringir el precio contradice la presentación actual del alcance y requiere decidir el permiso correcto con Core. `obtenerMaterialesOT` todavía lee todos los movimientos de la OT dentro de una transacción; no se cambia sin definir una estrategia de lectura que preserve coherencia con balances y permisos. Dividir los commits antiguos reescribiría historia del PR y no se realizó.
- Pendiente de aceptación: recorrido visual autenticado de consumo/devolución y comparación responsive con una pantalla Core equivalente. Se abrió la aplicación local, pero no se autorizó la consulta de la cuenta sintética necesaria para iniciar sesión; no se intentó eludir esa restricción. El smoke de UI es estático y no reemplaza esa comprobación.
- El resumen lee el ledger de la OT completo; no se ha realizado prueba de carga de historiales extensos. Mantiene el límite previo de alcance de 200 líneas de OT.
- Los movimientos históricos decimales se continúan leyendo para preservar la ficha, pero un saldo decimal menor a una unidad no se puede devolver con la nueva regla de cantidades enteras. No existen movimientos de ese tipo en las pruebas ni en la captura revisada; si aparecen datos reales, requerirán una definición de corrección autorizada.
- La SPEC no impone un máximo consumido igual a la cantidad planificada ni enumera exhaustivamente estados admitidos para devolución. Se explicitan arriba las decisiones localizadas adoptadas: salida solo en reparación/aprobada y servicio en progreso; devolución compensatoria en estados operativos no terminales. No se añaden estados ni reservas.
- El entorno local ejecutó Node 26 aunque Functions declara Node 22. Conviene repetir en Node 22 antes de desplegar. El build mantiene la advertencia de chunks mayores a 500 kB; no se hizo un refactor de empaquetado.
- Durante el desarrollo del PR sí se modificó la persistencia de arranque de emuladores; esos cambios de scripts y `.gitignore` se retiraron del diff tras la revisión. No se borraron `.firebase-emulator-data` ni los respaldos `firebase-export-*`. Sin la regla de `.gitignore`, los respaldos aparecen como no versionados y no deben añadirse al commit.

## Archivos principales

- Nuevo: `functions/workOrderMaterials.js`.
- Registro y reutilización local: `functions/index.js`, `functions/workOrderPersistence.js`, `functions/package.json`.
- Seguridad/compatibilidad: `firestore.rules`, `firestore.indexes.json`, `src/services/workService.js`, `src/services/reportService.js`.
- Interfaz: `src/features/workOrders/ServiceMaterialsPanel.jsx` (nuevo), `ServicePlanningPanel.jsx`, `src/services/workOrderService.js`.
- Pruebas: `scripts/work-order-material-cases.mjs` (nuevo), `scripts/work-orders-integrated-local.mjs`, `scripts/work-order-ui-smoke.mjs`.
- Documentación: este archivo. El diff completo contiene además cambios anteriores de etapas 7–10; no atribuirlos todos a esta etapa.

## Verificaciones

Satisfactorias:

- `npm run build`.
- `npm --prefix functions run lint`.
- `git diff --check` (advertencias locales LF/CRLF, sin errores de whitespace).
- `npm run test:work-orders-model`, `npm run test:work-orders-ui`, `npm run test:rbac`, `npm run test:works-model`, `npm run test:reports`.
- `node scripts/inventory-acquisition-smoke.mjs`.
- En una sesión `firebase emulators:exec --only auth,firestore,functions,storage`, sin import/export: `work-orders-integrated-local.mjs` (incluye aprobación, ejecución y materiales), `rules-smoke.mjs`, `work-rules-budget-fix-smoke.mjs`, `inventory-integrated-local.mjs`, `business-multi-integrated.mjs`. Runner temporal confirmó `STAGE11_SUITES_OK_UI_READY` después de cinco salidas exitosas.

La prueba detectó y permitió corregir una fuga de consultas amplias al usar `get("tipo", "")` en Rules; ahora se usa el campo canónico obligatorio. También detectó un exceso del presupuesto de expresiones al duplicar `hasBusinessRole` en la condición añadida. Se consulta el rol directamente para esa condición adicional y se conservan intactas las validaciones originales de acceso/membresía; las regresiones completas pasan.

No se realizaron commit, push ni deploy. Pendiente visual indicado arriba.
