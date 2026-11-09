import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification as firebaseSendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "firebase/auth";
import { assertClientWriteAllowed } from "../config/firebaseEnvironment.mjs";
import { auth } from "../firebase/firebaseConfig";
import { acceptLegalTerms } from "./legalService";

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Registro en curso (SPEC 024, 5.4). onAuthStateChanged dispara antes de que
// createUserWithEmailAndPassword resuelva, así que el deferred se crea de
// forma síncrona antes de crear la cuenta. Nunca rechaza.
let pendingRegistrationSetup = null;

export function waitForRegistrationSetup() {
  return pendingRegistrationSetup || Promise.resolve();
}

export async function registerWithEmail(
  email,
  password,
  { legalTermsAccepted = false } = {}
) {
  assertClientWriteAllowed("crear cuentas");
  if (legalTermsAccepted !== true) {
    throw new Error("auth/legal-terms-required");
  }

  let finishSetup;
  const setup = new Promise((resolve) => {
    finishSetup = resolve;
  });
  pendingRegistrationSetup = setup;

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    try {
      await acceptLegalTerms();
    } catch (error) {
      // No bloquea el registro: el guard de aceptación la pedirá al ingresar.
      console.error("No se pudo registrar la aceptación legal:", error);
    }
    // La sesión no necesita esperar al correo de verificación.
    finishSetup();

    try {
      await sendVerificationEmail(credential.user);
    } catch (error) {
      console.warn("No se pudo enviar el correo de verificacion:", error);
    }

    return credential;
  } finally {
    if (pendingRegistrationSetup === setup) pendingRegistrationSetup = null;
    finishSetup();
  }
}

// Si el navegador no deja abrir el popup se pasa a redirección.
const GOOGLE_REDIRECT_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
]);

// Ingreso con Google (SPEC 029). El primer ingreso de una persona nueva crea
// su cuenta de Auth, por eso lleva el mismo guard que el registro. No registra
// la aceptación legal: de eso se encarga el guard de aceptación de la app
// (SPEC 024, etapa 5) en cuanto carga la sesión.
export async function loginWithGoogle() {
  assertClientWriteAllowed("crear cuentas");

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (!GOOGLE_REDIRECT_FALLBACK_CODES.has(error?.code)) throw error;
  }

  // La página se recarga al volver de Google; completeGoogleRedirect recoge
  // los errores de ese regreso.
  await signInWithRedirect(auth, provider);
  return null;
}

// Se consulta una sola vez por carga de página: el resultado del regreso de
// Google se consume al leerlo y no debe reaparecer en ingresos posteriores.
let googleRedirectChecked = false;

export function completeGoogleRedirect() {
  if (googleRedirectChecked) return Promise.resolve(null);
  googleRedirectChecked = true;
  return getRedirectResult(auth);
}

export async function resetPassword(email) {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail) {
    throw new Error("auth/email-required");
  }

  return sendPasswordResetEmail(auth, normalizedEmail);
}

export async function sendVerificationEmail(user = auth.currentUser) {
  if (!user) {
    throw new Error("auth/no-current-user");
  }

  if (user.emailVerified) {
    return false;
  }

  await firebaseSendEmailVerification(user);
  return true;
}

export async function refreshCurrentUser() {
  const user = auth.currentUser;
  if (!user) return null;

  await user.reload();
  return auth.currentUser;
}

export function logout() {
  return signOut(auth);
}
