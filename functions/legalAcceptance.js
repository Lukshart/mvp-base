"use strict";

const {
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENTS_VERSION,
  isCurrentLegalVersion,
} = require("./legalDocuments");

const LEGAL_ACCEPTANCE_HISTORY_COLLECTION = "aceptacionesLegales";

function requireAuthenticatedUid(request, HttpsError) {
  const uid = request?.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  return uid;
}

function assertPlatformUserActive(user = {}, HttpsError) {
  if (user.estadoPlataforma === "suspendido") {
    throw new HttpsError(
      "permission-denied",
      "La cuenta de usuario esta suspendida por la plataforma."
    );
  }
}

function timestampToIso(value) {
  const date = typeof value?.toDate === "function" ? value.toDate() : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

// Estado de aceptación para la respuesta de getBusinessSession. Solo lee
// `usuarios/{uid}`; la escritura es exclusiva de acceptLegalTerms.
function legalAcceptanceState(userData = {}) {
  const acceptance = userData?.aceptacionLegal || {};
  const acceptedVersion =
    typeof acceptance.version === "string" ? acceptance.version : null;
  return {
    currentVersion: LEGAL_DOCUMENTS_VERSION,
    acceptedVersion,
    acceptedAt: timestampToIso(acceptance.aceptadoEn),
    isCurrent: isCurrentLegalVersion(acceptedVersion),
  };
}

async function acceptLegalTermsHandler(
  request,
  {db, HttpsError, FieldValue}
) {
  const uid = requireAuthenticatedUid(request, HttpsError);
  const version = request?.data?.version;
  if (!isCurrentLegalVersion(version)) {
    throw new HttpsError(
      "invalid-argument",
      "La versión de los documentos legales no es la vigente."
    );
  }

  const userRef = db.collection("usuarios").doc(uid);
  const historyRef = userRef
    .collection(LEGAL_ACCEPTANCE_HISTORY_COLLECTION)
    .doc(version);

  return db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const userData = userSnapshot.data() || {};
    assertPlatformUserActive(userData, HttpsError);

    if (isCurrentLegalVersion(userData.aceptacionLegal?.version)) {
      return {accepted: true, alreadyAccepted: true, version};
    }

    const now = FieldValue.serverTimestamp();
    transaction.set(
      userRef,
      {
        aceptacionLegal: {version, aceptadoEn: now},
        actualizadoEn: now,
        ...(userSnapshot.exists ?
          {} :
          {email: request?.auth?.token?.email || null, creadoEn: now}),
      },
      {merge: true}
    );
    transaction.set(historyRef, {
      uid,
      version,
      documentos: Object.keys(LEGAL_DOCUMENTS),
      aceptadoEn: now,
    });
    return {accepted: true, alreadyAccepted: false, version};
  });
}

module.exports = {
  LEGAL_ACCEPTANCE_HISTORY_COLLECTION,
  acceptLegalTermsHandler,
  legalAcceptanceState,
};
