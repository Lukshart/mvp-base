import React, {useEffect, useRef, useState} from "react";
import Button from "../../components/ui/Button";
import ResponsiveDialog from "../../components/ui/ResponsiveDialog";
import {getWorkMemberIdentity} from "../../domain/workModel.mjs";

// Formulario corto de "Nueva tarea" (SPEC 028 etapa B2): título, responsable y
// descripción opcional. Presentacional: `onSubmit(draft)` devuelve una promesa
// con true si la tarea se creó (la página la resuelve con la misma Function y el
// mismo requestId de siempre); solo entonces se cierra y se limpia el formulario.

const EMPTY_DRAFT = Object.freeze({titulo: "", descripcion: "", responsableUid: ""});

export default function WorkTaskCreateDialog({members, onClose, onSubmit, open, processing}) {
  const [draft, setDraft] = useState({...EMPTY_DRAFT});
  const titleRef = useRef(null);
  const busy = Boolean(processing);

  useEffect(() => { if (open) setDraft({...EMPTY_DRAFT}); }, [open]);

  const submit = (event) => {
    event.preventDefault();
    if (!draft.titulo.trim() || busy) return;
    onSubmit(draft).then((success) => { if (success) onClose(); });
  };

  return (
    <ResponsiveDialog
      open={open}
      onClose={() => !busy && onClose()}
      size="small"
      initialFocusRef={titleRef}
      eyebrow="Tablero"
      title="Nueva tarea"
      description="Se crea en Por hacer."
      footer={<><Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Cancelar</Button><Button type="submit" form="work-task-create-form" loading={processing === "task-new"} disabled={busy && processing !== "task-new"}>Crear tarea</Button></>}
    >
      <form id="work-task-create-form" className="works-task-create" onSubmit={submit}>
        <label className="erp-field">
          <span className="erp-field__label">Título *</span>
          <input ref={titleRef} className="erp-control" maxLength="240" required value={draft.titulo} onChange={(event) => setDraft((current) => ({...current, titulo: event.target.value}))} placeholder="Ej.: Tender cableado del segundo piso" />
        </label>
        <label className="erp-field">
          <span className="erp-field__label">Responsable</span>
          <select className="erp-control" value={draft.responsableUid} onChange={(event) => setDraft((current) => ({...current, responsableUid: event.target.value}))}>
            <option value="">Sin responsable</option>
            {members.map((member) => <option key={member.uid} value={member.uid}>{getWorkMemberIdentity(member)}</option>)}
          </select>
        </label>
        <label className="erp-field">
          <span className="erp-field__label">Descripción<span className="works-field-optional">Opcional</span></span>
          <textarea className="erp-control" maxLength="4000" rows="3" value={draft.descripcion} onChange={(event) => setDraft((current) => ({...current, descripcion: event.target.value}))} placeholder="Qué hay que hacer" />
        </label>
      </form>
    </ResponsiveDialog>
  );
}
