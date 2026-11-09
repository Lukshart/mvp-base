import assert from "node:assert/strict";
import {adaptBusinessMember} from "../src/domain/businessMemberModel.mjs";
import {getWorkHistoricalPersonIdentity, getWorkMemberIdentity, getWorkMemberOptionLabel} from "../src/domain/workModel.mjs";

// Identidad de un miembro sin nombre en /trabajos. Camino real de los datos:
// listarMiembrosNegocio (backend) devuelve "Sin nombre registrado", la
// interfaz lo pasa por adaptBusinessMember (que lo cambia a "Nombre no
// informado") y recién entonces llega a getWorkMemberIdentity. Este smoke
// recorre ese camino completo; probar solo el texto original del backend
// ocultó el error (la identidad nunca caía al correo).

const fromBackend = (overrides = {}) => adaptBusinessMember({
  uid: "owner-a",
  nombre: "Sin nombre registrado",
  correo: "owner@example.cl",
  rol: "OWNER",
  estado: "activo",
  ...overrides,
});

// 1. Sin nombre y con correo: se muestra el correo, nunca el relleno.
const nameless = fromBackend();
assert.equal(nameless.nombre, "Nombre no informado", "el adaptador conserva su texto (lo fija business-members-model-smoke)");
assert.equal(getWorkMemberIdentity(nameless), "owner@example.cl");
assert.equal(getWorkMemberOptionLabel(nameless, "owner-a"), "Yo (owner@example.cl)");
assert.equal(getWorkMemberOptionLabel(nameless, "otra-persona"), "owner@example.cl");

// 2. Nombre vacío en origen: mismo resultado.
assert.equal(getWorkMemberIdentity(fromBackend({nombre: ""})), "owner@example.cl");

// 3. Sin nombre ni correo: texto neutro, nunca "Nombre no informado".
const anonymous = fromBackend({correo: ""});
assert.equal(anonymous.correo, "Sin correo disponible");
assert.equal(getWorkMemberIdentity(anonymous), "Usuario sin identificar");

// 4. Con nombre real: el nombre manda sobre el correo.
assert.equal(getWorkMemberIdentity(fromBackend({nombre: "Luis Terreno"})), "Luis Terreno");
assert.equal(getWorkMemberOptionLabel(fromBackend({nombre: "Luis Terreno"}), "owner-a"), "Yo (Luis Terreno)");

// 5. Los textos de relleno originales y el de la interfaz se tratan igual, sin importar mayúsculas.
for (const placeholder of ["Sin nombre registrado", "Nombre no informado", "NOMBRE NO INFORMADO", "Usuario sin identificar"]) {
  assert.equal(getWorkMemberIdentity({nombre: placeholder, correo: "a@example.cl"}), "a@example.cl", placeholder);
}

// 6. Historial: un snapshot con el relleno de la interfaz se resuelve por correo o por el miembro actual.
const members = [nameless, fromBackend({uid: "worker-b", nombre: "Ana Pérez", correo: "ana@example.cl", rol: "TECNICO"})];
assert.equal(getWorkHistoricalPersonIdentity({nombre: "Nombre no informado", correo: "owner@example.cl"}, "owner-a", members), "owner@example.cl");
assert.equal(getWorkHistoricalPersonIdentity({nombre: "Nombre no informado", correo: ""}, "worker-b", members), "Ana Pérez");
assert.equal(getWorkHistoricalPersonIdentity({nombre: "Nombre no informado", correo: ""}, "desconocido", members, "Integrante sin identificar"), "Integrante sin identificar");

// 7. Ningún selector de /trabajos muestra member.nombre directo.
import {readFileSync} from "node:fs";
const page = readFileSync(new URL("../src/pages/WorksPage.jsx", import.meta.url), "utf8");
// Desde la etapa B del tablero, los selectores de tarea viven en WorkProjectBoard.
const board = readFileSync(new URL("../src/features/works/WorkProjectBoard.jsx", import.meta.url), "utf8");
// Con el tablero compacto (etapa B2) los selectores viven en el panel de la tarea y en el formulario de "Nueva tarea".
const taskPanel = readFileSync(new URL("../src/features/works/WorkTaskPanel.jsx", import.meta.url), "utf8");
const taskCreate = readFileSync(new URL("../src/features/works/WorkTaskCreateDialog.jsx", import.meta.url), "utf8");
assert.doesNotMatch(page, /member\.nombre/, "los selectores de miembros usan getWorkMemberIdentity");
for (const source of [board, taskPanel, taskCreate]) assert.doesNotMatch(source, /member\.nombre/, "los selectores del tablero usan getWorkMemberIdentity");
assert.ok(((page + board + taskPanel + taskCreate).match(/getWorkMemberIdentity\(member\)/g) || []).length >= 7);

console.log("WORK_MEMBER_IDENTITY_SMOKE_OK");
