# SPEC 032: Invitaciones de equipo

Estado: **v1. Backend implementado (`functions/teamInvitations.js`) e interfaz implementada en el frontend (2026-10-19)**, pendientes la revisión en el navegador y el despliegue (sección 12). Decisiones por defecto de Mauricio el 2026-10-18 (sección 9, cambiables).

## 1. Objetivo

Que una empresa no pueda agregar a una persona a su equipo sin que esa persona lo acepte, y que invitar no revele qué correos tienen cuenta en ValoraCloud. La persona recibe la invitación como un aviso en su centro de notificaciones, la acepta o la rechaza (con un motivo opcional), y recién al aceptar se crea su acceso.

## 2. Problema actual (hechos verificados en el código)

- `asociarUsuarioExistente` (`functions/businessMemberships.js`) crea la membresía al instante, sin aviso ni aceptación de la persona.
- Busca la cuenta por correo y, si no existe, responde "No existe una cuenta de ValoraCloud con ese correo.": una empresa puede probar correos para saber quién usa el sistema.
- Un error de tipeo que coincida con otra cuenta da acceso a los datos de la empresa.
- Desde el 2026-10-18 exige correo verificado, pero sigue sin pedir el consentimiento de la persona.
- La persona queda visible (nombre y correo) en la lista de miembros de la empresa.

## 3. Alcance

Invitar, aceptar, rechazar, revocar y vencer invitaciones. Aviso a la persona invitada, también si todavía no tiene cuenta. La acción directa de agregar por correo desaparece como Function invocable.

## 4. Modelo de datos

Colección raíz `invitacionesEquipo/{invitacionId}`, con **id determinista** `{negocioId}__{hash del correo normalizado}`. Así hay una sola invitación por empresa y correo, el enfriamiento y la unicidad no necesitan colecciones aparte, y reinvitar reutiliza el documento.

| Campo | Contenido |
|---|---|
| `negocioId`, `negocioNombre` | Empresa y su nombre comercial al invitar |
| `emailNormalizado` | Correo en minúsculas y sin espacios |
| `rol`, `profileId` | Mismos valores y validaciones que hoy en el diálogo de agregar usuario. Nunca OWNER |
| `estado` | `pendiente`, `aceptada`, `rechazada`, `revocada` o `vencida` |
| `creadoPorUid`, `creadoPorNombre`, `creadoEn`, `expiraEn` | Quién invita y cuándo vence (7 días) |
| `respondidoEn`, `respondidoPorUid`, `motivoRechazo` | Respuesta de la persona. Motivo opcional, hasta 500 caracteres |
| `ultimoRechazoEn`, `invitacionesTotales` | Para el enfriamiento y la auditoría |

Colecciones técnicas: `invitacionRequests/{requestId}` (idempotencia) y `invitacionLimites/{negocioId}__{AAAAMMDD}` (tope diario).

## 5. Reglas de Firestore

`invitacionesEquipo`, `invitacionRequests` e `invitacionLimites` quedan con `read, write: if false`. Todo pasa por Functions (la persona invitada lee sus invitaciones con una Function, no con una consulta del navegador), así que no hace falta comparar correos en las reglas.

## 6. Functions

| Function | Quién | Qué hace |
|---|---|---|
| `invitarMiembroNegocio` | OWNER o ADMIN, empresa operable | Crea o reabre la invitación. **Responde igual exista o no la cuenta** (`{ok, estado, expiraEn}`). Idempotente por `requestId`. Si la persona ya es miembro activo: error claro (es información de la propia empresa). Si rechazó hace menos de 30 días: error genérico "No es posible invitar a esa persona por ahora." Tope: 20 invitaciones por día y 50 pendientes por empresa |
| `listarInvitacionesNegocio` | OWNER o ADMIN | Pendientes, rechazadas (con motivo) y vencidas de esa empresa, de los últimos 90 días |
| `revocarInvitacionNegocio` | OWNER o ADMIN | Pasa una invitación pendiente a `revocada` |
| `listarMisInvitaciones` | Cualquier cuenta autenticada | Devuelve las pendientes y vigentes del **correo verificado** de quien llama: empresa, rol, quién invita y vencimiento. Con correo sin verificar devuelve lista vacía más `requiereVerificacion: true` |
| `responderInvitacion` | Quien recibe | `aceptar` o `rechazar` (con motivo opcional). En una transacción valida que la invitación esté pendiente y vigente, que la empresa esté activa, que el correo de la cuenta esté verificado **y coincida** con el invitado, y que la cuenta no esté suspendida. Aceptar crea la membresía con el mismo formato y validaciones de hoy y deja activa la empresa si la persona no tenía una |
| `asociarUsuarioExistente` | — | **Se elimina como Function invocable.** Su lógica de crear membresía pasa a una función interna compartida con `responderInvitacion` |

## 7. Interfaz

