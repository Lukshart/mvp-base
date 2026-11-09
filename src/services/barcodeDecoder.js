import {acceptCameraBarcodeRead, confirmCameraBarcodeRead} from "../domain/barcode.mjs";

const ZXING_FORMAT_KEYS = Object.freeze({
  ean_13: "EAN_13",
  ean_8: "EAN_8",
  upc_a: "UPC_A",
  upc_e: "UPC_E",
  code_128: "CODE_128",
});

export const NATIVE_DECODER_FALLBACK_MS = 2000;
export const BARCODE_DECODE_ERROR_LIMIT = 5;
const EMPTY_BARCODE_READ = Object.freeze({rawValue: "", format: "", source: ""});

// Lectura de un cuadro: texto, formato ("ean_13", "ean_8"…) y decoder que la produjo.
export function toBarcodeRead(value, source = "") {
  if (value && typeof value === "object") {
    return {
      rawValue: String(value.rawValue || ""),
      format: String(value.format || "").toLowerCase(),
      source: String(value.source || source),
    };
  }
  return {rawValue: String(value || ""), format: "", source};
}

export function isBarcodeVideoReady(video) {
  return Boolean(
    video &&
    Number(video.readyState) >= 2 &&
    Number(video.videoWidth) > 0 &&
    Number(video.videoHeight) > 0
  );
}

export function waitForBarcodeVideoReady(video, {signal} = {}) {
  if (isBarcodeVideoReady(video)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const events = ["loadeddata", "canplay", "resize"];
    const cleanup = () => {
      events.forEach((eventName) => video?.removeEventListener?.(eventName, handleReady));
      signal?.removeEventListener?.("abort", handleAbort);
    };
    const handleReady = () => {
      if (!isBarcodeVideoReady(video)) return;
      cleanup();
      resolve();
    };
    const handleAbort = () => {
      cleanup();
      const error = new Error("Se canceló la preparación del video.");
      error.name = "AbortError";
      reject(error);
    };
    events.forEach((eventName) => video?.addEventListener?.(eventName, handleReady));
    signal?.addEventListener?.("abort", handleAbort, {once: true});
    if (signal?.aborted) handleAbort();
    else handleReady();
  });
}

export function isZxingRetryableError(error, retryableErrorTypes) {
  return retryableErrorTypes.some((ErrorType) => error instanceof ErrorType);
}

