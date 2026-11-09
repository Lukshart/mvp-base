import React from "react";

// SPEC 022 §6.1 y SPEC 025: el Resumen mensual es la primera pestaña y la
// vista por defecto; Ventas, Compras y Ganancia quedan como detalle.
// "Rentabilidad y estado" se eliminó (repetía Ganancia) y sus alertas viven al
// final de Ganancia.
// `permission` indica qué capacidad del perfil exige cada una (las mismas que
// ya decide StatisticsPage con rbac.mjs). El Resumen no exige ninguna: cada
// tarjeta se oculta por su propio permiso.
export const REPORT_VIEWS = Object.freeze([
  {id: "resumen", label: "Resumen", permission: null},
  {id: "ventas", label: "Ventas", permission: "canViewSales"},
  {id: "compras", label: "Compras", permission: "canViewPurchases"},
  {id: "ganancias", label: "Ganancia", permission: "canViewProfitability"},
]);

export const DEFAULT_REPORT_VIEW_ID = "resumen";
// URL de las pestañas retiradas (SPEC 021 y SPEC 025): siguen funcionando como
// enlaces y abren Ganancia.
const LEGACY_VIEW_IDS = Object.freeze({rentabilidad: "ganancias", inventario: "ganancias", proyectos: "ganancias"});
const VIEWS_BY_ID = new Map(REPORT_VIEWS.map((view) => [view.id, view]));

function canOpenView(view, permissions) {
  return !view.permission || permissions[view.permission] !== false;
}

export function getAllowedReportViews(permissions = {}) {
  return REPORT_VIEWS.filter((view) => canOpenView(view, permissions));
}

// Resuelve la vista pedida a una que el perfil pueda abrir, para que ningún
// perfil aterrice en una pestaña vacía. Permisos ausentes se tratan como
// concedidos (compatibilidad con llamadas sin permisos).
export function normalizeReportView(value, permissions = {}) {
  const requested = LEGACY_VIEW_IDS[value] || (VIEWS_BY_ID.has(value) ? value : DEFAULT_REPORT_VIEW_ID);
  if (canOpenView(VIEWS_BY_ID.get(requested), permissions)) return requested;
  return getAllowedReportViews(permissions)[0]?.id || DEFAULT_REPORT_VIEW_ID;
}

function ReportsNav({active, onSelect, permissions = {}}) {
  return (
    <div className="financial-tabs statistics-tabs" role="tablist" aria-label="Vistas de reportes">
      {getAllowedReportViews(permissions).map((view) => (
        <button
          key={view.id}
          type="button"
          role="tab"
          aria-selected={active === view.id}
          className={active === view.id ? "financial-tab is-active" : "financial-tab"}
          onClick={() => onSelect(view.id)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

export default ReportsNav;