- **Empleados:** el botón pasa a "Invitar usuario". El diálogo pide correo y rol o perfil, como hoy, y confirma con un texto neutro: "Si esa persona usa ValoraCloud, recibirá la invitación." Una sección "Invitaciones" lista pendientes (con vencimiento y "Revocar"), rechazadas (con el motivo y la fecha) y vencidas (con "Volver a invitar"). La tabla de miembros muestra el correo cuando no hay nombre.
- **Centro de notificaciones:** cada invitación pendiente aparece como "{Empresa} te invita a unirte como {rol}" con "Aceptar" y "Rechazar". Rechazar abre un diálogo con un motivo opcional.
- **Cuentas sin empresa:** como no ven el menú ni las notificaciones, la pantalla de espera del colaborador y el onboarding muestran sus invitaciones pendientes con las mismas acciones. Allí **desaparece el campo "código de acceso"**: la invitación lo reemplaza.
- **Correo sin verificar:** se avisa que debe verificarlo para ver sus invitaciones.
- Tras aceptar, se recarga la sesión y se entra a la empresa.

## 8. Datos personales

La invitación guarda el correo de la persona invitada, que no necesariamente es usuaria. Debe mencionarse en la política de privacidad en el próximo cambio de versión de los textos, y las invitaciones respondidas o vencidas se purgan a los 90 días (tarea pendiente, fuera de esta versión).

## 9. Decisiones por defecto (cambiables)

1. Vigencia de la invitación: 7 días.
2. Enfriamiento tras un rechazo: 30 días.
3. Tope: 20 invitaciones diarias y 50 pendientes por empresa.
4. El correo de quien acepta debe estar verificado y coincidir con el invitado.
5. Sin bloqueo de empresas por parte del invitado en esta versión.
6. Enlace de invitación por WhatsApp para personas sin cuenta: versión posterior.
7. Las empresas existentes y sus miembros actuales no cambian.

## 10. Pruebas

- Pruebas puras: normalización del correo, id determinista, vencimiento, enfriamiento y máquina de estados.
- Integradas con emuladores:
  - invitar a un correo sin cuenta y a uno con cuenta, con la misma respuesta;
  - aceptar con correo verificado, con correo distinto y con correo sin verificar;
  - invitación vencida, doble aceptación (idempotente) y rechazo con motivo;
  - reinvitar durante el enfriamiento, revocar y superar el tope diario;
  - un rol que no sea OWNER ni ADMIN no puede invitar;
  - una persona solo ve sus propias invitaciones;
  - la membresía creada coincide con la que creaba la Function anterior.
- Reglas: las tres colecciones nuevas, sin acceso desde el navegador.
- Se actualizan los tests que usaban `asociarUsuarioExistente`.

## 11. Fuera de alcance

Enlace de invitación, bloqueo de empresas, purga automática, y correos de invitación (el aviso es solo dentro de ValoraCloud).

## 12. Implementación de la interfaz (2026-10-19)

No toca Functions ni reglas.

- **Servicio:** `src/services/teamInvitationService.js` llama a las cinco Functions con `requestId` (`createRequestId`). Si `listarMisInvitaciones` o `responderInvitacion` responden "verifica tu correo" pero Auth ya tiene el correo verificado, renueva el token (`user.reload()` no lo hace) y reintenta una vez. De `businessMemberService.js` se eliminó la función que llamaba a `asociarUsuarioExistente`; ya nada en `src/` la usa.
- **Modelo y estado:** `src/domain/teamInvitationModel.mjs` (puro) y `src/hooks/useMyInvitations.js` (cargar, aceptar y rechazar; `reload({ silent: true })` para las consultas periódicas).
- **Componentes compartidos:** `InvitationsInbox` (lista con estados de carga, error, correo sin verificar, vacío y datos) y `RejectInvitationDialog` (motivo opcional de hasta 500 caracteres). Estilos `ui-invitation*` en `components.css`.
- **Empleados:** botón y diálogo "Invitar usuario" con el texto neutro "Si esa persona usa ValoraCloud, recibirá la invitación."; los errores del servidor se muestran tal cual. Sección "Invitaciones" (`TeamInvitationsPanel`) con pendientes (vencimiento y Revocar), rechazadas (motivo y fecha) y vencidas (Volver a invitar), cargada aparte de la tabla de miembros. Sin nombre, la tabla usa el correo con `getWorkMemberIdentity`, el mismo criterio de Proyectos y trabajos.
- **Centro de notificaciones:** las invitaciones no vienen de la suscripción de Firestore (que sigue solo para OWNER) sino de `listarMisInvitaciones`, así que la campana ahora se muestra a todos los roles. La sección "Invitaciones" tiene sus propios estados y cuenta en el badge; la sección "Avisos" solo existe para OWNER. Al aceptar se recarga la sesión y se entra a la empresa (`handleBusinessChanged`); si la respuesta trae `mensaje` (acceso previo), se muestra.
- **Cuentas sin empresa:** la pantalla de espera reemplaza el campo de código por la lista (ver SPEC 029, sección 2.4); el onboarding muestra "Tienes N invitaciones pendientes" con "Ver invitaciones".
- **Pruebas:** `npm run test:team-invitations-ui` (nuevo). Se ajustaron `test:login-access` (campo de código, aviso de verificación y ancla de la consulta periódica) y `test:notification-bell` (la campana ya no se oculta a quien no es OWNER).
- **Pendiente conocido, fuera de esta tarea:** el error "Missing or insufficient permissions" de la suscripción de notificaciones. Hipótesis: la regla exige `resource.data.negocioId == businessId` y la consulta (`orderBy("creadoEn")`) no filtra por `negocioId`, así que Firestore no puede garantizar que cumple la regla. No se corrigió aquí.
