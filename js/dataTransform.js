/**
 * dataTransform.js
 * Este módulo toma los datos crudos que devuelve loader.js y los prepara
 * para que render.js los pueda usar fácilmente: qué columnas tiene cada
 * tabla y de qué tipo es cada columna (número, fecha o texto).
 */

/**
 * Devuelve los nombres de todas las tablas (hojas) leídas del Excel.
 * @param {Object} datosExcel - Objeto donde cada clave es el nombre de una hoja
 * @returns {string[]} - Array con los nombres de las hojas
 */
function obtenerNombresDeTablas(datosExcel) {
  return Object.keys(datosExcel);
}

/**
 * Devuelve los nombres de las columnas de una tabla, mirando la primera fila.
 * @param {Object[]} filas - Array de filas (cada fila es un objeto)
 * @returns {string[]} - Array con los nombres de las columnas
 */
function obtenerColumnas(filas) {
  if (!filas || filas.length === 0) return [];
  return Object.keys(filas[0]);
}

/**
 * Detecta si una columna contiene principalmente números, fechas o texto.
 * @param {Object[]} filas - Array de filas
 * @param {string} nombreColumna - Nombre de la columna a analizar
 * @returns {"numero"|"fecha"|"texto"}
 */
function detectarTipoColumna(filas, nombreColumna) {
  // Buscamos la primera fila donde esta columna tenga un valor real
  const filaConValor = filas.find(
    (fila) => fila[nombreColumna] !== undefined && fila[nombreColumna] !== ""
  );

  if (!filaConValor) return "texto";

  const valor = filaConValor[nombreColumna];

  if (typeof valor === "number") {
    return "numero";
  }

  const posibleFecha = new Date(valor);
  const esFechaValida = !isNaN(posibleFecha.getTime());

  // Evitamos que un número corto tipo "5" o "2024" se confunda con fecha
  if (esFechaValida && typeof valor === "string" && valor.length > 4) {
    return "fecha";
  }

  return "texto";
}

/**
 * Convierte una tabla cruda en un objeto normalizado con metadata útil
 * (columnas y tipos) además de las filas originales.
 * @param {string} nombre - Nombre de la tabla/hoja
 * @param {Object[]} filas - Array de filas de esa tabla
 * @returns {Object} - { nombre, columnas, tipos, filas }
 */
function normalizarTabla(nombre, filas) {
  const columnas = obtenerColumnas(filas);

  const tipos = {};
  columnas.forEach((columna) => {
    tipos[columna] = detectarTipoColumna(filas, columna);
  });

  return {
    nombre,
    columnas,
    tipos,
    filas,
  };
}

/**
 * Busca la hoja de perfiles dentro del libro Excel y devuelve sus filas.
 * @param {Object} datosExcel - Objeto donde cada clave es el nombre de una hoja
 * @returns {Object[]} - Filas de la tabla de perfiles
 */
function obtenerTablaPerfil(datosExcel) {
  if (!datosExcel || typeof datosExcel !== "object") return [];

  const nombresDeTablas = Object.keys(datosExcel);
  if (nombresDeTablas.length === 0) return [];

  const tablaPerfil = nombresDeTablas.find((nombre) => /perfil/i.test(nombre));

  if (tablaPerfil) {
    return Array.isArray(datosExcel[tablaPerfil]) ? datosExcel[tablaPerfil] : [];
  }

  for (const nombre of nombresDeTablas) {
    const filas = datosExcel[nombre];
    if (Array.isArray(filas) && filas.length > 0) {
      return filas;
    }
  }

  return [];
}

/**
 * Normaliza la tabla de perfiles para el dashboard.
 * @param {Object[]} filas - Filas de la tabla de perfiles
 * @returns {Object} - Datos listos para renderizar y filtrar
 */
function normalizarDatosPerfil(filas) {
  if (!Array.isArray(filas) || filas.length === 0) {
    return {
      columnas: [],
      filas: [],
      meses: [],
      tipos: {},
      columnaMes: null,
    };
  }

  const tablaNormalizada = normalizarTabla("Perfiles", filas);
  const columnas = tablaNormalizada.columnas;

  let columnaMes = null;
  for (const columna of columnas) {
    if (esColumnaMes(filas, columna)) {
      columnaMes = columna;
      break;
    }
  }

  const meses = columnaMes ? extraerMesesUnicos(filas, columnaMes) : [];

  return {
    columnas,
    filas,
    meses,
    tipos: tablaNormalizada.tipos,
    columnaMes,
  };
}