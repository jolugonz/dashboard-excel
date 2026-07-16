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

function renderizarTabla(filas, columnas) {
  const tableWrapper = document.getElementById("table-wrapper");
  const resultsSection = document.getElementById("results-section");

  if (!tableWrapper || !resultsSection) return;

  const table = document.createElement("table");
  table.className = "results-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  columnas.forEach((columna) => {
    const th = document.createElement("th");
    th.textContent = columna;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement("tbody");
  filas.forEach((fila) => {
    const row = document.createElement("tr");
    columnas.forEach((columna) => {
      const cell = document.createElement("td");
      const valor = fila[columna];
      cell.textContent = valor !== undefined && valor !== null ? valor : "";
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  tableWrapper.innerHTML = "";
  tableWrapper.appendChild(table);
  resultsSection.style.display = "block";
}

function renderizarMetricas(metricas) {
  const statsGrid = document.getElementById("stats-grid");
  if (!statsGrid) return;

  statsGrid.innerHTML = "";

  metricas.forEach((metrica) => {
    const card = document.createElement("div");
    card.className = "stat-card";

    card.innerHTML = `
      <div class="stat-card-icon">${metrica.icono || '📊'}</div>
      <div class="stat-card-body">
        <div class="stat-card-label">${metrica.label}</div>
        <div class="stat-card-value">${metrica.valor}</div>
        ${metrica.meta ? `<div class="stat-card-meta">${metrica.meta}</div>` : ''}
      </div>
    `;

    statsGrid.appendChild(card);
  });
}
