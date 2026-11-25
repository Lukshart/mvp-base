import {BUSINESS_PERMISSIONS, hasBusinessPermission} from "../domain/rbac.mjs";
import React, {useCallback, useEffect, useRef, useState} from "react";
import {ArrowLeft, Ban, RefreshCw, Save} from "lucide-react";
import {useLocation, useNavigate, useParams} from "react-router-dom";
import Button from "../components/ui/Button";
import LoadingState from "../components/ui/LoadingState";
import ResponsiveDialog from "../components/ui/ResponsiveDialog";
import StatusBadge from "../components/ui/StatusBadge";
import ServicePlanningPanel from "../features/workOrders/ServicePlanningPanel";
import ApprovalPanel from "../features/workOrders/ApprovalPanel";
import WorkOrderPlazaControl from "../features/workOrders/WorkOrderPlazaControl";
import {
  getWorkOrderApprovalLabel,
  getWorkOrderApprovalVariant,
  getWorkOrderDisplayStatusLabel,
  getWorkOrderDisplayStatusVariant,
  isWorkOrderWaitingForPlaza,
} from "../domain/workOrderModel.mjs";
import {
  formatWorkOrderHistoryDate,
  getWorkOrderHistoryDetail,
  getWorkOrderHistoryEventLabel,
} from "../domain/workOrderHistoryModel.mjs";
import {
  buildReceptionMutationPayload,
  getReceptionFieldErrors,
  hasReceptionAnomaly,
  isReceptionChecklistComplete,
  MAX_RECEPTION_MILEAGE_KM,
  RECEPTION_CHECKLIST_FIELDS,
  RECEPTION_FUEL_LEVELS,
  receptionValuesFromStored,
} from "../domain/workOrderReceptionModel.mjs";
import {obtenerVehiculo} from "../services/vehicleService";
import {listarPlazasTaller} from "../services/workshopPlazaService";
import {
  createWorkOrderRequestId,
  ejecutarCierreOT,
  getWorkOrderErrorMessage,
  listarServiciosOT,
  obtenerHistorialOT,
  obtenerOrdenTrabajo,
  registrarRecepcionOrdenTrabajo,
} from "../services/workOrderService";




// Flujo único y predecible: Recepción → Aprobación → Ejecución → Entrega.
const FLOW_STEPS = Object.freeze([
  {id: "recepcion", label: "Recepción"},
  {id: "aprobacion", label: "Aprobación"},
  {id: "ejecucion", label: "Ejecución"},
  {id: "entrega", label: "Entrega"},
]);

function currentFlowStep(order) {
  if (!order.recepcion) return "recepcion";
  if (order.estado === "en_reparacion") return "ejecucion";
  if (["pendiente_entrega", "cerrada"].includes(order.estado)) return "entrega";
  if (order.estado === "cancelada") return "recepcion";
  return "aprobacion";
}

function DetailItem({label, value}) {
  return <div className="vehicle-detail-item"><dt>{label}</dt><dd>{value}</dd></div>;
}

function ReceptionField({children, error, label, required = false}) {
  return <label className="erp-field">
    <span className="erp-field__label">{label}{required ? " *" : ""}</span>
    {children}
    {error && <span className="work-order-field-error" role="alert">{error}</span>}
  </label>;
}

