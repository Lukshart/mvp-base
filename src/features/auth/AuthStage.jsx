import React from "react";

const MODULE_CHIPS = ["Inventario", "Cotizaciones", "Compras", "Ventas"];

const BARS = [
  { x: 170, y: 260, height: 42 },
  { x: 210, y: 232, height: 70 },
  { x: 250, y: 246, height: 56 },
  { x: 290, y: 204, height: 98 },
  { x: 330, y: 170, height: 132 },
];

// Panel izquierdo del ingreso: ilustración SVG animada con CSS (nube con
// engranaje, barras que crecen, línea que se dibuja, etiquetas de módulos que
// flotan y luces de fondo). Todo lo decorativo va en aria-hidden; el único
// texto real es el titular. Los colores y las duraciones salen de tokens.css
// (ver login.css); con prefers-reduced-motion queda quieto y en su estado final.
function AuthStage() {
  return (
    <section className="auth-visual auth-stage" aria-label="ValoraCloud para tu negocio">
      <div className="auth-stage__decor" aria-hidden="true">
        <span className="auth-stage__orb auth-stage__orb--one" />
        <span className="auth-stage__orb auth-stage__orb--two" />
        <span className="auth-stage__orb auth-stage__orb--three" />

        {MODULE_CHIPS.map((label, index) => (
          <span
            key={label}
            className={`auth-stage__chip auth-stage__chip--${index + 1}`}
          >
            <i className="auth-stage__chip-dot" />
            {label}
          </span>
        ))}

        <svg
          className="auth-stage__art"
          viewBox="0 0 520 380"
          fill="none"
          focusable="false"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="auth-stage-cloud"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="110"
              x2="0"
              y2="320"
            >
              <stop offset="0" className="auth-stage__stop-cloud-top" />
              <stop offset="1" className="auth-stage__stop-cloud-bottom" />
            </linearGradient>
            <linearGradient id="auth-stage-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" className="auth-stage__stop-bar-top" />
              <stop offset="1" className="auth-stage__stop-bar-bottom" />
            </linearGradient>
          </defs>

          <g fill="url(#auth-stage-cloud)">
            <circle cx="190" cy="250" r="62" />
            <circle cx="252" cy="200" r="86" />
            <circle cx="345" cy="225" r="68" />
            <circle cx="398" cy="268" r="48" />
            <rect x="150" y="250" width="296" height="68" rx="34" />
          </g>

          <g transform="translate(168 168)">
            <g className="auth-stage__gear" strokeWidth="3">
              <circle r="15" />
              <circle r="22" strokeDasharray="5 6" strokeWidth="7" />
            </g>
          </g>

          <g fill="url(#auth-stage-bar)">
            {BARS.map((bar, index) => (
              <rect
                key={bar.x}
                className={`auth-stage__bar auth-stage__bar--${index + 1}`}
                x={bar.x}
                y={bar.y}
                width="22"
                height={bar.height}
                rx="4"
              />
            ))}
          </g>

          <path
            className="auth-stage__line"
            d="M160 262 L208 236 L252 246 L300 202 L352 156"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polygon
            className="auth-stage__tip"
            points="342,150 366,148 358,170"
          />
          <ellipse
            className="auth-stage__shadow"
            cx="300"
            cy="318"
            rx="150"
            ry="9"
          />
        </svg>
      </div>

      <p className="auth-stage__headline">
        Gestiona y valora tu negocio en un solo lugar.
      </p>
    </section>
  );
}

export default AuthStage;
