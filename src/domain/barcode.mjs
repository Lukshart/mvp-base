export const BARCODE_MAX_LENGTH = 120;
export const BARCODE_FORMATS = Object.freeze([
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
]);
export const BARCODE_DUPLICATE_WINDOW_MS = 1500;
export const BARCODE_CAMERA_REARM_MS = 800;
export const BARCODE_CONFIRMATION_WINDOW_MS = 1500;
export const BARCODE_LONG_CONFIRMATIONS = 2;
export const BARCODE_SHORT_CONFIRMATIONS = 3;
const SHORT_BARCODE_FORMATS = new Set(["ean_8", "upc_e"]);
const PREFERRED_LONG_BARCODE_FORMATS = new Set(["ean_13", "upc_a"]);

export function normalizeBarcode(value) {
  return String(value ?? "").trim().slice(0, BARCODE_MAX_LENGTH);
}

// UPC-A (12 dígitos) y el mismo código como EAN-13 con 0 inicial identifican el
// mismo producto. Solo se amplía la búsqueda; el barcode guardado no cambia.
export function getBarcodeLookupCandidates(value) {
  const barcode = normalizeBarcode(value);
  if (!barcode) return [];
  if (/^\d{12}$/.test(barcode)) return [barcode, `0${barcode}`];
  if (/^0\d{12}$/.test(barcode)) return [barcode, barcode.slice(1)];
  return [barcode];
}

export async function getBarcodeCameraSupport({
  BarcodeDetectorClass = globalThis.BarcodeDetector,
  mediaDevices = globalThis.navigator?.mediaDevices,
  secureContext = globalThis.isSecureContext,
} = {}) {
  // Fuera de HTTPS o localhost el navegador no expone la cámara.
  if (secureContext === false) {
    return {
      supported: false,
      reason: "insecure-context",
      decoder: "manual",
      formats: [],
    };
  }
  if (typeof mediaDevices?.getUserMedia !== "function") {
    return {
      supported: false,
      reason: "camera-api-unavailable",
      decoder: "manual",
      formats: [],
    };
  }
  if (
    typeof BarcodeDetectorClass === "function" &&
    typeof BarcodeDetectorClass.getSupportedFormats === "function"
  ) {
    try {
      const supportedFormats = await BarcodeDetectorClass.getSupportedFormats();
      const formats = BARCODE_FORMATS.filter((format) => supportedFormats.includes(format));
      if (formats.length === BARCODE_FORMATS.length) {
        return {supported: true, reason: "", decoder: "native", formats};
      }
    } catch {
      // La cámara sigue disponible mediante el decoder JS acotado a barras 1D.
    }
  }
  return {
    supported: true,
    reason: "",
    decoder: "zxing",
    formats: [...BARCODE_FORMATS],
  };
}

export function barcodeSupportMessage(reason) {
  if (reason === "insecure-context") {
    return "La cámara requiere una conexión segura (HTTPS). Abre la app desde su dirección https o usa el lector USB o el ingreso manual.";
  }
  return reason === "camera-api-unavailable"
    ? "Este navegador o dispositivo no permite abrir la cámara. Usa el lector USB o ingresa el código manualmente."
    : "No se pudo preparar el lector de códigos. Usa el lector USB o ingresa el código manualmente.";
}

export function barcodeCameraErrorMessage(error) {
  const name = String(error?.name || "");
  if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(name)) {
    return "No se autorizó la cámara. Habilita el permiso del sitio y vuelve a intentar, o ingresa el código manualmente.";
  }
  if (["NotFoundError", "DevicesNotFoundError"].includes(name)) {
    return "No se encontró una cámara en este dispositivo. Usa el lector USB o ingresa el código manualmente.";
  }
  if (["NotReadableError", "TrackStartError", "AbortError"].includes(name)) {
    return "La cámara no está disponible o está siendo usada por otra aplicación. Ciérrala allí y vuelve a intentar.";
  }
  return "No se pudo iniciar la cámara. Puedes usar el lector USB o ingresar el código manualmente.";
}

export function isDuplicateBarcodeRead(previous, value, now = Date.now()) {
  const barcode = normalizeBarcode(value);
  return Boolean(
    barcode &&
    previous?.barcode === barcode &&
    Number.isFinite(previous?.readAt) &&
    now - previous.readAt >= 0 &&
    now - previous.readAt < BARCODE_DUPLICATE_WINDOW_MS
  );
}

// Sin formato informado, un código numérico de hasta 8 dígitos se trata como corto.
export function isShortBarcodeRead({barcode, format}) {
  return format ? SHORT_BARCODE_FORMATS.has(format) : /^\d{1,8}$/.test(barcode);
}

function isPreferredLongBarcodeRead({barcode, format}) {
  return format ? PREFERRED_LONG_BARCODE_FORMATS.has(format) : /^\d{12,13}$/.test(barcode);
}

export function requiredBarcodeConfirmations(read) {
  return isShortBarcodeRead(read) ? BARCODE_SHORT_CONFIRMATIONS : BARCODE_LONG_CONFIRMATIONS;
}

