# SPEC 027 — Clínica Veterinaria MVP



> Estado: propuesta no implementada.

> Este documento debe ser revisado y aprobado antes de comenzar la implementación del módulo.



> La aprobación de esta SPEC autoriza únicamente el alcance descrito aquí. No autoriza modificaciones al Core protegido de ValoraCloud.



\#Objetivo



Incorporar a ValoraCloud un módulo aislado de Clínica Veterinaria que permita administrar pacientes veterinarios y registrar su proceso básico de atención, reutilizando las capacidades existentes de Clientes, Empresas, autenticación, membresías, permisos e Inventario sin duplicar ni modificar dichas funcionalidades Core.



El flujo principal del MVP será:



`Tutor → Paciente → Agenda → Recepción → Consulta clínica → Diagnóstico → Tratamiento → Servicios/productos → Cierre → Historial clínico`



El paciente será el eje clínico del módulo.



El tutor será representado mediante un Cliente existente de ValoraCloud.



\---



\#Alcance del MVP



La primera versión incluye:



\* búsqueda y selección de un tutor existente en Clientes;

\* registro de tutor mediante el flujo existente de Clientes cuando corresponda;

\* asociación de múltiples pacientes a un mismo tutor;

\* registro y edición de pacientes veterinarios;

\* ficha integral del paciente;

\* agenda veterinaria;

\* recepción del paciente;

\* atención clínica;

\* anamnesis;

\* examen clínico;

\* diagnóstico;

\* tratamiento;

\* indicaciones;

\* asociación informativa de servicios, productos y medicamentos utilizados;

\* cierre de atención;

\* historial clínico;

\* aislamiento multiempresa;

\* validación de permisos;

\* validaciones funcionales y clínicas básicas;

\* trazabilidad mediante Git y Pull Request;

\* pruebas locales con Firebase Emulator Suite.



El módulo no implementará un sistema paralelo de Clientes, autenticación, empleados, permisos, Inventario o Ventas.



\---



\#Flujo principal



&#x20;1. Tutor



El usuario busca al tutor dentro de Clientes Core.



Si existe:



`Buscar Cliente → Seleccionar Cliente`



Si no existe:



`Registrar mediante Clientes Core → Seleccionar Cliente`



El módulo veterinario no crea una colección independiente de tutores.



\---



&#x20;2. Paciente



Una vez seleccionado el tutor, el sistema consulta sus pacientes veterinarios.



Si el paciente existe:



`Tutor → Pacientes asociados → Seleccionar paciente`



Si no existe:



`Tutor → Nuevo paciente → Registrar → Asociar`



Un tutor puede mantener múltiples pacientes.



Cada paciente conserva su propia ficha e historial clínico.



\---



&#x20;3. Agenda



El usuario podrá crear una cita asociando:



\* tutor;

\* paciente;

\* fecha;

\* hora;

\* tipo o motivo de atención;

\* observaciones opcionales.



La cita deberá pertenecer al mismo negocio que tutor y paciente.



\---



&#x20;4. Recepción



Cuando el paciente llegue a la clínica, la cita podrá avanzar al estado correspondiente de recepción.



El flujo permitirá identificar claramente:



\* tutor;

\* paciente;

\* cita;

\* estado actual.



\---



&#x20;5. Atención clínica



Desde una cita válida se podrá iniciar una atención veterinaria.



La atención permitirá registrar como mínimo:



\* motivo de consulta;

\* anamnesis;

\* peso cuando corresponda;

\* examen clínico;

\* diagnóstico o diagnóstico presuntivo;

\* tratamiento;

\* indicaciones;

\* profesional responsable.



\---



&#x20;6. Servicios, productos y medicamentos



La atención podrá relacionar servicios, productos o medicamentos existentes.



En el MVP esta asociación tendrá carácter clínico/operacional.



Podrá registrar:



\* identificador del ítem Core;

\* nombre;

\* tipo;

\* cantidad;

\* valor de referencia cuando corresponda.