export async function createBarcodeFrameDecoder({decoder, formats}) {
  if (decoder === "native") {
    const detector = new globalThis.BarcodeDetector({formats});
    return {
      kind: "native",
      async detect(video) {
        const codes = await detector.detect(video);
        return {rawValue: String(codes?.[0]?.rawValue || ""), format: String(codes?.[0]?.format || "")};
      },
      stop() {},
    };
  }

  const {
    BarcodeFormat,
    BrowserMultiFormatReader,
    ChecksumException,
    DecodeHintType,
    FormatException,
    NotFoundException,
  } = await import("@zxing/library");
  const possibleFormats = formats
    .map((format) => BarcodeFormat[ZXING_FORMAT_KEYS[format]])
    .filter((format) => Number.isInteger(format));
  const hints = new Map([
    [DecodeHintType.POSSIBLE_FORMATS, possibleFormats],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const reader = new BrowserMultiFormatReader(hints, 250);
  const retryableErrorTypes = [NotFoundException, ChecksumException, FormatException];
  const formatNames = new Map(
    Object.entries(ZXING_FORMAT_KEYS).map(([name, key]) => [BarcodeFormat[key], name])
  );
  let captureWidth = 0;
  let captureHeight = 0;
  return {
    kind: "zxing",
    async detect(video) {
      if (!isBarcodeVideoReady(video)) return "";
      try {
        if (
          captureWidth &&
          (captureWidth !== video.videoWidth || captureHeight !== video.videoHeight)
        ) {
          reader.reset();
        }
        captureWidth = video.videoWidth;
        captureHeight = video.videoHeight;
        const result = reader.decode(video);
        return {
          rawValue: String(result?.getText?.() || ""),
          format: formatNames.get(result?.getBarcodeFormat?.()) || "",
        };
      } catch (error) {
        if (isZxingRetryableError(error, retryableErrorTypes)) return "";
        throw error;
      }
    },
    stop() {
      reader.reset();
    },
  };
}

// Avisa cada cambio de visibilidad de la página (true = visible). Devuelve la
// función para dejar de escuchar.
export function watchPageVisibility(doc, onChange) {
  if (typeof doc?.addEventListener !== "function") return () => {};
  const handleChange = () => onChange(doc.visibilityState !== "hidden");
  doc.addEventListener("visibilitychange", handleChange);
  return () => doc.removeEventListener("visibilitychange", handleChange);
}

function defaultNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

// Ciclo de lectura de la cámara, separado del componente para poder probarlo.
// Nunca toca el stream ni el elemento de video: la cámara solo se libera desde
// el componente al cerrar el cuadro o, vía onFatalError, ante errores repetidos
// de decodificación. Una búsqueda fallida deja el ciclo activo. Cada lectura
// pasa primero por la confirmación (lecturas idénticas) y luego por la regla de
// salir de cuadro.
export function startBarcodeCameraLoop({
  continuous = false,
  decoder,
  getVideo,
  now = Date.now,
  onDetection,
  onFatalError,
  onReadState,
  onStatus,
  readState = null,
  schedule,
  submit,
}) {
  let stopped = false;
  let state = readState;
  let confirmationState = null;
  let consecutiveErrors = 0;
  const saveState = (nextState) => {
    state = nextState;
    onReadState?.(state);
  };
  const scheduleNext = () => {
    if (!stopped) schedule(step, decoder.kind);
  };
  async function step() {
    if (stopped) return;
    const video = getVideo();
    if (!video) return;
    try {
      const detection = toBarcodeRead(await decoder.detect(video));
      if (stopped) return;
      consecutiveErrors = 0;
      const readAt = now();
      const confirmation = confirmCameraBarcodeRead(confirmationState, detection, readAt);
      confirmationState = confirmation.state;
      if (confirmation.barcode) onDetection?.(detection, confirmation);
      // Solo una lectura confirmada cuenta como presencia del código en cuadro.
      const read = acceptCameraBarcodeRead(state, confirmation.confirmed ? confirmation.barcode : "", readAt);
      saveState(read.state);
      if (read.accepted) {
        onStatus?.("processing", read.barcode);
        const used = await submit(read.barcode);
        if (stopped) return;
        if (used && !continuous) {
          // Lectura única aceptada: el componente cierra el cuadro y libera la cámara.
          stopped = true;
          return;
        }
        // La búsqueda pudo tardar más que la ventana; el código sigue en cuadro.
        saveState({barcode: read.barcode, seenAt: now()});
        onStatus?.("ready", read.barcode);
      }
    } catch {
      if (stopped) return;
      // La sesión ya absorbe los errores del decoder nativo; aquí solo llegan los de ZXing.
      consecutiveErrors += 1;
      if (consecutiveErrors >= BARCODE_DECODE_ERROR_LIMIT) {
        stopped = true;
        onFatalError?.();
        return;
      }
    }
    scheduleNext();
  }
  scheduleNext();
  return {
    get stopped() {
      return stopped;
    },
    stop() {
      stopped = true;
    },
  };
}

// Si el decoder nativo no lee nada en la ventana inicial, ZXing se suma y ambos
// se alternan por intento: el nativo sigue disponible para lecturas rápidas y
// ZXing cubre los códigos que el nativo no reconoce en ese equipo.
export async function createBarcodeDecoderSession({
  decoder,
  formats,
  createDecoder = createBarcodeFrameDecoder,
  fallbackAfterMs = NATIVE_DECODER_FALLBACK_MS,
  now = defaultNow,
  onFallback,
}) {
  const primaryDecoder = await createDecoder({decoder, formats});
  let fallbackDecoder = null;
  let fallbackUnavailable = false;
  let fallbackTurn = false;
  let decodeInFlight = false;
  let stopped = false;
  const startedAt = now();

  const startFallbackIfDue = async () => {
    if (
      primaryDecoder.kind !== "native" ||
      fallbackDecoder ||
      fallbackUnavailable ||
      now() - startedAt < fallbackAfterMs
    ) {
      return;
    }
    try {
      const created = await createDecoder({decoder: "zxing", formats});
      if (stopped) {
        created.stop?.();
        return;
      }
      fallbackDecoder = created;
      fallbackTurn = true;
      onFallback?.();
    } catch {
      // Sin ZXing, el decoder nativo continúa operando solo.
      fallbackUnavailable = true;
    }
  };

  return {
    get kind() {
      return fallbackDecoder ? "alternating" : primaryDecoder.kind;
    },
    async detect(video) {
      if (stopped || decodeInFlight || !isBarcodeVideoReady(video)) return EMPTY_BARCODE_READ;
      decodeInFlight = true;
      try {
        await startFallbackIfDue();
        if (stopped) return EMPTY_BARCODE_READ;
        const currentDecoder = fallbackDecoder && fallbackTurn ? fallbackDecoder : primaryDecoder;
        if (fallbackDecoder) fallbackTurn = !fallbackTurn;
        let detection;
        try {
          detection = toBarcodeRead(await currentDecoder.detect(video), currentDecoder.kind);
        } catch (error) {
          // Un error del decoder nativo equivale a un cuadro sin lectura.
          if (stopped || currentDecoder.kind === "native") return EMPTY_BARCODE_READ;
          throw error;
        }
        if (stopped) return EMPTY_BARCODE_READ;
        return detection.rawValue.trim() ? detection : EMPTY_BARCODE_READ;
      } finally {
        decodeInFlight = false;
      }
    },
    stop() {
      stopped = true;
      primaryDecoder.stop?.();
      fallbackDecoder?.stop?.();
    },
  };
}
