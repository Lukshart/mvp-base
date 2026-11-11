# Manual de usuario — Taller Automotriz

## 1. Objetivo

El módulo Taller Automotriz permite registrar vehículos de clientes del Core y gestionar su atención mediante Órdenes de Trabajo (OT).

Con el módulo se puede:

- registrar vehículos y cambiar su propietario actual;
- crear y consultar OTs;
- registrar la recepción del vehículo;
- asignar una Plaza física;
- registrar y completar diagnósticos;
- planificar servicios y productos del catálogo de Inventario;
- enviar el alcance a aprobación, aprobarlo o rechazarlo;
- ejecutar los servicios planificados;
- finalizar la reparación, registrar la entrega y consultar el historial;
- cancelar una OT mientras su estado todavía lo permita.

Los datos se mantienen separados por empresa. La empresa activa solo determina el contexto de navegación: el acceso efectivo requiere una membresía activa, permisos suficientes y que Taller esté habilitado para esa empresa.

Este documento no contiene contraseñas, claves, identificadores fiscales ni datos reales de personas o empresas.

## 2. Quién usa el módulo

Además de los permisos indicados abajo, la empresa debe tener habilitado el módulo `taller`.

| Rol | Puede hacer |
| --- | --- |
| `OWNER` | Consultar, crear y operar vehículos y OTs; aprobar o rechazar alcances; crear y administrar Plazas. |
| `ADMIN` | Las mismas operaciones de Taller que `OWNER`. |
| `TECNICO` | Consultar el módulo, registrar vehículos y OTs, completar la recepción y el diagnóstico, planificar y ejecutar servicios. No administra Plazas ni aprueba alcances. |
| `MEMBER` | Consultar y operar OTs existentes. No registra vehículos u OTs nuevos, no administra Plazas y no aprueba alcances. Si usa un perfil personalizado, el perfil también debe incluir Taller. |
| `VENTAS`, `COMPRAS`, `FINANZAS` | No tienen acceso al módulo Taller. |
| Superadministrador de plataforma | Habilita o deshabilita Taller para una empresa. No realiza la operación diaria del Taller por ese solo privilegio. |

La aprobación y el rechazo corresponden a la capacidad de administración de Taller. La visibilidad de costos y precios, cuando una pantalla los utiliza, depende de los permisos Core `INVENTORY_COSTS_READ` y `PRICING_READ`; Taller no crea permisos económicos paralelos.

## 3. Requisitos previos

Antes de operar Taller, comprueba que:

1. La empresa está activa y verificada.
2. El usuario tiene una membresía activa en la empresa.
3. Taller está habilitado para esa empresa.
4. El usuario seleccionó la empresa correcta como empresa activa.
5. Existen Clientes Core para asociar propietarios.
6. Los servicios y productos que se planificarán existen y están activos en Inventario Core.
7. Si se usarán Plazas, `OWNER` o `ADMIN` ya creó las ubicaciones necesarias.

## 4. Cómo activar Taller

La activación la realiza únicamente un superadministrador de plataforma.

1. Ingresa a la consola de administración de plataforma.
2. Abre **Empresas**.
3. Selecciona la empresa que utilizará Taller.
4. Verifica que la empresa esté activa y que su verificación empresarial permita operar.
5. En la sección **Módulos**, marca **Taller automotriz**.
6. Escribe un motivo del cambio, sin incluir contraseñas, claves ni datos sensibles.
7. Selecciona **Guardar módulos**.
8. Confirma que **Habilitados ahora** incluya Taller automotriz.
9. Pide a los usuarios de la empresa que recarguen la sesión. Si el menú no cambia, deben salir y volver a ingresar.

Cuando está habilitado, Taller aparece en la sección **Módulos** de la navegación. Al entrar, el sistema abre el listado de Órdenes de Trabajo.

### Desactivar Taller

El superadministrador puede volver a la ficha de la empresa, desmarcar **Taller automotriz**, informar el motivo y guardar.

Al deshabilitarlo:

- el módulo queda oculto y sus rutas y Functions quedan bloqueadas;
- los datos existentes no se eliminan;
- el cambio se refleja al recargar la sesión;
- una reactivación posterior vuelve a permitir el acceso según los permisos del usuario.

## 5. Preparación inicial

### 5.1 Crear Plazas

Esta tarea corresponde a `OWNER` o `ADMIN`.

