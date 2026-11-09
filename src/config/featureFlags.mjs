// Interruptores de funciones (SPEC 029). Se leen de variables VITE_* de
// compilación y valen false si la variable no existe: una función apagada no
// requiere ninguna configuración.
export function resolveGoogleLoginEnabled(env) {
  return env?.VITE_GOOGLE_LOGIN_ENABLED === "true";
}

// Ingreso con Google. Apagado por decisión de Mauricio (el sistema se traspasa
// a Bagner y su backend puede cambiar). El código se conserva: ver la SPEC 029
// para los pasos de reactivación.
export const GOOGLE_LOGIN_ENABLED = resolveGoogleLoginEnabled(import.meta.env);
