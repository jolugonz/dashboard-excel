/**
 * render.js
 * Funciones de UI para mostrar resultados, errores y controles.
 */

function mostrarNombreArchivo(nombreArchivo) {
  const fileInfo = document.getElementById("file-info");
  if (!fileInfo) return;
  fileInfo.textContent = `Archivo cargado: ${nombreArchivo}`;
}

function mostrarError(mensaje) {
  const errorMessage = document.getElementById("error-message");
  const resultsSection = document.getElementById("results-section");
  const controlsSection = document.getElementById("controls-section");

  if (resultsSection) {
    resultsSection.style.display = "none";
  }

  if (controlsSection) {
    controlsSection.style.display = "none";
  }

  if (!errorMessage) return;
  errorMessage.textContent = mensaje;
  errorMessage.style.display = "block";
}

function limpiarError() {
  const errorMessage = document.getElementById("error-message");
  if (!errorMessage) return;
  errorMessage.textContent = "";
  errorMessage.style.display = "none";
}

function renderizarFiltroMeses(meses) {
  const controlsSection = document.getElementById("controls-section");
  const startInput = document.getElementById("date-start");
  const endInput = document.getElementById("date-end");

  if (!controlsSection || !startInput || !endInput) return;

  startInput.value = "";
  endInput.value = "";
  controlsSection.style.display = meses.length > 0 ? "block" : "none";
}

function renderizarTabla() {
  // eliminada: ya no se muestra la tabla de datos completa
}

function renderizarMetricas(metricas) {
  const statsGrid = document.getElementById("stats-grid");
  if (!statsGrid) return;

  statsGrid.innerHTML = "";

  metricas.forEach((metrica) => {
    const card = document.createElement("div");
    card.className = "stat-card";

    card.innerHTML = `
      <div class="stat-card-body">
        <div class="stat-card-label">${metrica.label}</div>
        <div class="stat-card-value">${metrica.valor}</div>
        ${metrica.meta ? `<div class="stat-card-meta">${metrica.meta}</div>` : ''}
      </div>
    `;

    statsGrid.appendChild(card);
  });
}
