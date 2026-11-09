// SPEC 032: invitaciones de equipo. Toda la lectura y escritura de las
// colecciones invitacionesEquipo, invitacionRequests e invitacionLimites pasa
// por estas Functions (las reglas de Firestore las cierran al cliente).
const {createHash} = require("node:crypto");
const {getLogicalConsumptionWindow} = require("./aiRateLimiter");
const {
  ACTIVE_STATUS,
  assertEmployeeProfileAvailable,
  assertGrantAllowed,
  createMembershipForUser,
  isCanonicalMembership,
  normalizeMembershipGrant,
  validateActorSnapshot,
  validateBusinessSnapshot,
} = require("./businessMemberships");

const DAY_MS = 24 * 60 * 60 * 1000;
const INVITATION_TTL_DAYS = 7;
const REJECTION_COOLDOWN_DAYS = 30;
const DAILY_INVITATION_LIMIT = 20;
const PENDING_INVITATION_LIMIT = 50;
const LIST_WINDOW_DAYS = 90;
const MAX_REJECTION_REASON_LENGTH = 500;
const LIMIT_TIME_ZONE = "America/Santiago";
const DIRECTORY_BATCH_SIZE = 100;
const MY_INVITATIONS_LIMIT = 50;

const STATES = Object.freeze({
  PENDING: "pendiente",
  ACCEPTED: "aceptada",
  REJECTED: "rechazada",
  REVOKED: "revocada",
  EXPIRED: "vencida",
});
const TRANSITIONS = Object.freeze({
  [STATES.PENDING]: [STATES.ACCEPTED, STATES.REJECTED, STATES.REVOKED, STATES.EXPIRED],
  [STATES.EXPIRED]: [STATES.PENDING],
  [STATES.REVOKED]: [STATES.PENDING],
  [STATES.REJECTED]: [STATES.PENDING],
  [STATES.ACCEPTED]: [STATES.PENDING],
});
const INVITATION_ID_PATTERN = /^([a-zA-Z0-9_-]{1,160})__([a-f0-9]{64})$/;
const COOLDOWN_MESSAGE = "No es posible invitar a esa persona por ahora.";

function safeText(value, maxLength = 180) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeInviteEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 320);
}

function isValidInviteEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function invitationId(businessId, email) {
  return `${businessId}__${sha256(normalizeInviteEmail(email))}`;
}

function parseInvitationId(value) {
  const match = INVITATION_ID_PATTERN.exec(String(value || ""));
  return match ? {businessId: match[1], emailHash: match[2]} : null;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toIso(value) {
  const millis = toMillis(value);
  return millis ? new Date(millis).toISOString() : null;
}

function computeExpiry(now) {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * DAY_MS);
}

// El vencimiento se evalúa al leer: una invitación "pendiente" cuyo expiraEn
// ya pasó se trata como "vencida" sin necesidad de un proceso que la marque.
function effectiveState(invitation, now) {
  const state = invitation?.estado;
  if (state === STATES.PENDING && toMillis(invitation.expiraEn) <= now.getTime()) {
    return STATES.EXPIRED;
  }
  return state;
}

function isCooldownActive(invitation, now) {
  const rejectedAt = toMillis(invitation?.ultimoRechazoEn);
  return rejectedAt > 0 && rejectedAt + REJECTION_COOLDOWN_DAYS * DAY_MS > now.getTime();
}

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

// Decide qué hace invitar frente al documento existente (o su ausencia).
function planInvitation(existing, now) {
  if (!existing) return "create";
  if (effectiveState(existing, now) === STATES.PENDING) return "keep";
  if (isCooldownActive(existing, now)) return "cooldown";
  return "reopen";
}

function dayKey(now) {
  return getLogicalConsumptionWindow(now, LIMIT_TIME_ZONE).logicalDate.replace(/-/g, "");
}

function requireUid(request, HttpsError) {
  const uid = request?.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  return uid;
}

function validateRequestId(value, HttpsError) {
  const requestId = safeText(value, 120);
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(requestId)) {
    throw new HttpsError("invalid-argument", "No se pudo validar la solicitud.");
  }
  return requestId;
}

function tokenIdentity(request) {
  const token = request?.auth?.token || {};
  return {
    email: normalizeInviteEmail(token.email),
    emailVerified: token.email_verified === true,
    name: safeText(token.name, 240),
  };
}

