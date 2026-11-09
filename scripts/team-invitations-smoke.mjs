import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const {
  DAILY_INVITATION_LIMIT,
  INVITATION_TTL_DAYS,
  PENDING_INVITATION_LIMIT,
  REJECTION_COOLDOWN_DAYS,
  STATES,
  canTransition,
  computeExpiry,
  dayKey,
  effectiveState,
  invitationId,
  isCooldownActive,
  isValidInviteEmail,
  normalizeInviteEmail,
  parseInvitationId,
  planInvitation,
} = require("../functions/teamInvitations.js");

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-18T15:00:00.000Z");

// Correo: minúsculas y sin espacios, sin tocar puntos ni sufijos "+".
assert.equal(normalizeInviteEmail("  Persona.Uno+Tag@Empresa.CL "), "persona.uno+tag@empresa.cl");
assert.equal(normalizeInviteEmail(null), "");
assert.equal(isValidInviteEmail("persona@empresa.cl"), true);
assert.equal(isValidInviteEmail("persona@empresa"), false);
assert.equal(isValidInviteEmail("per sona@empresa.cl"), false);
assert.equal(isValidInviteEmail(""), false);
console.log("OK invitaciones: normalización de correo");

// Id determinista {negocioId}__{sha256 del correo normalizado}.
const id = invitationId("neg-1", "Persona@Empresa.CL");
assert.equal(id, invitationId("neg-1", " persona@empresa.cl "));
assert.match(id, /^neg-1__[a-f0-9]{64}$/);
assert.notEqual(id, invitationId("neg-2", "persona@empresa.cl"));
assert.notEqual(id, invitationId("neg-1", "otra@empresa.cl"));
assert.deepEqual(parseInvitationId(id), {
  businessId: "neg-1",
  emailHash: id.split("__")[1],
});
// Un negocioId con "__" también se separa bien porque el hash tiene largo fijo.
assert.equal(parseInvitationId(invitationId("a__b", "x@y.cl")).businessId, "a__b");
assert.equal(parseInvitationId("neg-1__abc"), null);
assert.equal(parseInvitationId(""), null);
assert.equal(parseInvitationId(`../x__${"a".repeat(64)}`), null);
console.log("OK invitaciones: id determinista y su lectura");

// Vencimiento a 7 días, evaluado al leer.
assert.equal(INVITATION_TTL_DAYS, 7);
assert.equal(computeExpiry(now).getTime() - now.getTime(), 7 * DAY_MS);
const pending = {estado: STATES.PENDING, expiraEn: computeExpiry(now)};
assert.equal(effectiveState(pending, now), STATES.PENDING);
assert.equal(effectiveState(pending, new Date(now.getTime() + 7 * DAY_MS - 1)), STATES.PENDING);
assert.equal(effectiveState(pending, new Date(now.getTime() + 7 * DAY_MS)), STATES.EXPIRED);
assert.equal(effectiveState({estado: STATES.REVOKED, expiraEn: new Date(0)}, now), STATES.REVOKED);
assert.equal(effectiveState({estado: STATES.PENDING}, now), STATES.EXPIRED);
console.log("OK invitaciones: vencimiento");

// Enfriamiento de 30 días tras un rechazo.
assert.equal(REJECTION_COOLDOWN_DAYS, 30);
const rejected = (daysAgo) => ({
  estado: STATES.REJECTED,
  ultimoRechazoEn: new Date(now.getTime() - daysAgo * DAY_MS),
});
assert.equal(isCooldownActive(rejected(1), now), true);
assert.equal(isCooldownActive(rejected(29), now), true);
assert.equal(isCooldownActive(rejected(30), now), false);
assert.equal(isCooldownActive(rejected(31), now), false);
assert.equal(isCooldownActive({estado: STATES.REVOKED}, now), false);
console.log("OK invitaciones: enfriamiento");

