import React from "react";
import { CloudCog } from "lucide-react";
import BrandMark from "./brand/BrandMark";

const BRAND_NAME = "ValoraCloud";
const BRAND_NAME_MAIN = "Valora";
const BRAND_NAME_ACCENT = "Cloud";
const BRAND_SUBTITLE = "Gestión empresarial";
// Ícono anterior (nube con engranaje). Ya no es la marca de la interfaz: solo
// queda como reemplazo en los documentos impresos cuando la empresa no sube su
// propio logo (cotización, orden de compra, compra y venta).
function CubeIcon({ size = 42, strokeWidth = 1.5, className = "", style }) {
  return (
    <CloudCog
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{
        color: "var(--color-brand-600)",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

function BrandLogo({
  variant = "sidebar",
  showText = true,
  className = "",
  iconSize,
  subtitle = BRAND_SUBTITLE,
  animated = false,
}) {
  const isAuth = variant === "auth";
  const rootClassName = ["brand-logo", `brand-logo--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClassName}
      role={showText ? undefined : "img"}
      aria-label={showText ? undefined : BRAND_NAME}
    >
      <span className="brand-logo__icon" aria-hidden="true">
        <BrandMark size={iconSize || (isAuth ? 42 : 40)} animated={animated} />
      </span>

      {showText && (
        <div className="brand-logo__text">
          <strong className="brand-logo__name">
            <span className="brand-logo__name-main">{BRAND_NAME_MAIN}</span>
            <span className="brand-logo__name-accent">{BRAND_NAME_ACCENT}</span>
          </strong>
          <span className="brand-logo__subtitle">{subtitle}</span>
        </div>
      )}
    </div>
  );
}

export { BRAND_NAME, BRAND_SUBTITLE, CubeIcon };
export default BrandLogo;
