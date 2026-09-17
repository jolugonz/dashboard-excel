/**
 * render.js — UI reimaginado estilo Support Team Dashboard
 */

/* ── Instancias activas de Chart.js ── */
let _charts = {};

// Un canvas transparente se compone sobre blanco al generar un PDF, aunque su
// contenedor sea oscuro. Dibujar el fondo dentro del propio bitmap conserva la
// paleta de los gráficos tanto en pantalla como en la exportación.
if (typeof Chart !== 'undefined') {
  Chart.register({
    id: 'dashboardCanvasBackground',
    beforeDraw(chart) {
      const { ctx, width, height } = chart;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#112255';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  });
}

function _destroyChart(id) {
  if (_charts[id]) {
    _charts[id].destroy();
    delete _charts[id];
  }
}

// Chart.js conserva el tamaño calculado para pantalla. Al entrar o salir del
// modo impresión hay que recalcular cada canvas con las dimensiones del PDF.
window.addEventListener('beforeprint', () => {
  Object.entries(_charts).forEach(([id, chart]) => {
    const contenedor = chart.canvas.parentElement;
    if (!contenedor) return;
    if (id === 'profiles-chart' && chart.$printLabels) {
      chart.data.labels = chart.$printLabels;
    }
    const altura = id === 'profiles-chart' ? 470 : 210;
    chart.resize(contenedor.clientWidth, altura);
    chart.update('none');
  });
});

window.addEventListener('afterprint', () => {
  Object.entries(_charts).forEach(([id, chart]) => {
    if (id === 'profiles-chart' && chart.$screenLabels) {
      chart.data.labels = chart.$screenLabels;
    }
    chart.resize();
    chart.update('none');
  });
});

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
  const advisor = document.getElementById('advisor-section');
  if (res)  res.style.display  = 'none';
  if (advisor) advisor.style.display = 'none';
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
  const ctrl        = document.getElementById('controls-section');
  const headerFiltro = document.getElementById('header-date-filter');
  const start       = document.getElementById('date-start');
  const end         = document.getElementById('date-end');
  if (!ctrl || !start || !end) return;
  start.value = '';
  end.value   = '';

  const fechas = ((window.datosGlobales && window.datosGlobales.filas) || [])
    .map(fila => parsearFechaParaFiltro(fila[window.datosGlobales.columnaMes]))
    .filter(fecha => fecha && !isNaN(fecha.getTime()))
    .sort((a, b) => a - b);

  if (fechas.length > 0) {
    const aValorInput = fecha => [
      fecha.getFullYear(),
      String(fecha.getMonth() + 1).padStart(2, '0')
    ].join('-');
    const minimo = aValorInput(fechas[0]);
    const maximo = aValorInput(fechas[fechas.length - 1]);
    start.min = end.min = minimo;
    start.max = end.max = maximo;
  } else {
    start.removeAttribute('min');
    start.removeAttribute('max');
    end.removeAttribute('min');
    end.removeAttribute('max');
  }

  // Mostrar filtro de fecha en el header
  if (headerFiltro) {
    if (meses.length > 0) {
      headerFiltro.classList.add('visible');
    } else {
      headerFiltro.classList.remove('visible');
    }
  }

  // La controls-section sólo muestra los filtros de proveedor / negocio
  ctrl.style.display = 'none';
}

function renderizarFiltrosAdicionales() {
  const ctrl = document.getElementById('controls-section');
  if (!ctrl || !window.datosGlobales || !window.datosGlobales.filas) return;

  // eliminar contenedor previo si existe
  let container = document.getElementById('extra-filters');
  if (container) container.remove();

  container = document.createElement('div');
  container.id = 'extra-filters';

  // Proveedores
  const proveedores = Array.from(new Set(window.datosGlobales.filas.map(f => f['Proveedor']).filter(Boolean))).slice(0,50);
  const provWrap = document.createElement('div');
  provWrap.className = 'filter-buttons';
  proveedores.forEach(p => {
    const provGroup = document.createElement('div');
    provGroup.className = 'provider-filter-group';

    const btn = document.createElement('button');
    btn.className = 'btn-filter';
    btn.textContent = p;
    btn.dataset.value = p;
    btn.dataset.filter = 'proveedor';
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      if (typeof window.setFiltroProveedor === 'function') window.setFiltroProveedor(p);
    });

    provGroup.appendChild(btn);
    if (normalizarNombreColumna(p) === 'konecta peru') {
      const asesorBtn = document.createElement('button');
      asesorBtn.className = 'btn-filter btn-advisor';
      asesorBtn.type = 'button';
      asesorBtn.textContent = 'Asesor';
      asesorBtn.dataset.provider = p;
      asesorBtn.setAttribute('aria-label', 'Ver detalle por asesor');
      asesorBtn.addEventListener('click', () => {
        if (typeof window.abrirVistaAsesor === 'function') window.abrirVistaAsesor();
      });
      provGroup.appendChild(asesorBtn);
    }
    provWrap.appendChild(provGroup);
  });

  // Negocio (PCRC)
  const ordenPcrc = ['comercial', 'contencion', 'tecnica'];
  const negocios = Array.from(new Set(window.datosGlobales.filas.map(f => f['Negocio']).filter(Boolean)))
    .sort((a, b) => {
      const indiceA = ordenPcrc.indexOf(normalizarNombreColumna(a));
      const indiceB = ordenPcrc.indexOf(normalizarNombreColumna(b));
      if (indiceA !== -1 || indiceB !== -1) {
        return (indiceA === -1 ? ordenPcrc.length : indiceA) -
          (indiceB === -1 ? ordenPcrc.length : indiceB);
      }
      return String(a).localeCompare(String(b), 'es');
    })
    .slice(0, 50);
  const negWrap = document.createElement('div');
  negWrap.className = 'filter-buttons filter-buttons-pcrc';
  negocios.forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'btn-filter';
    btn.textContent = n;
    btn.dataset.value = n;
    btn.dataset.filter = 'negocio';
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      if (typeof window.setFiltroNegocio === 'function') window.setFiltroNegocio(n);
    });
    negWrap.appendChild(btn);
  });

  container.appendChild(provWrap);
  container.appendChild(negWrap);

  ctrl.appendChild(container);

  // Mostrar la sección sólo si hay botones de filtro disponibles
  if (proveedores.length > 0 || negocios.length > 0) {
    ctrl.style.display = 'flex';
  }
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
function renderizarMetricas(metricas, filasFiltradas = [], opciones = {}) {
  const esVistaAsesor = opciones.vista === 'asesor';
  const grid = document.getElementById(opciones.targetId || 'stats-grid');
  if (!grid) return;

  const res = document.getElementById(opciones.sectionId || 'results-section');
  if (res) res.style.display = 'block';

  // destruir charts previos
  Object.keys(_charts).forEach(_destroyChart);

  /* ── Separar tarjeta de registros de las numéricas ── */
  const cardRegistros = metricas.find(m => m.tipo === 'cantidad');
  const cardsNum      = metricas.filter(m => m.tipo === 'numero');

  /* ─────────── KPI STRIP (fila superior) ─────────── */
  let stripHtml = '';

  if (cardRegistros && !esVistaAsesor) {
    stripHtml += `
      <div class="kpi-card kpi-card-compact" style="--accent-bar:var(--cyan)">
        <div class="kpi-value big">${cardRegistros.valor.toLocaleString('es-AR')}</div>
        <div class="kpi-label">${cardRegistros.label}</div>
      </div>`;
  }

  const columnasFiltradas = Array.from(new Set([
    ...(window.datosGlobales?.columnas || []),
    ...filasFiltradas.flatMap(fila => Object.keys(fila || {}))
  ]));
  const buscarColumna = nombres => columnasFiltradas.find(columna =>
    nombres.some(nombre =>
      normalizarNombreColumna(columna) === normalizarNombreColumna(nombre)
    )
  );
  const buscarColumnaFlexible = (patrones, exacto = false) => columnasFiltradas.find(columna => {
    const columnaNorm = normalizarNombreColumna(columna);
    return patrones.some(patron => {
      const patronNorm = normalizarNombreColumna(patron);
      return exacto
        ? columnaNorm === patronNorm
        : columnaNorm === patronNorm || columnaNorm.includes(patronNorm) || patronNorm.includes(columnaNorm);
    });
  });
  const columnaMuestras = buscarColumna(['Muestra', 'Muestras']);
  const columnaPerfil = columnasFiltradas.find(columna =>
    normalizarNombreColumna(columna).includes('afunilamento')
  );
  const sumarColumna = columna => columna
    ? filasFiltradas.reduce((total, fila) => {
        const valor = parsearNumeroLocale(fila[columna]);
        return total + (isNaN(valor) ? 0 : valor);
      }, 0)
    : 0;
  const contarApariciones = (patrones, columnaBase) => {
    if (!columnaBase) return 0;

    return filasFiltradas.reduce((total, fila) => {
      const valor = String(fila[columnaBase] ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      if (!valor) return total;

      const coincide = patrones.some(patron => {
        const patronNorm = String(patron)
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        return valor === patronNorm || valor.includes(patronNorm);
      });

      return coincide ? total + 1 : total;
    }, 0);
  };
  const totalMuestras = columnaMuestras
    ? sumarColumna(columnaMuestras)
    : 0;
  const totalCriticos = columnaPerfil
    ? filasFiltradas.filter(fila =>
        normalizarNombreColumna(fila[columnaPerfil]) === 'criticos'
      ).length
    : 0;
  const indicadoresResumen = [
    {
      label: 'Muestras',
      valor: totalMuestras,
      color: 'var(--green)'
    },
    {
      label: 'Críticos',
      valor: totalCriticos,
      color: 'var(--purple)'
    }
  ];
  const indicadoresAdicionales = [
    {
      label: 'Bench',
      valor: contarApariciones(['bench'], columnaPerfil),
      color: 'var(--cyan)'
    },
    {
      label: 'Eficiencia Retención',
      valor: contarApariciones(['eficiencia retencion', 'retencion'], columnaPerfil),
      color: 'var(--green)'
    },
    {
      label: 'Eficiencia Retención (M - F)',
      valor: contarApariciones([
        'eficiencia retencion (m - f)',
        'eficiencia retencion m-f',
        'eficiencia retencion m f',
        'm - f',
        'm-f',
        'm f'
      ], columnaPerfil),
      color: 'var(--purple)'
    }
  ];

  [...indicadoresResumen, ...indicadoresAdicionales].forEach(indicador => {
    stripHtml += `
      <div class="kpi-card kpi-card-compact" style="--accent-bar:${indicador.color}">
        <div class="kpi-value" style="color:${indicador.color}">
          ${indicador.valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
        </div>
        <div class="kpi-label">${indicador.label}</div>
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
  const perfilesHtml = esVistaAsesor ? `
    <div class="advisor-history-stack">
      <div class="chart-card perfiles-chart-card">
        <div class="chart-title">Historial de perfiles</div>
        <div class="chart-subtitle">Frecuencia total desde el inicio de la cuenta</div>
        <div class="profile-chart-wrap advisor-treemap-wrap"><div id="advisor-profiles-chart" class="advisor-treemap" role="img" aria-label="Frecuencia histórica de perfiles"></div></div>
      </div>
      <div class="chart-card advisor-history-card">
        <div class="chart-title">Historial de supervisores</div>
        <div class="chart-subtitle">Apariciones y meses asociados al asesor</div>
        <div id="advisor-supervisors-table" class="advisor-table-container"></div>
      </div>
    </div>` : `
    <div class="chart-card perfiles-chart-card">
      <div class="chart-title">Cantidad de perfiles</div>
      <div class="chart-subtitle">REP únicos por Afunilamento Group</div>
      <div class="profile-chart-wrap">
        <canvas id="profiles-chart"></canvas>
      </div>
    </div>`;
  // Cuando el filtro de negocio es "técnica", reemplazar Eficiencia por Resolución
  const negocioActivo = (window.filtrosActivos && window.filtrosActivos.negocio)
    ? normalizarNombreColumna(window.filtrosActivos.negocio)
    : '';
  const esTecnica = negocioActivo.includes('tecnica') || negocioActivo.includes('técnica');

  const eficienciaHtml = esTecnica ? `
    <div class="chart-card quartile-chart-card">
      <div class="chart-title">Resolución por cuartil</div>
      <div class="chart-canvas-wrap">
        <canvas id="resolution-chart"></canvas>
      </div>
    </div>
    <div class="chart-card quartile-chart-card">
      <div class="chart-title">Eficiencia Móvil por cuartil</div>
      <div class="chart-canvas-wrap">
        <canvas id="mobile-efficiency-chart"></canvas>
      </div>
    </div>` : `
    <div class="chart-card quartile-chart-card">
      <div class="chart-title">Eficiencia por cuartil</div>
      <div class="chart-canvas-wrap">
        <canvas id="efficiency-chart"></canvas>
      </div>
    </div>
    <div class="chart-card quartile-chart-card">
      <div class="chart-title">Eficiencia Móvil por cuartil</div>
      <div class="chart-canvas-wrap">
        <canvas id="mobile-efficiency-chart"></canvas>
      </div>
    </div>`;

  /* ─────────── Render al DOM ─────────── */
  grid.innerHTML = `
    <div class="kpi-strip">${stripHtml}</div>
    <div class="visual-dashboard">
      ${perfilesHtml}
      <div class="visual-dashboard-right">
        <div class="stats-grid visual-gauges">${eficienciaHtml}</div>
        ${chartSection}
      </div>
    </div>
  `;

  // Inicializar charts después del render
  setTimeout(() => {
    if (!grid.isConnected || esVistaAsesor !== (vistaActiva === 'asesor')) return;
    if (esVistaAsesor) {
      const columnasHistoricas = Array.from(new Set(filasFiltradas.flatMap(fila => Object.keys(fila || {}))));
      const columnaMesHistorica = window.datosGlobales?.columnaMes;
      const columnaPerfilHistorica = columnasHistoricas.find(columna => normalizarNombreColumna(columna).includes('afunilamento')) || 'Afunilamento Group';
      const columnaSupervisorHistorica = obtenerColumnaHistorica(columnasHistoricas, ['SUP', 'Supervisor']) || 'SUP';
      const mesesHistoricos = Array.from(new Set(
        filasFiltradas.map(fila => obtenerClaveMesHistorico(fila[columnaMesHistorica])).filter(Boolean)
      )).sort();
      const filasHistoricasAsesor = (window.datosGlobales?.filas || []).filter(fila => {
        const proveedor = window.filtrosActivos?.proveedor;
        const negocio = window.filtrosActivos?.negocio;
        const asesor = window.filtrosActivos?.asesorDetalle;
        return (!proveedor || String(fila.Proveedor || '').trim() === String(proveedor).trim()) &&
          (!negocio || String(fila.Negocio || '').trim() === String(negocio).trim()) &&
          (!asesor || String(fila.Rep || '').trim() === String(asesor).trim());
      });
      inicializarHistoricosAsesor(filasFiltradas, filasHistoricasAsesor, mesesHistoricos, columnaMesHistorica, columnaPerfilHistorica, columnaSupervisorHistorica);
    } else {
      initProfilesChart(filasFiltradas);
    }
    initQuartileCharts(filasFiltradas, esTecnica, esVistaAsesor, grid);
    initCharts(metricas, filasFiltradas, grid);
    if (esVistaAsesor) {
      setTimeout(ajustarGraficosAsesor, 120);
    }
  }, 50);

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
  const esVistaAsesor = typeof vistaActiva !== 'undefined' && vistaActiva === 'asesor';
  if (num.length === 0 && !esVistaAsesor) return '';

  // Los dos gráficos históricos requeridos: NPS y Productividad.
  const prioridad = ['nps', 'productividad'];
  const ordenados = [];

  prioridad.forEach(pref => {
    const found = num.find(x => x.columna && normalizarNombreColumna(x.columna).includes(pref));
    if (found || esVistaAsesor) {
      ordenados.push(found || {
        columna: pref === 'nps' ? 'NPS' : 'Productividad',
        label: pref === 'nps' ? 'NPS - Evolución' : 'Productividad - Evolución',
        tipo: 'numero'
      });
    }
  });

  // Construir placeholders de canvas; los datos reales vendrán de datosGlobales
  let cardsHtml = '';
  ordenados.forEach((m, i) => {
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

function mostrarMensajeEnGrafico(elemento, texto) {
  if (!elemento) return;
  const contenedor = elemento.parentElement;
  if (!contenedor) return;
  elemento.remove();
  const mensaje = document.createElement('div');
  mensaje.className = 'chart-empty-message';
  mensaje.textContent = texto;
  contenedor.appendChild(mensaje);
}

function mostrarSinDatosEnGrafico(elemento) {
  mostrarMensajeEnGrafico(elemento, 'El asesor no cuenta con datos de esta métrica');
}

function parsearValorGrafico(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') {
    return null;
  }
  if (!/\d/.test(String(valor))) {
    return null;
  }
  const numero = parseLocaleNumber(valor);
  return Number.isFinite(numero) ? numero : null;
}

function prepararCanvasGrafico(canvas) {
  const contenedor = canvas?.parentElement;
  if (!contenedor) return false;
  canvas.style.display = 'block';
  canvas.width = Math.max(contenedor.clientWidth, 1);
  canvas.height = Math.max(contenedor.clientHeight, 1);
  return true;
}

function ajustarGraficosAsesor() {
  document.querySelectorAll('#advisor-stats-grid .chart-canvas-wrap canvas').forEach(canvas => {
    const contenedor = canvas.parentElement;
    const chart = Object.values(_charts).find(instancia => instancia.canvas === canvas);
    if (!contenedor || !chart) return;
    const ancho = Math.round(contenedor.getBoundingClientRect().width);
    const alto = Math.round(contenedor.getBoundingClientRect().height);
    if (ancho <= 1 || alto <= 1) return;
    canvas.width = ancho;
    canvas.height = alto;
    chart.resize(ancho, alto);
    chart.update('none');
  });
}

function initCharts(metricas, filasFiltradas = [], root = document) {
  const chartColors = ['#00c2ff', '#00d68f'];

  for (let i = 0; i < 2; i++) {
    const canvas = root.querySelector(`#chart-${i}`);
    if (!canvas) continue;

    _destroyChart(`chart-${i}`);

    const columna = canvas.dataset.columna;
    // Si no hay columna, intentar tomar del metricas en orden
    let colName = columna || (metricas.filter(m => m.tipo === 'numero')[i] || {}).columna;
    if (!colName) {
      mostrarSinDatosEnGrafico(canvas);
      continue;
    }

    // Construir labels basados en la columna de mes real (normalizando seriales de Excel y strings)
    // Usar exactamente las filas que pasaron los filtros de fecha, proveedor
    // y PCRC. Así la serie histórica coincide con el resto del dashboard.
    const filasSerie = Array.isArray(filasFiltradas) ? filasFiltradas : [];
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
    const mesesClaves = Array.from(new Set(filasSerie.map(r => toMonthKey(r[columnaMes])).filter(Boolean)));
    mesesClaves.sort((a,b) => a.localeCompare(b));

    // Calcular promedio por cada clave (mes)
    const data = mesesClaves.map(key => {
      if (!columnaMes) return 0;
      const filas = filasSerie.filter(f => toMonthKey(f[columnaMes]) === key);
      // No contar celdas vacías como cero: el promedio debe coincidir con el
      // cálculo de la columna en la tabla Perfiles.
      const vals = filas
        .map(r => parsearValorGrafico(r[colName]))
        .filter(n => n !== null);
      if (vals.length === 0) return null;
      const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
      return avg;
    });

    // Sin un rango seleccionado, mostrar únicamente los meses que realmente
    // tienen información cargada para la métrica. Si el usuario filtra por
    // fecha, conservar todos los meses comprendidos en su selección.
    const hayFiltroFecha = Boolean(
      document.getElementById('date-start')?.value ||
      document.getElementById('date-end')?.value
    );
    const serie = mesesClaves
      .map((key, indice) => ({ key, valor: data[indice] }))
      .filter(punto => hayFiltroFecha || punto.valor !== null);
    const labels = serie.map(punto => formatMonthLabel(punto.key));
    const valores = serie.map(punto => punto.valor);

    if (!valores.some(valor => valor !== null && !isNaN(valor))) {
      mostrarSinDatosEnGrafico(canvas);
      continue;
    }

    if (typeof Chart === 'undefined') {
      mostrarMensajeEnGrafico(canvas, 'No se pudo cargar el gráfico');
      continue;
    }

    const col = chartColors[i % chartColors.length];
    if (!prepararCanvasGrafico(canvas)) {
      mostrarMensajeEnGrafico(canvas, 'No se pudo cargar el gráfico');
      continue;
    }

    try {
      _charts[`chart-${i}`] = new Chart(canvas, {
        type: i === 0 ? 'bar' : 'line',
        data: {
          labels,
          datasets: [{
            data: valores,
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
          responsive: vistaActiva !== 'asesor',
          maintainAspectRatio: false,
          layout: {
            padding: { left: 8, right: 16, top: 4, bottom: 12 }
          },
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8ba3cc', font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8ba3cc', font: { size: 10 } } }
          }
        }
      });
    } catch (error) {
      console.error(`No se pudo renderizar ${colName}:`, error);
      mostrarMensajeEnGrafico(canvas, 'No se pudo cargar el gráfico');
    }
  }
}

function initProfilesChart(filasFiltradas = []) {
  if (typeof Chart === 'undefined') return;

  const canvas = document.getElementById('profiles-chart');
  if (!canvas) return;
  _destroyChart('profiles-chart');

  const columnas = Array.from(new Set([
    ...(window.datosGlobales?.columnas || []),
    ...filasFiltradas.flatMap(fila => Object.keys(fila || {}))
  ]));
  const columnaPerfil = columnas.find(
    columna => normalizarNombreColumna(columna).includes('afunilamento')
  );
  const columnaRep = columnas.find(
    columna => normalizarNombreColumna(columna) === 'rep'
  );

  if (!columnaPerfil) return;

  // Un mismo REP puede aparecer en varios meses. Dentro de cada perfil se
  // cuenta una sola vez para el período y los filtros seleccionados.
  const repsPorPerfil = new Map();
  filasFiltradas.forEach((fila, indice) => {
    const perfil = String(fila[columnaPerfil] || '').trim();
    if (!perfil) return;

    const rep = String(fila[columnaRep] || '').trim();
    const identificador = rep || `fila-${indice}`;
    if (!repsPorPerfil.has(perfil)) repsPorPerfil.set(perfil, new Set());
    repsPorPerfil.get(perfil).add(identificador);
  });

  const ordenados = Array.from(repsPorPerfil, ([perfil, reps]) => ({
    perfil,
    cantidad: reps.size
  })).sort((a, b) => b.cantidad - a.cantidad);

  const labels = ordenados.map(item => `${item.perfil} (${item.cantidad})`);
  const printLabels = ordenados.map(item => {
    const texto = item.perfil;
    if (texto.length <= 24) return `${texto} (${item.cantidad})`;

    const palabras = texto.split(/\s+/);
    let primeraLinea = '';
    let segundaLinea = '';
    palabras.forEach(palabra => {
      if (!segundaLinea && `${primeraLinea} ${palabra}`.trim().length <= 24) {
        primeraLinea = `${primeraLinea} ${palabra}`.trim();
      } else {
        segundaLinea = `${segundaLinea} ${palabra}`.trim();
      }
    });
    return [primeraLinea, `${segundaLinea} (${item.cantidad})`.trim()];
  });
  const data = ordenados.map(item => item.cantidad);
  const colores = ordenados.map((_, i) =>
    ['#00c2ff', '#00d68f', '#a78bfa', '#ffd600', '#ff4d6a'][i % 5]
  );

  _charts['profiles-chart'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colores.map(color => `${color}b8`),
        borderColor: colores,
        borderWidth: 1,
        borderRadius: 5,
        barThickness: 18
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { left: 14, right: 20, top: 4, bottom: 12 }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: contexto => ` ${contexto.raw.toLocaleString('es-AR')} REP`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#8ba3cc',
            precision: 0
          }
        },
        y: {
          grid: { display: false },
          ticks: {
            color: '#8ba3cc',
            font: { size: 10 },
            autoSkip: false
          }
        }
      }
    }
  });
  _charts['profiles-chart'].$screenLabels = labels;
  _charts['profiles-chart'].$printLabels = printLabels;
}

