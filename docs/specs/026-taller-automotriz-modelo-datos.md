# SPEC 026 (modelo de datos) — Modelo de Datos Definitivo, Taller Automotriz MVP

**Estado:** Definitivo para implementación  
**Ámbito:** Módulo Taller Automotriz  
**Persistencia:** Firestore bajo `negocios/{businessId}/...`  
**Pendientes funcionales:** Ninguno

---

## 1. Principios del modelo

- `Cliente`, `Producto`, `Servicio`, personas asignables, moneda e Inventario pertenecen al Core.
- Taller no duplica entidades Core.
- La entidad operacional central es `OrdenTrabajo`.
- `Vehiculo.clienteId` representa al propietario actual.
- `OrdenTrabajo.clienteId` conserva al propietario asociado a la visita.
- Productos y Servicios Core se referencian mediante el `itemId` canónico de Inventario.
- Las operaciones sensibles son autoritativas en backend.
- Los registros históricos y movimientos económicos no se eliminan físicamente.
- Las correcciones de Inventario son compensatorias.
- Las colecciones técnicas internas no constituyen entidades funcionales del Taller.

---

# 2. Relaciones principales

```text
CLIENTE CORE
    │
    │ 1:N
    ▼
VEHICULO
    │
    │ 1:N
    ▼
ORDEN_TRABAJO
    │
    ├── 1 RECEPCION
    │
    ├── N DIAGNOSTICO
    │
    ├── N SERVICIO_OT
    │      │
    │      ├── 1 ITEM INVENTARIO CORE
    │      │      tipoItem = servicio
    │      │
    │      └── N PRODUCTO_OT
    │             │
    │             └── 1 ITEM INVENTARIO CORE
    │                    tipoItem = producto
    │
    ├── 0..1 PLAZA
    ├── N HISTORIAL_OT
    └── N MOVIMIENTO_INVENTARIO
```

---

# 3. Vehículo

## 3.1 Ruta

```text
negocios/{businessId}/vehiculos/{vehiculoId}
```

## 3.2 Estructura

```js
{
  vehiculoId: string,
  negocioId: string,

  clienteId: string,

  patente: string,
  vin: string | null,

  marca: string,
  modelo: string,
  anio: number,
  color: string,
  tipo: TipoVehiculo,

  creadoPorUid: string,
  creadoEn: timestamp,

  actualizadoPorUid: string,
  actualizadoEn: timestamp
}
```

## 3.3 Reglas

### Propietario

```text
Vehiculo.clienteId
= propietario actual
```

El propietario puede cambiar.

La modificación de `Vehiculo.clienteId` no altera el `clienteId` de OTs anteriores.

### Patente

- obligatoria;
- normalizada antes de persistir;
- única por negocio;
- almacenada directamente en formato canónico.

No existe:

```text
patenteNormalizada
```

### VIN

- opcional;
- recomendado;
- normalizado cuando exista;
- único por negocio únicamente cuando esté informado.

No existe:

```text
vinNormalizado
```

La ausencia de VIN no bloquea la creación del Vehículo ni la Recepción.

### Datos descriptivos

Son obligatorios:

```text
marca
modelo
anio
color
tipo
```

`anio` se persiste como número entero.

---

## 3.4 TipoVehiculo

`tipo` utiliza valores predefinidos.

```text
sedan
hatchback
suv
pickup
station_wagon
furgon
van
coupe
convertible
otro
```

Etiquetas sugeridas para interfaz:

| Valor | Etiqueta |
|---|---|
| `sedan` | Sedán |
| `hatchback` | Hatchback |
| `suv` | SUV |
| `pickup` | Pickup |
| `station_wagon` | Station Wagon |
| `furgon` | Furgón |
| `van` | Van |
| `coupe` | Coupé |
| `convertible` | Convertible |
| `otro` | Otro |

El backend debe rechazar valores fuera de este catálogo.

---

# 4. Orden de Trabajo

## 4.1 Ruta

```text
negocios/{businessId}/ordenesTrabajo/{otId}
```

## 4.2 Estructura

