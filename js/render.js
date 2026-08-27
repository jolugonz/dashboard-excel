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
    chart.resize(contenedor.clientWidth, 210);
    chart.update('none');
  });
});

window.addEventListener('afterprint', () => {
  Object.entries(_charts).forEach(([id, chart]) => {
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
  if (res)  res.style.display  = 'none';
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

  // Proveedores
  const proveedores = Array.from(new Set(window.datosGlobales.filas.map(f => f['Proveedor']).filter(Boolean))).slice(0,50);
  const provWrap = document.createElement('div');
  provWrap.className = 'filter-buttons';
  proveedores.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'btn-filter';
    btn.textContent = p;
    btn.dataset.value = p;
    btn.dataset.filter = 'proveedor';
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => {
      if (typeof window.setFiltroProveedor === 'function') window.setFiltroProveedor(p);
    });
    provWrap.appendChild(btn);
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
function renderizarMetricas(metricas, filasFiltradas = []) {
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
      <div class="kpi-card kpi-card-compact" style="--accent-bar:var(--cyan)">
        <div class="kpi-value big">${cardRegistros.valor.toLocaleString('es-AR')}</div>
        <div class="kpi-label">${cardRegistros.label}</div>
      </div>`;
  }

  const columnasFiltradas = Array.from(new Set(
    filasFiltradas.flatMap(fila => Object.keys(fila || {}))
  ));
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
  const perfilesHtml = buildProfilesCssChart(filasFiltradas);
  const eficienciaHtml = buildQuartileCssCharts(filasFiltradas);

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
    initCharts(metricas, filasFiltradas);
    initQuartileTooltips();
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
  if (num.length === 0) return '';

  // Los dos gráficos históricos requeridos: NPS y Productividad.
  const prioridad = ['nps', 'productividad'];
  const ordenados = [];

  prioridad.forEach(pref => {
    const found = num.find(x => x.columna && normalizarNombreColumna(x.columna).includes(pref));
    if (found) ordenados.push(found);
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

function initCharts(metricas, filasFiltradas = []) {
  if (typeof Chart === 'undefined') return;
  const chartColors = ['#00c2ff', '#00d68f'];

  for (let i = 0; i < 2; i++) {
    const canvas = document.getElementById(`chart-${i}`);
    if (!canvas) continue;

    _destroyChart(`chart-${i}`);

    const columna = canvas.dataset.columna;
    // Si no hay columna, intentar tomar del metricas en orden
    let colName = columna || (metricas.filter(m => m.tipo === 'numero')[i] || {}).columna;
    if (!colName) continue;

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
        .map(r => parsearNumeroLocale(r[colName]))
        .filter(n => !isNaN(n));
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

    const col = chartColors[i % chartColors.length];

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
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { left: 8, right: 16, top: 4, bottom: 12 }
        },
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#8ba3cc',
              autoSkip: false,
              maxRotation: 45,
              minRotation: 0,
              align: 'center',
              padding: 3,
              font: { size: 10 }
            }
          },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8ba3cc', font: { size: 10 } } }
        }
      }
    });
  }
}

function buildProfilesCssChart(filasFiltradas = []) {
  const columnas = Array.from(new Set(
    filasFiltradas.flatMap(fila => Object.keys(fila || {}))
  ));
  const columnaPerfil = columnas.find(
    columna => normalizarNombreColumna(columna).includes('afunilamento')
  );
  const columnaRep = columnas.find(
    columna => normalizarNombreColumna(columna) === 'rep'
  );

  if (!columnaPerfil) {
    return `
      <div class="chart-card perfiles-chart-card">
        <div class="chart-title">Cantidad de perfiles</div>
        <div class="chart-subtitle">REP únicos por Afunilamento Group</div>
        <div class="profile-chart-wrap profile-chart-empty">Sin datos de perfiles</div>
      </div>`;
  }

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

  const maximo = ordenados[0]?.cantidad || 1;
  const colores = ['#00c2ff', '#00d68f', '#a78bfa', '#ffd600', '#ff4d6a'];
  const escaparHtml = texto => String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const filasHtml = ordenados.map((item, indice) => {
    const ancho = (item.cantidad / maximo) * 100;
    const color = colores[indice % colores.length];
    return `
      <div class="profile-bar-row">
        <div class="profile-bar-label" title="${escaparHtml(item.perfil)}">
          <span>${escaparHtml(item.perfil)}</span>
          <strong>${item.cantidad.toLocaleString('es-AR')}</strong>
        </div>
        <div class="profile-bar-track" role="img" aria-label="${escaparHtml(item.perfil)}: ${item.cantidad} REP">
          <span class="profile-bar-fill" style="--bar-width:${ancho}%;--bar-color:${color}"></span>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="chart-card perfiles-chart-card">
      <div class="chart-title">Cantidad de perfiles</div>
      <div class="chart-subtitle">REP únicos por Afunilamento Group</div>
      <div class="profile-chart-wrap">
        <div class="profile-bars" role="list" aria-label="Cantidad de perfiles">
          ${filasHtml || '<div class="profile-chart-empty">Sin datos de perfiles</div>'}
        </div>
      </div>
    </div>`;
}

function buildQuartileCssCharts(filasFiltradas = []) {
  const configuraciones = [
    {
      titulo: 'Eficiencia por cuartil',
      columnaValor: 'Eficiencia',
      columnaCuartil: 'Quartil Eficiencia'
    },
    {
      titulo: 'Eficiencia Móvil por cuartil',
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
  const columnas = Array.from(new Set(
    filasFiltradas.flatMap(fila => Object.keys(fila || {}))
  ));
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
    const etiquetaEje = clave => {
      const [anio, mes] = clave.split('-').map(Number);
      const nombreMes = new Date(anio, mes - 1, 1).toLocaleString('es-AR', { month: 'short' });
      return `${nombreMes.replace('.', '')} '${String(anio).slice(-2)}`;
    };

  const escaparHtml = texto => String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  return configuraciones.map(configuracion => {
    const columnaValor = buscarColumna(configuracion.columnaValor);
    const columnaCuartil = buscarColumna(configuracion.columnaCuartil);
    const acumulados = new Map();

    if (columnaMes && columnaValor && columnaCuartil) {
      filasFiltradas.forEach(fila => {
        const mes = claveMes(fila[columnaMes]);
        const cuartil = String(fila[columnaCuartil] || '').trim().toUpperCase();
        const valor = parsearNumeroLocale(fila[columnaValor]);
        if (!mes || !['Q1', 'Q2', 'Q3', 'Q4'].includes(cuartil) || isNaN(valor)) return;

        const clave = `${mes}|${cuartil}`;
        if (!acumulados.has(clave)) acumulados.set(clave, { suma: 0, cantidad: 0 });
        const acumulado = acumulados.get(clave);
        acumulado.suma += valor;
        acumulado.cantidad += 1;
      });
    }

    const meses = Array.from(new Set(
      Array.from(acumulados.keys()).map(clave => clave.split('|')[0])
    )).sort();
    const valores = meses.flatMap(mes => ['Q1', 'Q2', 'Q3', 'Q4'].map(cuartil => {
      const acumulado = acumulados.get(`${mes}|${cuartil}`);
      return acumulado ? acumulado.suma / acumulado.cantidad : null;
    }).filter(valor => valor !== null));
    const minimo = Math.min(...valores, 0);
    let maximo = Math.max(...valores, 0);
    if (maximo === minimo) maximo = minimo + 1;
    const posicionY = valor => {
      const proporcion = (maximo - valor) / (maximo - minimo);
      return Math.min(88, Math.max(8, 8 + proporcion * 80));
    };
    const series = cuartil => meses.map((mes, indice) => {
      const acumulado = acumulados.get(`${mes}|${cuartil}`);
      if (!acumulado) return null;
      return {
        y: posicionY(acumulado.suma / acumulado.cantidad),
        valor: acumulado.suma / acumulado.cantidad
      };
    });
    const seriesHtml = ['Q1', 'Q2', 'Q3', 'Q4'].map(cuartil => {
      const puntos = series(cuartil);
      const segmentos = puntos.map((punto, indice) => {
        if (!punto) return '<div class="quartile-css-segment is-empty"></div>';
        const tieneAnterior = puntos.slice(0, indice).some(Boolean);
        const anterior = tieneAnterior ? puntos.slice(0, indice).reverse().find(Boolean) : punto;
        const valor = punto.valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const claseInicio = tieneAnterior ? '' : ' is-first';
        return `<div class="quartile-css-segment${claseInicio}" style="--y:${punto.y}%;--py:${anterior.y}%"><span class="quartile-point" role="button" tabindex="0" data-quartile="${cuartil}" data-month="${escaparHtml(etiquetaMes(meses[indice]))}" data-value="${valor}"></span></div>`;
      }).join('');
      return `<div class="quartile-css-series quartile-${cuartil.toLowerCase()}" style="--line-color:${colores[cuartil]}">${segmentos}</div>`;
    }).join('');
    const etiquetasHtml = meses.map((mes, indice) => {
      const posicionEtiqueta = ((indice + 0.5) / meses.length) * 100;
      return `<span style="--label-position:${posicionEtiqueta}%">${escaparHtml(etiquetaEje(mes))}</span>`;
    }).join('');
    const graficoHtml = meses.length
      ? `<div class="quartile-css-chart" style="--month-count:${meses.length}" role="img" aria-label="${escaparHtml(configuracion.titulo)}"><div class="quartile-css-stage"><div class="quartile-grid-lines">${[0, 25, 50, 75, 100].map(y => `<span style="--grid-y:${y}%"></span>`).join('')}</div>${seriesHtml}</div><div class="quartile-axis-labels">${etiquetasHtml}</div></div>`
      : '<div class="profile-chart-empty">Sin datos de cuartiles</div>';

    return `
      <div class="chart-card quartile-chart-card">
        <div class="chart-title">${configuracion.titulo}</div>
        <div class="quartile-legend" aria-label="Cuartiles">
          ${['Q1', 'Q2', 'Q3', 'Q4'].map(cuartil => `<span><i style="--legend-color:${colores[cuartil]}"></i>${cuartil}</span>`).join('')}
        </div>
        <div class="quartile-chart-wrap">
          ${graficoHtml}
          ${meses.length ? '<div class="quartile-tooltip" role="status" aria-live="polite"></div>' : ''}
        </div>
      </div>`;
  }).join('');
}

function initQuartileTooltips() {
  document.querySelectorAll('.quartile-chart-wrap').forEach(contenedor => {
    const tooltip = contenedor.querySelector('.quartile-tooltip');
    if (!tooltip) return;

    contenedor.querySelectorAll('.quartile-point').forEach(punto => {
      const mostrar = evento => {
        tooltip.innerHTML = `<span class="quartile-tooltip-dot" style="--tooltip-color:${punto.parentElement.parentElement.style.getPropertyValue('--line-color')}"></span><span><b>${punto.dataset.quartile}</b> · ${punto.dataset.month}</span><strong>${punto.dataset.value}</strong>`;
        tooltip.classList.add('is-visible');
        mover(evento);
      };
      const mover = evento => {
        const rect = contenedor.getBoundingClientRect();
        const puntoRect = punto.getBoundingClientRect();
        const margen = 10;
        const ancho = tooltip.offsetWidth;
        const alto = tooltip.offsetHeight;
        const izquierda = Math.min(
          Math.max(puntoRect.left - rect.left + puntoRect.width / 2 - ancho / 2, margen),
          rect.width - ancho - margen
        );
        const arriba = Math.max(puntoRect.top - rect.top - alto - margen, margen);
        tooltip.style.left = `${izquierda}px`;
        tooltip.style.top = `${arriba}px`;
      };
      const ocultar = () => tooltip.classList.remove('is-visible');

      punto.addEventListener('mouseenter', mostrar);
      punto.addEventListener('mousemove', mover);
      punto.addEventListener('mouseleave', ocultar);
      punto.addEventListener('focus', mostrar);
      punto.addEventListener('blur', ocultar);
      punto.setAttribute('tabindex', '0');
    });
  });
}
