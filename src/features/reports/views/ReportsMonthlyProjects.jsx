import React, {useMemo} from "react";
import {ArrowRight, Minus, RefreshCw, TrendingDown, TrendingUp} from "lucide-react";
import Button from "../../../components/ui/Button";
import LoadingState from "../../../components/ui/LoadingState";
import {
  PROJECT_RESULT_STATUS,
  buildMonthlyProjectResults,
  buildServicesWithoutProjectNotices,
  formatMonthLabel,
  projectResultLabel,
} from "../../../domain/reportMonthlySummary.mjs";
import useBusinessFormat from "../../../hooks/useBusinessFormat";
import {formatMoney} from "../../../utils/formatters";

const STATUS_VISUALS = Object.freeze({
  [PROJECT_RESULT_STATUS.LOSING]: {icon: TrendingDown, tone: "down"},
  [PROJECT_RESULT_STATUS.WINNING]: {icon: TrendingUp, tone: "up"},
  [PROJECT_RESULT_STATUS.NEUTRAL]: {icon: Minus, tone: "none"},
});

function ProjectRow({locale, onOpen, row}) {
  const {icon: Icon, tone} = STATUS_VISUALS[row.estado];
  const detail = [row.numero, row.cliente].filter(Boolean).join(" · ");
  return <li className="reports-month-project">
    <div className="reports-month-project__main">
      {onOpen
        ? <Button type="button" variant="ghost" className="reports-month-project__open" aria-label={`Abrir ficha de ${row.titulo}`} onClick={() => onOpen(row.id)}>{row.titulo}</Button>
        : <strong className="reports-month-project__title">{row.titulo}</strong>}
      {detail && <span className="reports-month-project__meta">{detail}</span>}
    </div>
    <span className={`reports-month-project__status reports-month-project__status--${tone}`}>
      <Icon size={14} aria-hidden="true" />
      {projectResultLabel(row.estado)}
    </span>
    <strong className={`reports-month-project__amount reports-month-project__amount--${tone}`}>{formatMoney(row.resultado, row.moneda, locale)}</strong>
  </li>;
}

// Proyectos con movimiento en el mes elegido (SPEC 025 §3), con los que pierden
// primero. Solo presenta lo que arma buildMonthlyProjectResults desde los mismos
// balances que alimentan la ganancia; no calcula dinero por su cuenta. Un fallo
// de carga es un error propio y nunca se muestra como vacío.
function ReportsMonthlyProjects({canView, currency, inProgress, links, month, onNavigate, onRetry, profit, projects}) {
  const {locale} = useBusinessFormat();
  const results = useMemo(
    () => projects.status === "ready" ? buildMonthlyProjectResults({projects: projects.meta?.proyectos || [], month, currency}) : null,
    [currency, month, projects]
  );
  const notices = useMemo(() => buildServicesWithoutProjectNotices(profit, currency), [currency, profit]);
  if (!canView) return null;

  const failedCount = projects.meta?.fallidos?.length || 0;
  const loadError = projects.status === "error"
    ? projects.error || "No fue posible cargar los proyectos del mes."
    : results && !results.filas.length && failedCount > 0
      ? "No fue posible cargar los balances de los proyectos."
      : "";
  const openWork = links.works ? (workId) => onNavigate("/trabajos", {state: {openWorkId: workId}}) : null;
  const currencies = results ? [...new Set(results.filas.map((row) => row.moneda))] : [];

  let body;
  if (projects.status === "loading") {
    body = <LoadingState variant="section" label="Cargando proyectos del mes..." />;
  } else if (loadError) {
    body = <div className="reports-v4-state reports-v4-state--error" role="alert">
      <span>{loadError}</span>
      <Button type="button" variant="secondary" icon={RefreshCw} iconSize={14} onClick={onRetry}>Reintentar</Button>
    </div>;
  } else if (!results.filas.length) {
    body = <p className="reports-month-projects__empty">
      {inProgress ? "Aún no hay proyectos con movimiento este mes" : `No hubo proyectos con movimiento en ${formatMonthLabel(month, locale).toLocaleLowerCase(locale)}`}
    </p>;
  } else {
    body = currencies.map((code) => <div className="reports-month-projects__group" key={code}>
      {currencies.length > 1 && <h3>{code}</h3>}
      <ul className="reports-month-projects__list">
        {results.filas.filter((row) => row.moneda === code).map((row) => <ProjectRow key={`${row.moneda}-${row.id}`} locale={locale} onOpen={openWork} row={row} />)}
      </ul>
    </div>);
  }

  const warnings = [];
  if (results?.incompletos > 0) {
    warnings.push(`${results.incompletos} ${results.incompletos === 1 ? "proyecto con movimiento no se muestra" : "proyectos con movimiento no se muestran"} porque sus datos están incompletos.`);
  }
  if (results && failedCount > 0 && results.filas.length) {
    warnings.push(`No fue posible cargar ${failedCount} ${failedCount === 1 ? "proyecto" : "proyectos"}.`);
  }

  return <section className="erp-card reports-month-projects" aria-labelledby="reports-month-projects-title">
    <header className="reports-month-projects__header">
      <h2 id="reports-month-projects-title">Proyectos del mes</h2>
      {links.works && <Button type="button" variant="ghost" icon={ArrowRight} iconSize={14} onClick={() => onNavigate("/trabajos")}>Ver todos los proyectos</Button>}
    </header>
    {body}
    {warnings.map((text) => <p className="reports-month-projects__note" key={text}>{text}</p>)}
    {notices.map((notice) => <p className="reports-month-projects__notice" key={notice.moneda}>
      <span className="reports-v4-badge reports-v4-badge--parcial">Aviso</span>
      {" "}Hay {formatMoney(notice.monto, notice.moneda, locale)} en servicios vendidos sin proyecto, y no entran en la ganancia. Vincúlalos a un proyecto para saber si ganas o pierdes con ellos.
      {links.sales && <>{" "}<Button type="button" variant="secondary" onClick={() => onNavigate("/ventas")}>Ir a Ventas</Button></>}
    </p>)}
  </section>;
}

export default ReportsMonthlyProjects;
