import React from "react";
import Button from "./ui/Button";
import ResponsiveDialog from "./ui/ResponsiveDialog";
import {
  MAX_INVITATION_REJECTION_REASON_LENGTH,
  trimInvitationReason,
} from "../domain/teamInvitationModel.mjs";

// Diálogo para rechazar una invitación con un motivo opcional (hasta 500
// caracteres). Presentacional: `onSubmit(motivo)` devuelve una promesa.
function RejectInvitationDialog({ invitation, busy = false, error = "", onClose, onSubmit }) {
  const [reason, setReason] = React.useState("");
  const textareaRef = React.useRef(null);
  const fieldId = React.useId();
  const open = Boolean(invitation);

  React.useEffect(() => {
    if (open) setReason("");
  }, [open, invitation?.id]);

  return (
    <ResponsiveDialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Rechazar invitación"
      eyebrow="Invitaciones"
      description={invitation ? `Puedes contarle a ${invitation.negocioNombre} por qué no te unes. Es opcional.` : ""}
      size="small"
      initialFocusRef={textareaRef}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={`${fieldId}-form`} variant="danger" loading={busy}>
            {busy ? "Rechazando..." : "Rechazar invitación"}
          </Button>
        </>
      }
    >
      <form
        id={`${fieldId}-form`}
        className="ui-invitation-reject"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onSubmit(reason.trim());
        }}
      >
        <label className="erp-field" htmlFor={fieldId}>
          <span className="erp-field__label">Motivo (opcional)</span>
          <textarea
            id={fieldId}
            ref={textareaRef}
            className="erp-control"
            rows="4"
            maxLength={MAX_INVITATION_REJECTION_REASON_LENGTH}
            value={reason}
            onChange={(event) => setReason(trimInvitationReason(event.target.value))}
            placeholder="Cuéntale a la empresa por qué no te unes"
          />
        </label>
        <small className="ui-invitation-reject__count">
          {reason.length} / {MAX_INVITATION_REJECTION_REASON_LENGTH}
        </small>
        {error && (
          <p className="ui-invitation-reject__error" role="alert">
            {error}
          </p>
        )}
      </form>
    </ResponsiveDialog>
  );
}

export default RejectInvitationDialog;
