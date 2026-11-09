"use strict";

const MODULE_DISABLED_MESSAGE = "Este módulo no está habilitado para tu empresa.";

// Módulo vertical deshabilitado = bloqueado, con los datos intactos. Usa el
// documento del negocio que requireBusinessAccess ya leyó: cero lecturas extra.
// La lista cruda se compara tal cual; un id ausente o un campo ausente cuenta
// como deshabilitado.
function assertBusinessModuleEnabled(businessSnapshot, moduleId, HttpsError) {
  const enabled = businessSnapshot?.data?.()?.modulosHabilitados;
  if (!moduleId || !Array.isArray(enabled) || !enabled.includes(moduleId)) {
    throw new HttpsError("failed-precondition", MODULE_DISABLED_MESSAGE);
  }
}

module.exports = {MODULE_DISABLED_MESSAGE, assertBusinessModuleEnabled};