Esta asociación \*\*no modifica stock\*\* y \*\*no crea automáticamente una Venta\*\*.



\---



&#x20;7. Cierre



Una atención solamente podrá finalizar cuando tenga registrados los antecedentes mínimos definidos.



Al finalizar:



\* la atención pasa a estado finalizado;

\* queda disponible para consulta;

\* se incorpora al historial clínico del paciente;

\* no se elimina ni se reemplaza por una atención posterior.



\---



&#x20;8. Historial



La ficha del paciente permitirá consultar cronológicamente las atenciones finalizadas.



El historial pertenece exclusivamente al paciente seleccionado y no debe mezclar antecedentes de otros pacientes, aunque compartan tutor.



\---



\# Reutilización del Core



Clientes:



El tutor reutiliza Clientes Core.



Referencia esperada:



`clienteId`



El módulo no duplicará:



\* datos personales;

\* información fiscal;

\* dirección;

\* teléfono;

\* correo;

\* lógica de creación o modificación de Clientes.



Las operaciones sobre un tutor como Cliente deberán realizarse utilizando los mecanismos ya existentes de Clientes.



\---



Empresas y multiempresa:



El módulo utilizará el `businessId` existente.



Toda información veterinaria operacional deberá vivir bajo:



`negocios/{businessId}/...`



`negocioActivoId` podrá utilizarse como contexto de navegación, pero nunca como prueba suficiente de autorización.



\---



&#x20;Autenticación:



Se reutiliza Firebase Authentication y el flujo de sesión existente.



No se implementará:



\* login veterinario independiente;

\* recuperación de contraseña propia;

\* sesiones paralelas.



\---



&#x20;Membresías y permisos:



Se reutiliza la membresía canónica existente.



No se crearán:



\* nuevas membresías veterinarias;

\* sistemas paralelos de roles;

\* autorización independiente del Core.



Para el MVP inicial se propone que las mutaciones veterinarias estén disponibles únicamente para `OWNER` y `ADMIN`.



La ampliación a `TECNICO`, perfiles personalizados u otros perfiles deberá aprobarse antes de implementarse y no deberá requerir modificar el RBAC central.



\---



Empleados:



Cuando se requiera registrar al profesional responsable, se reutilizará la identidad existente del usuario/empleado autorizado.



No se creará una colección veterinaria paralela de empleados.



\---



&#x20;Inventario;



El módulo podrá consultar ítems existentes de Inventario para relacionarlos con una atención.



Ejemplos:



\* medicamentos;

\* insumos;

\* productos;

\* servicios.



El módulo veterinario no será autoridad sobre stock ni economía de Inventario.



\---



Ventas:



Ventas Core no forma parte de la implementación obligatoria del primer MVP veterinario.



Una futura conversión:



`Atención → Venta`



sólo podrá implementarse utilizando un mecanismo Core aprobado.



No se escribirá directamente en documentos internos de Ventas.



\---



Modelo Firestore propuesto:



Los nombres siguientes forman parte de esta propuesta y deberán quedar aprobados antes de implementación.



Pacientes:





negocios/{businessId}/pacientesVeterinarios/{pacienteId}





Campos propuestos:



\* `pacienteId`;

\* `negocioId`;

\* `tutorClienteId`;

\* `nombre`;

\* `especie`;

\* `raza`;

\* `sexo`;

\* `fechaNacimiento`;

\* `edadEstimada`;

\* `peso`;

\* `color`;

\* `microchip`;

\* `alergias`;

\* `antecedentes`;

\* `observaciones`;

\* `estado`;

\* `creadoPorUid`;

\* `actualizadoPorUid`;

\* `creadoEn`;

\* `actualizadoEn`.



Estados:



\* `activo`;

\* `inactivo`;

\* `fallecido`.



No existe eliminación física del historial clínico asociado al paciente.



\---



Citas veterinarias:





negocios/{businessId}/citasVeterinarias/{citaId}





Campos propuestos:



\* `citaId`;

