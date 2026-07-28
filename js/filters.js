/**
 * filters.js
 * Este módulo se encarga de gestionar los filtros del dashboard
 * Detecta columnas de mes y proporciona funciones de filtrado
 */

/**
 * Detecta si una columna es de tipo "mes" analizando su contenido
 * @param {Object[]} filas - Array de filas
 * @param {string} nombreColumna - Nombre de la columna a analizar
 * @returns {boolean}
 */
function esColumnaMes(filas, nombreColumna) {
  const nombreLower = nombreColumna.toLowerCase();
  
  // Palabras clave que identifican una columna de mes
  const palabrasClaveMes = ['mes', 'month', 'mês', 'período', 'periodo', 'fecha', 'date'];
  
  if (palabrasClaveMes.some(palabra => nombreLower.includes(palabra))) {
    return true;
  }
  
  return false;
}

/**
 * Extrae todos los meses únicos de una columna
 * @param {Object[]} filas - Array de filas
 * @param {string} nombreColumna - Nombre de la columna de mes
 * @returns {string[]} - Array de meses únicos y ordenados
 */
function extraerMesesUnicos(filas, nombreColumna) {
  const meses = new Set();
  
  filas.forEach(fila => {
    const valor = fila[nombreColumna];
    if (valor !== undefined && valor !== null && valor !== '') {
      meses.add(String(valor).trim());
    }
  });
  
  // Convertir a array y ordenar
  return Array.from(meses).sort((a, b) => {
    // Intentar ordenar como fechas primero
    const fechaA = new Date(a);
    const fechaB = new Date(b);
    
    if (!isNaN(fechaA.getTime()) && !isNaN(fechaB.getTime())) {
      return fechaA - fechaB;
    }
    
    // Si no son fechas, ordenar alfabéticamente
    return a.localeCompare(b);
  });
}

/**
 * Filtra las filas según el mes seleccionado
 * @param {Object[]} filas - Array de filas original
 * @param {string} mesFiltro - Mes seleccionado para filtrar
 * @param {string|null} nombreColumna - Nombre de la columna de mes
 * @returns {Object[]} - Array de filas filtradas
 */
function filtrarPorMes(filas, mesFiltro, nombreColumna) {
  if (!mesFiltro || mesFiltro === '' || !nombreColumna) {
    return filas;
  }
  
  return filas.filter(fila => {
    const valorMes = String(fila[nombreColumna] || '').trim();
    return valorMes === mesFiltro;
  });
}

function parsearFechaParaFiltro(valor) {
  if (valor instanceof Date) {
    return isNaN(valor.getTime()) ? null : valor;
  }

  // Excel guarda normalmente las fechas como la cantidad de días transcurridos
  // desde 1899-12-30. new Date(45505) interpretaría ese valor como milisegundos
  // de 1970, por lo que todos los registros quedarían fuera del filtro.
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const milisegundos = Math.round((valor - 25569) * 86400000);
    const fechaUtc = new Date(milisegundos);
    if (isNaN(fechaUtc.getTime())) return null;

    // Devolver medianoche local para compararla con los inputs type="date".
    return new Date(
      fechaUtc.getUTCFullYear(),
      fechaUtc.getUTCMonth(),
      fechaUtc.getUTCDate()
    );
  }

  if (typeof valor !== 'string') {
    return null;
  }

  const texto = valor.trim();
  if (!texto) {
    return null;
  }

  // También puede llegar un serial de Excel convertido a texto.
  if (/^\d+(?:\.\d+)?$/.test(texto)) {
    return parsearFechaParaFiltro(Number(texto));
  }

  // Formato ISO completo o mensual: YYYY-MM-DD / YYYY-MM.
  let coincidencia = texto.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/);
  if (coincidencia) {
    return new Date(
      Number(coincidencia[1]),
      Number(coincidencia[2]) - 1,
      Number(coincidencia[3] || 1)
    );
  }

  // Formato habitual en archivos en español: DD/MM/YYYY.
  coincidencia = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (coincidencia) {
    return new Date(
      Number(coincidencia[3]),
      Number(coincidencia[2]) - 1,
      Number(coincidencia[1])
    );
  }

  const fecha = new Date(texto);
  if (!isNaN(fecha.getTime())) {
    return fecha;
  }

  return null;
}

function filtrarPorRangoFechas(filas, fechaInicio, fechaFin, nombreColumna) {
  if (!nombreColumna) {
    return filas;
  }

  const crearLimiteMes = (valor, esFin) => {
    if (!valor) return null;
    const coincidencia = String(valor).match(/^(\d{4})-(\d{2})/);
    if (!coincidencia) return null;
    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);
    return esFin
      ? new Date(anio, mes, 0, 23, 59, 59, 999)
      : new Date(anio, mes - 1, 1, 0, 0, 0, 0);
  };

  const inicio = crearLimiteMes(fechaInicio, false);
  const fin = crearLimiteMes(fechaFin, true);

  return filas.filter((fila) => {
    const valor = fila[nombreColumna];
    if (valor === undefined || valor === null || valor === '') {
      return false;
    }

    const fechaValor = parsearFechaParaFiltro(valor);
    if (!fechaValor) {
      return false;
    }

    const tiempoValor = fechaValor.getTime();
    if (inicio && tiempoValor < inicio.getTime()) {
      return false;
    }

    if (fin && tiempoValor > fin.getTime()) {
      return false;
    }

    return true;
  });
}