function assertCanManageInvitations(context, HttpsError) {
  if (context.membership?.profileId) {
    throw new HttpsError(
      "permission-denied",
      "No puedes administrar miembros de esta empresa."
    );
  }
}

function assertPlatformUserActive(user, HttpsError) {
  if (user?.estadoPlataforma === "suspendido") {
    throw new HttpsError(
      "permission-denied",
      "La cuenta de usuario esta suspendida por la plataforma."
    );
  }
}

function notFound(HttpsError) {
  return new HttpsError("not-found", "No se encontró la invitación.");
}

function chunks(values, size = DIRECTORY_BATCH_SIZE) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

// Nombre a mostrar de quien invita: perfil personal (nombres y apellidos),
// luego el nombre del token. No consulta Auth.
async function inviterDisplayName(db, uid, token) {
  const snapshot = await db.collection("usuarios").doc(uid)
    .collection("cuenta").doc("perfil").get();
  const profile = snapshot.data() || {};
  const profileName = [profile.nombres, profile.apellidos]
    .map((part) => safeText(part, 160))
    .filter(Boolean)
    .join(" ");
  return profileName || token.name || "Administrador de la empresa";
}

// "Ya es miembro" es información de la propia empresa. Se resuelve leyendo en
// Auth, por uid, solo a los miembros de esta empresa: nunca se busca el correo
// invitado, así que la respuesta y su tiempo no delatan si esa cuenta existe.
async function assertEmailIsNotMember({db, auth, HttpsError}, businessId, email) {
  const snapshot = await db.collection("membresias")
    .where("negocioId", "==", businessId)
    .get();
  const memberships = snapshot.docs
    .filter((doc) => isCanonicalMembership(doc, businessId))
    .map((doc) => doc.data());
  for (const batch of chunks(memberships)) {
    const result = await auth.getUsers(batch.map((member) => ({uid: member.uid})));
    for (const user of result.users) {
      if (normalizeInviteEmail(user.email) !== email) continue;
      const membership = batch.find((member) => member.uid === user.uid);
      if (membership?.estado === ACTIVE_STATUS) {
        throw new HttpsError(
          "already-exists",
          "Esa persona ya tiene acceso activo a esta empresa."
        );
      }
      throw new HttpsError(
        "failed-precondition",
        "Esa persona ya está asociada a la empresa con el acceso desactivado. " +
          "Reactívala desde el directorio."
      );
    }
  }
}

function assertSameFingerprint(requestData, fingerprint, HttpsError) {
  if (requestData.fingerprint !== fingerprint) {
    throw new HttpsError(
      "failed-precondition",
      "La misma solicitud ya fue utilizada con otros datos."
    );
  }
}

function inviteResponse(requestData) {
  return {
    ok: true,
    estado: requestData.estado,
    expiraEn: toIso(requestData.expiraEn),
  };
}