1. Entra a **Módulos > Taller automotriz > Plazas**.
2. Selecciona **Nueva Plaza**.
3. Escribe un nombre descriptivo, por ejemplo, “Plaza 1”.
4. Selecciona **Crear Plaza**.
5. Repite el proceso para cada ubicación física necesaria.

Una Plaza puede estar activa o inactiva. **Disponible** y **En uso** se calculan desde las OTs activas; no se editan manualmente. Una Plaza en uso no puede asignarse simultáneamente a otra OT activa.

### 5.2 Preparar Clientes e Inventario

- Los Clientes se crean y mantienen en el módulo Clientes del Core.
- Taller reutiliza esos Clientes; no crea una ficha de cliente paralela.
- El selector de Taller expone únicamente los datos mínimos necesarios y no devuelve RUT, identificador fiscal ni datos de contacto.
- Los Servicios y Productos se crean y mantienen en Inventario Core.
- Taller solo permite seleccionar ítems activos del catálogo.

## 6. Flujo paso a paso

### Paso 1: registrar un vehículo

Disponible para `OWNER`, `ADMIN` y `TECNICO`.

1. Entra a **Taller automotriz > Vehículos**.
2. Selecciona **Crear vehículo**.
3. Selecciona el Cliente que será el propietario actual.
4. Completa patente, VIN si está disponible, marca, modelo, año, color y tipo.
5. Selecciona **Guardar vehículo**.

La patente es obligatoria y única dentro de la empresa. El VIN es opcional, pero si se informa también debe ser único dentro de la empresa.

`OWNER` y `ADMIN` pueden editar la ficha y cambiar el propietario. El cambio de propietario no modifica el Cliente histórico guardado en OTs anteriores.

### Paso 2: crear una Orden de Trabajo

Disponible para `OWNER`, `ADMIN` y `TECNICO`.

1. Desde la ficha del vehículo, selecciona **Crear OT**; también puedes entrar a **Órdenes de Trabajo > Nueva OT**.
2. Busca y selecciona el vehículo correcto.
3. Revisa patente, vehículo y propietario actual.
4. Selecciona **Crear orden de trabajo**.

El número visible de la OT se genera automáticamente. La OT conserva como Cliente histórico al propietario que tenía el vehículo al momento de crearla.

### Paso 3: registrar la Recepción

1. Abre la OT.
2. Entra a la sección **Recepción**.
3. Completa kilometraje, nivel de combustible, accesorios y observaciones.
4. Completa todos los controles de la checklist.
5. Si existe una anomalía, descríbela en **Daños observados**.
6. Guarda la Recepción.

La checklist registra condiciones visibles al recibir el vehículo; no reemplaza el Diagnóstico técnico.

### Paso 4: asignar una Plaza

La OT puede existir sin Plaza.

1. En la OT, ubica el control de Plaza.
2. Selecciona **Asignar Plaza**.
3. Escoge una Plaza activa y disponible.
4. Confirma la asignación.

También puedes cambiar o liberar la Plaza. El sistema impide que dos OTs activas ocupen la misma Plaza.

### Paso 5: registrar y completar el Diagnóstico

1. Entra a **Diagnósticos**.
2. Selecciona la opción para agregar un diagnóstico.
3. Elige una persona responsable.
4. Registra la descripción y las observaciones.
5. Guarda el borrador si todavía falta información.
6. Cuando la evaluación esté lista, selecciona **Completar diagnóstico**.

Guardar un borrador no equivale a completar el Diagnóstico. Para enviar la OT a aprobación debe existir al menos un Diagnóstico completado. Un diagnóstico completado no se edita como borrador; si aparece información nueva, se registra otro.

### Paso 6: planificar servicios y productos

1. Entra a **Servicios y repuestos**.
2. Selecciona **Agregar servicio**.
3. Elige un Servicio activo de Inventario Core y una persona responsable.
4. Guarda el servicio.
5. Si corresponde, selecciona **Agregar producto** dentro del servicio.
6. Elige un Producto activo e indica una cantidad entera positiva.
7. Repite el proceso hasta completar el alcance.

Agregar o modificar productos es solo planificación. No reserva, descuenta ni mueve stock.

### Paso 7: enviar el alcance a aprobación

Pueden enviar o revalidar quienes tienen capacidad de operación de Taller. Solo `OWNER` y `ADMIN` pueden aprobar o rechazar.

