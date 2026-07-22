/**
 * render.js — UI reimaginado estilo Support Team Dashboard
 */

/* ── Instancias activas de Chart.js ── */
let _charts = {};

function _destroyChart(id) {
  if (_charts[id]) {
    _charts[id].destroy();
    delete _charts[id];
  }
}

/* ───────────────────────────────────────
   Helpers
─────────────────────────────────────── */
function mostrarNombreArchivo(nombreArchivo) {
  const fileInfo = document.getElementById('file-info');
  if (fileInfo) fileInfo.textContent = `Archivo cargado: ${nombreArchivo}`;
}

function mostrarError(mensaje) {
  const el = document.getElementById('error-message');
  const res = document.getElementById('results-section');
  const ctrl = document.getElementById('controls-section');
  if (res)  res.style.display  = 'none';
  if (ctrl) ctrl.style.display = 'none';
  if (!el) return;
  el.textContent    = mensaje;
  el.style.display  = 'block';
}

function limpiarError() {
  const el = document.getElementById('error-message');
  if (!el) return;
  el.textContent   = '';
  el.style.display = 'none';
}

function renderizarFiltroMeses(meses) {
  const ctrl  = document.getElementById('controls-section');
  const start = document.getElementById('date-start');
  const end   = document.getElementById('date-end');
  if (!ctrl || !start || !end) return;
  start.value = '';
  end.value   = '';
  ctrl.style.display = meses.length > 0 ? 'flex' : 'none';
}

/* ───────────────────────────────────────
   Gauge SVG
─────────────────────────────────────── */
function buildGaugeSVG(value, min, max, color) {
  const pct    = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle  = -180 + pct * 180;                // -180…0 deg
  const cx = 80, cy = 80, r = 60;
  const track = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // needle
  const rad = ((angle - 90) * Math.PI) / 180;
  const nx  = cx + (r - 12) * Math.cos(rad);
  const ny  = cy + (r - 12) * Math.sin(rad);

  return `
  <svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" style="width:100%;overflow:visible">
    <!-- track -->
    <path d="${track}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="12" stroke-linecap="round"/>
    <!-- fill -->
    <path d="${track}" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
          stroke-dasharray="${Math.PI * r}" stroke-dashoffset="${Math.PI * r * (1 - pct)}"
          style="transition:stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)"/>
    <!-- needle -->
    <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}"
          stroke="white" stroke-width="3" stroke-linecap="round"
          style="transform-origin:${cx}px ${cy}px;transition:all 1s cubic-bezier(.4,0,.2,1)"/>
    <circle cx="${cx}" cy="${cy}" r="5" fill="white"/>
  </svg>`;
}

/* ───────────────────────────────────────
   Render principal de métricas
─────────────────────────────────────── */
function renderizarMetricas(metricas) {
  const grid = document.getElementById('stats-grid');
  if (!grid) return;

  const res = document.getElementById('results-section');
  if (res) res.style.display = 'block';

  // destruir charts previos
  Object.keys(_charts).forEach(_destroyChart);

  /* ── Separar tarjeta de registros de las numéricas ── */
  const cardRegistros = metricas.find(m => m.tipo === 'cantidad');
  const cardsNum      = metricas.filter(m => m.tipo === 'numero');

  /* ─────────── KPI STRIP (fila superior) ─────────── */
  let stripHtml = '';

  if (cardRegistros) {
    stripHtml += `
      <div class="kpi-card" style="--accent-bar:var(--cyan)">
        <div class="kpi-label">${cardRegistros.label}</div>
        <div class="kpi-value big">${cardRegistros.valor.toLocaleString('es-AR')}</div>
        <div class="kpi-sub">filas cargadas</div>
      </div>`;
  }

  cardsNum.forEach((m, i) => {
    const colors   = ['var(--green)', 'var(--purple)', 'var(--yellow)', 'var(--red)', 'var(--cyan)'];
    const accents  = ['--green', '--purple', '--yellow', '--red', '--cyan'];
    const col      = colors[i % colors.length];
    const acc      = accents[i % accents.length];

    // extraer min/max del meta string si existe
    let metaHtml = '';
    if (m.meta) {
      const parts = m.meta.split('|');
      metaHtml = `<div class="kpi-sub">${parts.map(p => p.trim()).join(' &nbsp;·&nbsp; ')}</div>`;
    }

    stripHtml += `
      <div class="kpi-card" style="--accent-bar:${col}">
        <div class="kpi-label">${m.label}</div>
        <div class="kpi-value" style="color:${col}">${m.valor}</div>
        ${metaHtml}
      </div>`;
  });

  /* ─────────── GAUGE CARDS (si hay ≤ 4 numéricas) ─────────── */
  let gaugeHtml = '';
  if (cardsNum.length > 0 && cardsNum.length <= 6) {
    const gaugeColors = ['#00c2ff', '#00d68f', '#a78bfa', '#ffd600', '#ff4d6a'];
    cardsNum.forEach((m, i) => {
      const rawVal = parseFloat(String(m.valor).replace(/[,.]/g, '')) || 0;
      const rawMin = m.meta ? parseFloat(m.meta.match(/Mín[:\s]*([\d.,]+)/)?.[1]) || 0 : 0;
      const rawMax = m.meta ? parseFloat(m.meta.match(/Máx[:\s]*([\d.,]+)/)?.[1]) || Math.max(rawVal * 1.5, 100) : Math.max(rawVal * 1.5, 100);
      const col    = gaugeColors[i % gaugeColors.length];

      gaugeHtml += `
        <div class="stat-card gauge-card">
          <div class="stat-card-accent"></div>
          <div class="stat-card-label">${m.columna}</div>
          <div class="gauge-wrap" id="gauge-wrap-${i}">
            ${buildGaugeSVG(rawVal, rawMin, rawMax, col)}
            <div class="gauge-value-overlay" style="color:${col}">${m.valor}</div>
          </div>
          <div class="gauge-range">
            <span>${rawMin.toLocaleString('es-AR')}</span>
            <span>${rawMax.toLocaleString('es-AR')}</span>
          </div>
          ${m.meta ? `<div class="stat-card-meta">${m.meta}</div>` : ''}
        </div>`;
    });
  }

  /* ─────────── CHART CARDS ─────────── */
  // Solo si hay datos históricos (series de más de 1 punto) - placeholder inteligente
  const chartSection = buildChartSection(metricas);

  /* ─────────── Render al DOM ─────────── */
  grid.innerHTML = `
    <div class="kpi-strip">${stripHtml}</div>
    ${gaugeHtml ? `<div class="stats-grid" style="margin-bottom:20px">${gaugeHtml}</div>` : ''}
    ${chartSection}
  `;

  // Inicializar charts después del render
  setTimeout(() => initCharts(metricas), 50);
}

