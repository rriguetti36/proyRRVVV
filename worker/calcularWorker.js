const { parentPort, workerData } = require('worker_threads');
const {
  calcularpension_ini_opti
} = require('../servicios/calculos');

(async () => {
  try {
    const resultado = await calcularpension_ini_opti(
      workerData.idsoliictud,
      workerData.objDatosMod,
      workerData.objDatoflujos,
      workerData.sumprc,
      workerData.TasasCurvaCero,
      workerData.TasasRentabilidad
    );
    parentPort.postMessage({ ok: true, resultado });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error.message });
  }
})();