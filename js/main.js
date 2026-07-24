/**
 * main.js
 * Punto de entrada del dashboard. Conecta el input de archivo,
 * con la lectura del Excel y la renderización de datos.
 */

let datosGlobales = {
  columnas: [],
  filas: [],
  meses: [],
  tipos: {},
  columnaMes: null,
};

// estado de filtros adicionales
let filtrosActivos = { proveedor: null, negocio: null };

window.setFiltroProveedor = function(valor) {
  filtrosActivos.proveedor = valor === filtrosActivos.proveedor ? null : valor;
  actualizarVista();
  actualizarBotonesFiltro();
};

window.setFiltroNegocio = function(valor) {
  filtrosActivos.negocio = valor === filtrosActivos.negocio ? null : valor;
  actualizarVista();
  actualizarBotonesFiltro();
};

function actualizarBotonesFiltro() {
  const btns = document.querySelectorAll('.btn-filter');
  btns.forEach(b => {
    const v = b.dataset.value;
    const activo = b.dataset.filter === 'proveedor'
      ? v === filtrosActivos.proveedor
      : v === filtrosActivos.negocio;
    b.setAttribute('aria-pressed', String(activo));
    if (activo) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

// ============================================
// EVENT LISTENERS
// ============================================

// Escuchamos el evento "change" cuando el usuario selecciona un archivo
const inputExcel = document.getElementById("excel-input");
inputExcel.addEventListener("change", cargarYProcesarExcel);

// Escuchamos cambios en el rango de fechas
const dateStart = document.getElementById("date-start");
const dateEnd = document.getElementById("date-end");
const resetFilter = document.getElementById("reset-filter");
const downloadPdf = document.getElementById("download-pdf");

if (dateStart) {
  dateStart.addEventListener("change", actualizarVista);
}

if (dateEnd) {
  dateEnd.addEventListener("change", actualizarVista);
}

if (resetFilter) {
  resetFilter.addEventListener("click", limpiarFiltroFechas);
}

if (downloadPdf) {
  downloadPdf.addEventListener("click", () => {
    window.print();
  });
}

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

/**
 * Carga y procesa el archivo Excel seleccionado
 */
async function cargarYProcesarExcel(evento) {
  const archivo = evento.target.files[0];

  // Si el usuario canceló la selección, no hacemos nada
  if (!archivo) return;

  try {
    limpiarError();

    // Leer el archivo Excel
    const datos = await leerArchivoExcel(archivo);

    // Extraer y normalizar la tabla "perfiles"
    const filasRawPerfil = obtenerTablaPerfil(datos);
    const datosNormalizados = normalizarDatosPerfil(filasRawPerfil);

    // Guardar datos globales
    datosGlobales = {
      columnas: datosNormalizados.columnas,
      filas: datosNormalizados.filas,
      meses: datosNormalizados.meses,
      tipos: datosNormalizados.tipos,
      columnaMes: datosNormalizados.columnaMes,
    };
    // Exponer en window para que render.js pueda usar los datos
    window.datosGlobales = datosGlobales;

    // Mostrar nombre del archivo
    mostrarNombreArchivo(archivo.name);

    // Ocultar la sección de carga y mostrar los controles
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) {
      uploadSection.style.display = 'none';
    }

    // Renderizar filtro de fechas
    renderizarFiltroMeses(datosGlobales.meses);
    // Renderizar filtros adicionales (Proveedor / Negocio)
    if (typeof renderizarFiltrosAdicionales === 'function') renderizarFiltrosAdicionales();

    // Actualizar la vista inicial
    actualizarVista();

    console.log("✓ Datos cargados exitosamente", datosGlobales);
  } catch (error) {
    console.error("Error al procesar el Excel:", error);
    mostrarError(`Error: ${error.message}`);
  }
}

/**
 * Actualiza la vista (tabla y métricas) según el mes seleccionado
 */
function actualizarVista() {
  const fechaInicio = dateStart ? dateStart.value : "";
  const fechaFin = dateEnd ? dateEnd.value : "";

  const filasFiltradas = filtrarPorRangoFechas(
    datosGlobales.filas,
    fechaInicio,
    fechaFin,
    datosGlobales.columnaMes
  );

  // Aplicar filtros adicionales si existen
  let filasFiltradas2 = filasFiltradas;
  if (filtrosActivos.proveedor) {
    filasFiltradas2 = filasFiltradas2.filter(f => String(f['Proveedor'] || '').trim() === String(filtrosActivos.proveedor).trim());
  }
  if (filtrosActivos.negocio) {
    filasFiltradas2 = filasFiltradas2.filter(f => String(f['Negocio'] || '').trim() === String(filtrosActivos.negocio).trim());
  }

  if (filasFiltradas2.length === 0) {
    mostrarError("No hay datos para el rango de fechas seleccionado / filtro activo");
    return;
  }

  limpiarError();

  const metricas = calcularMetricas(filasFiltradas2, datosGlobales.tipos);
  renderizarMetricas(metricas, filasFiltradas2);

  const controlsSection = document.getElementById("controls-section");
  if (controlsSection) {
    setTimeout(() => {
      controlsSection.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }
}

function limpiarFiltroFechas() {
  if (dateStart) {
    dateStart.value = "";
  }

  if (dateEnd) {
    dateEnd.value = "";
  }

  actualizarVista();
}
