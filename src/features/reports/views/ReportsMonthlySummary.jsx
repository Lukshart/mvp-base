import React, {useMemo} from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  Minus,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import Button from "../../../components/ui/Button";
import LoadingState from "../../../components/ui/LoadingState";
import {
  MONTHLY_EXPLANATIONS,
  NO_PREVIOUS_MONTH_TEXT,
  buildMonthlySummaryGroups,
  canShowNextMonth,
  formatComparisonText,
  formatMonthLabel,
  formatMonthName,
  formatReferenceText,
  hasPreviousMonthBase,
  isMonthEmpty,
  isMonthInProgress,
  shiftMonthKey,
} from "../../../domain/reportMonthlySummary.mjs";
import useBusinessFormat from "../../../hooks/useBusinessFormat";
import {formatMoney} from "../../../utils/formatters";
import ReportsMonthlyProjects from "./ReportsMonthlyProjects";

const DELTA_ICONS = Object.freeze({up: ArrowUpRight, down: ArrowDownRight, flat: Minus, none: Minus});

function ComparisonLine({comparison, locale, signed = false}) {
  const Icon = DELTA_ICONS[comparison.direction];
  const tone = signed ? comparison.direction : "none";
  return <span className={`reports-month-delta reports-month-delta--${tone}`}>
    <Icon size={14} aria-hidden="true" />
    {formatComparisonText(comparison, locale)}
  </span>;
}

// Mes en curso: una línea de referencia con el mes anterior completo, sin
// porcentaje. Mes cerrado: la variación porcentual.
function ReferenceLine({text}) {
  return <span className="reports-month-delta reports-month-delta--none">{text}</span>;
}

function MonthlyCard({children, comparison, explanation, icon: Icon, locale, onOpenDetail, referenceText, signed, title, variant = "default"}) {
  return <article className={`reports-simple-card reports-simple-card--${variant}`}>
    <div className="reports-simple-card__top">
      <span className="reports-simple-card__icon"><Icon size={19} aria-hidden="true" /></span>
      <span className="reports-simple-card__title">{title}</span>
    </div>
    {children}
    {referenceText ? <ReferenceLine text={referenceText} /> : comparison && <ComparisonLine comparison={comparison} locale={locale} signed={signed} />}
    <small>{explanation}</small>
    {onOpenDetail && <Button type="button" variant="ghost" className="reports-month-card-link" icon={ArrowRight} iconSize={14} onClick={onOpenDetail}>Ver detalle</Button>}
  </article>;
}

function ProfitAmount({amountText, onRetry, profit}) {
  if (profit.status === "error") {
    // Un fallo de la ganancia es un error propio: nunca se muestra como vacío.
    return <div className="reports-v4-state reports-v4-state--error" role="alert">
      <span>{profit.error || "No fue posible calcular la ganancia."}</span>
      <Button type="button" variant="secondary" icon={RefreshCw} iconSize={14} onClick={onRetry}>Reintentar</Button>
    </div>;
  }
  if (profit.status !== "ready") return <LoadingState variant="inline" label="Calculando ganancia..." />;
  return <strong className="reports-simple-card__amount">{amountText}</strong>;
}

// Solo avisa: cobertura parcial de la ganancia o documentos sin neto válido.
// Con cobertura completa no se muestra nada.
function CoverageLine({canViewProfitability, coverage, onOpenDetail, withoutNetCount}) {
  const parts = [];
  if (canViewProfitability && coverage === "partial") {
    parts.push({key: "partial", badge: "Cobertura parcial", partial: true, text: "La ganancia del mes es parcial: hay registros que no se incluyen."});
  }
  if (!parts.length && !withoutNetCount) return null;

  return <div className="reports-month-coverage">
    {parts.map((part) => <p key={part.key}>
      <span className={part.partial ? "reports-v4-badge reports-v4-badge--parcial" : "reports-v4-badge"}>{part.badge}</span>
      {" "}{part.text}
      {part.partial && <>{" "}<Button type="button" variant="secondary" onClick={() => onOpenDetail("ganancias")}>Ver estado del sistema</Button></>}
    </p>)}
    {withoutNetCount > 0 && <p>
      <span className="reports-v4-badge reports-v4-badge--parcial">Aviso</span>
      {" "}Hay {withoutNetCount} {withoutNetCount === 1 ? "documento confirmado sin neto válido, que no se suma" : "documentos confirmados sin neto válido, que no se suman"} en Ventas y Compras.
    </p>}
  </div>;
}

