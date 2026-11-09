import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRequestId,
  listarMisInvitaciones,
  responderInvitacion,
} from "../services/teamInvitationService";

export const MY_INVITATIONS_STATUS = Object.freeze({
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
});

const cleanError = (error, fallback) =>
  String(error?.message || "").replace(/^Firebase:\s*/i, "").trim() || fallback;

// Invitaciones pendientes de la cuenta que inició sesión (SPEC 032). No hay
// colección legible desde el navegador: todo pasa por listarMisInvitaciones.
// `onAccepted(resultado, invitacion)` corre tras aceptar (recargar sesión y
// entrar a la empresa). `reload({ silent: true })` no vuelve a "loading" si ya
// hay datos, para las consultas periódicas.
export default function useMyInvitations({ enabled = true, onAccepted } = {}) {
  const [state, setState] = useState({
    status: MY_INVITATIONS_STATUS.LOADING,
    invitations: [],
    requiresVerification: false,
  });
  const [busyId, setBusyId] = useState("");
  const [feedback, setFeedback] = useState({ text: "", error: false });
  const onAcceptedRef = useRef(onAccepted);
  const mountedRef = useRef(true);
  const sequenceRef = useRef(0);
  const requestIdsRef = useRef(new Map());
  onAcceptedRef.current = onAccepted;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(async ({ silent = false } = {}) => {
    const sequence = ++sequenceRef.current;
    if (!silent) {
      setState((current) =>
        current.status === MY_INVITATIONS_STATUS.READY && current.invitations.length > 0
          ? current
          : { ...current, status: MY_INVITATIONS_STATUS.LOADING }
      );
    }
    try {
      const result = await listarMisInvitaciones();
      if (!mountedRef.current || sequence !== sequenceRef.current) return;
      setState({ status: MY_INVITATIONS_STATUS.READY, ...result });
    } catch (error) {
      if (!mountedRef.current || sequence !== sequenceRef.current) return;
      if (import.meta.env.DEV) {
        console.error("Error al cargar invitaciones:", error);
      }
      // Una consulta periódica fallida no tapa lo que ya se mostraba.
      setState((current) =>
        silent && current.status === MY_INVITATIONS_STATUS.READY
          ? current
          : { ...current, status: MY_INVITATIONS_STATUS.ERROR }
      );
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    reload();
  }, [enabled, reload]);

  // Un reintento del mismo clic reutiliza el requestId; cada intento nuevo,
  // tras un éxito o un cambio de motivo, genera uno distinto.
  const respond = useCallback(async (invitation, accion, motivo = "") => {
    if (busyId) return false;
    const key = `${invitation.id}|${accion}|${motivo}`;
    if (!requestIdsRef.current.has(key)) requestIdsRef.current.set(key, createRequestId());
    setBusyId(invitation.id);
    setFeedback({ text: "", error: false });
    try {
      const result = await responderInvitacion({
        invitacionId: invitation.id,
        accion,
        motivo,
        requestId: requestIdsRef.current.get(key),
      });
      requestIdsRef.current.delete(key);
      if (!mountedRef.current) return true;
      setState((current) => ({
        ...current,
        invitations: current.invitations.filter((item) => item.id !== invitation.id),
      }));
      if (accion === "aceptar") {
        try {
          await onAcceptedRef.current?.(result, invitation);
        } catch (error) {
          if (!mountedRef.current) return true;
          setFeedback({
            text: cleanError(error, "Aceptaste la invitación, pero no pudimos abrir la empresa. Recarga la página."),
            error: true,
          });
          return true;
        }
        if (mountedRef.current && result?.mensaje) {
          setFeedback({ text: result.mensaje, error: false });
        }
      } else if (mountedRef.current) {
        setFeedback({ text: "Rechazaste la invitación.", error: false });
      }
      return true;
    } catch (error) {
      if (mountedRef.current) {
        setFeedback({
          text: cleanError(error, "No pudimos responder la invitación."),
          error: true,
        });
      }
      return false;
    } finally {
      if (mountedRef.current) setBusyId("");
    }
  }, [busyId]);

  const clearFeedback = useCallback(() => setFeedback({ text: "", error: false }), []);

  return { ...state, busyId, clearFeedback, feedback, reload, respond };
}
