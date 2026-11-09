// Decisión del guard de aceptación legal (SPEC 024, 5.5). Función pura sobre
// `businessSession.legalAcceptance`.
//
// - "unknown": la sesión no trae el campo (backend desplegado sin la etapa 2).
//   No se bloquea: de lo contrario nadie podría entrar.
// - "required": el campo viene y la versión aceptada no es la vigente.
// - "accepted": la versión aceptada es la vigente.
export const LEGAL_ACCEPTANCE_GATE = Object.freeze({
  UNKNOWN: "unknown",
  REQUIRED: "required",
  ACCEPTED: "accepted",
});

export function resolveLegalAcceptanceGate(legalAcceptance) {
  if (!legalAcceptance || typeof legalAcceptance !== "object") {
    return LEGAL_ACCEPTANCE_GATE.UNKNOWN;
  }
  return legalAcceptance.isCurrent === true
    ? LEGAL_ACCEPTANCE_GATE.ACCEPTED
    : LEGAL_ACCEPTANCE_GATE.REQUIRED;
}
