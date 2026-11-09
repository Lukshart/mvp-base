# SPEC 028: Proyectos y trabajos, ficha por pestañas y tablero por proyecto

Estado: **v1**. Decisiones de negocio cerradas por Mauricio el 2026-10-15. Pendiente: informar a Bruno del cambio sobre la SPEC 016 §F (ver sección 5).

## 1. Objetivo

Que Lista y Tablero tengan trabajos distintos. La Lista sirve para administrar proyectos; el Tablero, para trabajar uno: crear tareas y subtareas, registrar gastos, horas y materiales dentro de cada tarea, y cerrar el proyecto cuando todo está terminado. Hoy ambas vistas muestran tarjetas de proyectos, y toda la información de un proyecto vive en una ficha muy larga.

## 2. Hechos verificados (investigación 2026-10-15)

- Proyectos y Trabajos es una sola entidad: `negocios/{id}/trabajos/`.
- La ficha es un diálogo de `WorksPage.jsx` con todas las secciones apiladas. Los componentes de apoyo están en `src/features/works/`.
- Tareas: `trabajos/{id}/tareas/{tareaId}`. Estados `pendiente`, `en_progreso`, `en_espera` y `completada`. Subtareas como arreglo dentro de la tarea, máximo 100. Nadie escribe tareas desde el cliente.
- Gastos, horas hombre, salidas de material y adicionales ya llevan `tareaId` opcional, validado contra el proyecto. Sin `tareaId`, el costo pertenece al proyecto completo. El balance y Reportes calculan por `trabajoId` y no dependen de `tareaId`, así que reubicar los formularios no cambia ningún número.
- El backend ya acepta `participanteUids` (máximo 30) al crear y editar, y valida membresía activa.
- Bug de identidad: `getWorkMemberIdentity` solo trata como vacío el literal "Sin nombre registrado", pero `adaptBusinessMember` lo convierte en "Nombre no informado". Por eso los selectores muestran "Yo (Nombre no informado)" y nunca el correo.
- Cierre: `cambiarEstadoTrabajo` permite cualquier transición y no mira las tareas. `actualizarTrabajo` y `crearTrabajo` aceptan `estado: "completado"` directo. El único control está en la interfaz.
- `eliminarTareaTrabajo` solo funciona con tareas heredadas (v1). Las tareas nuevas no se pueden eliminar ni cancelar.

## 3. Diseño

### 3.1 Lista
Proyectos creados, con la información de siempre. Al abrir uno, su ficha por pestañas:
- **Datos:** descripción, cliente, cotización asociada, responsable, equipo, prioridad y fechas. Sin repetir lo que ya muestra la franja superior.
- **Comercial:** resumen comercial (cotizaciones y ventas) y adicionales facturables.
- **Balance:** balance y margen, resumen de costos por día y materiales incluidos en la venta.
- **Notas e historial.**

La cabecera de la ficha queda fija: estado, Editar, Cambiar estado, un menú de más acciones (incluye "Cancelar trabajo") y la franja con cliente, responsable, prioridad, término, progreso y costo acumulado. Un botón "Trabajar en el tablero" lleva al tablero con ese proyecto elegido.

### 3.2 Tablero
- Selector de proyecto. Muestra solo las tareas de ese proyecto como tarjetas por estado, con sus subtareas.
- Cada tarjeta de tarea permite registrar gastos, horas hombre y materiales con la tarea ya asociada.
- Una tarjeta "General" agrupa los costos sin tarea, y una tarjeta "Sin tarea asignada" los costos cuyo `tareaId` ya no existe.
- Abajo, "Cerrar proyecto", habilitado solo cuando existe al menos una tarea y todas están completadas. Si no, explica qué falta.
- Un proyecto completado se ve en solo lectura.

### 3.3 Formulario de crear y editar
Visibles: Nombre, Cotización asociada (compacta), Cliente, Responsable, Equipo (selector múltiple), Prioridad y Término planificado. "Descripción" e "Inicio planificado" van en una sección "Más detalles", cerrada por defecto. Los miembros sin nombre se muestran con su correo.

## 4. Reglas de negocio (cerradas)

1. **Cierre:** un proyecto solo pasa a completado si tiene al menos una tarea y todas están completadas. La validación vive en el backend, en una función común usada por `cambiarEstadoTrabajo`, `actualizarTrabajo` y `crearTrabajo`, y cuenta las tareas reales dentro de la transacción (no usa los contadores `tareasTotal` y `tareasCompletadas`, que pueden ser 0 en proyectos antiguos).
2. **Eliminar tareas:** se puede eliminar una tarea (de cualquier versión) si no tiene costos ni documentación registrados. Si los tiene, no se elimina. Un proyecto sin tareas no se cierra, pero sí se puede cancelar.
3. **Subtareas pendientes:** completar una tarea con subtareas sin terminar pide confirmación, sin bloquear.
4. **Costos en tarea completada:** se permiten hasta que se cierra el proyecto.
5. **Materiales de ventas:** van en Balance, porque no pertenecen a ninguna tarea.
6. **Proyecto completado con tareas abiertas:** queda en solo lectura, como hoy. Al reabrirlo, el nuevo cierre le exige todo.

## 5. Precedencia

Esta SPEC reemplaza, solo en lo relativo a ubicación e interfaz:
- 016 §F (144-146): el tablero de `/trabajos` ya no son tarjetas de proyectos. **Informar a Bruno.**
- 012, sección "Interfaz": el resumen prioritario y el tablero de tarjetas por proyecto.
- 019: §5 (el tablero como vista dentro de la ficha), el principio 5 de §2 y §8.
- 020 §14: la ubicación de adicionales y evidencia. El comportamiento no cambia.
- 022 §7.2: la ubicación de `WorkBalanceSection`. Los números no cambian.

Siguen vigentes los permisos, el balance, Reportes, Ventas, la regla de que el equipo nace de la asignación y el deep link `state.openWorkId`.

## 6. Etapas

- **A (interfaz):** identidad de miembros, equipo en crear y editar, formulario más corto y ficha por pestañas, con una pestaña provisional "Operación" que conserva Tareas, Costos y Materiales sin cambios.
- **B (interfaz):** tablero por proyecto, con las tareas como tarjetas y los costos registrados desde cada tarjeta. Reemplaza la pestaña "Operación" y reescribe los smokes de tableros.
- **C (backend e interfaz):** validación de cierre, eliminación de tareas, botón "Cerrar proyecto" y confirmación de subtareas. Requiere deploy de Functions.

## 7. Pruebas

- Smokes de estructura de `/trabajos`: `works-model`, `projects-v3-stage1`, `projects-v3-stage2`. Los de `spec020` solo si cambian sus componentes.
- Etapa A: el smoke de identidad pasa por `adaptBusinessMember` antes de `getWorkMemberIdentity`.
- Etapa C: pruebas del handler de cierre (con y sin tareas, tarea abierta, proyecto sin tareas, y las tres vías de entrada) y de eliminación de tareas (con y sin costos). Las integradas con emuladores se corren cuando estén disponibles.
- `test:design`, `test:contrast`, `build` y `git diff --check`.

## 8. Criterios de aceptación

- Un proyecto con tareas abiertas no se puede cerrar por ninguna vía (pantalla ni Functions).
- Una tarea sin costos se puede eliminar, y una con costos no.
- Los miembros sin nombre se ven con su correo, nunca como "Nombre no informado".
- El balance y Reportes muestran los mismos números que antes del rediseño.
- Un fallo de carga muestra un error, nunca "Aún no hay ...".
- Móvil: sin scroll horizontal en tableros y fichas.
