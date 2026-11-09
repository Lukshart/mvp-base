import {BUSINESS_ROLE_LABELS} from "./rbac.mjs";

// Invitaciones de equipo (SPEC 032). Puro: sin React ni Firebase.

export const MAX_INVITATION_REJECTION_REASON_LENGTH = 500;

export const INVITATION_SENT_MESSAGE = "Si esa persona usa ValoraCloud, recibirá la invitación.";
export const INVITATION_VERIFY_EMAIL_MESSAGE =
  "Verifica tu correo para ver y responder tus invitaciones.";

export const BUSINESS_INVITATION_STATES = Object.freeze({
  PENDING: "pendiente",
  REJECTED: "rechazada",
  EXPIRED: "vencida",
});

function safeText(value) {
  return String(value || "").trim();
}

function roleLabel(role, profileName = "") {
  const name = safeText(profileName);
  if (name) return name;
  return BUSINESS_ROLE_LABELS[safeText(role).toUpperCase()] || BUSINESS_ROLE_LABELS.MEMBER;
}

// Invitación recibida (respuesta de listarMisInvitaciones).
export function adaptMyInvitation(raw = {}) {
  return {
    id: safeText(raw.id),
    negocioId: safeText(raw.negocioId),
    negocioNombre: safeText(raw.negocioNombre) || "Una empresa",
    rol: safeText(raw.rol).toUpperCase(),
    rolEtiqueta: roleLabel(raw.rol, raw.perfilNombre),
    invitadoPor: safeText(raw.invitadoPor),
    expiraEn: safeText(raw.expiraEn) || null,
  };
}

export function adaptMyInvitationsResponse(data = {}) {
  const invitations = Array.isArray(data?.invitaciones) ? data.invitaciones : [];
  return {
    invitations: invitations.map(adaptMyInvitation).filter((item) => item.id),
    requiresVerification: data?.requiereVerificacion === true,
  };
}

export function invitationHeadline(invitation) {
  return `${invitation.negocioNombre} te invita a unirte como ${invitation.rolEtiqueta}`;
}

// Invitación enviada por la empresa (respuesta de listarInvitacionesNegocio).
export function adaptBusinessInvitation(raw = {}, profiles = []) {
  const profileId = safeText(raw.profileId);
  const profile = profileId ? profiles.find((item) => item.id === profileId) : null;
  return {
    id: safeText(raw.id),
    correo: safeText(raw.correo),
    rol: safeText(raw.rol).toUpperCase(),
    profileId,
    perfilEtiqueta: roleLabel(raw.rol, profile?.nombre),
    estado: safeText(raw.estado).toLowerCase(),
    expiraEn: safeText(raw.expiraEn) || null,
    respondidoEn: safeText(raw.respondidoEn) || null,
    motivoRechazo: safeText(raw.motivoRechazo),
  };
}

export function groupBusinessInvitations(items = []) {
  const groups = {
    [BUSINESS_INVITATION_STATES.PENDING]: [],
    [BUSINESS_INVITATION_STATES.REJECTED]: [],
    [BUSINESS_INVITATION_STATES.EXPIRED]: [],
  };
  for (const item of items) groups[item.estado]?.push(item);
  return groups;
}

export function trimInvitationReason(value) {
  return String(value || "").slice(0, MAX_INVITATION_REJECTION_REASON_LENGTH);
}