\* `negocioId`;

\* `pacienteId`;

\* `tutorClienteId`;

\* `fecha`;

\* `hora`;

\* `tipoAtencion`;

\* `observaciones`;

\* `estado`;

\* `creadoPorUid`;

\* `actualizadoPorUid`;

\* `creadoEn`;

\* `actualizadoEn`.



Estados:



\* `agendada`;

\* `confirmada`;

\* `en\_espera`;

\* `en\_atencion`;

\* `finalizada`;

\* `cancelada`.



Una cita cancelada no puede pasar directamente a atención.



\---



&#x20;Atenciones veterinarias:





negocios/{businessId}/atencionesVeterinarias/{atencionId}





Campos propuestos:



\* `atencionId`;

\* `negocioId`;

\* `pacienteId`;

\* `tutorClienteId`;

\* `citaId`;

\* referencia al profesional responsable;

\* `motivoConsulta`;

\* `anamnesis`;

\* `examenClinico`;

\* `diagnostico`;

\* `tratamiento`;

\* `indicaciones`;

\* `pesoRegistrado`;

\* `itemsUtilizados`;

\* `estado`;

\* `iniciadaEn`;

\* `finalizadaEn`;

\* `creadoPorUid`;

\* `actualizadoPorUid`.



Estados:



\* `en\_atencion`;

\* `finalizada`.



Una atención finalizada será histórica y no podrá eliminarse físicamente mediante el flujo normal del módulo.



\---



Relación Tutor - Paciente:



La relación principal será:



`Cliente Core 1 → N Pacientes Veterinarios`



Un tutor puede poseer múltiples pacientes.



Para el MVP:



\* cada paciente tendrá un tutor responsable principal;

\* tutor y paciente deberán pertenecer al mismo negocio;

\* un paciente no podrá utilizar un `clienteId` perteneciente a otro negocio;

\* el historial pertenece al paciente y no al tutor.



La administración de múltiples tutores para un mismo paciente queda fuera del MVP inicial.



\---



Validaciones de paciente:



Para crear o editar un paciente:



\* nombre obligatorio;

\* especie obligatoria;

\* tutor válido obligatorio;

\* tutor perteneciente al mismo negocio;

\* fecha de nacimiento no futura;

\* peso, cuando exista, numérico y mayor que cero;

\* microchip, cuando exista, validado para evitar duplicados dentro del mismo negocio cuando corresponda;

\* estado perteneciente al conjunto permitido.



Los campos autoritativos de negocio, identidad, autoría y timestamps no deberán confiarse al frontend.



\---



Invariantes autoritativas:



Toda operación sensible deberá validar en backend:



\* usuario autenticado;

\* `businessId`;

\* negocio válido;

\* membresía activa;

\* rol autorizado;

\* pertenencia de todas las referencias al mismo negocio;

\* existencia del tutor;

\* existencia del paciente cuando corresponda;

\* estado válido de paciente, cita y atención.



Un identificador manipulado desde el frontend no deberá permitir acceder a información de otro negocio.



Debe rechazarse explícitamente cualquier operación cross-tenant.



\---



Autoridad del frontend:



El frontend podrá enviar únicamente datos editables necesarios para la operación.



No deberá utilizarse como autoridad para:



\* `businessId`;

\* permisos;

\* membresía;

\* autoría;

\* timestamps;

\* estados internos no permitidos;

\* stock;

\* costos de Inventario;

\* documentos internos de Venta.



Las validaciones visuales del formulario complementan, pero no sustituyen, las validaciones backend.



\---



Idempotencia y atomicidad:



Las mutaciones críticas deberán evitar duplicados y efectos parciales.



En particular, el cierre de una atención deberá considerar un `requestId` o mecanismo equivalente de idempotencia.



Un reintento de la misma operación no deberá:



\* crear una segunda atención;

\* cerrar dos veces;

\* duplicar registros relacionados;

\* crear múltiples consecuencias comerciales.



