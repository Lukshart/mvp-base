import React, {useMemo} from "react";
import {MonthlyOperationalProfitChart} from "../../../components/reports/OperationalProfitCharts";
import {OperationalNetProfitBreakdown, OperationalSystemStatus, visibleOperationalGroups} from "../OperationalNetProfitBreakdown";
import {buildMonthlyOperationalProfit} from "../operationalNetProfitCharts.mjs";

// Vista de Ganancia (SPEC 022 §6.5, simplificada en SPEC 025): el desglose de
// la ganancia, su evolución mensual y, al final, el estado del sistema solo si
// hay alertas. La única suma es la que entrega el helper de dominio; esta vista
// no combina bloques por su cuenta.
function ReportsGananciasView({currency, links, navigate, operationalProfit, profitabilityV4, range}) {
  const {commercial, projects} = profitabilityV4;
  const monthly = useMemo(() => {
    if (operationalProfit.status !== "ready") return null;
    return buildMonthlyOperationalProfit({
      sales: commercial.meta?.items || [],
      projectBalances: projects.meta?.proyectos || [],
      range,
      currency,
      salesTruncated: Boolean(commercial.meta?.lecturaTruncada),
      projectsError: projects.status === "error",
    });
  }, [commercial, currency, operationalProfit.status, projects, range]);

  if (!profitabilityV4.canView) {
    return <div className="erp-card reports-simple-state">Tu perfil no incluye información de ganancias.</div>;
  }

  const result = operationalProfit.status === "ready" ? operationalProfit.result : null;
  const hasAlerts = Boolean(result) && (
    visibleOperationalGroups(result, currency).some((group) => group.alertas.length) ||
    result.alertasGenerales.length > 0
  );

  return <>
    <section className="erp-card reports-detail-section reports-plain-headings">
      <div className="reports-section-heading"><div><span>Ganancia</span><h2>Ganancia del período</h2><p>Ventas sin proyecto y proyectos del período, cada venta contada una sola vez.</p></div></div>
      <OperationalNetProfitBreakdown canView={profitabilityV4.canView} currency={currency} onRetry={profitabilityV4.reload} state={operationalProfit} />
    </section>

    {monthly && monthly.map((group) => <section className="erp-card reports-detail-section reports-plain-headings" key={`monthly-${group.moneda}`}>
      <div className="reports-section-heading"><div><span>{group.moneda}</span><h2>Evolución mensual</h2><p>Ganancia por mes, en sus dos componentes.</p></div></div>
      <MonthlyOperationalProfitChart currency={group.moneda} months={group.meses} />
      {group.meses.some((month) => month.parcial) && <p className="reports-v4-note">* Mes con cobertura parcial: revisa el estado del sistema al final de esta página.</p>}
    </section>)}

    {hasAlerts && <section className="erp-card reports-detail-section reports-plain-headings">
      <div className="reports-section-heading"><div><span>Estado</span><h2>Estado del sistema</h2><p>Registros que se excluyen de la ganancia o que la dejan parcial.</p></div></div>
      <OperationalSystemStatus canView={profitabilityV4.canView} currency={currency} links={links} onNavigate={navigate} state={operationalProfit} />
    </section>}
  </>;
}

export default ReportsGananciasView;