```js
{
  otId: string,
  negocioId: string,

  numeroOT: string,

  vehiculoId: string,
  clienteId: string,

  estado: EstadoOT,
  estadoAprobacion: EstadoAprobacion,

  plazaId: string | null,

  moneda: string | null,

  recepcion: Recepcion | null,

  creadoPorUid: string,
  creadoEn: timestamp,

  actualizadoPorUid: string,
  actualizadoEn: timestamp
}
```

---

## 4.3 Cliente histórico

```text
OrdenTrabajo.clienteId
= propietario del Vehículo al crear la OT
```

Ejemplo:

```text
OT-000001
Vehiculo.clienteId = CLIENTE_A
OrdenTrabajo.clienteId = CLIENTE_A

Cambio de propietario:

Vehiculo.clienteId = CLIENTE_B

OT-000001.clienteId continúa siendo CLIENTE_A
```

---

## 4.4 Número de OT

- generado exclusivamente en backend;
- incremental;
- único por negocio;
- no reutilizable.

Formato:

```text
OT-000001
OT-000002
OT-000003
```

---

## 4.5 EstadoOT

```text
ingresada
en_cola
en_diagnostico
esperando_repuestos
esperando_aprobacion
en_reparacion
pendiente_entrega
cerrada
cancelada
```

Estados terminales:

```text
cerrada
cancelada
```

---

## 4.6 EstadoAprobacion

```text
pendiente
aprobada
rechazada
```

El estado de aprobación es independiente del estado operacional.

---

# 5. Recepción

La Recepción es una composición 1:1 de la Orden de Trabajo.

No constituye una entidad empresarial independiente.

## 5.1 Persistencia

```text
OrdenTrabajo.recepcion
```

## 5.2 Estructura

```js
{
  kilometraje: number,
  nivelCombustible: string,

  checklist: {
    carroceriaPintura: EstadoVisual,
    vidriosEspejos: EstadoVisual,
    lucesOpticos: EstadoVisual,
    neumaticosLlantas: EstadoVisual,
    interior: EstadoVisual,

    tableroIndicadores: EstadoTablero,
    encendido: EstadoEncendido,
    fugasVisibles: EstadoFugas,
    nivelesVisibles: EstadoNiveles,
    estadoGeneral: EstadoGeneral
  },

  accesorios: string[],
  danosObservados: string,
  observaciones: string,

  recibidoPorUid: string,
  recibidoEn: timestamp
}
```

---

# 6. Checklist de Recepción

La checklist registra exclusivamente condiciones observables al momento de la recepción.

No debe utilizarse para registrar diagnósticos mecánicos.

Los diez campos son obligatorios.

---

## 6.1 Carrocería y pintura

```text
carroceriaPintura
```

Valores:

```text
SIN_DANOS_VISIBLES
CON_OBSERVACIONES
NO_REVISADO
```

---

## 6.2 Vidrios y espejos

```text
vidriosEspejos
```

Valores:

```text
SIN_DANOS_VISIBLES
CON_OBSERVACIONES
NO_REVISADO
```

---

## 6.3 Luces y ópticos

```text
lucesOpticos
```

Valores:

```text
SIN_DANOS_VISIBLES
CON_OBSERVACIONES
NO_REVISADO
```

---

## 6.4 Neumáticos y llantas

```text
neumaticosLlantas
```

Valores:

```text
SIN_DANOS_VISIBLES
CON_OBSERVACIONES
NO_REVISADO
```

---

## 6.5 Interior

```text
interior
```

Valores:

```text
SIN_DANOS_VISIBLES
CON_OBSERVACIONES
NO_REVISADO
```

---

## 6.6 Tablero e indicadores

```text
tableroIndicadores
```

Valores:

```text
SIN_ALERTAS_VISIBLES
CON_ALERTAS
NO_REVISADO
```

---

## 6.7 Encendido

```text
encendido
```

Valores:

```text
NORMAL
CON_DIFICULTAD
NO_ENCIENDE
NO_PROBADO
```

---

## 6.8 Fugas visibles

```text
fugasVisibles
```

Valores:

```text
NO_SE_OBSERVAN
SE_OBSERVAN
NO_REVISADO
```

---

## 6.9 Niveles visibles

```text
nivelesVisibles
```

Valores:

