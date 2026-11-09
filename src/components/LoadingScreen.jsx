import React from "react";
import BrandLogo from "./BrandLogo";
import LoadingState from "./ui/LoadingState";

// Pantalla de arranque de la app (auth y sesión de negocio). El retraso de
// aparición se aplica al contenido y no al fondo, para que el canvas sea
// constante. BrandLogo va como hermano de LoadingState y NUNCA dentro de su
// role="status", para que el lector no anuncie el nombre de la marca junto al
// texto de carga. La marca animada reemplaza al círculo giratorio.
function LoadingScreen({ label = "Preparando tu espacio..." }) {
  return (
    <main className="brand-loader">
      <div className="brand-loader__content ui-reveal-delay">
        <BrandLogo variant="auth" iconSize={64} animated />
        <LoadingState variant="page" label={label} showSpinner={false} />
      </div>
    </main>
  );
}

export default LoadingScreen;
