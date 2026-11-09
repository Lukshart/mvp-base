import React from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import BrandLogo from "../../components/BrandLogo";
import Button from "../../components/ui/Button";
import SkipLink from "../../components/ui/SkipLink";
import {
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENTS_VERSION,
} from "../../domain/legalDocuments.mjs";
import {
  LEGAL_DOCUMENTS_CONTENT,
  LEGAL_NOTICE,
} from "../../domain/legalDocumentsContent.mjs";
import "./legal-page.css";

function LegalBlock({ block }) {
  if (block.type === "list") {
    return (
      <ul className="legal-page__list">
        {block.items.map((item, index) => (
          <li key={index}>
            {item.label && <strong>{item.label}</strong>}
            {item.label && " "}
            {item.text}
          </li>
        ))}
      </ul>
    );
  }
  return <p>{block.text}</p>;
}

function LegalDocumentPage({ documentKey }) {
  const navigate = useNavigate();
  const document = LEGAL_DOCUMENTS[documentKey];
  const content = LEGAL_DOCUMENTS_CONTENT[documentKey];
  const otherDocument = Object.values(LEGAL_DOCUMENTS).find(
    (item) => item.key !== documentKey
  );

  // Con historial previo vuelve a la pantalla anterior (por ejemplo la de
  // aceptación); en un enlace directo cae en "/", que resuelve la sesión.
  const goBack = () => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  return (
    <>
      <SkipLink targetId="legal-main-content" />
      <main id="legal-main-content" className="legal-page" tabIndex="-1">
        <header className="legal-page__header">
          <BrandLogo variant="auth" subtitle={document.title} />
          <Button variant="ghost" icon={ArrowLeft} onClick={goBack}>
            Volver
          </Button>
        </header>

        <article className="legal-page__document" aria-labelledby="legal-title">
          <p className="legal-page__notice">{LEGAL_NOTICE}</p>
          <h1 id="legal-title" className="legal-page__title">
            {document.title}
          </h1>
          <p className="legal-page__version">Versión {LEGAL_DOCUMENTS_VERSION}</p>

          {content.sections.map((section) => (
            <section key={section.title} className="legal-page__section">
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) => (
                <LegalBlock key={index} block={block} />
              ))}
            </section>
          ))}
        </article>

        <footer className="legal-page__footer">
          <Link to={otherDocument.path}>{otherDocument.title}</Link>
        </footer>
      </main>
    </>
  );
}

export default LegalDocumentPage;