async function invitarMiembroNegocioHandler(request, dependencies) {
  const {db, auth, HttpsError, FieldValue, Timestamp, requireBusinessAccess} = dependencies;
  const clock = dependencies.now || (() => new Date());
  const context = await requireBusinessAccess(
    request,
    {db, HttpsError},
    {roles: ["OWNER", "ADMIN"]}
  );
  assertCanManageInvitations(context, HttpsError);
  const requestId = validateRequestId(request?.data?.requestId, HttpsError);
  const email = normalizeInviteEmail(request?.data?.correo);
  if (!isValidInviteEmail(email)) {
    throw new HttpsError("invalid-argument", "Ingresa un correo válido.");
  }
  const {role, profileId} = normalizeMembershipGrant(request?.data, HttpsError);
  const token = tokenIdentity(request);
  if (email === token.email) {
    throw new HttpsError("failed-precondition", "No puedes modificar tu propio perfil.");
  }
  assertGrantAllowed(context.membership, role, HttpsError);

  const businessId = context.businessId;
  const fingerprint = sha256(JSON.stringify([businessId, email, role, profileId]));
  const requestRef = db.collection("invitacionRequests").doc(`${businessId}__${requestId}`);
  const invitationRef = db.collection("invitacionesEquipo").doc(invitationId(businessId, email));
  const profileRef = profileId
    ? db.collection("negocios").doc(businessId).collection("perfilesEmpleados").doc(profileId)
    : null;

  const replay = await requestRef.get();
  if (replay.exists) {
    assertSameFingerprint(replay.data() || {}, fingerprint, HttpsError);
    return inviteResponse(replay.data() || {});
  }
  await assertEmailIsNotMember({db, auth, HttpsError}, businessId, email);
  const inviterName = await inviterDisplayName(db, context.uid, token);

  return db.runTransaction(async (transaction) => {
    const now = clock();
    const limitRef = db.collection("invitacionLimites").doc(`${businessId}__${dayKey(now)}`);
    const [
      requestSnapshot,
      invitationSnapshot,
      limitSnapshot,
      pendingSnapshot,
      businessSnapshot,
      actorSnapshot,
      profileSnapshot,
    ] = await Promise.all([
      transaction.get(requestRef),
      transaction.get(invitationRef),
      transaction.get(limitRef),
      transaction.get(
        db.collection("invitacionesEquipo")
          .where("negocioId", "==", businessId)
          .where("estado", "==", STATES.PENDING)
      ),
      transaction.get(context.businessRef),
      transaction.get(context.membershipRef),
      profileRef ? transaction.get(profileRef) : Promise.resolve(null),
    ]);
    if (requestSnapshot.exists) {
      assertSameFingerprint(requestSnapshot.data() || {}, fingerprint, HttpsError);
      return inviteResponse(requestSnapshot.data() || {});
    }
    validateBusinessSnapshot(businessSnapshot, HttpsError);
    const actor = validateActorSnapshot(actorSnapshot, context, HttpsError);
    assertGrantAllowed(actor, role, HttpsError);
    assertEmployeeProfileAvailable(profileSnapshot, {businessId, profileId, role}, HttpsError);

    const existing = invitationSnapshot.exists ? invitationSnapshot.data() || {} : null;
    const plan = planInvitation(existing, now);
    if (plan === "cooldown") {
      throw new HttpsError("failed-precondition", COOLDOWN_MESSAGE);
    }

    const serverNow = FieldValue.serverTimestamp();
    let expiresAt;
    if (plan === "keep") {
      expiresAt = existing.expiraEn;
      transaction.update(invitationRef, {
        rol: role,
        profileId: profileId || FieldValue.delete(),
        negocioNombre: safeText(businessSnapshot.data()?.nombreComercial, 160),
        actualizadoEn: serverNow,
      });
    } else {
      const pendingCount = pendingSnapshot.docs.filter((doc) =>
        effectiveState(doc.data(), now) === STATES.PENDING
      ).length;
      if (pendingCount >= PENDING_INVITATION_LIMIT) {
        throw new HttpsError(
          "resource-exhausted",
          `Tienes ${PENDING_INVITATION_LIMIT} invitaciones pendientes. Revoca alguna o espera a que venzan.`
        );
      }
      const sentToday = Number(limitSnapshot.data()?.conteo || 0);
      if (sentToday >= DAILY_INVITATION_LIMIT) {
        throw new HttpsError(
          "resource-exhausted",
          `Alcanzaste el máximo de ${DAILY_INVITATION_LIMIT} invitaciones por día. Intenta mañana.`
        );
      }
      expiresAt = Timestamp.fromDate(computeExpiry(now));
      transaction.set(limitRef, {
        negocioId: businessId,
        fecha: dayKey(now),
        conteo: sentToday + 1,
        actualizadoEn: serverNow,
      });
      transaction.set(invitationRef, {
        negocioId: businessId,
        negocioNombre: safeText(businessSnapshot.data()?.nombreComercial, 160),
        emailNormalizado: email,
        rol: role,
        ...(profileId ? {profileId} : {}),
        estado: STATES.PENDING,
        creadoPorUid: context.uid,
        creadoPorNombre: inviterName,
        creadoEn: serverNow,
        expiraEn: expiresAt,
        ...(existing?.ultimoRechazoEn ? {ultimoRechazoEn: existing.ultimoRechazoEn} : {}),
        invitacionesTotales: Number(existing?.invitacionesTotales || 0) + 1,
        actualizadoEn: serverNow,
      });
    }
    transaction.create(requestRef, {
      negocioId: businessId,
      uid: context.uid,
      invitacionId: invitationRef.id,
      fingerprint,
      estado: STATES.PENDING,
      expiraEn: expiresAt,
      creadoEn: serverNow,
    });
    return {ok: true, estado: STATES.PENDING, expiraEn: toIso(expiresAt)};
  });
}

