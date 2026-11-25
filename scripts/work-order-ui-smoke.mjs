import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/app/App.jsx", "utf8");
assert.match(app, /path="\/taller\/ordenes"/);
assert.match(app, /<WorkOrdersPage/);
assert.match(app, /<NewWorkOrderPage/);
assert.match(app, /path="\/taller\/ordenes\/:otId"/);
assert.match(app, /<WorkOrderDetailPage/);
assert.match(app, /path="\/taller\/plazas"/);
assert.match(app, /<WorkshopPlazasPage/);

const list = fs.readFileSync("src/pages/WorkOrdersPage.jsx", "utf8");
for (const column of [
  "Número OT",
  "Patente",
  "Vehículo",
  "Estado",
  "Aprobación",
  "Plaza",
  "Actualización",
]) {
  assert.match(list, new RegExp(column));
}
assert.match(list, /matchesWorkOrderSearch/);
assert.match(list, /listarOrdenesTrabajo/);
assert.match(list, /className="erp-module-intro"/);
assert.match(list, /placeholder=\{countryCopy\.workOrderSearchExample\}/);
assert.match(list, /formatDate\(order\.actualizadoEn, locale\)/);
assert.doesNotMatch(list, /Cliente histórico|listarClientes|clientsById/);

const creation = fs.readFileSync("src/pages/NewWorkOrderPage.jsx", "utf8");
assert.match(creation, /normalizeVehiclePlate/);
assert.match(creation, /listarVehiculos/);
assert.match(creation, /listarClientesSeleccionablesTaller/);
assert.match(creation, /hasBusinessPermission\(role, BUSINESS_PERMISSIONS.TALLER_CREATE\)/);
assert.match(creation, /if \(!normalizedSearch\) return vehicles/);
assert.match(creation, /Vehículos disponibles/);
assert.match(creation, /Crear vehículo/);
assert.match(creation, /\/taller\/vehiculos\/nuevo/);
assert.match(creation, /createWorkOrderRequestId/);
// Al crear la OT se abre su ficha directamente.
assert.match(creation, /navigate\(`\/taller\/ordenes\/\$\{order\.otId\}`/);
assert.doesNotMatch(creation, /numeroOT\s*:/);
assert.doesNotMatch(creation, /clienteId\s*:/);

const detail = fs.readFileSync("src/pages/WorkOrderDetailPage.jsx", "utf8");
// Flujo único sin pestañas: Recepción → Aprobación → Ejecución → Entrega.
for (const step of ["Recepción", "Aprobación", "Ejecución", "Entrega"]) {
  assert.match(detail, new RegExp(`label: "${step}"`));
}
assert.doesNotMatch(detail, /role="tablist"|role="tab"|<DiagnosisPanel/);
assert.match(detail, /aria-current=\{activeStep === step\.id \? "step" : undefined\}/);
assert.match(detail, /obtenerOrdenTrabajo/);
assert.match(detail, /order\.plazaId/);
assert.match(detail, /getWorkOrderDisplayStatusLabel/);
assert.match(detail, /getWorkOrderApprovalLabel/);
assert.match(detail, /RECEPTION_CHECKLIST_FIELDS/);
assert.match(detail, /RECEPTION_FUEL_LEVELS/);
assert.match(detail, /max=\{MAX_RECEPTION_MILEAGE_KM\}/);
assert.match(detail, /Selecciona una opción/);
assert.match(detail, /registrarRecepcionOrdenTrabajo/);
assert.match(detail, /<ServicePlanningPanel/);
assert.match(detail, /<ApprovalPanel/);
assert.match(detail, /<WorkOrderPlazaControl/);
assert.match(detail, /listarPlazasTaller/);
assert.match(detail, /plazas\.find\(\(plaza\) => plaza\.plazaId === order\.plazaId\)\?\.nombre \|\| "Sin asignar"/);
assert.match(detail, /Finalizar orden de trabajo/);
assert.match(detail, /Registrar entrega/);
assert.match(detail, /Cancelar OT/);
assert.match(detail, /beginClosure\("cancelar"\)/);
assert.match(detail, /allServicesCompleted/);
assert.match(detail, /ejecutarCierreOT/);
assert.match(detail, /obtenerHistorialOT/);
assert.match(detail, /const canManage = hasBusinessPermission\(role, BUSINESS_PERMISSIONS\.TALLER_MANAGE\)/);
assert.match(detail, /canManage && showHistory/);
assert.doesNotMatch(detail, /Cliente histórico|listarClientes|clientLabel/);
assert.match(detail, /work-order-history-list/);
assert.match(detail, /getWorkOrderHistoryEventLabel/);
assert.match(detail, /getWorkOrderHistoryDetail/);
assert.match(detail, /ResponsiveDialog/);
assert.match(detail, /\["pendiente_entrega", "cerrada", "cancelada"\]\.includes\(order\.estado\)/);
assert.doesNotMatch(detail, /updateDoc|setDoc|pendiente_pago/);
const historyModel = fs.readFileSync("src/domain/workOrderHistoryModel.mjs", "utf8");
for (const event of ["ot_creada", "recepcion_registrada", "diagnostico_completado", "vehiculo_entregado", "ot_cancelada"]) {
  assert.match(historyModel, new RegExp(event));
}
assert.doesNotMatch(historyModel, /costoUnitario|costoTotal|scopeHash/);
const plazasPage = fs.readFileSync("src/pages/WorkshopPlazasPage.jsx", "utf8");
for (const text of ["Nombre", "Estado", "Ocupación actual", "OT asignada", "Vehículo asignado", "Disponible", "En uso", "Nueva Plaza", "Editar", "Activar", "Inactivar"]) {
  assert.ok(plazasPage.includes(text));
}
assert.match(plazasPage, /deriveWorkshopPlazaOccupancy/);
assert.match(plazasPage, /canManageWorkshopPlazas/);
assert.match(plazasPage, /if \(canManage\) load\(\)/);
assert.match(plazasPage, /if \(!canManage\)/);
assert.match(plazasPage, /El acceso a Plazas está restringido para tu perfil/);
assert.match(plazasPage, /Propietario o Administrador pueden administrar esta sección/);
assert.doesNotMatch(plazasPage, /OWNER o ADMIN/);
assert.match(plazasPage, /erp-table/);
assert.match(plazasPage, /erp-card-list erp-mobile-only/);
assert.match(plazasPage, /className="erp-module-intro"/);
assert.doesNotMatch(plazasPage, /className="erp-page-header"/);
assert.doesNotMatch(plazasPage, /setDoc|updateDoc|estado:\s*["'](?:ocupada|disponible)["']/);
const plazaControl = fs.readFileSync("src/features/workOrders/WorkOrderPlazaControl.jsx", "utf8");
assert.match(plazaControl, /Asignar Plaza/);
assert.match(plazaControl, /Cambiar Plaza/);
assert.match(plazaControl, /Liberar Plaza/);
assert.match(plazaControl, /plaza\.estado !== "activa"/);
assert.doesNotMatch(plazaControl, /setDoc|updateDoc/);
const approvalPanel = fs.readFileSync("src/features/workOrders/ApprovalPanel.jsx", "utf8");
for (const action of ["Aprobar ingreso", "Rechazar ingreso"]) {
  assert.ok(approvalPanel.includes(action));
}
assert.match(approvalPanel, /summary\.puedeAprobar/);
// Compuerta de ingreso: motivo obligatorio al rechazar, sin alcance, totales ni montos.
assert.match(approvalPanel, /Motivo \*/);
assert.doesNotMatch(approvalPanel, /Motivo \(opcional\)/);
assert.match(approvalPanel, /confirmation\.action === "rechazar" && !reason\.trim\(\)/);
assert.doesNotMatch(approvalPanel, /Enviar a aprobación|Revalidar|summary\.alcance|calculateWorkOrderScopeTotal|precioUnitario|Subtotal|<th>Precio<\/th>|amount\(|formatBusinessMoney/);
assert.match(approvalPanel, /ResponsiveDialog/);
assert.match(approvalPanel, /<LoadingState variant="section" label="Cargando aprobación\.\.\." \/>/);
assert.match(approvalPanel, /confirmation\.revision/);
assert.doesNotMatch(approvalPanel, /erp-empty-state" role="status">Cargando/);
assert.doesNotMatch(approvalPanel, /setDoc|updateDoc|<select|type="number"/);
const diagnosisPanel = fs.readFileSync("src/features/workOrders/DiagnosisPanel.jsx", "utf8");
assert.match(diagnosisPanel, /Guardar borrador/);
assert.match(diagnosisPanel, /Completar diagnóstico/);
assert.match(diagnosisPanel, /diagnosis\.estado === "borrador"/);
assert.match(diagnosisPanel, /"pendiente_entrega", "cerrada", "cancelada"/);
assert.match(diagnosisPanel, /useBusinessFormat/);
assert.match(diagnosisPanel, /formatTimestamp\(value, locale\)/);
assert.doesNotMatch(diagnosisPanel, /toLocaleString\("es-CL"/);
const planningPanel = fs.readFileSync("src/features/workOrders/ServicePlanningPanel.jsx", "utf8");
const workOrderService = fs.readFileSync("src/services/workOrderService.js", "utf8");
assert.match(planningPanel, /listarCatalogoTaller/);
assert.match(planningPanel, /<LoadingState variant="section" label="Cargando catálogo y responsables\.\.\." \/>/);
assert.doesNotMatch(planningPanel, /erp-empty-state" role="status">Cargando catálogo y responsables/);
assert.doesNotMatch(planningPanel, /getInventoryItems/);
assert.match(planningPanel, /tipoItem === "servicio"/);
assert.match(planningPanel, /tipoItem === "producto"/);
assert.match(planningPanel, /cantidad planificada/i);
assert.match(planningPanel, /Stock actual:/);
// El taller no muestra montos: ni valores de servicio, ni precios, ni subtotales.
assert.doesNotMatch(planningPanel, /Valor Servicio|Precio vigente|priceLabel|currentPrice|precioEfectivo|formatBusinessMoney|Intl\.NumberFormat/);
assert.doesNotMatch(planningPanel, /Esto retirará la solicitud de aprobación/);
assert.match(planningPanel, /withScopeWarning\(/);
assert.match(planningPanel, /const cancelProduct = \(\) => \{ setProductServiceId\(null\); setError\(""\); \}/);
assert.match(planningPanel, /Iniciar servicio/);
assert.match(planningPanel, /Completar servicio/);
assert.match(planningPanel, /Eliminar servicio/);
assert.match(planningPanel, /Agregar servicio/);
assert.match(planningPanel, /Finalizar orden de trabajo/);
assert.match(planningPanel, /canFinalizeWorkOrder/);
assert.match(planningPanel, /className="work-order-finalize-button"/);
assert.match(planningPanel, /eliminarServicioOT/);
assert.match(planningPanel, /service\.estado === "pendiente"/);
assert.match(planningPanel, /service\.estado === "en_progreso"/);
assert.match(planningPanel, /order\.estado === "en_reparacion" && order\.estadoAprobacion === "aprobada"/);
assert.doesNotMatch(planningPanel, /Productos planificados/);
assert.doesNotMatch(planningPanel, /<th>Stock actual<\/th>/);
assert.match(planningPanel, /type="number" min="1" step="1"/);
assert.doesNotMatch(planningPanel, /type="number"[^>]*precio/);
assert.match(planningPanel, /className="erp-table work-order-products-table"/);
assert.match(planningPanel, /<th>Producto<\/th><th>Cantidad<\/th>/);
assert.doesNotMatch(planningPanel, /<th>Precio<\/th>/);
assert.match(planningPanel, /Sin productos planificados/);
assert.doesNotMatch(planningPanel, /ServiceMaterialsPanel|obtenerMaterialesOT|Registrar consumo|Registrar devolución|movimientos de inventario/);
assert.doesNotMatch(workOrderService, /registrarSalidaMaterialOT|registrarDevolucionMaterialOT|obtenerMaterialesOT/);
assert.doesNotMatch(approvalPanel, /work-order-approval-table/);
assert.match(approvalPanel, /work-order-approval-actions/);
const tallerStyles = fs.readFileSync("src/features/taller/taller.css", "utf8");
const interiorStyles = fs.readFileSync("src/styles/interior.css", "utf8");
assert.match(tallerStyles, /\.work-order-products-table__quantity/);
assert.doesNotMatch(tallerStyles, /\.work-order-material-history/);
assert.doesNotMatch(interiorStyles, /\.work-order-products-table__quantity/);
assert.doesNotMatch(detail, /value=\{order\.estado\}/);
assert.match(detail, /Recepción registrada correctamente\./);
assert.match(detail, /onSaved=\{refreshOrder\}/);
assert.doesNotMatch(detail, /¿Confirmas esta acción para/);
assert.match(detail, /¿Confirmas que la reparación de \$\{otLabel\} está terminada\?/);
const navigation = fs.readFileSync("src/app/navigation.js", "utf8");
const layout = fs.readFileSync("src/layout/AppLayout.jsx", "utf8");
for (const path of ["ordenes", "vehiculos", "plazas"]) {
  assert.ok(navigation.includes(`path: "${path}"`));
}
assert.match(navigation, /requiredPermission: BUSINESS_PERMISSIONS\.TALLER_MANAGE/);
assert.match(navigation, /const to = path \? `\$\{basePath\}\/\$\{path\}` : basePath;/);
assert.match(navigation, /pathname === to \|\| pathname\.startsWith\(`\$\{to\}\/`\)/);
assert.match(layout, /item\.children/);
assert.match(layout, /nav-module__items/);
assert.match(layout, /: pathname === item\.to;/);
assert.doesNotMatch(layout, /: pathname === item\.to \|\| pathname\.startsWith/);
assert.match(layout, /idPrefix="desktop"/);
assert.match(layout, /idPrefix="mobile"/);
const layoutStyles = fs.readFileSync("src/styles/layout.css", "utf8");
assert.match(layoutStyles, /\.nav-module__label[\s\S]*font-size: var\(--font-size-xs\)/);
assert.match(layoutStyles, /\.nav-module__label[\s\S]*color: var\(--color-text-muted\)/);
// Plaza automática: la lista, la ficha y la aprobación muestran la espera sin montos.
assert.match(list, /getWorkOrderDisplayStatusLabel\(order\)/);
assert.doesNotMatch(list, /getWorkOrderStatusLabel\(order\.estado\)/);
assert.match(detail, /getWorkOrderDisplayStatusLabel\(order\)/);
assert.match(detail, /La ejecución comienza cuando se asigne una plaza\./);
assert.match(approvalPanel, /isWorkOrderWaitingForPlaza\(order\)/);
assert.match(approvalPanel, /En espera de plaza\./);
assert.match(approvalPanel, /result\?\.enEsperaDePlaza/);
assert.doesNotMatch(approvalPanel, /precio|monto|subtotal|formatBusinessMoney/i);
const plazaAssignment = fs.readFileSync("functions/workOrderPlazaAssignment.js", "utf8");
assert.doesNotMatch(plazaAssignment, /require\("\.\/workOrder(Persistence|Plazas)"\)/);
assert.match(fs.readFileSync("functions/package.json", "utf8"), /workOrderPlazaAssignment\.js/);
// El negocio conserva al menos una Plaza activa: aprobar e inactivar lo validan en el servidor.
assert.match(fs.readFileSync("functions/workOrderPersistence.js", "utf8"), /Crea al menos una Plaza activa en Taller > Plazas antes de aprobar el ingreso\./);
assert.match(fs.readFileSync("functions/workOrderPlazas.js", "utf8"), /El negocio debe tener al menos una Plaza activa\./);
console.log("OK UI OT: rutas, listado real, selección por patente y reutilización de Vehículos");
console.log("WORK_ORDER_UI_SMOKE_OK");
