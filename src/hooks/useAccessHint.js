import { useSyncExternalStore } from "react";
import {
  ACCESS_HINT_STORAGE_KEY,
  normalizeAccessHint,
} from "../domain/accessHint.mjs";

// Pista de acceso de interfaz (SPEC 029). Vive solo en sessionStorage del
// navegador; si no está disponible (modo privado, datos bloqueados) se usa una
// variable en memoria. Nunca viaja al backend ni concede permisos.
const listeners = new Set();
let memoryHint = null;

export function readAccessHint() {
  try {
    return normalizeAccessHint(
      window.sessionStorage.getItem(ACCESS_HINT_STORAGE_KEY)
    );
  } catch {
    return memoryHint;
  }
}

export function setAccessHint(hint) {
  const value = normalizeAccessHint(hint);
  memoryHint = value;
  try {
    if (value) window.sessionStorage.setItem(ACCESS_HINT_STORAGE_KEY, value);
    else window.sessionStorage.removeItem(ACCESS_HINT_STORAGE_KEY);
  } catch {
    // Sin sessionStorage: queda solo en memoria.
  }
  listeners.forEach((listener) => listener());
}

export function clearAccessHint() {
  setAccessHint(null);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAccessHint() {
  return useSyncExternalStore(subscribe, readAccessHint, () => null);
}
