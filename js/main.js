/**
 * main.js
 * Punto de entrada del dashboard. Conecta el input de archivo
 * con la lectura del Excel y (por ahora) muestra el resultado en consola.
 */

// Buscamos el input donde el usuario selecciona el archivo
const inputExcel = document.getElementById("excel-input");

// Escuchamos el evento "change", que se dispara cuando el usuario elige un archivo
inputExcel.addEventListener("change", async (evento) => {
  const archivo = evento.target.files[0];

  // Si el usuario canceló la selección, no hacemos nada
  if (!archivo) return;

  try {
    const datos = await leerArchivoExcel(archivo);
    console.log("Datos leídos del Excel:", datos);
    const nombresTablas = obtenerNombresDeTablas(datos);
    nombresTablas.forEach((nombre) => {
      const tablaNormalizada = normalizarTabla(nombre, datos[nombre]);
      console.log(tablaNormalizada);
    });
  } catch (error) {
    console.error("Hubo un error al leer el archivo:", error);
  }
});