/**
 * main.js
 * Punto de entrada del dashboard. Conecta el input de archivo,
 * con la lectura del Excel y la renderización de datos.
 */

let datosGlobales = {
  columnas: [],
  filas: [],
  meses: [],
};

// ============================================
// EVENT LISTENERS
// ============================================

// Escuchamos el evento "change" cuando el usuario selecciona un archivo
const inputExcel = document.getElementById("excel-input");
inputExcel.addEventListener("change", cargarYProcesarExcel);

// Escuchamos cambios en el filtro de mes
const monthFilter = document.getElementById("month-filter");
monthFilter.addEventListener("change", actualizarVista);

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
    };

    // Mostrar nombre del archivo
    mostrarNombreArchivo(archivo.name);

    // Renderizar filtro de meses
    renderizarFiltroMeses(datosGlobales.meses);

    // Mostrar todos los datos inicialmente
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
  const mesSeleccionado = monthFilter.value;

  // Filtrar datos según el mes
  const filasFiltradasPorMes = filtrarPorMes(
    datosGlobales.filas,
    mesSeleccionado
  );

  if (filasFiltradasPorMes.length === 0) {
    mostrarError("No hay datos para el mes seleccionado");
    return;
  }

  limpiarError();

  // Calcular métricas
  const metricas = calcularMetricas(
    filasFiltradasPorMes,
    datosGlobales.columnas
  );

  // Renderizar tabla
  renderizarTabla(filasFiltradasPorMes, datosGlobales.columnas);

  // Renderizar métricas
  renderizarMetricas(metricas);

  // Scroll suave a los resultados
  const filtersSection = document.getElementById("filters-section");
  if (filtersSection) {
    setTimeout(() => {
      filtersSection.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }
}
