# SPEC 029: Ingreso con Google, selector de acceso y pantalla de espera

Estado: **v1 implementada en el frontend (2026-10-18)**. **El ingreso con Google está DESACTIVADO por decisión de Mauricio (ver sección 3 bis).** No toca Functions, reglas ni cálculos. Complementa la SPEC 024 (aceptación de términos); no sustituye ninguno de sus puntos.

**Actualización (2026-10-19, SPEC 032):** el campo "código de acceso" de la pantalla de espera desaparece y la lista de invitaciones pendientes ocupa su lugar (sección 2.4). El resto de la SPEC sigue vigente.

## 1. Objetivo

Renovar la pantalla de ingreso (`Login.jsx`) y dar un camino claro a quien entra como colaborador de una empresa que todavía no lo ha agregado.

## 2. Qué se implementó

### 2.1 Panel izquierdo animado
`src/features/auth/AuthStage.jsx` reemplaza la imagen estática: ilustración SVG con CSS (nube con engranaje, barras que crecen, línea que se dibuja, etiquetas de módulos que flotan y luces de fondo). Estilos en `src/features/auth/login.css`.

- Colores solo con tokens (`--color-dark-*` para el fondo del panel, `--color-brand-*` y `--color-accent-500` para la ilustración). Radios con `--radius-*`.
- Las duraciones no tenían token: se agregaron `--motion-stage-drift-duration`, `--motion-stage-float-duration`, `--motion-stage-chart-duration` y `--motion-stage-gear-duration` en `tokens.css`. Los desfases se calculan con `calc()` sobre esos tokens.
- `prefers-reduced-motion: reduce`: sin animación y con el estado final visible (barras completas, línea dibujada, punta de flecha visible).
- Lo decorativo va en `aria-hidden="true"`; el titular queda fuera de ese bloque. Sin librerías nuevas.
- Se eliminó de `components.css` el CSS que solo servía a la imagen (`.auth-visual*` y sus keyframes). El PNG `src/assets/valoracloud-login-background.png` **ya no lo importa nadie** y no se borró.
- En pantallas de hasta 900 px el panel pasa a una franja con solo la ilustración; hasta 680 px se oculta (igual que antes).

### 2.2 Selector "Mi empresa / Soy colaborador"
Usa `Tabs`/`TabPanel` del sistema (flechas, Inicio y Fin). Aparece en ingreso y registro, no en recuperar contraseña.

- Cambia solo textos: "Bienvenido de vuelta" (sin subtítulo) frente a "Acceso de colaborador" con "Tu empresa te agrega con tu correo.".
- La elección se guarda en `sessionStorage` (`valoracloud.accessHint`) y puede venir de `?acceso=colaborador`, que manda sobre lo guardado. Si `sessionStorage` no está disponible, queda en memoria.
- Reglas puras en `src/domain/accessHint.mjs`; almacén y hook en `src/hooks/useAccessHint.js`.

### 2.3 Ingreso con Google
`loginWithGoogle` en `authService.js`: `GoogleAuthProvider` y `signInWithPopup`; si el navegador bloquea el popup (`auth/popup-blocked`) o no lo soporta, pasa a `signInWithRedirect`. `completeGoogleRedirect` recoge los errores del regreso (se consulta una sola vez por carga de página). Lleva `assertClientWriteAllowed("crear cuentas")`, porque el primer ingreso crea la cuenta de Auth.

Mensajes en español para popup cerrado, popup bloqueado, `auth/account-exists-with-different-credential`, método no habilitado, dominio no autorizado y cuenta deshabilitada. Una solicitud de popup reemplazada (`auth/cancelled-popup-request`) no muestra error.

El logo es el oficial de Google, como archivo (`src/assets/google-g.svg`): sus colores de marca no deben alterarse y así no entran como literales al código.

**Aceptación legal de una persona nueva de Google.** No pasa por la casilla del registro. Al autenticarse, `App` carga `getBusinessSession`; para una cuenta sin `usuarios/{uid}` la respuesta trae `legalAcceptance` con `isCurrent: false` (tanto en la rama de onboarding como en la de negocio activo). El guard de la SPEC 024 (etapa 5) lo detecta antes de `unavailable`, de `needsOnboarding` y de la pantalla de espera, y muestra la pantalla de aceptación, que permite cerrar sesión y reintentar si falla. No hay parpadeo: mientras la sesión carga se ve `LoadingScreen`. No hay `registerWithEmail` de por medio, así que tampoco hay carrera con `waitForRegistrationSetup`.

### 2.4 Pantalla de espera
`src/features/auth/BusinessWaitingPage.jsx`. Se muestra cuando `getBusinessSession` devuelve `needsOnboarding` y la pista es "colaborador" (rama `needsOnboarding` de `AppRoutes`, después del guard de aceptación). Contiene: correo del usuario con botón Copiar, estado ("Esperando una invitación de tu empresa..."), la sección **Invitaciones** con las invitaciones pendientes de la cuenta y sus acciones Aceptar y Rechazar (SPEC 032, sección 7), "Cerrar sesión" y "Quiero crear mi propia empresa" (borra la pista y lleva al onboarding normal). Si el correo no está verificado (según Auth o según `requiereVerificacion` de `listarMisInvitaciones`) se muestra el aviso de verificación en lugar de la lista. El campo "código de acceso" ya no existe.