```text
SIN_OBSERVACIONES
CON_OBSERVACIONES
NO_REVISADO
```

---

## 6.10 Estado general

```text
estadoGeneral
```

Valores:

```text
SIN_OBSERVACIONES
CON_OBSERVACIONES
```

---

# 7. Reglas de daños y anomalías

Se consideran valores indicativos de anomalía:

```text
CON_OBSERVACIONES
CON_ALERTAS
CON_DIFICULTAD
NO_ENCIENDE
SE_OBSERVAN
```

Si cualquier campo contiene uno de esos valores:

```text
danosObservados
```

debe:

- ser obligatorio;
- contener una descripción manual;
- ser distinto de `Ninguno`.

Ejemplo:

```text
Rayón en puerta trasera izquierda. Llanta delantera derecha raspada.
Testigo Check Engine encendido.
```

Si ningún campo presenta una anomalía:

```text
danosObservados = "Ninguno"
```

Los valores:

```text
NO_REVISADO
NO_PROBADO
```

representan ausencia de revisión o prueba y no una anomalía por sí mismos.

No existen campos individuales de observación por cada elemento del checklist.

---

# 8. Diagnóstico

## 8.1 Ruta

```text
negocios/{businessId}/ordenesTrabajo/{otId}/diagnosticos/{diagnosticoId}
```

## 8.2 Estructura

```js
{
  diagnosticoId: string,
  negocioId: string,
  otId: string,

  responsableUid: string,

  descripcion: string,
  observaciones: string,

  estado: EstadoDiagnostico,

  creadoPorUid: string,
  creadoEn: timestamp,

  actualizadoPorUid: string,
  actualizadoEn: timestamp,

  completadoPorUid: string | null,
  completadoEn: timestamp | null
}
```

## 8.3 EstadoDiagnostico

```text
borrador
completado
```

## 8.4 Reglas

Guardar:

```text
estado = borrador
```

no equivale a completar.

Al completar:

```text
estado = completado
completadoPorUid = actor
completadoEn = timestamp
```

Debe existir al menos un Diagnóstico `completado` antes de enviar la OT a aprobación.

Un Diagnóstico completado no puede modificarse mediante edición ordinaria.

Nueva información técnica debe registrarse mediante otro Diagnóstico.

---

# 9. ServicioOT

Representa una instancia de un Servicio Core dentro de una OT.

## 9.1 Ruta

```text
negocios/{businessId}/ordenesTrabajo/{otId}/servicios/{servicioOtId}
```

## 9.2 Estructura

```js
{
  servicioOtId: string,
  negocioId: string,
  otId: string,

  itemId: string,

  responsableUid: string,

  estado: EstadoServicioOT,

  precioUnitario: number | null,

  servicioSnapshot: {
    codigoInterno: string,
    nombre: string,
    unidad: string,
    modeloInventarioVersion: number | null
  } | null,

  productos: ProductoOT[],

  creadoPorUid: string,
  creadoEn: timestamp,

  actualizadoPorUid: string,
  actualizadoEn: timestamp
}
```

## 9.3 Referencia Core

`itemId` referencia:

```text
negocios/{businessId}/inventario/{itemId}
```

y el backend debe garantizar:

```text
tipoItem == "servicio"
```

No se permite crear un ServicioOT utilizando:

```text
tipoItem = producto
tipoItem = actividad
```

---

## 9.4 EstadoServicioOT

```text
pendiente
en_progreso
completado
```

---

## 9.5 Regla de finalización

Para finalizar la reparación:

```text
TODOS los ServicioOT
deben tener:

estado = completado
```

Solo entonces:

```text
OrdenTrabajo.estado
en_reparacion
→ pendiente_entrega
```

---

# 10. ProductoOT

`ProductoOT` representa un Producto Core planificado para ejecutar un ServicioOT.

No constituye una entidad operacional independiente.

Se persiste como composición dentro de:

```text
ServicioOT.productos[]
```

## 10.1 Estructura

```js
{
  productoOtId: string,

  itemId: string,

  cantidad: number,

  precioUnitario: number | null,

  productoSnapshot: {
    codigoInterno: string,
    nombre: string,
    unidad: string,
    modeloInventarioVersion: number | null
  } | null
}
```