function businessInvitationDto(snapshot, now) {
  const invitation = snapshot.data() || {};
  const state = effectiveState(invitation, now);
  return {
    id: snapshot.id,
    correo: invitation.emailNormalizado || "",
    rol: invitation.rol,
    profileId: invitation.profileId || "",
    estado: state,
    creadoPorNombre: invitation.creadoPorNombre || "",
    creadoEn: toIso(invitation.creadoEn),
    expiraEn: toIso(invitation.expiraEn),
    respondidoEn: toIso(invitation.respondidoEn),
    ...(state === STATES.REJECTED ? {motivoRechazo: invitation.motivoRechazo || ""} : {}),
  };
}

function listReferenceMillis(invitation, state) {
  if (state === STATES.REJECTED) {
    return toMillis(invitation.respondidoEn) || toMillis(invitation.actualizadoEn);
  }
  if (state === STATES.EXPIRED) return toMillis(invitation.expiraEn);
  return toMillis(invitation.creadoEn);
}

async function listarInvitacionesNegocioHandler(request, dependencies) {
  const {db, HttpsError, requireBusinessAccess} = dependencies;
  const clock = dependencies.now || (() => new Date());
  const context = await requireBusinessAccess(
    request,
    {db, HttpsError},
    {roles: ["OWNER", "ADMIN"]}
  );
  assertCanManageInvitations(context, HttpsError);
  const now = clock();
  const since = now.getTime() - LIST_WINDOW_DAYS * DAY_MS;
  const snapshot = await db.collection("invitacionesEquipo")
    .where("negocioId", "==", context.businessId)
    .limit(500)
    .get();
  const order = {
    [STATES.PENDING]: 0,
    [STATES.REJECTED]: 1,
    [STATES.EXPIRED]: 2,
  };
  const items = snapshot.docs
    .map((doc) => ({doc, state: effectiveState(doc.data(), now)}))
    .filter(({doc, state}) =>
      state in order &&
      (state === STATES.PENDING || listReferenceMillis(doc.data(), state) >= since)
    )
    .sort((left, right) =>
      order[left.state] - order[right.state] ||
      listReferenceMillis(right.doc.data(), right.state) -
        listReferenceMillis(left.doc.data(), left.state)
    )
    .map(({doc}) => businessInvitationDto(doc, now));
  return {invitaciones: items};
}

async function revocarInvitacionNegocioHandler(request, dependencies) {
  const {db, HttpsError, FieldValue, requireBusinessAccess} = dependencies;
  const clock = dependencies.now || (() => new Date());
  const context = await requireBusinessAccess(
    request,
    {db, HttpsError},
    {roles: ["OWNER", "ADMIN"]}
  );
  assertCanManageInvitations(context, HttpsError);
  const parsed = parseInvitationId(request?.data?.invitacionId);
  if (!parsed || parsed.businessId !== context.businessId) throw notFound(HttpsError);
  const invitationRef = db.collection("invitacionesEquipo").doc(request.data.invitacionId);

  return db.runTransaction(async (transaction) => {
    const now = clock();
    const [invitationSnapshot, businessSnapshot, actorSnapshot] = await Promise.all([
      transaction.get(invitationRef),
      transaction.get(context.businessRef),
      transaction.get(context.membershipRef),
    ]);
    validateBusinessSnapshot(businessSnapshot, HttpsError);
    validateActorSnapshot(actorSnapshot, context, HttpsError);
    const invitation = invitationSnapshot.data() || {};
    if (!invitationSnapshot.exists || invitation.negocioId !== context.businessId) {
      throw notFound(HttpsError);
    }
    if (invitation.estado === STATES.REVOKED) return {ok: true, estado: STATES.REVOKED};
    if (effectiveState(invitation, now) !== STATES.PENDING ||
        !canTransition(invitation.estado, STATES.REVOKED)) {
      throw new HttpsError("failed-precondition", "La invitación ya no está pendiente.");
    }
    const serverNow = FieldValue.serverTimestamp();
    transaction.update(invitationRef, {
      estado: STATES.REVOKED,
      revocadoPorUid: context.uid,
      revocadoEn: serverNow,
      actualizadoEn: serverNow,
    });
    return {ok: true, estado: STATES.REVOKED};
  });
}

