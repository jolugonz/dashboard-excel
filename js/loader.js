/**
 * loader.js
 * Este módulo se encarga de leer el archivo Excel que el usuario selecciona
 * y convertirlo en datos que JavaScript pueda entender.
 */

function leerArchivoExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // Esto se ejecuta CUANDO TERMINA de leer el archivo
    reader.onload = function (evento) {
      try {
        const datos = evento.target.result;
        const libro = XLSX.read(datos, { type: "binary" });

        const resultado = {};

        // Recorremos cada hoja del Excel
        libro.SheetNames.forEach((nombreHoja) => {
          const hoja = libro.Sheets[nombreHoja];
          // Convertimos la hoja a un array de objetos (uno por fila)
          resultado[nombreHoja] = XLSX.utils.sheet_to_json(hoja);
        });

        resolve(resultado);
      } catch (error) {
        reject(error);
      }
    };

    // Esto se ejecuta SI HAY UN ERROR al leer
    reader.onerror = function (error) {
      reject(error);
    };

    // Iniciamos la lectura del archivo en formato binario
    reader.readAsBinaryString(file);
  });
}