## 10.2 Referencia Core

`itemId` referencia:

```text
negocios/{businessId}/inventario/{itemId}
```

y debe cumplir:

```text
tipoItem == "producto"
```

---

## 10.3 Cantidad planificada

```text
ProductoOT.cantidad
= cantidad planificada
```

No representa el consumo físico.

Ejemplo:

```text
ProductoOT.cantidad = 5

SALIDA_TALLER total = 4

Resultado:
Planificado = 5
Consumido = 4
```

Ambos valores son válidos y representan conceptos distintos.

---

# 11. Snapshots históricos

Los snapshots no se generan al agregar el Servicio o Producto.

Se generan al:

```text
Enviar OT a aprobación
```

---

## 11.1 Proceso

El backend debe:

1. leer nuevamente los `itemId` desde Inventario Core;
2. validar que continúen disponibles;
3. validar `tipoItem`;
4. obtener nombre, código, unidad y versión vigente;
5. obtener el precio vigente desde Core;
6. obtener la moneda aplicable;
7. persistir el snapshot;
8. congelar `precioUnitario`.

---

## 11.2 ServicioSnapshot

```js
{
  codigoInterno: string,
  nombre: string,
  unidad: string,
  modeloInventarioVersion: number | null
}
```

El precio se persiste en:

```text
ServicioOT.precioUnitario
```

---

## 11.3 ProductoSnapshot

```js
{
  codigoInterno: string,
  nombre: string,
  unidad: string,
  modeloInventarioVersion: number | null
}
```

El precio se persiste en:

```text
ProductoOT.precioUnitario
```

---

## 11.4 Inmutabilidad histórica

Después de generar los snapshots:

```text
cambio de nombre Core
cambio de precio Core
cambio de unidad Core
```

no modifica retroactivamente la versión histórica de la OT.

---

# 12. Aprobación

La aprobación autoriza el alcance de la OT.

Incluye:

```text
Servicios
Productos
Cantidades
```

Los precios no se editan manualmente en Taller.

---

## 12.1 Invalidación de aprobación

Después de una aprobación, cualquiera de estos cambios la invalida:

```text
agregar Servicio
eliminar Servicio
reemplazar Servicio

agregar Producto
eliminar Producto
reemplazar Producto

cambiar cantidad planificada
```

Resultado:

```text
estadoAprobacion = pendiente
```

La OT debe volver a enviarse a aprobación.

---

# 13. Plaza

## 13.1 Ruta

```text
negocios/{businessId}/plazasTaller/{plazaId}
```

## 13.2 Estructura

```js
{
  plazaId: string,
  negocioId: string,

  nombre: string,

  estado: EstadoPlaza,

  creadoPorUid: string,
  creadoEn: timestamp,

  actualizadoPorUid: string,
  actualizadoEn: timestamp
}
```

## 13.3 EstadoPlaza

```text
activa
inactiva
```

No existen como estado funcional:

```text
ocupada
disponible
```

La ocupación se determina mediante:

```text
OrdenTrabajo.plazaId
```

Una Plaza no puede estar asignada simultáneamente a dos OTs activas.

---

# 14. HistorialOT

## 14.1 Ruta

```text
negocios/{businessId}/ordenesTrabajo/{otId}/historial/{eventoId}
```

## 14.2 Estructura

```js
{
  eventoId: string,
  negocioId: string,
  otId: string,

  tipo: string,
  fecha: timestamp,

  actorUid: string,

  actorSnapshot: {
    nombre: string,
    correo: string
  },

  detalle: object
}
```

## 14.3 Regla

```text
append-only
```

No se reescriben eventos históricos.

---

## 14.4 Eventos relevantes

```text
ot_creada
estado_cambiado

plaza_asignada
plaza_liberada

diagnostico_creado
diagnostico_completado

servicio_agregado
servicio_actualizado
servicio_iniciado
servicio_completado

ot_enviada_aprobacion
ot_aprobada
ot_rechazada
aprobacion_invalidada

material_consumido
material_devuelto

reparacion_finalizada
vehiculo_entregado

ot_cancelada
```

---

# 15. Inventario

Taller reutiliza el ledger Core:

```text
negocios/{businessId}/movimientosInventario/{movimientoId}
```

No se crea un Inventario separado.

---

## 15.1 Tipos de movimiento

```text
SALIDA_TALLER
DEVOLUCION_TALLER
```

---

## 15.2 Movimiento de Taller

```js
{
  movimientoId: string,
  negocioId: string,

  otId: string,
  servicioOtId: string,

  tipo: "SALIDA_TALLER" | "DEVOLUCION_TALLER",

  itemId: string,

  cantidad: number,

  costoUnitario: number,
  costoTotal: number,
  costoFuente: string,
  moneda: string,

  stockAnterior: number,
  stockPosterior: number,

  valorInventarioAnterior: number,
  valorInventarioPosterior: number,

  costoPromedioAnterior: number | null,
  costoPromedioPosterior: number | null,

  movimientoOrigenId: string | null,

  productoSnapshot: object,

  usuarioUid: string,

  usuarioSnapshot: {
    nombre: string,
    correo: string
  },

  fecha: string,
  creadoEn: timestamp
}
```

---

## 15.3 SALIDA_TALLER

Debe:

- validar negocio;
- validar membresía;
- validar permisos;
- validar OT;
- validar ServicioOT;
- validar Producto;
- validar cantidad;
- validar stock;
- utilizar el núcleo económico Core;
- congelar costo;
- descontar stock;
- registrar movimiento;
- ser idempotente.

```text
movimientoOrigenId = null
```

---

## 15.4 DEVOLUCION_TALLER

Debe:

- referenciar una `SALIDA_TALLER`;
- usar el mismo Producto;
- utilizar el costo congelado de la salida;
- impedir sobredevolución;
- reponer stock;
- reponer valor de Inventario;
- registrar movimiento compensatorio;
- ser idempotente.

```text
movimientoOrigenId
= movimientoId de SALIDA_TALLER
```

---

# 16. Colecciones técnicas internas

Estas colecciones son mecanismos de implementación.

No forman parte del dominio funcional visible.

---

## 16.1 Unicidad de patente

```text
negocios/{businessId}/vehiclePlateKeys/{patente}
```

Conceptualmente:

```js
{
  negocioId: string,
  vehiculoId: string,
  patente: string
}
```

---

## 16.2 Unicidad de VIN

```text
negocios/{businessId}/vehicleVinKeys/{vin}
```

Solo se crea cuando existe VIN.

---

## 16.3 Idempotencia de creación de Vehículo

```text
negocios/{businessId}/vehicleCreateRequests/{requestId}
```

---

## 16.4 Correlativo OT

```text
negocios/{businessId}/otCounters/global
```

```js
{
  negocioId: string,
  lastNumber: number,
  actualizadoEn: timestamp
}
```

---

## 16.5 Idempotencia de creación OT

```text
negocios/{businessId}/otCreateRequests/{requestId}
```

---

## 16.6 Idempotencia de materiales

```text
negocios/{businessId}/tallerMaterialRequests/{requestId}
```

---

## 16.7 Saldo de devolución

```text
negocios/{businessId}/tallerMaterialBalances/{movimientoOrigenId}
```

```js
{
  negocioId: string,

  otId: string,
  servicioOtId: string,

  movimientoOrigenId: string,
  itemId: string,

  cantidadSalida: number,
  cantidadDevuelta: number,

  costoSalida: number,
  costoDevuelto: number,

  actualizadoEn: timestamp
}
```

---

## 16.8 Exclusividad técnica de Plaza

```text
negocios/{businessId}/plazaOccupancyKeys/{plazaId}
```

Conceptualmente:

```js
{
  negocioId: string,
  plazaId: string,
  otId: string
}
```

Su única responsabilidad es garantizar transaccionalmente:

```text
1 Plaza
→ máximo 1 OT activa asignada
```

No constituye un estado funcional adicional de Plaza.

---

# 17. Reglas de autoridad

## 17.1 Frontend puede solicitar