// Resumen mensual de Reportes (SPEC 025 §3): ventas, compras y ganancia del
// mes elegido con su comparación contra el mes anterior. Solo presenta cifras
// de reportModel y operationalNetProfit; no calcula dinero por su cuenta.
function ReportsMonthlySummary({
  canRegisterPurchase,
  canRegisterSale,
  canViewProfitability,
  canViewPurchases,
  canViewSales,
  currency,
  links,
  month,
  onMonthChange,
  onNavigate,
  onOpenDetail,
  onRetryProfit,
  previousProfit,
  previousSummary,
  profit,
  projects,
  summary,
  todayKey,
}) {
  const {locale} = useBusinessFormat();
  const inProgress = isMonthInProgress(month, todayKey);
  const previousMonthName = formatMonthName(shiftMonthKey(month, -1), locale);
  const groups = useMemo(
    () => buildMonthlySummaryGroups({summary, previousSummary, profit, previousProfit, canViewProfitability, currency, inProgress}),
    [canViewProfitability, currency, inProgress, previousProfit, previousSummary, profit, summary]
  );
  const hasCards = canViewSales || canViewPurchases || canViewProfitability;
  const coverage = groups.some((group) => group.profit?.coverage === "partial") ? "partial" : "other";
  // Sin base en ninguna tarjeta: una sola línea bajo el selector de mes.
  const showComparison = hasPreviousMonthBase(groups, {sales: canViewSales, purchases: canViewPurchases, profit: canViewProfitability});
  const withoutNetCount = (canViewSales ? summary.sales.withoutNetCount : 0) +
    (canViewPurchases ? summary.purchases.withoutNetCount : 0);

  return <>
    <div className="reports-month-nav" role="group" aria-label="Mes del resumen">
      <Button type="button" variant="secondary" icon={ChevronLeft} aria-label="Mes anterior" onClick={() => onMonthChange(shiftMonthKey(month, -1))} />
      <strong className="reports-month-nav__label">{formatMonthLabel(month, locale)}</strong>
      <Button type="button" variant="secondary" icon={ChevronRight} aria-label="Mes siguiente" disabled={!canShowNextMonth(month, todayKey)} onClick={() => onMonthChange(shiftMonthKey(month, 1))} />
    </div>
    {hasCards && !showComparison && <p className="reports-month-no-previous">{NO_PREVIOUS_MONTH_TEXT}</p>}

    {!hasCards && <div className="erp-card reports-simple-state">Tu perfil no incluye informes con cifras del mes.</div>}

    {hasCards && <div className="reports-simple-currencies">{groups.map((group) => {
      const money = (value) => formatMoney(value, group.currency, locale);
      const referenceOf = (metric) => metric.reference
        ? formatReferenceText(metric.reference, previousMonthName, money(metric.reference.amount))
        : null;
      return <section className="reports-simple-currency-group" key={group.currency}>
        {groups.length > 1 && <h2>{group.currency}</h2>}
        <div className="reports-simple-metrics reports-simple-metrics--3col">
          {canViewSales && <MonthlyCard comparison={showComparison ? group.sales.comparison : null} explanation={MONTHLY_EXPLANATIONS.sales} icon={BadgeDollarSign} locale={locale} onOpenDetail={links.sales ? () => onOpenDetail("ventas") : null} referenceText={showComparison ? referenceOf(group.sales) : null} title="Ventas">
            <strong className="reports-simple-card__amount">{money(group.sales.total)}</strong>
          </MonthlyCard>}
          {canViewPurchases && <MonthlyCard comparison={showComparison ? group.purchases.comparison : null} explanation={MONTHLY_EXPLANATIONS.purchases} icon={ShoppingCart} locale={locale} onOpenDetail={links.purchases ? () => onOpenDetail("compras") : null} referenceText={showComparison ? referenceOf(group.purchases) : null} title="Compras">
            <strong className="reports-simple-card__amount">{money(group.purchases.total)}</strong>
          </MonthlyCard>}
          {canViewProfitability && group.profit && <MonthlyCard comparison={showComparison && group.profit.status === "ready" ? group.profit.comparison : null} explanation={MONTHLY_EXPLANATIONS.profit} icon={TrendingUp} locale={locale} onOpenDetail={() => onOpenDetail("ganancias")} referenceText={showComparison && group.profit.status === "ready" ? referenceOf(group.profit) : null} signed title="Ganancia" variant="result">
            <ProfitAmount amountText={money(group.profit.amount)} onRetry={onRetryProfit} profit={group.profit} />
          </MonthlyCard>}
        </div>
      </section>;
    })}</div>}

    {hasCards && isMonthEmpty(groups) && <div className="erp-card reports-simple-state reports-month-empty">
      {inProgress ? <div>
        <strong>Aún no hay ventas confirmadas este mes</strong>
        <span>Registra tu primera venta o compra para ver aquí cómo va el negocio.</span>
      </div> : <div>
        <strong>No hubo ventas confirmadas en {formatMonthLabel(month, locale).toLocaleLowerCase(locale)}</strong>
      </div>}
      {inProgress && (canRegisterSale || canRegisterPurchase) && <div className="reports-month-actions">
        {canRegisterSale && <Button type="button" onClick={() => onNavigate("/ventas/nueva")}>Registrar venta</Button>}
        {canRegisterPurchase && <Button type="button" variant="secondary" onClick={() => onNavigate("/compras/nueva")}>Registrar compra</Button>}
      </div>}
    </div>}

    <ReportsMonthlyProjects canView={canViewProfitability} currency={currency} inProgress={inProgress} links={links} month={month} onNavigate={onNavigate} onRetry={onRetryProfit} profit={profit} projects={projects} />

    {hasCards && <CoverageLine canViewProfitability={canViewProfitability} coverage={coverage} onOpenDetail={onOpenDetail} withoutNetCount={withoutNetCount} />}
  </>;
}

export default ReportsMonthlySummary;