Cuando una operación veterinaria afecte varios documentos propios del módulo, deberá utilizar transacción o batch cuando corresponda y dentro de los límites técnicos permitidos.



\---



Integración con Inventario Core:



El módulo podrá leer Inventario para seleccionar servicios, medicamentos, insumos o productos.



No podrá escribir directamente:



\* `stock`;

\* `costoPromedio`;

\* `valorInventario`;

\* moneda del saldo;

\* economía Q/V;

\* `adquisicionesInventario`;

\* movimientos internos.



El registro de un medicamento o producto en una atención no implica automáticamente consumo de stock.



Una futura afectación física deberá utilizar exclusivamente un mecanismo Core aprobado.



\---



Integración con Ventas Core:



El módulo podrá preparar información comercial proveniente de una atención:



\* servicios;

\* productos;

\* medicamentos;

\* cantidades;

\* valores.



El MVP veterinario no escribirá directamente en:



`negocios/{businessId}/ventas/...`



La generación de una Venta sólo podrá incorporarse posteriormente si existe un contrato Core aprobado para dicha integración.



\---



Core protegido:



Esta SPEC no autoriza modificaciones a:



\* autenticación;

\* sesión;

\* recuperación de acceso;

\* selección del negocio activo;

\* autorización y aislamiento multiempresa Core;

\* modelo central `negocios/{businessId}/...`;

\* membresías;

\* RBAC central;

\* helpers compartidos de autorización;

\* verificación empresarial;

\* Platform Admin;

\* Firestore Rules globales;

\* Storage Rules globales;

\* economía Q/V de Inventario;

\* `costoPromedio`;

\* `valorInventario`;

\* moneda de Inventario;

\* `adquisicionesInventario`;

\* Compras Core;

\* Recepciones Core;

\* Ventas Core;

\* reversas, cancelaciones o devoluciones de stock;

\* snapshots históricos Core;

\* idempotencia Core existente;

\* Functions centrales compartidas;

\* `.firebaserc`;

\* configuración o proyecto Firebase productivo;

\* secretos;

\* deploy de producción.



Si una funcionalidad necesita modificar cualquiera de estos elementos, su implementación se detiene hasta obtener autorización.



\---



Firestore Rules y Functions:



El módulo no modificará Firestore Rules globales ni Functions centrales compartidas sin autorización.



Las operaciones backend del módulo deberán mantenerse aisladas de la lógica Core.



Si la implementación requiere ampliar Rules globales o modificar una Function Core existente, deberá documentarse la necesidad y solicitar aprobación antes del cambio.



\---



&#x20;Interfaz propuesta:



El módulo podrá organizarse bajo una ruta principal:





/clinica-veterinaria





Rutas propuestas:





/clinica-veterinaria/pacientes

/clinica-veterinaria/pacientes/{pacienteId}

/clinica-veterinaria/agenda

/clinica-veterinaria/atenciones/{atencionId}





Las pantallas principales serán:



\* listado/búsqueda de pacientes;

\* ficha integral del paciente;

\* agenda veterinaria;

\* recepción;

\* consulta clínica;

\* historial clínico.



La interfaz deberá incluir estados de:



\* carga;

\* vacío;

\* error;

\* permiso insuficiente.



conservar coherencia visual y responsive con ValoraCloud.



\---

&#x20;Pruebas requeridas:



Todas las pruebas se ejecutarán utilizando Firebase Emulator Suite.



Como mínimo deberán cubrirse:



Tutor y paciente:



\* selección de Cliente válido;

\* creación de paciente;

\* múltiples pacientes para el mismo tutor;

\* rechazo de tutor inexistente;

\* rechazo de tutor de otro negocio;

\* validación de nombre, especie, fecha y peso.



Multiempresa:



\* usuario del negocio A puede consultar datos del negocio A;

\* usuario del negocio A no puede consultar paciente del negocio B;

\* usuario del negocio A no puede modificar cita o atención del negocio B;

\* manipular IDs desde cliente no evita el rechazo backend.