async function listarMisInvitacionesHandler(request, dependencies) {
  const {db, HttpsError} = dependencies;
  const clock = dependencies.now || (() => new Date());
  requireUid(request, HttpsError);
  const identity = tokenIdentity(request);
  if (!identity.email) return {invitaciones: [], requiereVerificacion: false};
  if (!identity.emailVerified) return {invitaciones: [], requiereVerificacion: true};

  const now = clock();
  const snapshot = await db.collection("invitacionesEquipo")
    .where("emailNormalizado", "==", identity.email)
    .where("estado", "==", STATES.PENDING)
    .limit(MY_INVITATIONS_LIMIT)
    .get();
  const valid = snapshot.docs.filter((doc) => {
    const invitation = doc.data() || {};
    return effectiveState(invitation, now) === STATES.PENDING &&
      doc.id === invitationId(invitation.negocioId, identity.email);
  });
  if (!valid.length) return {invitaciones: [], requiereVerificacion: false};

  const businessIds = [...new Set(valid.map((doc) => doc.data().negocioId))];
  const profileRefs = valid
    .filter((doc) => doc.data().profileId)
    .map((doc) => db.collection("negocios").doc(doc.data().negocioId)
      .collection("perfilesEmpleados").doc(doc.data().profileId));
  const [businessSnapshots, profileSnapshots] = await Promise.all([
    db.getAll(...businessIds.map((id) => db.collection("negocios").doc(id))),
    profileRefs.length ? db.getAll(...profileRefs) : [],
  ]);
  const businesses = new Map(businessSnapshots.map((doc) => [doc.id, doc]));
  const profileNames = new Map(profileSnapshots.map((doc) =>
    [doc.ref.path, safeText(doc.data()?.nombre, 80)]
  ));
  const invitaciones = valid
    .filter((doc) => {
      const business = businesses.get(doc.data().negocioId);
      return business?.exists && business.data()?.estado === ACTIVE_STATUS &&
        !business.data()?.eliminadoEn;
    })
    .map((doc) => {
      const invitation = doc.data();
      const business = businesses.get(invitation.negocioId).data() || {};
      return {
        id: doc.id,
        negocioId: invitation.negocioId,
        negocioNombre: safeText(business.nombreComercial || invitation.negocioNombre, 160),
        rol: invitation.rol,
        perfilNombre: invitation.profileId
          ? profileNames.get(
            `negocios/${invitation.negocioId}/perfilesEmpleados/${invitation.profileId}`
          ) || ""
          : "",
        invitadoPor: invitation.creadoPorNombre || "",
        expiraEn: toIso(invitation.expiraEn),
      };
    })
    .sort((left, right) => left.expiraEn.localeCompare(right.expiraEn));
  return {invitaciones, requiereVerificacion: false};
}

async function assertCanAcceptWithAccount(auth, uid, identity, HttpsError) {
  let authUser;
  try {
    authUser = await auth.getUser(uid);
  } catch (error) {
    if (String(error?.code || "").includes("user-not-found")) {
      throw new HttpsError("failed-precondition", "La cuenta de usuario ya no está disponible.");
    }
    throw error;
  }
  if (authUser.disabled) {
    throw new HttpsError("failed-precondition", "La cuenta de usuario está deshabilitada.");
  }
  // El token puede estar desactualizado: la cuenta manda.
  if (authUser.emailVerified !== true ||
      normalizeInviteEmail(authUser.email) !== identity.email) {
    throw new HttpsError(
      "failed-precondition",
      "Verifica tu correo para aceptar la invitación."
    );
  }
}

