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

if (dateStart) {
  dateStart.addEventListener("change", actualizarVista);
}

if (dateEnd) {
  dateEnd.addEventListener("change", actualizarVista);
}

if (resetFilter) {
  resetFilter.addEventListener("click", limpiarFiltroFechas);
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

    // Mostrar nombre del archivo
    mostrarNombreArchivo(archivo.name);

    // Ocultar la sección de carga y mostrar los controles
    const uploadSection = document.querySelector('.upload-section');
    if (uploadSection) {
      uploadSection.style.display = 'none';
    }

    // Renderizar filtro de fechas
    renderizarFiltroMeses(datosGlobales.meses);

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

  if (filasFiltradas.length === 0) {
    mostrarError("No hay datos para el rango de fechas seleccionado");
    return;
  }

  limpiarError();

  const metricas = calcularMetricas(filasFiltradas, datosGlobales.tipos);
  renderizarMetricas(metricas);

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
