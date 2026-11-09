import {
  classifyOperationalProject,
  OPERATIONAL_NET_PROFIT_COVERAGE as COVERAGE,
} from "./operationalNetProfit.mjs";

// SPEC 025 etapa 3: resumen mensual de Reportes. Este módulo solo resuelve
// meses, comparación porcentual y cobertura; las cifras vienen de reportModel
// (ventas y compras en neto) y de operationalNetProfit (ganancia). No calcula
// ningún monto por su cuenta.

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const MONTHLY_EXPLANATIONS = Object.freeze({
  sales: "Confirmadas, sin IVA.",
  purchases: "Confirmadas, sin IVA. Incluye stock aún no vendido.",
  profit: "Lo vendido menos su costo, más lo que dejaron los proyectos.",
});

export const NO_PREVIOUS_MONTH_TEXT = "Sin datos del mes anterior para comparar";

export function currentMonthKey(todayKey) {
  return String(todayKey || "").slice(0, 7);
}

// Un mes inválido o posterior al actual cae al mes actual.
export function normalizeMonthKey(value, todayKey) {
  const current = currentMonthKey(todayKey);
  const month = String(value || "").trim();
  return MONTH_PATTERN.test(month) && month <= current ? month : current;
}

export function shiftMonthKey(monthKey, delta) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + Number(delta || 0), 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function canShowNextMonth(monthKey, todayKey) {
  return monthKey < currentMonthKey(todayKey);
}

// El mes en curso aún no termina: compararlo en porcentaje contra el mes
// anterior completo induce a error (el día 15 mostraría "50 % menos").
export function isMonthInProgress(monthKey, todayKey) {
  return monthKey >= currentMonthKey(todayKey);
}

export function getMonthRange(monthKey) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: `${monthKey}-01`,
    end: `${monthKey}-${String(days).padStart(2, "0")}`,
    days,
    period: "month",
  };
}