// Solo cámara. Un decodificador puede leer parte de las barras de un EAN-13 y
// entregar un EAN-8 válido inventado. Un código se confirma cuando se lee igual
// 2 veces (largos) o 3 (EAN-8/UPC-E) dentro de BARCODE_CONFIRMATION_WINDOW_MS;
// los cuadros vacíos no cortan la cuenta, un código distinto sí. Un código corto
// se ignora si en esa ventana apareció un EAN-13/UPC-A. Ya confirmado, sigue
// confirmado mientras se lea sin pausas mayores que la ventana.
export function confirmCameraBarcodeRead(previous, detection, now = Date.now()) {
  const state = previous || {candidate: null, lastLongAt: null};
  const barcode = normalizeBarcode(typeof detection === "object" ? detection?.rawValue : detection);
  if (!barcode) return {confirmed: false, barcode: "", ignored: false, state};
  const read = {barcode, format: String(detection?.format || "").toLowerCase()};
  // Number(null) es 0: sin un código largo previo la distancia debe ser NaN.
  const sinceLong = state.lastLongAt == null ? Number.NaN : now - Number(state.lastLongAt);
  const longRecently = Number.isFinite(sinceLong) && sinceLong >= 0 && sinceLong <= BARCODE_CONFIRMATION_WINDOW_MS;
  if (isShortBarcodeRead(read) && longRecently) {
    return {confirmed: false, barcode, ignored: true, state};
  }
  const current = state.candidate;
  const sinceLast = now - Number(current?.lastAt);
  const continues = current?.barcode === barcode &&
    Number.isFinite(sinceLast) && sinceLast >= 0 && sinceLast <= BARCODE_CONFIRMATION_WINDOW_MS;
  let candidate;
  if (continues && current.confirmed) {
    candidate = {...current, lastAt: now};
  } else if (continues && now - current.firstAt <= BARCODE_CONFIRMATION_WINDOW_MS) {
    candidate = {...current, count: current.count + 1, lastAt: now};
  } else {
    candidate = {...read, count: 1, firstAt: now, lastAt: now, confirmed: false};
  }
  if (!candidate.confirmed && candidate.count >= requiredBarcodeConfirmations(read)) {
    candidate = {...candidate, confirmed: true};
  }
  return {
    confirmed: candidate.confirmed,
    barcode,
    ignored: false,
    state: {candidate, lastLongAt: isPreferredLongBarcodeRead(read) ? now : state.lastLongAt},
  };
}

// Con la cámara abierta, un código que sigue en cuadro se ve en cuadros
// consecutivos. Se acepta un código distinto de inmediato; el mismo código solo
// cuando dejó de verse durante BARCODE_CAMERA_REARM_MS (salió de cuadro).
export function acceptCameraBarcodeRead(previous, value, now = Date.now()) {
  const barcode = normalizeBarcode(value);
  if (!barcode) return {accepted: false, barcode: "", state: previous || null};
  const elapsed = now - Number(previous?.seenAt);
  const stillInFrame = previous?.barcode === barcode &&
    Number.isFinite(elapsed) &&
    elapsed >= 0 &&
    elapsed < BARCODE_CAMERA_REARM_MS;
  return {accepted: !stillInFrame, barcode, state: {barcode, seenAt: now}};
}

// Sesión del cuadro de escaneo: lista de lecturas y un único mensaje visible.
// Cada resultado reemplaza al mensaje anterior: solo se ve el último, éxito o error.
export const EMPTY_SCAN_SESSION = Object.freeze({entries: Object.freeze([]), message: null});

export function recordScanSuccess(session, {key, label}) {
  const entries = (session || EMPTY_SCAN_SESSION).entries;
  const count = (entries.find((entry) => entry.key === key)?.count || 0) + 1;
  return {
    entries: [{key, label, count}, ...entries.filter((entry) => entry.key !== key)],
    // La cuenta distingue dos lecturas iguales seguidas.
    message: {tone: "success", text: `Agregado: ${label} (×${count})`},
  };
}

// source distingue un resultado de lectura ("scan") de un aviso de cámara ("camera").
export function recordScanError(session, text, source = "scan") {
  return {entries: (session || EMPTY_SCAN_SESSION).entries, message: {tone: "error", text, source}};
}

export function clearScanError(session) {
  return session?.message?.tone === "error" ? {...session, message: null} : session;
}

// Al volver a funcionar la cámara, su aviso anterior ya no aplica; un resultado de lectura se conserva.
export function clearCameraNotice(session) {
  return session?.message?.source === "camera" ? {...session, message: null} : session;
}

export const BARCODE_CAMERA_LABELS = Object.freeze({
  starting: "Iniciando cámara…",
  ready: "Cámara lista: apunta al código",
  processing: "Buscando producto…",
  paused: "Cámara en pausa: se reactivará al volver a esta página",
  manual: "Ingreso manual disponible",
});

// Estado visible de la cámara del cuadro. Con la página oculta la cámara se
// apaga; al volver se reactiva sola. Si quedó no disponible, se puede
// reintentar sin cerrar el cuadro ni perder la lista de la sesión.
export function describeBarcodeCamera({supported, pageVisible, cameraStatus}) {
  if (!supported) return {shouldRun: false, canRetry: false, label: BARCODE_CAMERA_LABELS.manual};
  if (!pageVisible) return {shouldRun: false, canRetry: false, label: BARCODE_CAMERA_LABELS.paused};
  return {
    shouldRun: true,
    canRetry: cameraStatus === "unavailable",
    label: BARCODE_CAMERA_LABELS[cameraStatus] || BARCODE_CAMERA_LABELS.manual,
  };
}

export function incrementScannedItem(items, itemId, createItem) {
  const source = Array.isArray(items) ? items : [];
  const normalizedItemId = String(itemId || "").trim();
  const existingIndex = source.findIndex((item) =>
    String(item?.itemId || item?.productoId || "").trim() === normalizedItemId
  );
  if (existingIndex < 0) return [...source, createItem()];
  return source.map((item, index) => index === existingIndex
    ? {...item, cantidad: Number(item.cantidad || 0) + 1}
    : item
  );
}

export function stopBarcodeCamera(stream) {
  stream?.getTracks?.().forEach((track) => track.stop());
}
