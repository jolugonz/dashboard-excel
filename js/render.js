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

// Normaliza cadenas numéricas con formato local (ej: "45.817,77")
function parseLocaleNumber(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number' && !isNaN(v)) return v;
  let s = String(v).trim();
  // eliminar espacios
  s = s.replace(/\s/g, '');
  // eliminar separador de miles (.) y convertir decimal (,) a punto
  s = s.replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
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

function renderizarFiltrosAdicionales() {
  const ctrl = document.getElementById('controls-section');
  if (!ctrl || !window.datosGlobales || !window.datosGlobales.filas) return;

  // eliminar contenedor previo si existe
  let container = document.getElementById('extra-filters');
  if (container) container.remove();

  container = document.createElement('div');
  container.id = 'extra-filters';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '10px';
  container.style.marginLeft = '12px';

  // Proveedores
  const proveedores = Array.from(new Set(window.datosGlobales.filas.map(f => f['Proveedor']).filter(Boolean))).slice(0,50);
  const provWrap = document.createElement('div');
  provWrap.className = 'filter-buttons';
  const provLabel = document.createElement('div'); provLabel.textContent = 'Proveedor:'; provLabel.style.color = 'var(--text-secondary)'; provLabel.style.fontSize='0.78rem'; provLabel.style.fontWeight='700'; provLabel.style.marginBottom='6px';
  provWrap.appendChild(provLabel);
  proveedores.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'btn-filter';
    btn.textContent = p;
    btn.dataset.value = p;
    btn.addEventListener('click', () => {
      if (typeof window.setFiltroProveedor === 'function') window.setFiltroProveedor(p);
    });
    provWrap.appendChild(btn);
  });

  // Negocio (PCRC)
  const negocios = Array.from(new Set(window.datosGlobales.filas.map(f => f['Negocio']).filter(Boolean))).slice(0,50);
  const negWrap = document.createElement('div');
  negWrap.className = 'filter-buttons';
  const negLabel = document.createElement('div'); negLabel.textContent = 'PCRC:'; negLabel.style.color='var(--text-secondary)'; negLabel.style.fontSize='0.78rem'; negLabel.style.fontWeight='700'; negLabel.style.marginBottom='6px';
  negWrap.appendChild(negLabel);
  negocios.forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'btn-filter';
    btn.textContent = n;
    btn.dataset.value = n;
    btn.addEventListener('click', () => {
      if (typeof window.setFiltroNegocio === 'function') window.setFiltroNegocio(n);
    });
    negWrap.appendChild(btn);
  });

  container.appendChild(provWrap);
  container.appendChild(negWrap);

  ctrl.appendChild(container);
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
      const rawVal = parseLocaleNumber(m.valor) || 0;
      const rawMin = m.meta ? parseLocaleNumber(m.meta.match(/Mín[:\s]*([\d.,]+)/)?.[1]) || 0 : 0;
      const rawMax = m.meta ? parseLocaleNumber(m.meta.match(/Máx[:\s]*([\d.,]+)/)?.[1]) || Math.max(rawVal * 1.5, 100) : Math.max(rawVal * 1.5, 100);
      const col    = gaugeColors[i % gaugeColors.length];

      gaugeHtml += `
        <div class="stat-card gauge-card">
          <div class="stat-card-accent"></div>
          <div class="stat-card-label">${m.columna}</div>
          <div class="gauge-wrap" id="gauge-wrap-${i}">
            ${buildGaugeSVG(rawVal, rawMin, rawMax, col)}
            <div class="gauge-value-overlay" id="gauge-value-${i}" style="color:${col}">${m.valor}</div>
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

  // Ajustar tamaño del overlay si el texto es muy largo
  setTimeout(() => {
    const gaugeOverlays = document.querySelectorAll('.gauge-value-overlay');
    gaugeOverlays.forEach(el => {
      // si el ancho del contenido excede el contenedor, aplicar clase small
      const parent = el.parentElement;
      if (!parent) return;
      const parentW = parent.getBoundingClientRect().width;
      const textW = (() => {
        const span = document.createElement('span');
        span.style.visibility = 'hidden';
        span.style.whiteSpace = 'nowrap';
        span.style.fontWeight = getComputedStyle(el).fontWeight;
        span.style.fontSize = getComputedStyle(el).fontSize;
        span.textContent = el.textContent || '';
        document.body.appendChild(span);
        const w = span.getBoundingClientRect().width;
        document.body.removeChild(span);
        return w;
      })();

      if (textW > parentW * 0.78) {
        el.classList.add('small');
      } else {
        el.classList.remove('small');
      }
    });
  }, 120);
}

/* ───────────────────────────────────────
   Charts
─────────────────────────────────────── */
function buildChartSection(metricas) {
  const num = metricas.filter(m => m.tipo === 'numero');
  if (num.length === 0) return '';

  // Queremos priorizar Productividad y NPS como los dos primeros charts
  const prioridad = ['productividad', 'nps'];
  const ordenados = [];

  prioridad.forEach(pref => {
    const found = num.find(x => x.columna && normalizarNombreColumna(x.columna).includes(pref));
    if (found) ordenados.push(found);
  });

  // añadir el resto sin repetir
  num.forEach(m => {
    if (!ordenados.includes(m)) ordenados.push(m);
  });

  // Construir placeholders de canvas; los datos reales vendrán de datosGlobales
  let cardsHtml = '';
  ordenados.slice(0, 3).forEach((m, i) => {
    cardsHtml += `
      <div class="chart-card">
        <div class="chart-title">${m.label}</div>
        <div class="chart-canvas-wrap">
          <canvas id="chart-${i}" data-columna="${m.columna}"></canvas>
        </div>
      </div>`;
  });

  return `<div class="charts-row">${cardsHtml}</div>`;
}

function initCharts(metricas) {
  if (typeof Chart === 'undefined') return;
  // Construir series reales basadas en datosGlobales si están disponibles
  const chartColors = ['#00c2ff', '#00d68f', '#a78bfa'];

  for (let i = 0; i < 3; i++) {
    const canvas = document.getElementById(`chart-${i}`);
    if (!canvas) continue;

    _destroyChart(`chart-${i}`);

    const columna = canvas.dataset.columna;
    // Si no hay columna, intentar tomar del metricas en orden
    let colName = columna || (metricas.filter(m => m.tipo === 'numero')[i] || {}).columna;
    if (!colName) continue;

    // Construir labels basados en la columna de mes real (normalizando seriales de Excel y strings)
    const filasGlobal = (window.datosGlobales && window.datosGlobales.filas) || [];
    const columnaMes = window.datosGlobales ? window.datosGlobales.columnaMes : null;

    function excelSerialToDate(serial) {
      // serial puede incluir parte decimal (hora)
      const days = Number(serial);
      if (isNaN(days)) return null;
      const utc = Math.round((days - 25569) * 86400 * 1000);
      return new Date(utc);
    }

    function toMonthKey(valor) {
      if (valor === undefined || valor === null) return null;
      // si es número (serial), convertir
      if (typeof valor === 'number' || /^\d+$/.test(String(valor).trim())) {
        const d = excelSerialToDate(Number(valor));
        if (d && !isNaN(d.getTime())) return d.toISOString().slice(0,7);
      }
      // intentar parsear como fecha string
      const maybe = new Date(String(valor));
      if (!isNaN(maybe.getTime())) return maybe.toISOString().slice(0,7);
      // fallback: usar el string literal
      return String(valor).trim();
    }

    function formatMonthLabel(key) {
      // si es YYYY-MM
      if (/^\d{4}-\d{2}$/.test(key)) {
        const d = new Date(key + '-01T00:00:00');
        return d.toLocaleString('es-AR', { month: 'short', year: 'numeric' });
      }
      return key;
    }

    // extraer claves únicas ordenadas
    const mesesClaves = Array.from(new Set(filasGlobal.map(r => toMonthKey(r[columnaMes])).filter(Boolean)));
    mesesClaves.sort((a,b) => a.localeCompare(b));

    const labels = mesesClaves.map(formatMonthLabel);

    // Calcular promedio por cada clave (mes)
    const data = mesesClaves.map(key => {
      if (!columnaMes) return 0;
      const filas = filasGlobal.filter(f => toMonthKey(f[columnaMes]) === key);
      const vals = filas.map(r => parseLocaleNumber(r[colName]) || 0).filter(n => !isNaN(n));
      if (vals.length === 0) return 0;
      const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
      return avg;
    });

    const col = chartColors[i % chartColors.length];

    _charts[`chart-${i}`] = new Chart(canvas, {
      type: i === 0 ? 'bar' : 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: col,
          backgroundColor: i === 0 ? `${col}55` : function(ctx){
            const gradient = ctx.chart.ctx.createLinearGradient(0,0,0,160);
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
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8ba3cc', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8ba3cc', font: { size: 10 } } }
        }
      }
    });
  }
}