1. En **Alcance y aprobación**, revisa servicios, productos, cantidades y valores visibles.
2. Selecciona **Enviar a aprobación**.
3. Confirma la acción.
4. El backend vuelve a consultar el catálogo y congela el alcance vigente.
5. Si faltan productos, la OT queda esperando repuestos; esto no reserva ni descuenta stock.
6. `OWNER` o `ADMIN` revisa el alcance y selecciona **Aprobar** o **Rechazar**.

Si cambia un servicio, producto o cantidad después de una aprobación, el alcance debe enviarse nuevamente.

### Paso 8: ejecutar los servicios

Cuando la OT está aprobada y en reparación:

1. Abre **Servicios y repuestos**.
2. En cada servicio pendiente, selecciona **Iniciar servicio**.
3. Cuando termine, selecciona **Completar servicio**.
4. Repite hasta que todos los servicios estén completados.

Las acciones quedan registradas en el historial de la OT.

### Paso 9: finalizar la reparación y entregar

1. Comprueba que todos los servicios estén completados.
2. Selecciona **Finalizar orden de trabajo**.
3. La OT pasa a pendiente de entrega.
4. Cuando el vehículo se entregue físicamente, selecciona **Registrar entrega**.
5. Confirma la acción.

La entrega cierra la OT. Una OT cerrada no se reabre.

### Paso 10: consultar historial o cancelar

- Usa la sección **Historial** para revisar los eventos persistidos de la OT.
- La ficha del Vehículo muestra sus OTs anteriores.
- La cancelación solo está disponible antes de entrar en reparación y deja la OT en un estado terminal.
- Una OT cancelada no se elimina ni se reabre; una nueva visita requiere otra OT.

## 7. Búsqueda y consulta

- **Vehículos:** permite buscar por patente, VIN, marca o modelo.
- **Órdenes de Trabajo:** permite buscar y filtrar por estado y aprobación.
- **Plazas:** muestra estado administrativo y ocupación calculada.
- **Historial:** muestra los eventos de cada OT sin permitir edición directa.

## 8. Limitaciones actuales

El módulo no incluye:

- consumo, devolución, reserva o descuento físico de stock;
- movimientos de Inventario creados por Taller;
- costos operacionales nuevos, Horas Hombre o margen de Taller;
- precios ingresados manualmente dentro de la OT;
- creación automática de Ventas;
- pagos o estados de pago propios;
- dashboard propio de Taller;
- fotografías o archivos adjuntos del vehículo;
- agenda, reservas horarias o notificaciones;
- garantías, retrabajos o mantenimiento preventivo;
- reapertura de OTs cerradas o canceladas;
- eliminación física de OTs y su historial;
- una decisión automática sobre **Proyectos y trabajos** cuando Taller está habilitado.

La planificación puede consultar disponibilidad del catálogo, pero no garantiza stock futuro. La existencia de una cantidad planificada no representa una reserva.

## 9. Mensajes frecuentes

### “El módulo no está habilitado para esta empresa”

Solicita a un superadministrador de plataforma que revise la sección **Módulos** de la empresa. Después del cambio, recarga la sesión.

### Taller no aparece en el menú

Comprueba que:

- la empresa activa sea la correcta;
- Taller esté habilitado;
- la membresía esté activa;
- el rol tenga permisos de Taller;
- la sesión se haya recargado después de la activación.

### No puedo crear vehículos u OTs

La creación está disponible para `OWNER`, `ADMIN` y `TECNICO`. `MEMBER` puede consultar y operar registros existentes, pero no crearlos.

### No puedo aprobar o rechazar

La aprobación está restringida a `OWNER` y `ADMIN`.

### No puedo asignar una Plaza

Comprueba que la Plaza esté activa y no esté ocupada por otra OT activa. La administración de Plazas corresponde a `OWNER` y `ADMIN`.

### La OT no permite finalizar

Todos los servicios deben estar completados. Finalizar la reparación deja la OT pendiente de entrega; para cerrarla todavía se debe registrar la entrega.

## 10. Buenas prácticas

- Confirma siempre la empresa activa antes de operar.
- Busca el vehículo antes de registrarlo para evitar duplicados.
- Revisa el propietario antes de crear la OT.
- Describe claramente las anomalías observadas en la Recepción.
- Completa el Diagnóstico solo cuando la evaluación esté lista.
- Revisa el alcance antes de enviarlo a aprobación.
- No interpretes la planificación de productos como reserva o consumo.
- No incluyas contraseñas, claves, tokens ni datos sensibles en motivos u observaciones.
- Usa el historial para auditar acciones; no intentes corregir registros eliminándolos.
