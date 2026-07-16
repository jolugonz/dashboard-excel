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

/**
 * Calcula estadísticas básicas de las columnas numéricas
 * @param {Object[]} filas - Array de filas
 * @param {Object} tipos - Objeto con tipos de columnas
 * @returns {Object} - Estadísticas por columna
 */
function calcularEstadisticas(filas, tipos) {
  const estadisticas = {};
  
  Object.keys(tipos).forEach(columna => {
    if (tipos[columna] === 'numero') {
      const valores = filas
        .map(fila => {
          const valor = fila[columna];
          return typeof valor === 'number' ? valor : parseFloat(valor);
        })
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
 * @param {Object[]} filas
 * @param {Object} tipos
 * @returns {Object[]}
 */
function calcularMetricas(filas, tipos) {
  const estadisticas = calcularEstadisticas(filas, tipos);
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
    label: 'Total de Registros',
    valor: datosOriginales.length,
    icono: '📊'
  });
  
  // Tarjetas de estadísticas numéricas
  Object.keys(estadisticas).forEach(columna => {
    const stats = estadisticas[columna];
    
    tarjetas.push({
      tipo: 'numero',
      columna: columna,
      label: `Promedio - ${columna}`,
      valor: formatearNumero(stats.promedio),
      meta: `Mín: ${formatearNumero(stats.minimo)} | Máx: ${formatearNumero(stats.maximo)}`,
      icono: '📈'
    });
  });
  
  return tarjetas;
}
