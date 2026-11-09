import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {deleteApp, initializeApp} from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  getIdToken,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  terminate,
  updateDoc,
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from "firebase/functions";

const PROJECT_ID = "tesis-inventario-ia";
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
process.env.GCLOUD_PROJECT ||= PROJECT_ID;
const requireFromFunctions = createRequire(
  new URL("../functions/package.json", import.meta.url)
);
const {
  deleteApp: deleteAdminApp,
  initializeApp: initializeAdminApp,
} = requireFromFunctions("firebase-admin/app");
const {getAuth: getAdminAuth} = requireFromFunctions("firebase-admin/auth");
const {
  FieldValue,
  Timestamp,
  getFirestore: getAdminFirestore,
} = requireFromFunctions("firebase-admin/firestore");

const DAY_MS = 24 * 60 * 60 * 1000;
const clients = [];

function createClient(name) {
  const app = initializeApp(
    {
      apiKey: "demo-key",
      authDomain: `${PROJECT_ID}.firebaseapp.com`,
      projectId: PROJECT_ID,
      appId: `invites-${name}-${RUN_ID}`,
    },
    `invites-${name}-${RUN_ID}`
  );
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, "us-central1");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {disableWarnings: true});
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  const client = {app, auth, db, functions};
  clients.push(client);
  return client;
}

const adminApp = initializeAdminApp({projectId: PROJECT_ID}, `invites-admin-${RUN_ID}`);
const adminDb = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);

// Crea la cuenta; con verified el token se renueva para que lleve email_verified.
async function newUser(label, {verified = true} = {}) {
  const client = createClient(label);
  const email = `inv-${label}-${RUN_ID}@example.test`;
  const credential = await createUserWithEmailAndPassword(
    client.auth, email, `Invites-${RUN_ID}-Pass!`
  );
  client.uid = credential.user.uid;
  client.email = email;
  if (verified) await verifyEmail(client);
  return client;
}

async function verifyEmail(client) {
  await adminAuth.updateUser(client.uid, {emailVerified: true});
  await getIdToken(client.auth.currentUser, true);
}

const call = (client, name) => httpsCallable(client.functions, name);
const requestId = (prefix) =>
  `${prefix}-${RUN_ID}-${Math.random().toString(36).slice(2, 10)}`;
const invitationHash = (email) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const invitationIdFor = (businessId, email) => `${businessId}__${invitationHash(email)}`;

const invite = (client, businessId, correo, extra = {}) =>
  call(client, "invitarMiembroNegocio")({
    businessId, correo, requestId: requestId("inv"), ...extra,
  });
const respond = (client, invitacionId, accion, extra = {}) =>
  call(client, "responderInvitacion")({invitacionId, accion, ...extra});

async function expectError(label, operation, expectedCodes, message) {
  try {
    await operation();
  } catch (error) {
    assert.ok(
      expectedCodes.some((code) => String(error?.code || "").includes(code)),
      `${label}: código inesperado ${error?.code} ${error?.message}`
    );
    if (message) assert.equal(error.message, message, `${label}: mensaje`);
    console.log(`OK rechazo: ${label}`);
    return;
  }
  throw new Error(`Se esperaba rechazo: ${label}`);
}

async function expectDenied(label, operation) {
  try {
    await operation();
  } catch (error) {
    assert.match(String(error?.code || ""), /permission-denied/);
    console.log(`OK reglas: ${label}`);
    return;
  }
  throw new Error(`Se esperaba denegación: ${label}`);
}

const santiagoDay = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date()).replace(/-/g, "");