async function responderInvitacionHandler(request, dependencies) {
  const {db, auth, HttpsError, FieldValue} = dependencies;
  const clock = dependencies.now || (() => new Date());
  const uid = requireUid(request, HttpsError);
  const identity = tokenIdentity(request);
  const action = safeText(request?.data?.accion, 20).toLowerCase();
  if (!["aceptar", "rechazar"].includes(action)) {
    throw new HttpsError("invalid-argument", "Indica si aceptas o rechazas la invitación.");
  }
  if (!identity.email || !identity.emailVerified) {
    throw new HttpsError(
      "failed-precondition",
      "Verifica tu correo para responder invitaciones."
    );
  }
  const parsed = parseInvitationId(request?.data?.invitacionId);
  // Solo se puede tocar el documento cuyo id sale del propio correo verificado.
  if (!parsed || parsed.emailHash !== sha256(identity.email)) throw notFound(HttpsError);
  const invitationRef = db.collection("invitacionesEquipo").doc(request.data.invitacionId);
  const userRef = db.collection("usuarios").doc(uid);
  const reason = safeText(request?.data?.motivo, MAX_REJECTION_REASON_LENGTH);
  if (action === "aceptar") {
    await assertCanAcceptWithAccount(auth, uid, identity, HttpsError);
  }

  return db.runTransaction(async (transaction) => {
    const now = clock();
    const [invitationSnapshot, userSnapshot] = await Promise.all([
      transaction.get(invitationRef),
      transaction.get(userRef),
    ]);
    const userData = userSnapshot.data() || {};
    assertPlatformUserActive(userData, HttpsError);
    const invitation = invitationSnapshot.data() || {};
    if (!invitationSnapshot.exists ||
        invitation.emailNormalizado !== identity.email ||
        invitation.negocioId !== parsed.businessId) {
      throw notFound(HttpsError);
    }
    const businessId = invitation.negocioId;

    const answeredState = action === "aceptar" ? STATES.ACCEPTED : STATES.REJECTED;
    if ([STATES.ACCEPTED, STATES.REJECTED].includes(invitation.estado)) {
      if (invitation.estado === answeredState && invitation.respondidoPorUid === uid) {
        return {ok: true, estado: answeredState, businessId, idempotent: true};
      }
      throw new HttpsError("failed-precondition", "Esta invitación ya fue respondida.");
    }
    const state = effectiveState(invitation, now);
    if (state !== STATES.PENDING) {
      throw new HttpsError(
        "failed-precondition",
        state === STATES.EXPIRED
          ? "La invitación venció. Pide que te inviten de nuevo."
          : "Esta invitación ya no está disponible."
      );
    }
    const serverNow = FieldValue.serverTimestamp();

    if (action === "rechazar") {
      transaction.update(invitationRef, {
        estado: STATES.REJECTED,
        respondidoEn: serverNow,
        respondidoPorUid: uid,
        ultimoRechazoEn: serverNow,
        ...(reason ? {motivoRechazo: reason} : {}),
        actualizadoEn: serverNow,
      });
      return {ok: true, estado: STATES.REJECTED, businessId};
    }

    let alreadyHadAccess = false;
    try {
      await createMembershipForUser(
        transaction,
        {db, HttpsError, FieldValue},
        {
          businessId,
          targetUid: uid,
          actorUid: invitation.creadoPorUid,
          role: invitation.rol,
          profileId: safeText(invitation.profileId, 160),
        }
      );
    } catch (error) {
      // Si quien invitó ya no puede asignar este acceso, la invitación caduca
      // en la práctica; no es un problema de permisos de quien acepta.
      if (error?.code === "permission-denied" || error?.code === "invalid-argument") {
        throw new HttpsError("failed-precondition", "Esta invitación ya no es válida.");
      }
      if (error?.code !== "already-exists") throw error;
      // La persona ya tenía membresía: activa, la invitación se da por
      // aceptada sin tocar el acceso; inactiva, solo la empresa puede reactivarlo.
      if (error.details?.membershipEstado !== ACTIVE_STATUS) {
        throw new HttpsError(
          "failed-precondition",
          "Tu acceso a esa empresa está desactivado. Pide que lo reactiven."
        );
      }
      alreadyHadAccess = true;
    }
    transaction.update(invitationRef, {
      estado: STATES.ACCEPTED,
      respondidoEn: serverNow,
      respondidoPorUid: uid,
      actualizadoEn: serverNow,
    });
    transaction.set(
      userRef,
      {
        ...(userData.negocioActivoId ? {} : {negocioActivoId: businessId}),
        actualizadoEn: serverNow,
        ...(userSnapshot.exists ? {} : {email: identity.email, creadoEn: serverNow}),
      },
      {merge: true}
    );
    return {
      ok: true,
      estado: STATES.ACCEPTED,
      businessId,
      ...(alreadyHadAccess
        ? {idempotent: true, mensaje: "Ya tienes acceso a esa empresa."}
        : {}),
    };
  });
}

module.exports = {
  DAILY_INVITATION_LIMIT,
  INVITATION_TTL_DAYS,
  MAX_REJECTION_REASON_LENGTH,
  PENDING_INVITATION_LIMIT,
  REJECTION_COOLDOWN_DAYS,
  STATES,
  canTransition,
  computeExpiry,
  dayKey,
  effectiveState,
  invitarMiembroNegocioHandler,
  invitationId,
  isCooldownActive,
  isValidInviteEmail,
  listarInvitacionesNegocioHandler,
  listarMisInvitacionesHandler,
  normalizeInviteEmail,
  parseInvitationId,
  planInvitation,
  responderInvitacionHandler,
  revocarInvitacionNegocioHandler,
};
