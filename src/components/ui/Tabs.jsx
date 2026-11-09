import React, {useRef} from "react";

// Pestañas controladas: <Tabs> dibuja la fila de pestañas y <TabPanel> el
// contenido de la activa. Enlazan por `idPrefix` + id de la pestaña. Teclado
// según el patrón WAI-ARIA: flechas izquierda/derecha, Inicio y Fin mueven la
// selección; solo la pestaña activa entra en el orden de Tab.
export function tabId(idPrefix, id) {
  return `${idPrefix}-tab-${id}`;
}

export function tabPanelId(idPrefix, id) {
  return `${idPrefix}-panel-${id}`;
}

export function Tabs({className = "", idPrefix, label, onChange, tabs, value}) {
  const refs = useRef({});
  const visible = (tabs || []).filter(Boolean);
  const handleKeyDown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = visible.findIndex((tab) => tab.id === value);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? visible.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + visible.length) % visible.length;
    const target = visible[next];
    if (!target) return;
    onChange(target.id);
    refs.current[target.id]?.focus();
  };

  return (
    <div className={["ui-tabs", className].filter(Boolean).join(" ")} role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
      {visible.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => { refs.current[tab.id] = node; }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            aria-controls={tabPanelId(idPrefix, tab.id)}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={selected ? "ui-tab is-active" : "ui-tab"}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// Los paneles inactivos quedan montados pero ocultos (`hidden`): así un
// formulario a medio llenar no se pierde al cambiar de pestaña.
export function TabPanel({active = true, children, className = "", id, idPrefix}) {
  return (
    <div className={["ui-tab-panel", className].filter(Boolean).join(" ")} role="tabpanel" id={tabPanelId(idPrefix, id)} aria-labelledby={tabId(idPrefix, id)} hidden={!active}>
      {children}
    </div>
  );
}

export default Tabs;