function ReceptionPanel({businessId, onSaved, order, otId, role}) {
  const [values, setValues] = useState(() => receptionValuesFromStored(order.recepcion));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const canOperate = hasBusinessPermission(role, BUSINESS_PERMISSIONS.TALLER_OPERATE) &&
    !["pendiente_entrega", "cerrada", "cancelada"].includes(order.estado);
  const checklistComplete = isReceptionChecklistComplete(values.checklist);
  const hasAnomaly = hasReceptionAnomaly(values.checklist);

  useEffect(() => {
    setValues(receptionValuesFromStored(order.recepcion));
    setErrors({});
    setServerError("");
  }, [order.recepcion]);

  const updateValue = (field, value) => {
    setValues((current) => ({...current, [field]: value}));
    setErrors((current) => ({...current, [field]: undefined}));
    setServerError("");
    setNotice("");
  };

  const updateChecklist = (field, value) => {
    setValues((current) => {
      const checklist = {...current.checklist, [field]: value};
      const complete = isReceptionChecklistComplete(checklist);
      const anomaly = hasReceptionAnomaly(checklist);
      return {
        ...current,
        checklist,
        danosObservados: complete
          ? anomaly
            ? current.danosObservados === "Ninguno" ? "" : current.danosObservados
            : "Ninguno"
          : current.danosObservados,
      };
    });
    setErrors((current) => ({...current, [field]: undefined, danosObservados: undefined}));
    setServerError("");
    setNotice("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const nextErrors = getReceptionFieldErrors(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setServerError("");
    setNotice("");
    const wasRegistered = Boolean(order.recepcion);
    try {
      await registrarRecepcionOrdenTrabajo(
        businessId,
        otId,
        buildReceptionMutationPayload(values),
      );
      // onSaved refresca la OT sin desmontar la pantalla, para que el aviso y la posición de scroll se conserven.
      await onSaved();
      setNotice(wasRegistered ? "Recepción actualizada correctamente." : "Recepción registrada correctamente.");
    } catch (saveError) {
      setServerError(getWorkOrderErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  if (!order.recepcion && !canOperate) return <section className="erp-panel" aria-labelledby="work-order-reception-title">
    <div className="erp-panel-header"><div><h2 id="work-order-reception-title" className="erp-panel-title">Recepción</h2><p className="erp-secondary-text">Registra las condiciones observables del vehículo al momento de su ingreso.</p></div></div>
    <div className="erp-empty-state">Aún no hay una recepción registrada.</div>
    <div className="vehicle-message vehicle-message--warning" role="status">No tienes permisos para registrar la recepción de esta OT.</div>
  </section>;

  return <section className="erp-panel" aria-labelledby="work-order-reception-title">
    <div className="erp-panel-header"><div><h2 id="work-order-reception-title" className="erp-panel-title">Recepción</h2><p className="erp-secondary-text">Registra condiciones observables. Esta checklist no reemplaza un diagnóstico mecánico.</p></div></div>
    {canOperate ? <form className="vehicle-form" onSubmit={submit} noValidate>
      <div className="work-order-reception-grid">
        <ReceptionField label="Kilometraje" error={errors.kilometraje} required><input className="erp-control" type="number" min="0" max={MAX_RECEPTION_MILEAGE_KM} step="1" value={values.kilometraje} onChange={(event) => updateValue("kilometraje", event.target.value)} /></ReceptionField>
        <ReceptionField label="Nivel de combustible" error={errors.nivelCombustible} required><select className="erp-control" value={values.nivelCombustible} onChange={(event) => updateValue("nivelCombustible", event.target.value)}><option value="">Selecciona una opción</option>{RECEPTION_FUEL_LEVELS.map((fuelLevel) => <option key={fuelLevel.value} value={fuelLevel.value}>{fuelLevel.label}</option>)}</select></ReceptionField>
        {RECEPTION_CHECKLIST_FIELDS.map((field) => <ReceptionField key={field.name} label={field.label} error={errors[field.name]} required><select className="erp-control" value={values.checklist[field.name]} onChange={(event) => updateChecklist(field.name, event.target.value)}><option value="">Selecciona una opción</option>{field.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></ReceptionField>)}
        <ReceptionField label="Daños u observaciones detectados" error={errors.danosObservados} required={checklistComplete && hasAnomaly}><textarea className="erp-control work-order-reception-textarea" disabled={checklistComplete && !hasAnomaly} maxLength={2000} value={values.danosObservados} onChange={(event) => updateValue("danosObservados", event.target.value)} placeholder={hasAnomaly ? "Describe la anomalía observada" : checklistComplete ? "Ninguno" : "Completa la checklist primero"} /></ReceptionField>
        <ReceptionField label="Accesorios entregados"><textarea className="erp-control work-order-reception-textarea" maxLength={6000} value={values.accesoriosTexto} onChange={(event) => updateValue("accesoriosTexto", event.target.value)} placeholder="Un accesorio por línea" /></ReceptionField>
        <ReceptionField label="Observaciones" ><textarea className="erp-control work-order-reception-textarea" maxLength={2000} value={values.observaciones} onChange={(event) => updateValue("observaciones", event.target.value)} /></ReceptionField>
      </div>
      {checklistComplete && <p className="erp-secondary-text">{hasAnomaly ? "Debes describir las anomalías detectadas antes de guardar." : "No se detectaron anomalías visibles: se registrará Ninguno."}</p>}
      {serverError && <div className="vehicle-message vehicle-message--error" role="alert">{serverError}</div>}
      {notice && <div className="vehicle-message" role="status">{notice}</div>}
      <div className="vehicle-form-actions"><Button type="submit" icon={Save} disabled={saving}>{saving ? "Guardando recepción..." : order.recepcion ? "Actualizar recepción" : "Registrar recepción"}</Button></div>
    </form> : <dl className="vehicle-detail-grid">
      <DetailItem label="Kilometraje" value={order.recepcion.kilometraje} />
      <DetailItem label="Nivel de combustible" value={order.recepcion.nivelCombustible} />
      {RECEPTION_CHECKLIST_FIELDS.map((field) => <DetailItem key={field.name} label={field.label} value={field.options.find(([value]) => value === order.recepcion.checklist?.[field.name])?.[1] || "No informado"} />)}
      <DetailItem label="Daños observados" value={order.recepcion.danosObservados} />
      <DetailItem label="Accesorios entregados" value={order.recepcion.accesorios?.join(", ") || "Ninguno"} />
      <DetailItem label="Observaciones" value={order.recepcion.observaciones || "Sin observaciones"} />
    </dl>}
  </section>;
}

export default function WorkOrderDetailPage({businessId, role}) {
  const {otId} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const creationFeedback = String(location.state?.feedback || "");
  const [order, setOrder] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [services, setServices] = useState([]);
  const [plazas, setPlazas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStep, setSelectedStep] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [closureTarget, setClosureTarget] = useState(null);
  const [closureBusy, setClosureBusy] = useState(false);
  const [closureNotice, setClosureNotice] = useState("");
  const [closureActionError, setClosureActionError] = useState("");
  const historyRequest = useRef(0);
  const canManage = hasBusinessPermission(role, BUSINESS_PERMISSIONS.TALLER_MANAGE);
  const canOperate = hasBusinessPermission(role, BUSINESS_PERMISSIONS.TALLER_OPERATE);

  const load = useCallback(async () => {
    if (!businessId || !otId) return;
    setLoading(true);
    setError("");
    try {
      const orderItem = await obtenerOrdenTrabajo(businessId, otId);
      if (!orderItem) {
        setOrder(null);
        setVehicle(null);
        setServices([]);
        setPlazas([]);
        return;
      }
      const [vehicleItem, serviceItems, plazaItems] = await Promise.all([
        obtenerVehiculo(businessId, orderItem.vehiculoId),
        listarServiciosOT(businessId, otId),
        listarPlazasTaller(businessId),
      ]);
      setOrder(orderItem);
      setSelectedStep(null);
      setVehicle(vehicleItem);
      setServices(serviceItems);
      setPlazas(plazaItems);
    } catch (loadError) {
      setError(getWorkOrderErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [businessId, otId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setClosureTarget(null);
    setClosureNotice("");
    setClosureActionError("");
  }, [businessId, otId]);

  const refreshHistory = useCallback(async () => {
    if (!businessId || !otId || !canManage) return;
    const request = ++historyRequest.current;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const events = await obtenerHistorialOT(businessId, otId);
      if (historyRequest.current === request) setHistoryEvents(events);
    } catch (loadError) {
      if (historyRequest.current === request) setHistoryError(getWorkOrderErrorMessage(loadError));
    } finally {
      if (historyRequest.current === request) setHistoryLoading(false);
    }
  }, [businessId, canManage, otId]);

  useEffect(() => {
    if (!canManage || !showHistory) return;
    void refreshHistory();
  }, [showHistory, refreshHistory]);

  // Refresca solo la OT (estado, recepción) sin la pantalla de carga completa de load().
  const refreshOrder = useCallback(async () => {
    const currentOrder = await obtenerOrdenTrabajo(businessId, otId);
    if (currentOrder) {
      setOrder(currentOrder);
      // Tras guardar la recepción se queda en ese paso para conservar el aviso; el stepper permite avanzar.
      setSelectedStep((current) => current || "recepcion");
    }
  }, [businessId, otId]);

  const refreshServices = useCallback(async () => {
    const [items, currentOrder] = await Promise.all([
      listarServiciosOT(businessId, otId), obtenerOrdenTrabajo(businessId, otId),
    ]);
    setServices(items);
    if (currentOrder) { setOrder(currentOrder); setSelectedStep(null); }
  }, [businessId, otId]);

  const confirmClosure = async () => {
    if (!closureTarget || closureBusy) return;
    setClosureBusy(true);
    setClosureActionError("");
    try {
      await ejecutarCierreOT(businessId, otId, closureTarget.action,
        closureTarget.revision, closureTarget.requestId);
      setClosureTarget(null);
      setClosureNotice(closureTarget.action === "finalizar"
        ? "Reparación finalizada. El vehículo está pendiente de entrega."
        : closureTarget.action === "entregar"
          ? "Entrega registrada. La OT quedó cerrada."
          : "Orden de trabajo cancelada.");
      await refreshServices();
      if (canManage) await refreshHistory();
    } catch (actionError) {
      setClosureActionError(getWorkOrderErrorMessage(actionError));
      if (String(actionError?.code || "").includes("aborted")) {
        setClosureTarget(null);
        try { await refreshServices(); } catch (refreshError) { setClosureActionError(getWorkOrderErrorMessage(refreshError)); }
      }
    } finally {
      setClosureBusy(false);
    }
  };

  if (loading) return <LoadingState variant="page" label="Cargando orden de trabajo..." />;
  if (error) return <main className="erp-page"><div className="vehicle-message vehicle-message--error" role="alert"><span>{error}</span><Button type="button" variant="secondary" icon={RefreshCw} onClick={load}>Reintentar</Button></div></main>;
  if (!order) return <main className="erp-page"><div className="erp-empty-state" role="status"><h2>Orden de trabajo no encontrada</h2><p>Puede no existir o no pertenecer al negocio activo.</p><Button type="button" variant="secondary" icon={ArrowLeft} onClick={() => navigate("/taller/ordenes")}>Volver a órdenes</Button></div></main>;

  const otLabel = order.numeroOT ? `la orden ${order.numeroOT}` : "esta orden";
  const flowStep = currentFlowStep(order);
  const activeStep = selectedStep || flowStep;
  const vehicleLabel = vehicle ? `${vehicle.marca} ${vehicle.modelo}` : "Vehículo no disponible";
  const plazaLabel = plazas.find((plaza) => plaza.plazaId === order.plazaId)?.nombre || "Sin asignar";
  const completedServices = services.filter((service) => service.estado === "completado").length;
  const allServicesCompleted = services.length > 0 && completedServices === services.length;
  const canCancel = canOperate && [
    "ingresada", "en_cola", "en_diagnostico", "esperando_aprobacion", "esperando_repuestos",
  ].includes(order.estado);

  const beginClosure = (action) => {
    setClosureActionError("");
    setClosureNotice("");
    setClosureTarget({action, revision: order.actualizadoEn?.toMillis?.(), requestId: createWorkOrderRequestId()});
  };

  return <main className="erp-page work-orders-page">
    <header className="erp-page-header">
      <div className="erp-page-header__content">
        <p className="erp-page-header__eyebrow">Taller · Órdenes de trabajo</p>
        <h1 className="erp-page-header__title">{order.numeroOT || "Orden de trabajo"}</h1>
        <p className="erp-page-header__description">{vehicleLabel} · {vehicle?.patente || "Patente no disponible"}</p>
        <div className="work-order-header-meta" aria-label="Estado actual de la orden">
          <StatusBadge variant={getWorkOrderDisplayStatusVariant(order)}>{getWorkOrderDisplayStatusLabel(order)}</StatusBadge>
          <StatusBadge variant={getWorkOrderApprovalVariant(order.estadoAprobacion)}>{getWorkOrderApprovalLabel(order.estadoAprobacion)}</StatusBadge>
          <StatusBadge variant="neutral">Plaza: {plazaLabel}</StatusBadge>
        </div>
      </div>
      <div className="erp-module-actions"><Button type="button" variant="secondary" icon={ArrowLeft} onClick={() => navigate("/taller/ordenes")}>Volver</Button><WorkOrderPlazaControl businessId={businessId} onChanged={load} order={order} plazas={plazas} role={role} />{canCancel && <Button type="button" variant="ghost-danger" icon={Ban} disabled={closureBusy} onClick={() => beginClosure("cancelar")}>Cancelar OT</Button>}</div>
    </header>

    {creationFeedback && <div className="vehicle-message" role="status">{creationFeedback}</div>}
    <nav aria-label="Pasos de la orden de trabajo"><ol className="work-order-steps">
      {FLOW_STEPS.map((step, index) => <li key={step.id}><button type="button" aria-current={activeStep === step.id ? "step" : undefined}
        data-done={FLOW_STEPS.findIndex((item) => item.id === flowStep) > index ? "true" : undefined}
        onClick={() => setSelectedStep(step.id)}><span className="work-order-steps__number">{index + 1}</span>{step.label}</button></li>)}
    </ol></nav>

    {activeStep === "recepcion" && <ReceptionPanel businessId={businessId} onSaved={refreshOrder} order={order} otId={otId} role={role} />}
    {activeStep === "aprobacion" && (order.recepcion
      ? <ApprovalPanel businessId={businessId} otId={otId} order={order} onChanged={refreshServices} />
      : <div className="erp-empty-state" role="status">Registra la recepción para poder aprobar el ingreso.</div>)}
    {activeStep === "ejecucion" && (order.estado === "en_reparacion"
      ? <ServicePlanningPanel businessId={businessId}
        canFinalizeWorkOrder={canOperate && order.estado === "en_reparacion" && allServicesCompleted && !closureBusy}
        onChanged={refreshServices}
        onFinalizeWorkOrder={canOperate ? () => beginClosure("finalizar") : null}
        order={order} otId={otId} role={role} services={services} />
      : <div className="erp-empty-state" role="status">{isWorkOrderWaitingForPlaza(order)
        ? "Ingreso aprobado. La ejecución comienza cuando se asigne una plaza."
        : "La ejecución comienza cuando el ingreso está aprobado."}</div>)}
    {activeStep === "entrega" && <section className="erp-panel" aria-labelledby="work-order-delivery-title">
      <div className="erp-panel-header"><div><h2 id="work-order-delivery-title" className="erp-panel-title">Entrega</h2><p className="erp-secondary-text">Cierra la orden cuando el cliente retira el vehículo.</p></div></div>
      {order.estado === "pendiente_entrega"
        ? <div className="vehicle-message vehicle-message--warning work-order-delivery-notice" role="status">
          <strong>Vehículo listo para entrega.</strong>
          {canOperate && <Button type="button" disabled={closureBusy} onClick={() => beginClosure("entregar")}>Registrar entrega</Button>}
        </div>
        : order.estado === "cerrada"
          ? <div className="vehicle-message" role="status">Entrega registrada. La OT está cerrada.</div>
          : <div className="erp-empty-state" role="status">El vehículo estará listo para entrega al finalizar la ejecución.</div>}
    </section>}
    {canManage && <div className="vehicle-form-actions"><Button type="button" variant="secondary" onClick={() => setShowHistory((value) => !value)}>{showHistory ? "Ocultar historial" : "Ver historial"}</Button></div>}
    {canManage && showHistory && <section className="erp-panel" aria-labelledby="work-order-history-title">
      <div className="erp-panel-header"><div><h2 id="work-order-history-title" className="erp-panel-title">Historial</h2><p className="erp-secondary-text">Eventos registrados de la orden de trabajo.</p></div></div>
      {historyLoading && <LoadingState variant="section" label="Cargando historial..." />}
      {historyError && <div className="vehicle-message vehicle-message--error" role="alert">{historyError} <Button type="button" variant="secondary" onClick={refreshHistory}>Reintentar</Button></div>}
      {!historyLoading && !historyError && (historyEvents.length
        ? <ol className="work-order-history-list">{historyEvents.map((event) => { const detail = getWorkOrderHistoryDetail(event); return <li key={event.eventoId} className="work-order-history-event"><time>{formatWorkOrderHistoryDate(event.fecha)}</time><div><h3>{getWorkOrderHistoryEventLabel(event.tipo)}</h3><p>{event.actorNombre || "Usuario no disponible"}</p>{detail && <p className="erp-secondary-text">{detail}</p>}</div></li>; })}</ol>
        : <div className="erp-empty-state">Aún no hay eventos registrados para esta OT.</div>)}
    </section>}
    <ResponsiveDialog open={Boolean(closureTarget)} onClose={() => !closureBusy && setClosureTarget(null)} size="small" eyebrow="Taller"
      title={closureTarget?.action === "finalizar" ? "Finalizar orden de trabajo" : closureTarget?.action === "entregar" ? "Registrar entrega" : "Cancelar orden de trabajo"}
      description={closureTarget?.action === "finalizar" ? "Se comprobará que todos los servicios estén completados." : closureTarget?.action === "entregar" ? "Se registrará la entrega física y la OT quedará cerrada." : "La OT quedará cancelada de forma permanente y se liberará su Plaza, si corresponde."}
      footer={<><Button type="button" variant="secondary" disabled={closureBusy} onClick={() => setClosureTarget(null)}>Volver</Button><Button type="button" variant={closureTarget?.action === "cancelar" ? "danger" : "primary"} disabled={closureBusy} onClick={confirmClosure}>{closureBusy ? "Procesando..." : closureTarget?.action === "cancelar" ? "Cancelar OT" : "Confirmar"}</Button></>}>
      <p>{closureTarget?.action === "finalizar"
        ? `¿Confirmas que la reparación de ${otLabel} está terminada? Todos los servicios están completados y el vehículo quedará pendiente de entrega.`
        : closureTarget?.action === "entregar"
          ? `¿Confirmas que el vehículo de ${otLabel} fue entregado al cliente? La OT quedará cerrada.`
          : `¿Confirmas que quieres cancelar ${otLabel}? Esta acción no se puede deshacer.`}</p>
      {closureActionError && <div className="vehicle-message vehicle-message--error" role="alert">{closureActionError}</div>}
    </ResponsiveDialog>
  </main>;
}
