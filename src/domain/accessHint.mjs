// Pista de acceso (SPEC 029). Solo guía qué pantalla de interfaz se muestra:
// "Mi empresa" o "Soy colaborador". NO es una autorización: no se envía al
// backend, no se guarda en Firestore y no cambia ningún permiso. La autoridad
// sigue siendo la membresía activa.
export const ACCESS_HINT = Object.freeze({
  EMPRESA: "empresa",
  COLABORADOR: "colaborador",
});

export const ACCESS_HINT_STORAGE_KEY = "valoracloud.accessHint";
export const ACCESS_HINT_QUERY_PARAM = "acceso";

export function normalizeAccessHint(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return Object.values(ACCESS_HINT).includes(normalized) ? normalized : null;
}

// La query (?acceso=colaborador) manda sobre lo guardado; sin ninguna de las
// dos, se parte de "Mi empresa".
export function resolveAccessHint({ search = "", stored = null } = {}) {
  const fromQuery = normalizeAccessHint(
    new URLSearchParams(search).get(ACCESS_HINT_QUERY_PARAM)
  );
  return fromQuery || normalizeAccessHint(stored) || ACCESS_HINT.EMPRESA;
}

// Enlace de ingreso para abrir en otro navegador. Conserva la pestaña elegida
// con ?acceso=colaborador; "Mi empresa" es el valor por defecto y no se agrega.
export function buildLoginLink(origin, hint) {
  const base = `${String(origin || "").replace(/\/+$/, "")}/login`;
  return normalizeAccessHint(hint) === ACCESS_HINT.COLABORADOR
    ? `${base}?${ACCESS_HINT_QUERY_PARAM}=${ACCESS_HINT.COLABORADOR}`
    : base;
}
