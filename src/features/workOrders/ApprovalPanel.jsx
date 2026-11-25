import React, {useCallback, useEffect, useState} from "react";
import Button from "../../components/ui/Button";
import LoadingState from "../../components/ui/LoadingState";
import ResponsiveDialog from "../../components/ui/ResponsiveDialog";
import {
  createWorkOrderRequestId, ejecutarAccionAprobacionOT, getWorkOrderErrorMessage,
  obtenerResumenAprobacionOT,
} from "../../services/workOrderService";

const ACTIONS = {aprobar: "Aprobar ingreso", rechazar: "Rechazar ingreso"};

// La aprobación es una compuerta: el Owner o el Administrador dicen sí o no al ingreso.
// Los trabajos y repuestos se registran después, en la ejecución.
export default function ApprovalPanel({businessId, otId, order, onChanged}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const revision = order.actualizadoEn?.toMillis?.();

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setSummary(null);
    obtenerResumenAprobacionOT(businessId, otId)
      .then(async (data) => {
        if (!active) return;
        setSummary(data);
        // Otra operación pudo cambiar la OT después de cargar la ficha.
        if (Number.isSafeInteger(data.revision) && data.revision !== revision) await onChanged();
      })
      .catch((failure) => { if (active) setError(getWorkOrderErrorMessage(failure)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, otId, revision, reload]);

  const begin = (action) => {
    setConfirmation({action, requestId: createWorkOrderRequestId(), revision: summary.revision});
    setReason(""); setReasonError(""); setError(""); setNotice("");
  };
  const confirm = useCallback(async () => {
    if (!confirmation || busy) return;
    // Rechazar exige el motivo (la Function también lo valida).
    if (confirmation.action === "rechazar" && !reason.trim()) {
      setReasonError("Indica el motivo del rechazo.");
      return;
    }
    setBusy(true); setError("");
    try {
      await ejecutarAccionAprobacionOT(businessId, otId, confirmation.action,
        confirmation.requestId, confirmation.revision, reason);
      setConfirmation(null);
      setNotice(confirmation.action === "aprobar"
        ? "Ingreso aprobado. Ya se pueden registrar los trabajos en la ejecución."
        : "Ingreso rechazado.");
      await onChanged();
      setReload((value) => value + 1);
    } catch (failure) {
      setError(getWorkOrderErrorMessage(failure));
      if (String(failure.code).includes("aborted")) { setConfirmation(null); setSummary(null); }
    } finally { setBusy(false); }
  }, [businessId, otId, confirmation, busy, reason, onChanged]);

  const approved = summary?.estadoAprobacion === "aprobada";
  const rejected = summary?.estadoAprobacion === "rechazada";
  return <section className="erp-panel" aria-labelledby="work-order-approval-title">
    <div className="erp-panel-header"><div>
      <h2 id="work-order-approval-title" className="erp-panel-title">Aprobación del ingreso</h2>
      <p className="erp-secondary-text">Revisa la recepción y decide si el vehículo ingresa al taller.</p>
    </div></div>
    {loading && <LoadingState variant="section" label="Cargando aprobación..." />}
    {error && <div className="vehicle-message vehicle-message--error" role="alert">{error}</div>}
    {notice && <div className="vehicle-message" role="status">{notice}</div>}
    {summary && !loading && <>
      {approved && <div className="vehicle-message" role="status">Ingreso aprobado.</div>}
      {rejected && <div className="vehicle-message vehicle-message--warning" role="status">Ingreso rechazado. Puedes aprobarlo si cambia la decisión.</div>}
      {!approved && !summary.puedeDecidir && <p className="erp-secondary-text">Registra la recepción para poder decidir el ingreso.</p>}
      {summary.puedeDecidir && !summary.puedeAprobar && <p className="erp-secondary-text">Tu membresía permite consultar la aprobación, pero no decidirla.</p>}
      {summary.puedeDecidir && summary.puedeAprobar && <div className="vehicle-form-actions work-order-approval-actions">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => begin("rechazar")}>Rechazar</Button>
        <Button type="button" disabled={busy} onClick={() => begin("aprobar")}>Aprobar</Button>
      </div>}
    </>}
    <ResponsiveDialog open={Boolean(confirmation)} onClose={() => !busy && setConfirmation(null)} size="small" eyebrow="Taller" title={ACTIONS[confirmation?.action] || "Confirmar acción"}
      description="La decisión se valida en el servidor y queda en el historial de la OT."
      footer={<><Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</Button><Button type="button" disabled={busy} onClick={confirm}>{busy ? "Procesando..." : "Confirmar"}</Button></>}>
      {confirmation?.action === "rechazar" && <label className="erp-field"><span className="erp-field__label">Motivo *</span><textarea className="erp-control" value={reason} maxLength={2000} disabled={busy} onChange={(event) => { setReason(event.target.value); setReasonError(""); }} />{reasonError && <span className="work-order-field-error" role="alert">{reasonError}</span>}</label>}
      {error && <div className="vehicle-message vehicle-message--error" role="alert">{error}</div>}
    </ResponsiveDialog>
  </section>;
}
