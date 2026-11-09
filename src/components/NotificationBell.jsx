import React from "react";
import useMyInvitations from "../hooks/useMyInvitations";
import useNotifications from "../hooks/useNotifications";
import NotificationBellView, {
  canViewBusinessNotifications,
} from "./NotificationBellView";

export { canViewBusinessNotifications };

function NotificationBell({ businessId, role, onInvitationAccepted }) {
  const canSeeNotifications = canViewBusinessNotifications(role);
  const [open, setOpen] = React.useState(false);
  // businessId vacío si el rol no corresponde: useNotifications nunca
  // llama a subscribeToNotifications en ese caso (mismo patrón que
  // useFinancialMovements/DashboardPage con hasBusinessPermission).
  const notificationsState = useNotifications(canSeeNotifications ? businessId : "");
  // Las invitaciones se piden con la Function listarMisInvitaciones, no con
  // la suscripción de arriba: las ve cualquier rol con una empresa activa.
  const invitationsState = useMyInvitations({
    enabled: Boolean(businessId),
    onAccepted: async (result, invitation) => {
      await onInvitationAccepted?.(result, invitation);
      if (!result?.mensaje) setOpen(false);
    },
  });
  const { reload: reloadInvitations } = invitationsState;

  const handleOpen = React.useCallback(() => {
    setOpen(true);
    reloadInvitations({ silent: true });
  }, [reloadInvitations]);

  if (!businessId) return null;

  return (
    <NotificationBellView
      {...notificationsState}
      showNotifications={canSeeNotifications}
      invitations={{
        busyId: invitationsState.busyId,
        feedback: invitationsState.feedback,
        invitations: invitationsState.invitations,
        onAccept: (invitation) => invitationsState.respond(invitation, "aceptar"),
        onClearFeedback: invitationsState.clearFeedback,
        onReject: (invitation, reason) =>
          invitationsState.respond(invitation, "rechazar", reason),
        onRetry: reloadInvitations,
        requiresVerification: invitationsState.requiresVerification,
        status: invitationsState.status,
      }}
      open={open}
      onOpen={handleOpen}
      onClose={() => {
        invitationsState.clearFeedback();
        setOpen(false);
      }}
    />
  );
}

export default NotificationBell;