export function formatMonthLabel(monthKey, locale = "es-CL") {
  const [year, month] = String(monthKey).split("-").map(Number);
  const label = new Intl.DateTimeFormat(locale, {month: "long", year: "numeric", timeZone: "UTC"})
    .format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

// Solo el nombre del mes ("Septiembre"), para la referencia del mes anterior.
export function formatMonthName(monthKey, locale = "es-CL") {
  const [year, month] = String(monthKey).split("-").map(Number);
  const name = new Intl.DateTimeFormat(locale, {month: "long", timeZone: "UTC"})
    .format(new Date(Date.UTC(year, month - 1, 1)));
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

// Referencia del mes anterior completo, sin porcentaje. Sin base (valor
// ausente) no hay monto que mostrar.
export function buildPreviousMonthReference(previousAmount) {
  return typeof previousAmount === "number" && Number.isFinite(previousAmount)
    ? {hasBase: true, amount: previousAmount}
    : {hasBase: false, amount: null};
}

export function formatReferenceText(reference, previousMonthName, formattedAmount) {
  return reference?.hasBase ? `${previousMonthName} completo: ${formattedAmount}` : NO_PREVIOUS_MONTH_TEXT;
}

// Sin base de comparación (mes anterior ausente, cero o no numérico) no hay
// porcentaje: nunca se divide por cero ni se inventa una variación.
export function compareWithPreviousMonth(current, previous) {
  const now = typeof current === "number" ? current : Number.NaN;
  const before = typeof previous === "number" ? previous : Number.NaN;
  if (!Number.isFinite(now) || !Number.isFinite(before) || before === 0) {
    return {hasBase: false, percent: null, direction: "none"};
  }
  const percent = Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
  return {hasBase: true, percent, direction: percent > 0 ? "up" : percent < 0 ? "down" : "flat"};
}

export function formatComparisonText(comparison, locale = "es-CL") {
  if (!comparison?.hasBase) return NO_PREVIOUS_MONTH_TEXT;
  if (comparison.direction === "flat") return "Sin variación frente al mes anterior";
  const amount = Math.abs(comparison.percent).toLocaleString(locale, {maximumFractionDigits: 1});
  return `${amount} % ${comparison.direction === "up" ? "más" : "menos"} que el mes anterior`;
}

function profitGroups(profit, currency) {
  const groups = profit?.status === "ready" ? profit.result?.grupos || [] : [];
  return groups.filter((group) => group.moneda && (!currency || currency === "todos" || group.moneda === currency));
}

// Resume la cobertura de la ganancia del mes entre las monedas visibles.
export function summarizeProfitCoverage(profit, currency = "todos") {
  if (profit?.status !== "ready") return "pending";
  const groups = profitGroups(profit, currency);
  if (groups.some((group) => group.cobertura === COVERAGE.PARTIAL)) return "partial";
  if (groups.some((group) => group.cobertura === COVERAGE.COMPLETE)) return "complete";
  return "empty";
}

// Una fila por moneda con lo que pintan las tres tarjetas. `summary` y
// `previousSummary` salen de getSimplifiedReportSummary; `profit` y
// `previousProfit` salen de useOperationalNetProfit (estado + resultado).
// Con `inProgress` (mes actual) no hay porcentaje: cada métrica trae un
// `reference` con el total del mes anterior completo. Con el mes ya cerrado
// trae `comparison` en porcentaje y `reference` es null.
export function buildMonthlySummaryGroups({
  summary,
  previousSummary,
  profit,
  previousProfit,
  canViewProfitability = true,
  currency = "todos",
  inProgress = false,
}) {
  const NO_PERCENT = {hasBase: false, percent: null, direction: "none"};
  // `comparison` y `reference` según el estado del mes elegido.
  const compareOrRefer = (current, previousAmount) => inProgress
    ? {comparison: NO_PERCENT, reference: buildPreviousMonthReference(previousAmount)}
    : {comparison: compareWithPreviousMonth(current, previousAmount), reference: null};
  const known = new Set(summary.currencies.map((entry) => entry.currency));
  const extra = canViewProfitability
    ? profitGroups(profit, currency).map((group) => group.moneda).filter((code) => !known.has(code))
    : [];
  const empty = (code) => ({currency: code, sales: {count: 0, total: 0}, purchases: {count: 0, total: 0}});
  const rows = [...summary.currencies, ...extra.map(empty)]
    .sort((left, right) => left.currency.localeCompare(right.currency));
  const find = (source, code) => source?.currencies.find((entry) => entry.currency === code);

  return rows.map((group) => {
    const previous = find(previousSummary, group.currency);
    // Sin operaciones el mes anterior no hay base, aunque el total sea 0.
    const baseOf = (before) => before?.count > 0 ? before.total : null;
    const row = {
      currency: group.currency,
      sales: {
        count: group.sales.count,
        total: group.sales.total,
        ...compareOrRefer(group.sales.total, baseOf(previous?.sales)),
      },
      purchases: {
        count: group.purchases.count,
        total: group.purchases.total,
        ...compareOrRefer(group.purchases.total, baseOf(previous?.purchases)),
      },
      profit: null,
    };
    if (!canViewProfitability) return row;

    const ready = profit?.status === "ready";
    const current = profitGroups(profit, group.currency)[0];
    const before = profitGroups(previousProfit, group.currency)[0];
    const amount = ready ? current?.gananciaNetaOperacional ?? 0 : null;
    row.profit = {
      status: profit?.status || "loading",
      error: profit?.error || "",
      amount,
      coverage: summarizeProfitCoverage(profit, group.currency),
      // La referencia de la ganancia solo existe con la ganancia anterior lista.
      ...compareOrRefer(amount, previousProfit?.status === "ready" ? before?.gananciaNetaOperacional : null),
    };
    return row;
  });
}

// ¿Alguna tarjeta visible tiene base del mes anterior? Si ninguna la tiene, la
// pantalla muestra una sola línea "Sin datos del mes anterior para comparar"
// en vez de repetirla en cada tarjeta. La ganancia solo cuenta cuando está lista.
export function hasPreviousMonthBase(groups, {sales = true, purchases = true, profit = true} = {}) {
  const baseOf = (metric) => Boolean(metric && (metric.reference ? metric.reference.hasBase : metric.comparison?.hasBase));
  return groups.some((group) =>
    (sales && baseOf(group.sales)) ||
    (purchases && baseOf(group.purchases)) ||
    (profit && group.profit?.status === "ready" && baseOf(group.profit))
  );
}

// Vacío del primer día: ningún dato visible del mes. Mientras la ganancia se
// calcula o falla no se declara vacío, para no confundir un fallo con "no hay".
export function isMonthEmpty(groups) {
  return groups.every((group) =>
    group.sales.count === 0 &&
    group.purchases.count === 0 &&
    (!group.profit || (group.profit.status === "ready" && group.profit.coverage === "empty"))
  );
}

// --- Proyectos del mes (SPEC 025 §3) ---
// Lista de proyectos con movimiento en el mes elegido. No calcula dinero nuevo:
// toma el `resultado` mensual de `desglosePorMes` de cada balance, con el mismo
// criterio de proyecto incluible y de mes que calculateOperationalNetProfit, así
// que la suma de la lista es el "Resultado de proyectos" de la pestaña Ganancia.

export const PROJECT_RESULT_STATUS = Object.freeze({
  LOSING: "PERDIENDO",
  WINNING: "GANANDO",
  NEUTRAL: "SIN_RESULTADO",
});

const PROJECT_RESULT_LABELS = Object.freeze({
  [PROJECT_RESULT_STATUS.LOSING]: "Perdiendo",
  [PROJECT_RESULT_STATUS.WINNING]: "Ganando",
  [PROJECT_RESULT_STATUS.NEUTRAL]: "Sin resultado",
});

export function projectResultLabel(status) {
  return PROJECT_RESULT_LABELS[status] || PROJECT_RESULT_LABELS[PROJECT_RESULT_STATUS.NEUTRAL];
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function projectResultStatus(result) {
  if (result < 0) return PROJECT_RESULT_STATUS.LOSING;
  if (result > 0) return PROJECT_RESULT_STATUS.WINNING;
  return PROJECT_RESULT_STATUS.NEUTRAL;
}

// Pierden primero (el peor al comienzo), luego los que ganan (el mayor primero)
// y al final los de resultado 0. Empates por título y número para que el orden
// sea estable.
const STATUS_RANK = Object.freeze({
  [PROJECT_RESULT_STATUS.LOSING]: 0,
  [PROJECT_RESULT_STATUS.WINNING]: 1,
  [PROJECT_RESULT_STATUS.NEUTRAL]: 2,
});

export function compareProjectResultRows(left, right) {
  return left.moneda.localeCompare(right.moneda) ||
    STATUS_RANK[left.estado] - STATUS_RANK[right.estado] ||
    (left.estado === PROJECT_RESULT_STATUS.LOSING ? left.resultado - right.resultado : right.resultado - left.resultado) ||
    left.titulo.localeCompare(right.titulo, "es") ||
    left.numero.localeCompare(right.numero, "es");
}

// `projects` son las entradas de `projects.meta.proyectos` del hook de
// rentabilidad: el trabajo con su `balance`. Un proyecto no incluible (misma
// regla que la ganancia) no tiene resultado confiable: no se lista y se cuenta
// en `incompletos` si tuvo movimiento ese mes.
export function buildMonthlyProjectResults({projects = [], month, currency = "todos"} = {}) {
  const rows = [];
  let incomplete = 0;
  (Array.isArray(projects) ? projects : []).forEach((entry) => {
    const months = Array.isArray(entry?.balance?.desglosePorMes)
      ? entry.balance.desglosePorMes.filter((item) => item?.mes === month)
      : [];
    const classification = classifyOperationalProject(entry);
    const filtered = currency && currency !== "todos" && classification.moneda && classification.moneda !== currency;
    if (!classification.incluible) {
      if (months.length && !filtered) incomplete += 1;
      return;
    }
    if (filtered) return;
    const monthRows = months.filter((item) => item.moneda === classification.moneda);
    if (!monthRows.length) return;
    const result = roundMoney(monthRows.reduce((total, item) => total + item.resultado, 0));
    rows.push({
      id: classification.proyectoId,
      numero: String(entry.numero || ""),
      titulo: String(entry.titulo || "").trim() || "Proyecto sin título",
      cliente: String(entry.clienteSnapshot?.nombreRazonSocial || "").trim(),
      moneda: classification.moneda,
      resultado: result,
      estado: projectResultStatus(result),
    });
  });
  return {filas: rows.sort(compareProjectResultRows), incompletos: incomplete};
}

// Monto de servicios vendidos sin proyecto del mes, por moneda, tal como lo
// entrega calculateOperationalNetProfit (`ventasSinCostoRegistrado`). Solo las
// monedas con monto mayor que 0.
export function buildServicesWithoutProjectNotices(profit, currency = "todos") {
  const groups = profit?.status === "ready" ? profit.result?.grupos || [] : [];
  return groups
    .filter((group) => group.moneda && (!currency || currency === "todos" || group.moneda === currency))
    .map((group) => ({moneda: group.moneda, monto: group.ventasSinCostoRegistrado?.monto}))
    .filter((notice) => Number.isFinite(notice.monto) && notice.monto > 0);
}