Permisos:



\* `OWNER` autorizado;

\* `ADMIN` autorizado;

\* usuario sin membresía rechazado;

\* membresía inactiva rechazada;

\* rol no autorizado rechazado.



Agenda:



\* creación de cita válida;

\* paciente y tutor coincidentes;

\* cambio entre estados permitidos;

\* rechazo de transiciones inválidas.



Atención clínica:



\* inicio con paciente válido;

\* registro de información clínica;

\* rechazo de cierre sin campos mínimos;

\* cierre correcto;

\* atención finalizada disponible en historial.



&#x20;Idempotencia:



\* repetir cierre con el mismo request no duplica atención ni consecuencias.



Integración Core:



\* ninguna escritura directa de stock desde frontend;

\* ningún cambio de `costoPromedio`;

\* ningún cambio de `valorInventario`;

\* ninguna escritura directa en Ventas;

\* Clientes Core continúa funcionando sin regresión.



\---



Criterios de aceptación:



El MVP se considerará aceptable cuando:



\* un Cliente existente puede utilizarse como tutor;

\* un tutor puede poseer múltiples pacientes;

\* puede registrarse y consultarse una ficha de paciente;

\* puede crearse una cita;

\* puede registrarse la llegada del paciente;

\* puede iniciarse una atención;

\* pueden registrarse anamnesis, examen, diagnóstico, tratamiento e indicaciones;

\* pueden asociarse servicios/productos sin alterar stock directamente;

\* una atención puede finalizar sólo con sus datos mínimos;

\* una atención finalizada aparece en el historial del paciente correcto;

\* no existe acceso cross-tenant;

\* las operaciones sensibles validan membresía y permisos en backend;

\* un reintento crítico no genera duplicados;

\* Inventario Core no es modificado directamente;

\* Ventas Core no es modificado directamente;

\* los smokes y pruebas de integración local están en verde;

\* build y lint terminan correctamente cuando correspondan;

\* `git diff --check` está limpio;

\* no existen credenciales, datos reales ni secretos;

\* no se ejecutó ningún deploy de producción.



\---



Fuera de alcance del MVP:



No forman parte de esta primera implementación:



\* hospitalización;

\* gestión quirúrgica avanzada;

\* portal para tutores;

\* aplicación móvil independiente;

\* telemedicina;

\* diagnóstico mediante IA;

\* integración automática con laboratorios;

\* firma electrónica avanzada;

\* facturación electrónica;

\* pagos;

\* integraciones gubernamentales;

\* múltiples tutores por paciente;

\* recordatorios avanzados;

\* dashboard avanzado;

\* analítica de rentabilidad;

\* documentos clínicos adjuntos;

\* fotografías obligatorias;

\* lotes o vencimientos farmacológicos;

\* modificación directa de stock;

\* lógica propia de Compras;

\* lógica propia de Ventas;

\* reversas o devoluciones Core.



Prescripciones, vacunas, desparasitación, recordatorios y seguimiento avanzado podrán evaluarse después de completar el flujo principal.



\---



Pendientes antes de aprobación:



Antes de aprobar esta SPEC deberán confirmarse:



1\. Los nombres definitivos de las colecciones veterinarias.

2\. El mapa definitivo de permisos del módulo.

3\. Si `TECNICO` podrá operar funciones clínicas o si el MVP quedará inicialmente limitado a `OWNER` y `ADMIN`.

4\. Los campos clínicos mínimos obligatorios para cerrar una atención.

5\. Si la selección de productos/medicamentos desde Inventario será parte de la primera implementación o una segunda iteración.

6\. Si existe actualmente un mecanismo Core aprobado para convertir una atención en Venta. Si no existe, dicha integración permanecerá fuera del MVP.



\---

Condición de inicio de implementación:



La implementación no comienza hasta que esta SPEC sea revisada y aprobada.



Cualquier necesidad de modificar el Core protegido obliga a detener el desarrollo de esa parte y solicitar una revisión adicional.



