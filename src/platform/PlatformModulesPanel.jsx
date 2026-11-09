import React from "react";
import Button from "../components/ui/Button";

export const MODULES_EVENT_TYPE = "modulos_actualizados";

function moduleLabel(registry, moduleId) {
  return registry.find((item) => item.id === moduleId)?.label || moduleId;
}

function moduleList(registry, ids) {
  return ids.length ? ids.map((id) => moduleLabel(registry, id)).join(", ") : "ninguno";
}

// Texto del historial para un evento modulos_actualizados.
export function moduleEventSummary(event, registry = []) {
  const summary = `Módulos: ${moduleList(registry, event.modulosAnteriores || [])} → ${moduleList(registry, event.modulosResultantes || [])}`;
  return event.motivo ? `${summary} · ${event.motivo}` : summary;
}

// Interruptor de módulos verticales de una empresa. Los módulos salen del
// registro que entrega la Function (modulosDisponibles); aquí no se conoce
// ninguno por nombre. onSave(modulos, motivo) debe resolver true si se guardó.
// El padre lo remonta (key) cuando cambia la lista habilitada, así que la
// selección y el motivo nacen siempre del estado guardado.
function PlatformModulesPanel({registry, enabled, deleted = false, working = false, onEdit, onSave}) {
  const [selected, setSelected] = React.useState(enabled);
  const [reason, setReason] = React.useState("");
  const dirty = registry.some((item) => selected.includes(item.id) !== enabled.includes(item.id));
  const toggle = (moduleId, checked) => {
    onEdit?.();
    setSelected((current) => checked
      ? [...new Set([...current, moduleId])]
      : current.filter((id) => id !== moduleId));
  };
  const save = async () => {
    const saved = await onSave(registry.map((item) => item.id).filter((id) => selected.includes(id)), reason.trim());
    if (saved) setReason("");
  };
  return (
    <section className="platform-panel" aria-labelledby="platform-modules-title">
      <h2 id="platform-modules-title">Módulos</h2>
      {!registry.length ? (
        <p className="platform-help platform-help--flush">No hay módulos verticales disponibles todavía.</p>
      ) : (
        <>
          <p className="platform-modules__current">
            <span>Habilitados ahora:</span> <strong>{enabled.length ? moduleList(registry, enabled) : "Ninguno"}</strong>
          </p>
          <fieldset className="platform-modules__list" disabled={deleted || working}>
            <legend className="platform-modules__legend">Módulos de la empresa</legend>
            {registry.map((item) => (
              <label className="ui-checkbox" key={item.id}>
                <input
                  className="ui-checkbox__input"
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  onChange={(event) => toggle(item.id, event.target.checked)}
                />
                <span className="ui-checkbox__label">{item.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="platform-action-form">
            <label>
              Motivo del cambio
              <textarea
                rows="2"
                value={reason}
                disabled={deleted || working}
                onChange={(event) => { onEdit?.(); setReason(event.target.value); }}
              />
            </label>
            <Button disabled={deleted || working || !dirty || !reason.trim()} onClick={save}>
              Guardar módulos
            </Button>
          </div>
          <p className="platform-help">
            Un módulo deshabilitado queda oculto y bloqueado, con sus datos intactos. El cambio se ve al recargar la sesión.
          </p>
        </>
      )}
    </section>
  );
}

export default PlatformModulesPanel;
