import {httpsCallable} from "firebase/functions";
import {assertCloudFunctionAllowed} from "../config/firebaseEnvironment.mjs";
import {auth, getFirebaseFunctions} from "../firebase/firebaseConfig.js";
import {normalizeBusinessMemberEmail} from "../domain/businessMemberModel.mjs";
import {adaptMyInvitationsResponse} from "../domain/teamInvitationModel.mjs";

const functions = getFirebaseFunctions("us-central1");

export function createRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return `invitation-${globalThis.crypto.randomUUID()}`;
  }
  return `invitation-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function call(name, data, operation) {
  assertCloudFunctionAllowed(operation);
  return httpsCallable(functions, name)(data);
}

// user.reload() no renueva el token: si la persona acaba de verificar su
// correo, el backend todavía ve el token anterior. Se renueva una vez.
async function refreshTokenIfEmailVerified() {
  const user = auth.currentUser;
  if (!user || user.emailVerified !== true) return false;
  await user.getIdToken(true);
  return true;
}

export async function invitarMiembroNegocio(businessId, {correo, rol, profileId = "", requestId}) {
  const response = await call(
    "invitarMiembroNegocio",
    {
      businessId,
      correo: normalizeBusinessMemberEmail(correo),
      rol,
      profileId,
      requestId: requestId || createRequestId(),
    },
    "invitar usuarios"
  );
  return response.data || {};
}

export async function listarInvitacionesNegocio(businessId) {
  const response = await call("listarInvitacionesNegocio", {businessId}, "consultar invitaciones");
  return response.data?.invitaciones || [];
}

export async function revocarInvitacionNegocio(businessId, invitacionId) {
  const response = await call(
    "revocarInvitacionNegocio",
    {businessId, invitacionId},
    "revocar invitaciones"
  );
  return response.data || {};
}

export async function listarMisInvitaciones() {
  let response = await call("listarMisInvitaciones", {}, "consultar tus invitaciones");
  if (response.data?.requiereVerificacion === true && await refreshTokenIfEmailVerified()) {
    response = await call("listarMisInvitaciones", {}, "consultar tus invitaciones");
  }
  return adaptMyInvitationsResponse(response.data);
}

export async function responderInvitacion({invitacionId, accion, motivo = "", requestId}) {
  const data = {invitacionId, accion, motivo, requestId: requestId || createRequestId()};
  try {
    const response = await call("responderInvitacion", data, "responder invitaciones");
    return response.data || {};
  } catch (error) {
    const notVerified = String(error?.code || "").endsWith("failed-precondition") &&
      /^Verifica tu correo/i.test(String(error?.message || ""));
    if (!notVerified || !await refreshTokenIfEmailVerified()) throw error;
    const response = await call("responderInvitacion", data, "responder invitaciones");
    return response.data || {};
  }
}