function initQuartileCharts(filasFiltradas = [], esTecnica = false, esVistaAsesor = false, root = document) {
  const configuraciones = [
    esTecnica
      ? {
          id: 'resolution-chart',
          columnaValor: 'Resolución',
          columnaCuartil: 'Quartil Eficiencia'
        }
      : {
          id: 'efficiency-chart',
          columnaValor: 'Eficiencia',
          columnaCuartil: 'Quartil Eficiencia'
        },
    {
      id: 'mobile-efficiency-chart',
      columnaValor: 'Eficiencia Móvil',
      columnaCuartil: 'Quartil Eficiencia Móvil'
    }
  ];
  const colores = {
    Q1: '#00d68f',
    Q2: '#00c2ff',
    Q3: '#ffd600',
    Q4: '#ff4d6a'
  };
  const columnaMes = window.datosGlobales ? window.datosGlobales.columnaMes : null;
  const columnas = Array.from(new Set([
    ...(window.datosGlobales?.columnas || []),
    ...filasFiltradas.flatMap(fila => Object.keys(fila || {}))
  ]));
  const buscarColumna = nombre => columnas.find(
    columna => normalizarNombreColumna(columna) === normalizarNombreColumna(nombre)
  );
  const claveMes = valor => {
    const fecha = parsearFechaParaFiltro(valor);
    if (!fecha) return null;
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
  };
  const etiquetaMes = clave => {
    const [anio, mes] = clave.split('-').map(Number);
    return new Date(anio, mes - 1, 1).toLocaleString('es-AR', {
      month: 'short',
      year: 'numeric'
    });
  };

  configuraciones.forEach(configuracion => {
    const canvas = root.querySelector(`#${configuracion.id}`);
    if (!canvas) return;
    if (!columnaMes) {
      mostrarSinDatosEnGrafico(canvas);
      return;
    }
    _destroyChart(configuracion.id);

    const columnaValor = buscarColumna(configuracion.columnaValor);
    const columnaCuartil = buscarColumna(configuracion.columnaCuartil);
    if (!columnaValor || !columnaCuartil) {
      mostrarSinDatosEnGrafico(canvas);
      return;
    }

    const acumulados = new Map();
    filasFiltradas.forEach(fila => {
      const mes = claveMes(fila[columnaMes]);
      const cuartil = String(fila[columnaCuartil] || '').trim().toUpperCase();
      const valor = parsearValorGrafico(fila[columnaValor]);
      if (!mes || !['Q1', 'Q2', 'Q3', 'Q4'].includes(cuartil) || valor === null) return;

      const clave = `${mes}|${cuartil}`;
      if (!acumulados.has(clave)) acumulados.set(clave, { suma: 0, cantidad: 0 });
      const acumulado = acumulados.get(clave);
      acumulado.suma += valor;
      acumulado.cantidad += 1;
    });

    const meses = Array.from(new Set(
      Array.from(acumulados.keys()).map(clave => clave.split('|')[0])
    )).sort();
    if (meses.length === 0) {
      mostrarSinDatosEnGrafico(canvas);
      return;
    }
    if (typeof Chart === 'undefined') {
      mostrarMensajeEnGrafico(canvas, 'No se pudo cargar el gráfico');
      return;
    }
    if (!prepararCanvasGrafico(canvas)) {
      mostrarMensajeEnGrafico(canvas, 'No se pudo cargar el gráfico');
      return;
    }
    const datasets = ['Q1', 'Q2', 'Q3', 'Q4'].map(cuartil => ({
      label: cuartil,
      data: meses.map(mes => {
        const acumulado = acumulados.get(`${mes}|${cuartil}`);
        return acumulado ? acumulado.suma / acumulado.cantidad : null;
      }),
      borderColor: colores[cuartil],
      backgroundColor: colores[cuartil],
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
      spanGaps: true,
      hidden: !['Q3', 'Q4'].includes(cuartil)
    }));

    try {
      _charts[configuracion.id] = new Chart(canvas, {
        type: 'line',
        data: {
          labels: meses.map(etiquetaMes),
          datasets
        },
        options: {
          responsive: !esVistaAsesor,
          maintainAspectRatio: false,
          layout: {
            padding: { left: 10, right: 16, top: 4, bottom: 12 }
          },
          interaction: { mode: 'nearest', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#8ba3cc',
                usePointStyle: true,
                boxWidth: 7,
                font: { size: 10 }
              }
            },
            tooltip: {
              callbacks: {
                label: contexto =>
                  ` ${contexto.dataset.label}: ${Number(contexto.raw).toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}`
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: {
                color: '#8ba3cc',
                font: { size: 9 }
              }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: { color: '#8ba3cc', font: { size: 9 } }
            }
          }
        }
      });
    } catch (error) {
      console.error(`No se pudo renderizar ${configuracion.id}:`, error);
      mostrarMensajeEnGrafico(canvas, 'No se pudo cargar el gráfico');
    }
  });
}

