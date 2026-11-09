import React from "react";
import { Check, LogOut, ScrollText } from "lucide-react";
import { Link } from "react-router-dom";
import BrandLogo from "../../components/BrandLogo";
import Button from "../../components/ui/Button";
import SkipLink from "../../components/ui/SkipLink";
import { LEGAL_DOCUMENTS } from "../../domain/legalDocuments.mjs";
import { logout } from "../../services/authService";
import { acceptLegalTerms } from "../../services/legalService";
import "./legal-page.css";

const LEGAL_LINKS = [LEGAL_DOCUMENTS.privacidad, LEGAL_DOCUMENTS.terminos];

const ACCEPT_ERROR_MESSAGE =
  "No pudimos registrar tu aceptación. Revisa la conexión y vuelve a intentarlo.";

// Pantalla previa al onboarding y al resto de la app cuando la persona no
// tiene aceptada la versión vigente (SPEC 024, 5.5). Solo se puede aceptar o
// cerrar sesión; los textos abren en pestaña nueva para no perder esta vista.
function LegalAcceptancePage({ usuario, isUpdate = false, onAccepted }) {
  const [accepting, setAccepting] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    setError("");
    try {
      await acceptLegalTerms();
      const session = await onAccepted();
      if (session?.legalAcceptance?.isCurrent !== true) {
        setError(ACCEPT_ERROR_MESSAGE);
      }
    } catch (acceptError) {
      if (import.meta.env.DEV) {
        console.error(
          "Error registrando la aceptación legal:",
          acceptError?.code,
          acceptError?.message
        );
      }
      setError(ACCEPT_ERROR_MESSAGE);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <>
      <SkipLink targetId="legal-acceptance-main" />
      <main
        id="legal-acceptance-main"
        className="onboarding-screen legal-acceptance-screen"
        tabIndex="-1"
      >
        <section
          className="onboarding-card onboarding-card--message legal-acceptance"
          aria-labelledby="legal-acceptance-title"
        >
          <BrandLogo variant="auth" showText />
          <span className="onboarding-icon" aria-hidden="true">
            <ScrollText size={24} />
          </span>
          <h1 id="legal-acceptance-title">
            {isUpdate
              ? "Actualizamos nuestros documentos"
              : "Antes de continuar"}
          </h1>
          <p>
            {isUpdate
              ? "Para seguir usando ValoraCloud, revisa y acepta la versión vigente de estos documentos."
              : "Para usar ValoraCloud necesitamos que revises y aceptes estos documentos."}
          </p>
          <ul className="legal-acceptance__links">
            {LEGAL_LINKS.map((document) => (
              <li key={document.key}>
                <Link
                  to={document.path}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {document.title}
                </Link>
              </li>
            ))}
          </ul>
          {error && (
            <div className="onboarding-alert legal-acceptance__error" role="alert">
              <span>{error}</span>
            </div>
          )}
          <div className="onboarding-message-actions legal-acceptance__actions">
            <Button
              type="button"
              icon={Check}
              loading={accepting}
              onClick={handleAccept}
            >
              {accepting
                ? "Registrando..."
                : "Acepto la política de privacidad y los términos de uso"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={LogOut}
              disabled={accepting}
              onClick={logout}
            >
              Cerrar sesión
            </Button>
          </div>
          <span className="onboarding-message-email">{usuario?.email}</span>
        </section>
      </main>
    </>
  );
}

export default LegalAcceptancePage;