try {
  const owner = await newUser("owner");
  const admin = await newUser("admin");
  const member = await newUser("member");
  const salesRep = await newUser("sales");
  const outsider = await newUser("outsider");
  const invitee = await newUser("invitee");
  const stranger = await newUser("stranger");

  const business = await call(owner, "createFirstBusiness")({
    nombreComercial: "Negocio invitaciones",
    rubroCodigo: "INGENIERIA_CONSULTORIA",
    regionCodigo: "13",
    requestId: requestId("business-main"),
  });
  const otherBusiness = await call(outsider, "createFirstBusiness")({
    nombreComercial: "Negocio externo",
    rubroCodigo: "INGENIERIA_CONSULTORIA",
    regionCodigo: "13",
    requestId: requestId("business-other"),
  });
  const businessId = business.data.business.id;
  const otherBusinessId = otherBusiness.data.business.id;
  const now = FieldValue.serverTimestamp();
  const seedMembership = (uid, rol) => adminDb.doc(`membresias/${businessId}__${uid}`).set({
    negocioId: businessId, uid, rol, estado: "activo", creadoEn: now, actualizadoEn: now,
  });
  await Promise.all([
    adminDb.doc(`negocios/${businessId}`).update({verificacionEmpresa: {estado: "VERIFICADA"}}),
    adminDb.doc(`negocios/${otherBusinessId}`).update({verificacionEmpresa: {estado: "VERIFICADA"}}),
    seedMembership(admin.uid, "ADMIN"),
    seedMembership(member.uid, "MEMBER"),
    seedMembership(salesRep.uid, "VENTAS"),
    adminDb.doc(`usuarios/${owner.uid}/cuenta/perfil`).set({
      uid: owner.uid, nombres: "Olivia", apellidos: "Owner",
    }),
  ]);
  const storedInvitation = async (email, id = businessId) =>
    (await adminDb.doc(`invitacionesEquipo/${invitationIdFor(id, email)}`).get()).data();

  // 1. Misma respuesta exista o no la cuenta.
  const nobodyEmail = `inv-nobody-${RUN_ID}@example.test`;
  const [toNobody, toInvitee] = await Promise.all([
    invite(owner, businessId, nobodyEmail, {rol: "TECNICO"}),
    invite(owner, businessId, invitee.email, {rol: "TECNICO"}),
  ]);
  for (const response of [toNobody.data, toInvitee.data]) {
    assert.deepEqual(Object.keys(response).sort(), ["estado", "expiraEn", "ok"]);
    assert.equal(response.ok, true);
    assert.equal(response.estado, "pendiente");
    const days = (Date.parse(response.expiraEn) - Date.now()) / DAY_MS;
    assert.ok(days > 6.99 && days <= 7, `vence en 7 días (${days})`);
  }
  assert.equal(toNobody.data.estado, toInvitee.data.estado);
  const stored = await storedInvitation(invitee.email);
  assert.equal(stored.negocioNombre, "Negocio invitaciones");
  assert.equal(stored.emailNormalizado, invitee.email);
  assert.equal(stored.creadoPorUid, owner.uid);
  assert.equal(stored.creadoPorNombre, "Olivia Owner");
  assert.equal(stored.invitacionesTotales, 1);
  assert.equal((await storedInvitation(nobodyEmail)).estado, "pendiente");
  await invite(owner, businessId, ` ${invitee.email.toUpperCase()} `, {rol: "TECNICO"});
  assert.equal((await storedInvitation(invitee.email)).invitacionesTotales, 1);
  console.log("OK invitar: misma respuesta con y sin cuenta, id determinista por correo normalizado");

  // 2. Idempotencia por requestId.
  const sameRequest = requestId("idem");
  const first = await call(owner, "invitarMiembroNegocio")({
    businessId, correo: `inv-idem-${RUN_ID}@example.test`, rol: "COMPRAS", requestId: sameRequest,
  });
  const replay = await call(owner, "invitarMiembroNegocio")({
    businessId, correo: `inv-idem-${RUN_ID}@example.test`, rol: "COMPRAS", requestId: sameRequest,
  });
  assert.deepEqual(replay.data, first.data);
  await expectError(
    "requestId reutilizado con otros datos",
    () => call(owner, "invitarMiembroNegocio")({
      businessId, correo: `inv-idem2-${RUN_ID}@example.test`, rol: "COMPRAS", requestId: sameRequest,
    }),
    ["failed-precondition"]
  );
  await expectError(
    "requestId inválido",
    () => call(owner, "invitarMiembroNegocio")({
      businessId, correo: invitee.email, rol: "TECNICO", requestId: "x",
    }),
    ["invalid-argument"]
  );
  await expectError(
    "correo inválido",
    () => invite(owner, businessId, "no-es-correo"),
    ["invalid-argument"]
  );
  console.log("OK invitar: idempotencia por requestId");

  // 3. Quién puede invitar y qué roles.
  await expectError("MEMBER no invita", () => invite(member, businessId, stranger.email), ["permission-denied"]);
  await expectError("VENTAS no invita", () => invite(salesRep, businessId, stranger.email), ["permission-denied"]);
  await expectError("MEMBER no lista invitaciones", () =>
    call(member, "listarInvitacionesNegocio")({businessId}), ["permission-denied"]);
  await expectError(
    "ADMIN no invita a otro ADMIN",
    () => invite(admin, businessId, stranger.email, {rol: "ADMIN"}),
    ["permission-denied"]
  );
  await expectError("no se invita como OWNER", () =>
    invite(owner, businessId, stranger.email, {rol: "OWNER"}), ["invalid-argument"]);
  await expectError("owner ajeno no invita a mi empresa", () =>
    invite(outsider, businessId, stranger.email), ["permission-denied"]);
  await expectError("no se invita a sí mismo", () => invite(owner, businessId, owner.email), ["failed-precondition"]);
  await expectError(
    "ya es miembro activo",
    () => invite(owner, businessId, member.email),
    ["already-exists"]
  );
  await invite(admin, businessId, `inv-by-admin-${RUN_ID}@example.test`, {rol: "TECNICO"});
  console.log("OK permisos: solo OWNER/ADMIN invitan; ADMIN no crea ADMIN; miembro activo avisa");

  // 4. Cada persona solo ve sus invitaciones.
  const inviteeList = await call(invitee, "listarMisInvitaciones")({});
  assert.equal(inviteeList.data.requiereVerificacion, false);
  assert.equal(inviteeList.data.invitaciones.length, 1);
  assert.deepEqual(
    Object.keys(inviteeList.data.invitaciones[0]).sort(),
    ["expiraEn", "id", "invitadoPor", "negocioId", "negocioNombre", "perfilNombre", "rol"]
  );
  assert.equal(inviteeList.data.invitaciones[0].negocioNombre, "Negocio invitaciones");
  assert.equal(inviteeList.data.invitaciones[0].invitadoPor, "Olivia Owner");
  assert.equal(inviteeList.data.invitaciones[0].rol, "TECNICO");
  const strangerList = await call(stranger, "listarMisInvitaciones")({});
  assert.deepEqual(strangerList.data.invitaciones, []);
  await expectError(
    "otra persona no responde mi invitación",
    () => respond(stranger, invitationIdFor(businessId, invitee.email), "aceptar"),
    ["not-found"]
  );
  await expectError("invitación inexistente", () =>
    respond(invitee, invitationIdFor(businessId, "nadie@example.test"), "aceptar"), ["not-found"]);
  await expectError("id con formato inválido", () => respond(invitee, "../x", "aceptar"), ["not-found"]);
  await expectError("acción inválida", () =>
    respond(invitee, invitationIdFor(businessId, invitee.email), "borrar"), ["invalid-argument"]);
  assert.equal(
    (await adminDb.doc(`membresias/${businessId}__${stranger.uid}`).get()).exists, false
  );
  console.log("OK privacidad: cada persona solo ve y responde sus invitaciones");

  // 5. Correo sin verificar: no ve invitaciones ni acepta; verificado, sí.
  const unverified = await newUser("unverified", {verified: false});
  await invite(owner, businessId, unverified.email, {rol: "FINANZAS"});
  const unverifiedList = await call(unverified, "listarMisInvitaciones")({});
  assert.deepEqual(unverifiedList.data, {invitaciones: [], requiereVerificacion: true});
  await expectError(
    "correo sin verificar no acepta",
    () => respond(unverified, invitationIdFor(businessId, unverified.email), "aceptar"),
    ["failed-precondition"],
    "Verifica tu correo para responder invitaciones."
  );
  assert.equal((await adminDb.doc(`membresias/${businessId}__${unverified.uid}`).get()).exists, false);
  await verifyEmail(unverified);
  assert.equal((await call(unverified, "listarMisInvitaciones")({})).data.invitaciones.length, 1);
  console.log("OK verificación: sin correo verificado no se ve ni se acepta");

  // 6. Aceptar crea la membresía con el formato de siempre y fija la empresa activa.
  const inviteeId = invitationIdFor(businessId, invitee.email);
  const accepted = await respond(invitee, inviteeId, "aceptar");
  assert.deepEqual(accepted.data, {ok: true, estado: "aceptada", businessId});
  const membership = (await adminDb.doc(`membresias/${businessId}__${invitee.uid}`).get()).data();
  assert.deepEqual(
    Object.keys(membership).sort(),
    ["actualizadoEn", "actualizadoPorUid", "creadoEn", "creadoPorUid", "estado", "negocioId", "rol", "uid"]
  );
  assert.equal(membership.negocioId, businessId);
  assert.equal(membership.uid, invitee.uid);
  assert.equal(membership.rol, "TECNICO");
  assert.equal(membership.estado, "activo");
  assert.equal(membership.creadoPorUid, owner.uid);
  assert.equal(membership.actualizadoPorUid, owner.uid);
  assert.equal((await adminDb.doc(`usuarios/${invitee.uid}`).get()).data().negocioActivoId, businessId);
  const acceptedInvitation = await storedInvitation(invitee.email);
  assert.equal(acceptedInvitation.estado, "aceptada");
  assert.equal(acceptedInvitation.respondidoPorUid, invitee.uid);
  const session = await call(invitee, "getBusinessSession")({});
  assert.equal(session.data.activeBusiness.id, businessId);
  assert.deepEqual((await call(invitee, "listarMisInvitaciones")({})).data.invitaciones, []);
  console.log("OK aceptar: membresía con el formato anterior y empresa activa");

  // 7. Doble aceptación es idempotente.
  const again = await respond(invitee, inviteeId, "aceptar");
  assert.equal(again.data.idempotent, true);
  assert.equal(again.data.estado, "aceptada");
  await expectError("aceptada no se rechaza después", () =>
    respond(invitee, inviteeId, "rechazar"), ["failed-precondition"]);
  await expectError("ya es miembro: no se reinvita", () =>
    invite(owner, businessId, invitee.email), ["already-exists"]);
  console.log("OK aceptar: doble aceptación idempotente");

  // 8. Rechazo con motivo, enfriamiento y reinvitación.
  const rejecter = await newUser("rejecter");
  await invite(owner, businessId, rejecter.email, {rol: "VENTAS"});
  const rejectedResult = await respond(
    rejecter, invitationIdFor(businessId, rejecter.email), "rechazar", {motivo: "  No trabajo ahí  "}
  );
  assert.equal(rejectedResult.data.estado, "rechazada");
  assert.equal((await adminDb.doc(`membresias/${businessId}__${rejecter.uid}`).get()).exists, false);
  const rejectedDoc = await storedInvitation(rejecter.email);
  assert.equal(rejectedDoc.motivoRechazo, "No trabajo ahí");
  assert.ok(rejectedDoc.ultimoRechazoEn);
  const ownerList = await call(owner, "listarInvitacionesNegocio")({businessId});
  const rejectedItem = ownerList.data.invitaciones.find((item) => item.correo === rejecter.email);
  assert.equal(rejectedItem.estado, "rechazada");
  assert.equal(rejectedItem.motivoRechazo, "No trabajo ahí");
  assert.ok(ownerList.data.invitaciones.some((item) => item.correo === nobodyEmail && item.estado === "pendiente"));
  assert.ok(!ownerList.data.invitaciones.some((item) => item.correo === invitee.email));
  assert.equal(
    (await respond(rejecter, invitationIdFor(businessId, rejecter.email), "rechazar")).data.idempotent,
    true
  );
  await expectError(
    "reinvitar durante el enfriamiento",
    () => invite(owner, businessId, rejecter.email, {rol: "VENTAS"}),
    ["failed-precondition"],
    "No es posible invitar a esa persona por ahora."
  );
  await adminDb.doc(`invitacionesEquipo/${invitationIdFor(businessId, rejecter.email)}`).update({
    ultimoRechazoEn: Timestamp.fromMillis(Date.now() - 31 * DAY_MS),
  });
  await invite(owner, businessId, rejecter.email, {rol: "VENTAS"});
  const reopened = await storedInvitation(rejecter.email);
  assert.equal(reopened.estado, "pendiente");
  assert.equal(reopened.invitacionesTotales, 2);
  assert.equal(reopened.motivoRechazo, undefined);
  assert.equal(reopened.respondidoEn, undefined);
  assert.equal(reopened.respondidoPorUid, undefined);
  console.log("OK rechazo: motivo, enfriamiento de 30 días y reapertura del mismo documento");

  // 9. Vencida.
  const expirer = await newUser("expirer");
  await invite(owner, businessId, expirer.email, {rol: "COMPRAS"});
  const expirerId = invitationIdFor(businessId, expirer.email);
  await adminDb.doc(`invitacionesEquipo/${expirerId}`).update({
    expiraEn: Timestamp.fromMillis(Date.now() - 1000),
  });
  assert.deepEqual((await call(expirer, "listarMisInvitaciones")({})).data.invitaciones, []);
  await expectError(
    "invitación vencida no se acepta",
    () => respond(expirer, expirerId, "aceptar"),
    ["failed-precondition"],
    "La invitación venció. Pide que te inviten de nuevo."
  );
  const expiredItem = (await call(owner, "listarInvitacionesNegocio")({businessId}))
    .data.invitaciones.find((item) => item.correo === expirer.email);
  assert.equal(expiredItem.estado, "vencida");
  await invite(owner, businessId, expirer.email, {rol: "COMPRAS"});
  assert.equal((await storedInvitation(expirer.email)).estado, "pendiente");
  assert.equal((await respond(expirer, expirerId, "aceptar")).data.estado, "aceptada");
  console.log("OK vencimiento: no se acepta, se lista como vencida y se puede reinvitar");

  // 10. Revocar.
  const revoked = await newUser("revoked");
  await invite(owner, businessId, revoked.email, {rol: "TECNICO"});
  const revokedId = invitationIdFor(businessId, revoked.email);
  await expectError("MEMBER no revoca", () =>
    call(member, "revocarInvitacionNegocio")({businessId, invitacionId: revokedId}), ["permission-denied"]);
  await expectError("owner ajeno no revoca", () =>
    call(outsider, "revocarInvitacionNegocio")({businessId: otherBusinessId, invitacionId: revokedId}), ["not-found"]);
  assert.equal(
    (await call(admin, "revocarInvitacionNegocio")({businessId, invitacionId: revokedId})).data.estado,
    "revocada"
  );
  assert.equal(
    (await call(admin, "revocarInvitacionNegocio")({businessId, invitacionId: revokedId})).data.estado,
    "revocada"
  );
  assert.equal((await storedInvitation(revoked.email)).estado, "revocada");
  assert.deepEqual((await call(revoked, "listarMisInvitaciones")({})).data.invitaciones, []);
  await expectError("revocada no se acepta", () => respond(revoked, revokedId, "aceptar"), ["failed-precondition"]);
  assert.ok(!(await call(owner, "listarInvitacionesNegocio")({businessId}))
    .data.invitaciones.some((item) => item.correo === revoked.email));
  await expectError("revocar con id de otra empresa", () =>
    call(owner, "revocarInvitacionNegocio")({
      businessId, invitacionId: invitationIdFor(otherBusinessId, revoked.email),
    }), ["not-found"]);
  await invite(owner, businessId, revoked.email, {rol: "TECNICO"});
  assert.equal((await storedInvitation(revoked.email)).estado, "pendiente");
  console.log("OK revocar: pendiente pasa a revocada, es idempotente y se puede reinvitar");

  // 11. Perfil personalizado y validaciones del perfil.
  const profile = await call(owner, "crearPerfilEmpleado")({
    businessId, nombre: "Solo clientes", modulos: ["clientes"],
  });
  const profileId = profile.data.perfil.id;
  const profiled = await newUser("profiled");
  await expectError("perfil exige rol MEMBER", () =>
    invite(owner, businessId, profiled.email, {rol: "TECNICO", profileId}), ["invalid-argument"]);
  await expectError("perfil de otra empresa", () =>
    invite(outsider, otherBusinessId, profiled.email, {rol: "MEMBER", profileId}), ["invalid-argument"]);
  await invite(owner, businessId, profiled.email, {rol: "MEMBER", profileId});
  const profiledList = await call(profiled, "listarMisInvitaciones")({});
  assert.equal(profiledList.data.invitaciones[0].perfilNombre, "Solo clientes");
  await respond(profiled, invitationIdFor(businessId, profiled.email), "aceptar");
  const profiledMembership = (await adminDb.doc(`membresias/${businessId}__${profiled.uid}`).get()).data();
  assert.equal(profiledMembership.rol, "MEMBER");
  assert.equal(profiledMembership.profileId, profileId);
  console.log("OK perfil: la membresía conserva rol MEMBER y profileId");

  // 12. Si quien invitó pierde permisos antes de aceptar, la invitación ya no vale.
  const lateAdmin = await newUser("late-admin");
  await seedMembership(lateAdmin.uid, "ADMIN");
  const lateInvitee = await newUser("late-invitee");
  await invite(lateAdmin, businessId, lateInvitee.email, {rol: "TECNICO"});
  await call(owner, "actualizarMembresiaNegocio")({
    businessId, miembroUid: lateAdmin.uid, rol: "ADMIN", estado: "inactivo",
  });
  await expectError(
    "quien invitó fue desactivado",
    () => respond(lateInvitee, invitationIdFor(businessId, lateInvitee.email), "aceptar"),
    ["failed-precondition"],
    "Esta invitación ya no es válida."
  );
  assert.equal((await adminDb.doc(`membresias/${businessId}__${lateInvitee.uid}`).get()).exists, false);
  console.log("OK aceptar: invitación de alguien sin permisos vigentes no crea acceso");

  // 12b. Quien invitó fue degradado (sigue activo, pero ya no es OWNER/ADMIN).
  const demotedAdmin = await newUser("demoted-admin");
  await seedMembership(demotedAdmin.uid, "ADMIN");
  const demotedInvitee = await newUser("demoted-invitee");
  await invite(demotedAdmin, businessId, demotedInvitee.email, {rol: "TECNICO"});
  await call(owner, "actualizarMembresiaNegocio")({
    businessId, miembroUid: demotedAdmin.uid, rol: "TECNICO", estado: "activo",
  });
  assert.equal(
    (await adminDb.doc(`membresias/${businessId}__${demotedAdmin.uid}`).get()).data().estado,
    "activo"
  );
  await expectError(
    "quien invitó fue degradado a TECNICO",
    () => respond(demotedInvitee, invitationIdFor(businessId, demotedInvitee.email), "aceptar"),
    ["failed-precondition"],
    "Esta invitación ya no es válida."
  );
  assert.equal((await adminDb.doc(`membresias/${businessId}__${demotedInvitee.uid}`).get()).exists, false);
  assert.equal((await storedInvitation(demotedInvitee.email)).estado, "pendiente");
  console.log("OK aceptar: invitación de alguien degradado no crea acceso");

  // 12c. Invitar a una persona con membresía inactiva en la empresa.
  const inactiveUser = await newUser("inactive-member");
  await adminDb.doc(`membresias/${businessId}__${inactiveUser.uid}`).set({
    negocioId: businessId, uid: inactiveUser.uid, rol: "TECNICO", estado: "inactivo",
    creadoEn: now, actualizadoEn: now,
  });
  await expectError(
    "invitar a quien tiene el acceso desactivado",
    () => invite(owner, businessId, inactiveUser.email, {rol: "TECNICO"}),
    ["failed-precondition"],
    "Esa persona ya está asociada a la empresa con el acceso desactivado. Reactívala desde el directorio."
  );
  assert.equal(await storedInvitation(inactiveUser.email), undefined);
  console.log("OK invitar: persona con acceso desactivado se rechaza sin crear invitación");

  // 12d. Aceptar cuando la persona ya tiene acceso activo: se resuelve sin tocar el acceso.
  const alreadyUser = await newUser("already-member");
  await invite(owner, businessId, alreadyUser.email, {rol: "TECNICO"});
  await seedMembership(alreadyUser.uid, "VENTAS");
  const alreadyId = invitationIdFor(businessId, alreadyUser.email);
  const alreadyResult = await respond(alreadyUser, alreadyId, "aceptar");
  assert.deepEqual(alreadyResult.data, {
    ok: true, estado: "aceptada", businessId, idempotent: true, mensaje: "Ya tienes acceso a esa empresa.",
  });
  const alreadyMembership = (await adminDb.doc(`membresias/${businessId}__${alreadyUser.uid}`).get()).data();
  assert.equal(alreadyMembership.rol, "VENTAS");
  assert.equal(alreadyMembership.creadoPorUid, undefined);
  assert.equal((await storedInvitation(alreadyUser.email)).estado, "aceptada");
  assert.equal((await adminDb.doc(`usuarios/${alreadyUser.uid}`).get()).data().negocioActivoId, businessId);
  assert.equal((await respond(alreadyUser, alreadyId, "aceptar")).data.idempotent, true);
  console.log("OK aceptar: acceso ya activo marca la invitación aceptada sin cambiar la membresía");

  // 12e. Aceptar cuando la persona tiene el acceso desactivado: no se reactiva por invitación.
  const deactivatedUser = await newUser("deactivated-member");
  await invite(owner, businessId, deactivatedUser.email, {rol: "TECNICO"});
  await adminDb.doc(`membresias/${businessId}__${deactivatedUser.uid}`).set({
    negocioId: businessId, uid: deactivatedUser.uid, rol: "TECNICO", estado: "inactivo",
    creadoEn: now, actualizadoEn: now,
  });
  await expectError(
    "aceptar con el acceso desactivado",
    () => respond(deactivatedUser, invitationIdFor(businessId, deactivatedUser.email), "aceptar"),
    ["failed-precondition"],
    "Tu acceso a esa empresa está desactivado. Pide que lo reactiven."
  );
  assert.equal(
    (await adminDb.doc(`membresias/${businessId}__${deactivatedUser.uid}`).get()).data().estado,
    "inactivo"
  );
  assert.equal((await storedInvitation(deactivatedUser.email)).estado, "pendiente");
  console.log("OK aceptar: acceso desactivado no se reactiva y la invitación sigue pendiente");

  // 13. Topes (en la otra empresa para no mezclar contadores).
  const limitRef = adminDb.doc(`invitacionLimites/${otherBusinessId}__${santiagoDay()}`);
  await limitRef.set({negocioId: otherBusinessId, fecha: santiagoDay(), conteo: 20});
  await expectError("tope diario de 20", () =>
    invite(outsider, otherBusinessId, `inv-cap-${RUN_ID}@example.test`), ["resource-exhausted"]);
  await limitRef.set({negocioId: otherBusinessId, fecha: santiagoDay(), conteo: 19});
  await invite(outsider, otherBusinessId, `inv-cap-19-${RUN_ID}@example.test`);
  assert.equal((await limitRef.get()).data().conteo, 20);
  await expectError("el contador sube con cada invitación nueva", () =>
    invite(outsider, otherBusinessId, `inv-cap-20-${RUN_ID}@example.test`), ["resource-exhausted"]);
  await limitRef.delete();
  const batch = adminDb.batch();
  for (let index = 0; index < 49; index += 1) {
    batch.set(
      adminDb.doc(`invitacionesEquipo/${otherBusinessId}__${invitationHash(`seed-${index}-${RUN_ID}@x.test`)}`),
      {
        negocioId: otherBusinessId,
        emailNormalizado: `seed-${index}-${RUN_ID}@x.test`,
        estado: "pendiente",
        expiraEn: Timestamp.fromMillis(Date.now() + DAY_MS),
      }
    );
  }
  await batch.commit();
  // Ya hay 1 (la de tope 19) + 49 sembradas = 50 pendientes.
  await expectError("tope de 50 pendientes", () =>
    invite(outsider, otherBusinessId, `inv-pending-${RUN_ID}@example.test`), ["resource-exhausted"]);
  console.log("OK topes: 20 por día y 50 pendientes por empresa");

  // 14. Cuenta suspendida no responde.
  const suspended = await newUser("suspended");
  await invite(owner, businessId, suspended.email, {rol: "TECNICO"});
  await adminDb.doc(`usuarios/${suspended.uid}`).set({estadoPlataforma: "suspendido"}, {merge: true});
  await expectError("cuenta suspendida no acepta", () =>
    respond(suspended, invitationIdFor(businessId, suspended.email), "aceptar"), ["permission-denied"]);
  assert.equal((await adminDb.doc(`membresias/${businessId}__${suspended.uid}`).get()).exists, false);
  console.log("OK suspensión: cuenta suspendida no puede responder");

  // 15. La Function directa ya no existe y las colecciones no se tocan desde el navegador.
  await expectError("asociarUsuarioExistente ya no existe", () =>
    call(owner, "asociarUsuarioExistente")({businessId, correo: stranger.email}), ["not-found"]);
  assert.equal((await adminDb.doc(`membresias/${businessId}__${stranger.uid}`).get()).exists, false);
  const anyInvitation = `invitacionesEquipo/${inviteeId}`;
  await expectDenied("lee invitacionesEquipo", () => getDoc(doc(invitee.db, anyInvitation)));
  await expectDenied("lista invitacionesEquipo", () => getDocs(collection(owner.db, "invitacionesEquipo")));
  await expectDenied("escribe invitacionesEquipo", () =>
    setDoc(doc(owner.db, `invitacionesEquipo/${invitationIdFor(businessId, stranger.email)}`), {estado: "aceptada"}));
  await expectDenied("edita invitacionesEquipo", () => updateDoc(doc(invitee.db, anyInvitation), {estado: "pendiente"}));
  await expectDenied("borra invitacionesEquipo", () => deleteDoc(doc(owner.db, anyInvitation)));
  await expectDenied("lee invitacionRequests", () => getDoc(doc(owner.db, `invitacionRequests/${businessId}__${sameRequest}`)));
  await expectDenied("escribe invitacionLimites", () =>
    setDoc(doc(owner.db, `invitacionLimites/${businessId}__${santiagoDay()}`), {conteo: 0}));
  console.log("OK seguridad: Function directa eliminada y colecciones cerradas al navegador");

  console.log("TEAM_INVITATIONS_INTEGRATED_OK");
} finally {
  await Promise.all(clients.map(async (client) => {
    await terminate(client.db).catch(() => {});
    await deleteApp(client.app).catch(() => {});
  }));
  await deleteAdminApp(adminApp).catch(() => {});
}