function obtenerClaveMesHistorico(valor) {
  const fecha = parsearFechaParaFiltro(valor);
  if (!fecha || isNaN(fecha.getTime())) return null;
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

function formatearMesHistorico(clave) {
  const fecha = new Date(`${clave}-01T00:00:00`);
  return fecha.toLocaleString('es-AR', { month: 'short', year: 'numeric' });
}

function obtenerColumnaHistorica(columnas, nombres) {
  return columnas.find(columna => {
    const normalizada = normalizarNombreColumna(columna);
    return nombres.some(nombre => normalizada === normalizarNombreColumna(nombre));
  });
}

function renderizarDetalleAsesor(filasFiltradas = []) {
  const section = document.getElementById('advisor-section');
  const grid = document.getElementById('advisor-stats-grid');
  const select = document.getElementById('advisor-select');
  const title = document.getElementById('advisor-title');
  if (!section || !grid || !select || !title) return;

  limpiarError();
  section.style.display = 'block';
  const proveedorActivo = window.filtrosActivos?.proveedor || '';
  const proveedoresDelAsesor = asesorActivo
    ? Array.from(new Set(
        window.datosGlobales.filas
          .filter(fila => String(fila.Rep || '').trim() === asesorActivo)
          .map(fila => String(fila.Proveedor || '').trim())
          .filter(Boolean)
      )).sort((a, b) => a.localeCompare(b, 'es'))
    : [];
  const etiquetaProveedor = proveedorActivo ||
    (proveedoresDelAsesor.length ? proveedoresDelAsesor.join(' / ') : 'Todos los proveedores');
  title.textContent = asesorActivo
    ? `${asesorActivo} · ${etiquetaProveedor}`
    : `Detalle por asesor · ${etiquetaProveedor}`;

  const filasParaAsesores = filtrarPorRangoFechas(
    window.datosGlobales.filas,
    document.getElementById('date-start')?.value || '',
    document.getElementById('date-end')?.value || '',
    window.datosGlobales.columnaMes
  ).filter(fila => {
    const proveedor = window.filtrosActivos?.proveedor;
    const negocio = window.filtrosActivos?.negocio;
    return (!proveedor || String(fila.Proveedor || '').trim() === String(proveedor).trim()) &&
      (!negocio || String(fila.Negocio || '').trim() === String(negocio).trim());
  });
  const asesores = Array.from(new Set(
    filasParaAsesores.map(fila => String(fila.Rep || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, 'es'));

  const valorActual = asesorActivo || '';
  select.innerHTML = '';
  const opcionTodos = document.createElement('option');
  opcionTodos.value = '';
  opcionTodos.textContent = 'Todos los asesores';
  select.appendChild(opcionTodos);
  asesores.forEach(asesor => {
    const opcion = document.createElement('option');
    opcion.value = asesor;
    opcion.textContent = asesor;
    select.appendChild(opcion);
  });
  select.value = asesores.includes(valorActual) ? valorActual : '';

  const metricas = calcularMetricas(filasFiltradas, window.datosGlobales.tipos);
  renderizarMetricas(metricas, filasFiltradas, {
    targetId: 'advisor-stats-grid',
    sectionId: 'advisor-section',
    vista: 'asesor'
  });
}

function calcularLayoutTreemap(items, total) {
  if (!items.length || !total) return [];

  const resultado = [];
  const pendientes = items.map(item => ({ ...item }));
  let x = 0;
  let y = 0;
  let width = 1;
  let height = 1;
  let restante = total;

  const peorProporcion = (fila, lado, escala) => {
    const areas = fila.map(item => item.frecuencia * escala);
    const suma = areas.reduce((totalArea, area) => totalArea + area, 0);
    const minimo = Math.min(...areas);
    const maximo = Math.max(...areas);
    if (!suma || !minimo) return Infinity;
    return Math.max((lado * lado * maximo) / (suma * suma), (suma * suma) / (lado * lado * minimo));
  };

  const colocarFila = fila => {
    const areaFila = fila.reduce((suma, item) => suma + item.frecuencia, 0) / restante * width * height;
    const horizontal = width < height;
    if (horizontal) {
      const filaHeight = areaFila / width;
      let cursor = x;
      fila.forEach(item => {
        const itemWidth = (item.frecuencia / fila.reduce((suma, actual) => suma + actual.frecuencia, 0)) * width;
        resultado.push({ ...item, x: cursor, y, width: itemWidth, height: filaHeight });
        cursor += itemWidth;
      });
      y += filaHeight;
      height -= filaHeight;
    } else {
      const filaWidth = areaFila / height;
      let cursor = y;
      fila.forEach(item => {
        const itemHeight = (item.frecuencia / fila.reduce((suma, actual) => suma + actual.frecuencia, 0)) * height;
        resultado.push({ ...item, x, y: cursor, width: filaWidth, height: itemHeight });
        cursor += itemHeight;
      });
      x += filaWidth;
      width -= filaWidth;
    }
    restante -= fila.reduce((suma, item) => suma + item.frecuencia, 0);
  };

  while (pendientes.length && width > 0 && height > 0) {
    const fila = [];
    const lado = Math.min(width, height);
    const escala = width * height / restante;
    while (pendientes.length) {
      const siguiente = pendientes[0];
      const actual = peorProporcion(fila, lado, escala);
      const candidato = peorProporcion([...fila, siguiente], lado, escala);
      if (fila.length === 0 || candidato <= actual) {
        fila.push(pendientes.shift());
      } else {
        break;
      }
    }
    colocarFila(fila);
  }

  return resultado;
}

function inicializarHistoricosAsesor(filas, filasHistoricas, meses, columnaMes, columnaPerfil, columnaSupervisor) {
  const labels = meses.map(formatearMesHistorico);
  const perfilesPorFrecuencia = new Map();
  filasHistoricas.forEach(fila => {
    const perfil = String(fila[columnaPerfil] || '').trim();
    if (perfil) perfilesPorFrecuencia.set(perfil, (perfilesPorFrecuencia.get(perfil) || 0) + 1);
  });
  const perfiles = Array.from(perfilesPorFrecuencia, ([perfil, frecuencia]) => ({ perfil, frecuencia }))
    .sort((a, b) => b.frecuencia - a.frecuencia || a.perfil.localeCompare(b.perfil, 'es'));
  const colores = ['#00c2ff', '#00d68f', '#a78bfa', '#ffd600', '#ff4d6a', '#ff9f43'];
  const treemap = document.getElementById('advisor-profiles-chart');
  if (treemap) {
    treemap.innerHTML = '';
    const totalFrecuencia = perfiles.reduce((total, item) => total + item.frecuencia, 0);
    const rectangulos = calcularLayoutTreemap(perfiles, totalFrecuencia);
    rectangulos.forEach(({ perfil, frecuencia, x, y, width, height }, indice) => {
      const bloque = document.createElement('div');
      bloque.className = 'advisor-treemap-tile';
      bloque.style.left = `${x * 100}%`;
      bloque.style.top = `${y * 100}%`;
      bloque.style.width = `${width * 100}%`;
      bloque.style.height = `${height * 100}%`;
      bloque.style.background = `linear-gradient(135deg, ${colores[indice % colores.length]}dd, ${colores[indice % colores.length]}77)`;
      bloque.title = `${perfil}: ${frecuencia} apariciones históricas`;
      bloque.setAttribute('aria-label', `${perfil}: ${frecuencia} apariciones históricas`);
      bloque.innerHTML = `<strong>${perfil}</strong><span>${frecuencia} ${frecuencia === 1 ? 'vez' : 'veces'}</span>`;
      treemap.appendChild(bloque);
    });
  }

  const supervisores = new Map();
  filas.forEach((fila) => {
    const supervisor = String(fila[columnaSupervisor] || '').trim();
    const mes = obtenerClaveMesHistorico(fila[columnaMes]);
    if (!supervisor || !mes) return;
    if (!supervisores.has(supervisor)) {
      supervisores.set(supervisor, { supervisor, apariciones: 0, meses: new Set() });
    }
    const registro = supervisores.get(supervisor);
    registro.apariciones += 1;
    registro.meses.add(mes);
  });

  const filasSupervisores = Array.from(supervisores.values())
    .sort((a, b) => b.apariciones - a.apariciones || a.supervisor.localeCompare(b.supervisor, 'es'))
    .map(registro => ({
      supervisor: registro.supervisor,
      apariciones: registro.apariciones,
      meses: Array.from(registro.meses).sort().map(formatearMesHistorico).join(', ')
    }));
  renderizarTablaSupervisores(filasSupervisores);
}

function renderizarTablaSupervisores(filas) {
  const contenedor = document.getElementById('advisor-supervisors-table');
  if (!contenedor) return;

  const filasPorPagina = 8;
  let pagina = 0;
  const totalPaginas = Math.max(1, Math.ceil(filas.length / filasPorPagina));

  const pintar = () => {
    const inicio = pagina * filasPorPagina;
    const visibles = filas.slice(inicio, inicio + filasPorPagina);
    contenedor.innerHTML = '';

    const tabla = document.createElement('table');
    tabla.className = 'advisor-supervisors-table';
    tabla.innerHTML = `
      <thead><tr><th>Supervisor</th><th>Apariciones</th><th>Meses</th></tr></thead>
      <tbody></tbody>`;
    const cuerpo = tabla.querySelector('tbody');
    visibles.forEach(fila => {
      const filaTabla = document.createElement('tr');
      filaTabla.innerHTML = `<td></td><td></td><td></td>`;
      filaTabla.children[0].textContent = fila.supervisor;
      filaTabla.children[1].textContent = fila.apariciones.toLocaleString('es-AR');
      filaTabla.children[2].textContent = fila.meses;
      cuerpo.appendChild(filaTabla);
    });
    contenedor.appendChild(tabla);

    const pie = document.createElement('div');
    pie.className = 'advisor-table-pagination';
    pie.innerHTML = `
      <span> ${filas.length ? inicio + 1 : 0}-${Math.min(inicio + filasPorPagina, filas.length)} de ${filas.length}</span>
      <div class="advisor-table-actions">
        <button type="button" class="advisor-page-button" aria-label="Supervisores anteriores">‹</button>
        <button type="button" class="advisor-page-button" aria-label="Supervisores siguientes">›</button>
      </div>`;
    const botones = pie.querySelectorAll('button');
    botones[0].disabled = pagina === 0;
    botones[1].disabled = pagina >= totalPaginas - 1;
    botones[0].addEventListener('click', () => { pagina -= 1; pintar(); });
    botones[1].addEventListener('click', () => { pagina += 1; pintar(); });
    contenedor.appendChild(pie);
  };

  pintar();
}