Vuelve a consultar la sesión sola con la recarga que ya existe en `App` (`refreshBusinessSession`; `getBusinessSession` no cambió) y, en cada consulta, también `listarMisInvitaciones`: cada 30 s con tope de 20 consultas (10 min), y al recuperar el foco o la visibilidad de la pestaña con un mínimo de 5 s entre consultas. Pasado el tope solo queda la consulta por foco y el texto lo indica. Un error de consulta no saca de la espera. Cuando la persona ya tiene empresa, `needsOnboarding` pasa a `false` y la app entra.

## 3. Decisión: "colaborador" es solo una pista de interfaz

- La pista no se envía al backend, no se guarda en Firestore y no cambia ninguna autorización. La autoridad sigue siendo la membresía activa (`AGENTS.md`).
- Se usa únicamente para (a) elegir pestaña y textos en el ingreso y (b) decidir entre la pantalla de espera y el onboarding cuando la cuenta no pertenece a ninguna empresa. Una cuenta con empresa ignora la pista.
- Quien se equivoca de pestaña no pierde nada: puede cambiarla o usar "Quiero crear mi propia empresa".

## 3 bis. Decisión: ingreso con Google desactivado por ahora

Mauricio decidió dejar el ingreso con Google apagado: el sistema se traspasará a Bagner y su backend puede cambiar. El código **se conserva** para poder reactivarlo (`loginWithGoogle`, `completeGoogleRedirect`, `inAppBrowser.mjs`, los mensajes de error y los estilos).

- **Interruptor:** `GOOGLE_LOGIN_ENABLED` en `src/config/featureFlags.mjs`. Vale `true` solo si `import.meta.env.VITE_GOOGLE_LOGIN_ENABLED === "true"`; sin la variable vale `false`. La variable no está en ningún archivo `.env`.
- **Apagado:** el botón "Continuar con Google" se ve deshabilitado (atributo `disabled`, logo en gris) con el texto "Ingreso con Google no conectado por ahora.", ligado con `aria-describedby`. El separador "o" y el formulario de correo no cambian. No se llama a `loginWithGoogle` ni a `completeGoogleRedirect`, y tampoco se muestra el aviso de navegador integrado (no hay botón que reemplazar).
- **Encendido:** todo se comporta como se describe en la sección 2.3, incluida la detección de navegadores integrados.

### Cómo reactivarlo
1. Definir `VITE_GOOGLE_LOGIN_ENABLED=true` en el entorno de compilación (por ejemplo en `.env.production` o en el `.env` de la compilación) y volver a compilar. Es una variable de compilación: no se lee en tiempo de ejecución.
2. Habilitar el proveedor Google en Firebase Authentication del proyecto vigente.
3. Autorizar el dominio de producción en Firebase Authentication (dominios autorizados).
4. Configurar y publicar la pantalla de consentimiento OAuth en Google Cloud (estado "En producción"; en modo de prueba solo ingresan los usuarios de prueba).
5. Probar el ingreso en un navegador real (popup y, si se quiere, redirección; ver la sección 6) y con una cuenta nueva de Google, para confirmar que el guard de aceptación legal la captura.

## 4. Fuera de alcance

- **Código de acceso de empresa.** Descartado: lo reemplazan las invitaciones de la SPEC 032.
- Vincular una cuenta de Google con una de correo y contraseña ya existente (`account-exists-with-different-credential` solo informa).
- Aviso de correo no verificado para cuentas de correo y contraseña: sin cambios.

## 5. Pruebas

`npm run test:login-access` (`scripts/login-access-smoke.mjs`; incluye el interruptor apagado por defecto, el botón deshabilitado con su nota y la rama encendida intacta): regla pura de la pista; la elección no llega a Firebase ni al backend; `reduced-motion` cubre todo lo animado y `login.css` no tiene literales; panel decorativo en `aria-hidden`; Google (popup, redirección, guard `assertClientWriteAllowed`, mensajes en español, sin casilla propia, guard de aceptación antes de la espera); pantalla de espera (sin campo de código, lista de invitaciones, salidas, tope de consultas, un solo `role="status"`). Las aserciones de las invitaciones están en `npm run test:team-invitations-ui`.

Se ejecutan además `test:legal-documents`, `test:firebase-environment`, `test:business-quick-flow`, `test:design`, `test:contrast`, `build` y `git diff --check`.

## 6. Pendiente de configuración (fuera del repositorio)

Solo aplica al reactivar el ingreso con Google (sección 3 bis).

- Habilitar el proveedor Google en Firebase Authentication y confirmar que el dominio de producción esté en los dominios autorizados.
- `authDomain` es `*.firebaseapp.com` y la app se sirve desde otro dominio: el **popup** funciona, pero la **redirección** puede fallar en navegadores que parten el almacenamiento entre sitios. Por eso es solo el plan B. Revisar en un navegador real antes de depender de ella.
- Revisar en el navegador: `/login` ( ambas pestañas, claro y oscuro, 1280 / 768 / 390 px, con y sin movimiento reducido) y la pantalla de espera con `?acceso=colaborador` y una cuenta sin empresa.