// Máquina de estados.
for (const to of [STATES.ACCEPTED, STATES.REJECTED, STATES.REVOKED, STATES.EXPIRED]) {
  assert.equal(canTransition(STATES.PENDING, to), true, `pendiente -> ${to}`);
}
for (const from of [STATES.EXPIRED, STATES.REVOKED, STATES.REJECTED, STATES.ACCEPTED]) {
  assert.equal(canTransition(from, STATES.PENDING), true, `${from} -> pendiente`);
  assert.equal(canTransition(from, STATES.ACCEPTED), false, `${from} -/-> aceptada`);
  assert.equal(canTransition(from, STATES.REVOKED), false, `${from} -/-> revocada`);
}
assert.equal(canTransition(STATES.PENDING, STATES.PENDING), false);
assert.equal(canTransition("inventado", STATES.PENDING), false);
console.log("OK invitaciones: máquina de estados");

// Qué hace invitar frente al documento existente.
assert.equal(planInvitation(null, now), "create");
assert.equal(planInvitation(pending, now), "keep");
assert.equal(planInvitation({...pending, expiraEn: new Date(now.getTime() - 1)}, now), "reopen");
assert.equal(planInvitation({estado: STATES.REVOKED}, now), "reopen");
assert.equal(planInvitation({estado: STATES.ACCEPTED}, now), "reopen");
assert.equal(planInvitation(rejected(2), now), "cooldown");
assert.equal(planInvitation(rejected(45), now), "reopen");
// Reinvitada y revocada dentro del enfriamiento sigue bloqueada.
assert.equal(
  planInvitation({estado: STATES.REVOKED, ultimoRechazoEn: rejected(3).ultimoRechazoEn}, now),
  "cooldown"
);
console.log("OK invitaciones: plan de invitar");

// Topes y día lógico del tope diario (zona horaria de Chile).
assert.equal(DAILY_INVITATION_LIMIT, 20);
assert.equal(PENDING_INVITATION_LIMIT, 50);
assert.equal(dayKey(new Date("2026-10-18T15:00:00.000Z")), "20261018");
assert.equal(dayKey(new Date("2026-01-10T02:30:00.000Z")), "20260109");
console.log("OK invitaciones: topes y día lógico");

// Contrato estático: no hay forma de saber si un correo tiene cuenta, ni de
// agregar a alguien sin que acepte.
const invitationsSource = fs.readFileSync("functions/teamInvitations.js", "utf8");
const membershipsSource = fs.readFileSync("functions/businessMemberships.js", "utf8");
const indexSource = fs.readFileSync("functions/index.js", "utf8");
const rulesSource = fs.readFileSync("firestore.rules", "utf8");
assert.doesNotMatch(invitationsSource, /getUserByEmail/);
assert.doesNotMatch(membershipsSource, /getUserByEmail/);
assert.match(invitationsSource, /request\?\.auth\?\.token/);
assert.doesNotMatch(invitationsSource, /request\??\.data\??\.(correo|email)[^\n]*email_verified/);
assert.doesNotMatch(indexSource, /asociarUsuarioExistente/);
assert.doesNotMatch(membershipsSource, /asociarUsuarioExistente/);
for (const name of [
  "invitarMiembroNegocio",
  "listarInvitacionesNegocio",
  "revocarInvitacionNegocio",
  "listarMisInvitaciones",
  "responderInvitacion",
]) {
  assert.match(indexSource, new RegExp(`exports\\.${name} = onCall`));
}
assert.match(membershipsSource, /transaction\.create\(targetRef/);
assert.match(invitationsSource, /createMembershipForUser\(/);
for (const collection of ["invitacionesEquipo", "invitacionRequests", "invitacionLimites"]) {
  assert.match(
    rulesSource,
    new RegExp(`match /${collection}/\\{\\w+\\} \\{\\s*allow read, write: if false;\\s*\\}`)
  );
}
console.log("OK invitaciones: contrato estático (sin búsqueda por correo ni alta directa)");

console.log("TEAM_INVITATIONS_SMOKE_OK");