- crear Vehículo;
- actualizar Vehículo;
- cambiar propietario;
- registrar Recepción;
- crear Diagnóstico;
- editar Diagnóstico en borrador;
- completar Diagnóstico;
- agregar ServicioOT;
- actualizar ServicioOT;
- asignar responsable;
- agregar/modificar Productos planificados;
- enviar OT a aprobación;
- aprobar/rechazar OT;
- asignar/liberar Plaza;
- cambiar estado de ServicioOT;
- registrar salida de material;
- registrar devolución;
- finalizar reparación;
- registrar entrega;
- cancelar OT cuando corresponda.

---

## 17.2 Backend debe decidir

- aislamiento multiempresa;
- membresía activa;
- permisos;
- unicidad de patente;
- unicidad de VIN;
- generación de número OT;
- transiciones de estado;
- finalización de Diagnóstico;
- integridad de referencias Core;
- snapshots;
- precios;
- moneda;
- aprobación;
- invalidación de aprobación;
- exclusividad de Plaza;
- stock;
- costos;
- movimientos de Inventario;
- idempotencia;
- timestamps.

---

# 18. Cardinalidades definitivas

| Origen | Relación | Destino |
|---|---|---|
| Cliente Core | 1:N | Vehículo |
| Vehículo | 1:N | OrdenTrabajo |
| OrdenTrabajo | 1:1 | Recepción |
| OrdenTrabajo | 1:N | Diagnóstico |
| OrdenTrabajo | 1:N | ServicioOT |
| ServicioOT | N:1 | Ítem Inventario tipo `servicio` |
| ServicioOT | 1:N | ProductoOT |
| ProductoOT | N:1 | Ítem Inventario tipo `producto` |
| OrdenTrabajo | N:0..1 | Plaza |
| OrdenTrabajo | 1:N | HistorialOT |
| OrdenTrabajo | 1:N | MovimientoInventario |
| ServicioOT | 1:N | MovimientoInventario |

---

# 19. Modelo consolidado

```text
CLIENTE CORE
    │
    ▼
VEHICULO
├── vehiculoId
├── negocioId
├── clienteId              ← propietario actual
├── patente                ← obligatoria / única
├── vin                    ← opcional / único si existe
├── marca
├── modelo
├── anio
├── color
└── tipo                   ← enum predefinido
    │
    ▼
ORDEN_TRABAJO
├── otId
├── negocioId
├── numeroOT
├── vehiculoId
├── clienteId              ← propietario histórico
├── estado
├── estadoAprobacion
├── plazaId
├── moneda
│
├── RECEPCION
│   ├── kilometraje
│   ├── nivelCombustible
│   ├── checklist
│   │   ├── carroceriaPintura
│   │   ├── vidriosEspejos
│   │   ├── lucesOpticos
│   │   ├── neumaticosLlantas
│   │   ├── interior
│   │   ├── tableroIndicadores
│   │   ├── encendido
│   │   ├── fugasVisibles
│   │   ├── nivelesVisibles
│   │   └── estadoGeneral
│   ├── accesorios
│   ├── danosObservados
│   ├── observaciones
│   ├── recibidoPorUid
│   └── recibidoEn
│
├── DIAGNOSTICOS[]
│   ├── diagnosticoId
│   ├── responsableUid
│   ├── descripcion
│   ├── observaciones
│   ├── estado
│   ├── completadoPorUid
│   └── completadoEn
│
└── SERVICIOS_OT[]
    ├── servicioOtId
    ├── itemId             ← Inventario tipo servicio
    ├── responsableUid
    ├── estado
    ├── precioUnitario
    ├── servicioSnapshot
    │
    └── productos[]
        ├── productoOtId
        ├── itemId         ← Inventario tipo producto
        ├── cantidad
        ├── precioUnitario
        └── productoSnapshot

ORDEN_TRABAJO
├── 0..1 PLAZA
├── HISTORIAL_OT[]
└── MOVIMIENTOS_INVENTARIO[]
    ├── SALIDA_TALLER
    └── DEVOLUCION_TALLER
```

---

# 20. Estado definitivo

El modelo queda cerrado en sus tres niveles:

```text
Modelo funcional     → CERRADO
Modelo lógico        → CERRADO
Modelo físico        → DEFINIDO PARA IMPLEMENTACIÓN
```

No quedan requerimientos funcionales pendientes de definición dentro del modelo de datos del MVP de Taller Automotriz.