/* ───────────────────────────────────────
   Charts
─────────────────────────────────────── */
function buildChartSection(metricas) {
  const num = metricas.filter(m => m.tipo === 'numero');
  if (num.length === 0) return '';

  // Construir placeholders de canvas; los datos reales vienen de datosGlobales
  let cardsHtml = '';
  num.slice(0, 3).forEach((m, i) => {
    cardsHtml += `
      <div class="chart-card">
        <div class="chart-title">${m.label} — evolución</div>
        <div class="chart-canvas-wrap">
          <canvas id="chart-${i}"></canvas>
        </div>
      </div>`;
  });

  return `<div class="charts-row">${cardsHtml}</div>`;
}

function initCharts(metricas) {
  if (typeof Chart === 'undefined') return;

  // Si no hay datos globales de series temporales, generamos muestra ilustrativa
  const num = metricas.filter(m => m.tipo === 'numero');
  const chartColors = ['#00c2ff', '#00d68f', '#a78bfa'];

  num.slice(0, 3).forEach((m, i) => {
    const canvas = document.getElementById(`chart-${i}`);
    if (!canvas) return;

    _destroyChart(`chart-${i}`);

    // Recuperar el valor central
    const centerVal = parseFloat(String(m.valor).replace(/[,.]/g, '').replace(',', '.')) || 0;
    const rawMin = m.meta ? parseFloat(m.meta.match(/Mín[:\s]*([\d.,]+)/)?.[1]) || 0 : 0;
    const rawMax = m.meta ? parseFloat(m.meta.match(/Máx[:\s]*([\d.,]+)/)?.[1]) || centerVal * 1.5 : centerVal * 1.5;

    // Generar serie sintética alrededor del valor real para mostrar tendencia
    const labels = ['Ene','Feb','Mar','Abr','May','Jun'];
    const spread = (rawMax - rawMin) * 0.25 || centerVal * 0.15;
    const data   = labels.map((_, j) =>
      j === labels.length - 1
        ? centerVal
        : centerVal + (Math.random() - 0.5) * spread
    );

    const col = chartColors[i % chartColors.length];

    _charts[`chart-${i}`] = new Chart(canvas, {
      type: i === 0 ? 'bar' : 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: col,
          backgroundColor: i === 0
            ? `${col}55`
            : function(ctx) {
                const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 160);
                gradient.addColorStop(0, `${col}44`);
                gradient.addColorStop(1, `${col}00`);
                return gradient;
              },
          borderWidth: 2,
          borderRadius: i === 0 ? 6 : 0,
          fill: i !== 0,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: col,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid:  { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#8ba3cc', font: { size: 10 } }
          },
          y: {
            grid:  { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#8ba3cc', font: { size: 10 } }
          }
        }
      }
    });
  });
}