/**
 * Calcula estadísticas básicas de las columnas numéricas
 * @param {Object[]} filas - Array de filas
 * @param {Object} tipos - Objeto con tipos de columnas
 * @param {string[]} columnasObligatorias - Columnas que siempre deben procesarse
 * @returns {Object} - Estadísticas por columna
 */
function calcularEstadisticas(filas, tipos, columnasObligatorias = []) {
  const estadisticas = {};
  
  Object.keys(tipos).forEach(columna => {
    const nombreNormalizado = normalizarNombreColumna(columna);
    
    // Procesar si: es tipo 'numero' O es una columna obligatoria
    const esObligatoria = columnasObligatorias.some(col => 
      normalizarNombreColumna(col) === nombreNormalizado
    );
    const esNumerico = tipos[columna] === 'numero';
    
    if (esNumerico || esObligatoria) {
      const valores = filas
        .map(fila => parsearNumeroLocale(fila[columna]))
        .filter(v => !isNaN(v));

      if (valores.length > 0) {
        estadisticas[columna] = {
          suma: valores.reduce((a, b) => a + b, 0),
          promedio: valores.reduce((a, b) => a + b, 0) / valores.length,
          minimo: Math.min(...valores),
          maximo: Math.max(...valores),
          cantidad: valores.length
        };
      }
    }
  });
  
  return estadisticas;
}

/**
 * Calcula métricas de la tabla usando los tipos de columna.
 * Asegura que Productividad y NPS siempre se incluyan
 * @param {Object[]} filas
 * @param {Object} tipos
 * @returns {Object[]}
 */
function calcularMetricas(filas, tipos) {
  // El dashboard debe resumir únicamente estas métricas. Mes e ID pueden ser
  // numéricos en Excel, pero no son indicadores cuyo promedio tenga sentido.
  const columnasMetricas = ['Productividad', 'NPS'];
  const tiposMetricas = Object.keys(tipos).reduce((resultado, columna) => {
    const esMetrica = columnasMetricas.some(
      metrica => normalizarNombreColumna(metrica) === normalizarNombreColumna(columna)
    );
    if (esMetrica) {
      resultado[columna] = tipos[columna];
    }
    return resultado;
  }, {});

  const estadisticas = calcularEstadisticas(filas, tiposMetricas, columnasMetricas);
  return generarTarjetasEstadisticas(estadisticas, tipos, filas);
}

/**
 * Formatea un número para mostrar en el dashboard
 * @param {number} numero - Número a formatear
 * @param {number} decimales - Cantidad de decimales (default: 2)
 * @returns {string} - Número formateado
 */
function formatearNumero(numero, decimales = 2) {
  if (isNaN(numero)) return '0';
  
  return numero.toLocaleString('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  });
}

/**
 * Genera un resumen de estadísticas para mostrar en tarjetas
 * @param {Object} estadisticas - Objeto con estadísticas
 * @param {Object} tipos - Objeto con tipos de columnas
 * @param {Object} datosOriginales - Datos originales para contar filas
 * @returns {Object[]} - Array de objetos para renderizar tarjetas
 */
function generarTarjetasEstadisticas(estadisticas, tipos, datosOriginales) {
  const tarjetas = [];
  
  // Tarjeta de cantidad de registros
  tarjetas.push({
    tipo: 'cantidad',
    columna: 'Registros',
    label: 'Registros',
    valor: datosOriginales.length,
    icono: '📊'
  });
  
  // Prioridad de columnas para mostrar primero
  const columnasConPrioridad = ['Productividad', 'NPS'];
  
  // Procesar primero las columnas con prioridad
  columnasConPrioridad.forEach(colPrioridad => {
    const columnaEnEstadisticas = Object.keys(estadisticas).find(col => 
      normalizarNombreColumna(col) === normalizarNombreColumna(colPrioridad)
    );
    
    if (columnaEnEstadisticas && estadisticas[columnaEnEstadisticas]) {
      const stats = estadisticas[columnaEnEstadisticas];
      const nombreNormalizado = normalizarNombreColumna(columnaEnEstadisticas);
      
      let label = `Promedio - ${columnaEnEstadisticas}`;
      if (nombreNormalizado.includes('productividad')) {
        label = 'Productividad - Evolución';
      } else if (nombreNormalizado.includes('nps')) {
        label = 'NPS - Evolución';
      }
      
      tarjetas.push({
        tipo: 'numero',
        columna: columnaEnEstadisticas,
        label: label,
        valor: formatearNumero(stats.promedio),
        meta: `Mín: ${formatearNumero(stats.minimo)} | Máx: ${formatearNumero(stats.maximo)}`,
        icono: '📈'
      });
    }
  });
  
  // Luego añadir el resto de estadísticas (excepto las ya añadidas)
  Object.keys(estadisticas).forEach(columna => {
    // Saltar si ya fue añadida en prioridad
    if (columnasConPrioridad.some(col => 
      normalizarNombreColumna(col) === normalizarNombreColumna(columna)
    )) {
      return;
    }
    
    const stats = estadisticas[columna];
    const label = `Promedio - ${columna}`;

    tarjetas.push({
      tipo: 'numero',
      columna: columna,
      label: label,
      valor: formatearNumero(stats.promedio),
      meta: `Mín: ${formatearNumero(stats.minimo)} | Máx: ${formatearNumero(stats.maximo)}`,
      icono: '📈'
    });
  });
  
  return tarjetas;
}
