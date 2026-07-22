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

function normalizarNombreColumna(nombre) {
  return String(nombre || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parsearNumeroLocale(valor) {
  if (valor === null || valor === undefined) return NaN;
  if (typeof valor === 'number' && !isNaN(valor)) return valor;

  let texto = String(valor).trim();
  if (texto === '') return NaN;

  texto = texto.replace(/\s/g, '');
  texto = texto.replace(/[%€$₱¥£₹]/g, '');

  const patrones = [
    /^[+-]?(\d{1,3}(\.\d{3})+)(,\d+)?$/, // 1.234,56
    /^[+-]?\d+(,\d+)?$/, // 1234,56 o 123456
    /^[+-]?(\d{1,3}(,\d{3})+)(\.\d+)?$/, // 1,234.56
    /^[+-]?\d+(\.\d+)?$/ // 1234.56 o 1234
  ];

  const tieneComa = texto.includes(',');
  const tienePunto = texto.includes('.');

  if (patrones[0].test(texto)) {
    texto = texto.replace(/\./g, '').replace(/,/g, '.');
  } else if (patrones[2].test(texto)) {
    texto = texto.replace(/,/g, '');
  } else if (patrones[3].test(texto)) {
    // deja el punto decimal
  } else if (patrones[1].test(texto)) {
    texto = texto.replace(/,/g, '.');
  } else {
    return NaN;
  }

  const numero = parseFloat(texto);
  return Number.isFinite(numero) ? numero : NaN;
}

function normalizarFilaKeys(fila) {
  if (!fila || typeof fila !== 'object') return fila;
  return Object.entries(fila).reduce((acc, [key, value]) => {
    const nombreNormalizado = String(key || '')
      .replace(/\uFEFF|\u200B|\u200C|\u200D/g, '')
      .trim();

    if (nombreNormalizado) {
      acc[nombreNormalizado] = value;
    }
    return acc;
  }, {});
}

/**
 * Detecta si una columna contiene principalmente números, fechas o texto.
 * @param {Object[]} filas - Array de filas
 * @param {string} nombreColumna - Nombre de la columna a analizar
 * @returns {"numero"|"fecha"|"texto"}
 */
function detectarTipoColumna(filas, nombreColumna) {
  // Revisar varias filas para decidir el tipo, no solo la primera
  const valores = filas
    .map(fila => fila[nombreColumna])
    .filter(valor => valor !== undefined && valor !== null && valor !== "")
    .slice(0, 5);

  if (valores.length === 0) return "texto";

  let candidatoNumero = 0;
  let candidatoFecha = 0;
  let candidatoTexto = 0;

  valores.forEach((valor) => {
    if (typeof valor === "number") {
      candidatoNumero += 1;
      return;
    }

    if (typeof valor === 'string') {
      const numero = parsearNumeroLocale(valor);
      if (!isNaN(numero)) {
        candidatoNumero += 1;
        return;
      }
    }

    const posibleFecha = new Date(valor);
    const esFechaValida = !isNaN(posibleFecha.getTime());
    if (esFechaValida && typeof valor === "string" && valor.length > 4) {
      candidatoFecha += 1;
      return;
    }

    candidatoTexto += 1;
  });

  if (candidatoNumero >= candidatoFecha && candidatoNumero >= candidatoTexto) {
    return "numero";
  }

  if (candidatoFecha > candidatoTexto) {
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
    const filas = Array.isArray(datosExcel[tablaPerfil]) ? datosExcel[tablaPerfil] : [];
    return filas.map(normalizarFilaKeys);
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