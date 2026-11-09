import React from "react";
import {RefreshCw} from "lucide-react";
import Button from "../../components/ui/Button";
import {SkeletonRegion, SkeletonTable} from "../../components/ui/Skeleton";
import StatusBadge from "../../components/ui/StatusBadge";
import {BUSINESS_INVITATION_STATES} from "../../domain/teamInvitationModel.mjs";
import {formatDate} from "../../utils/formatters";

const GROUPS = [
  {state: BUSINESS_INVITATION_STATES.PENDING, title: "Pendientes", badge: "warning", badgeLabel: "Pendiente"},
  {state: BUSINESS_INVITATION_STATES.REJECTED, title: "Rechazadas", badge: "neutral", badgeLabel: "Rechazada"},
  {state: BUSINESS_INVITATION_STATES.EXPIRED, title: "Vencidas", badge: "neutral", badgeLabel: "Vencida"},
];

function InvitationDetail({invitation}) {
  if (invitation.estado === BUSINESS_INVITATION_STATES.PENDING) {
    return <span>Vence el {formatDate(invitation.expiraEn)}</span>;
  }
  if (invitation.estado === BUSINESS_INVITATION_STATES.REJECTED) {
    return <>
      <span>Rechazada el {formatDate(invitation.respondidoEn)}</span>
      <span className="employees-invitation__reason">
        {invitation.motivoRechazo ? `Motivo: ${invitation.motivoRechazo}` : "Sin motivo indicado."}
      </span>
    </>;
  }
  return <span>Venció el {formatDate(invitation.expiraEn)}</span>;
}

// Sección "Invitaciones" de Empleados (SPEC 032): pendientes (con vencimiento
// y Revocar), rechazadas (con motivo y fecha) y vencidas (Volver a invitar).
// Presentacional: el estado y las llamadas viven en EmployeesPage.
export default function TeamInvitationsPanel({status, groups, busyId, onRevoke, onReinvite, onRetry}) {
  const total = GROUPS.reduce((count, group) => count + groups[group.state].length, 0);
  let body;
  if (status === "loading") {
    body = <SkeletonRegion label="Cargando invitaciones..."><SkeletonTable columns={3} rows={3} /></SkeletonRegion>;
  } else if (status === "error") {
    body = <div className="employees-message employees-message--error" role="alert">
      <span>No pudimos cargar las invitaciones.</span>
      <Button type="button" variant="secondary" icon={RefreshCw} onClick={onRetry}>Reintentar</Button>
    </div>;
  } else if (total === 0) {
    body = <p className="erp-empty-state">Aún no hay invitaciones pendientes, rechazadas ni vencidas.</p>;
  } else {
    body = GROUPS.filter((group) => groups[group.state].length > 0).map((group) =>
      <section className="employees-invitations__group" key={group.state} aria-label={group.title}>
        <h3>{group.title} <span>({groups[group.state].length})</span></h3>
        <ul className="employees-invitations__list">
          {groups[group.state].map((invitation) => <li className="employees-invitation" key={invitation.id}>
            <div className="employees-invitation__identity">
              <strong>{invitation.correo}</strong>
              <StatusBadge variant={group.badge}>{invitation.perfilEtiqueta}</StatusBadge>
            </div>
            <div className="employees-invitation__detail"><InvitationDetail invitation={invitation} /></div>
            <div className="employees-invitation__actions">
              {group.state === BUSINESS_INVITATION_STATES.PENDING &&
                <Button type="button" variant="ghost-danger" loading={busyId === invitation.id} disabled={Boolean(busyId)} onClick={() => onRevoke(invitation)}>Revocar</Button>}
              {group.state === BUSINESS_INVITATION_STATES.EXPIRED &&
                <Button type="button" variant="secondary" loading={busyId === invitation.id} disabled={Boolean(busyId)} onClick={() => onReinvite(invitation)}>Volver a invitar</Button>}
            </div>
          </li>)}
        </ul>
      </section>
    );
  }
  return <section className="erp-panel" aria-labelledby="employees-invitations-title">
    <header className="employees-panel-header">
      <div>
        <h2 id="employees-invitations-title" className="erp-panel-title">Invitaciones</h2>
        <p className="erp-secondary-text">Cada persona decide si acepta. Las invitaciones vencen a los 7 días.</p>
      </div>
    </header>
    {body}
  </section>;
}
