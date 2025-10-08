const express = require('express');
const router = express.Router();
const validarCotizacion = require('../middleware/validarCotizacion');
const cotizadorController = require('../controllers/backend_Interface/cotizadorController');

//paginas
router.get("/estudiolista", cotizadorController.listar);
router.get("/estudio", cotizadorController.EstudioCot);
router.get("/carga", cotizadorController.CargaXML);
router.get("/descarga", cotizadorController.DescargaXML);
router.get("/resultado", cotizadorController.ResultadosXML);

//---------------Apis-----------------------------//

//cotizador
router.get("/api/solicitudes", cotizadorController.getSolicitudes);
router.post("/api/cargaresultado", cotizadorController.CargaResultados);
router.post("/api/respuestas", cotizadorController.getRespuestas);
router.post("/api/validasol", cotizadorController.postValidacion);
router.post("/api/aceptasol", cotizadorController.postAceptaCotizacion);
router.post("/api/tasasInd", cotizadorController.getTasasTopes);
router.get("/api/regiones", cotizadorController.getRegion);
router.get("/api/provincias/:idRegion", cotizadorController.getProvincia);
router.get("/api/distritos/:idProvincia", cotizadorController.getDistrito);
router.get("/api/distrito-info/:idDistrito", cotizadorController.getDistritoInfo);



//cotizador Estudio
router.post("/api/guardar", cotizadorController.guardar);
router.delete("/api/eliminar/:id", cotizadorController.eliminar);
router.get("/api/pdf/:id", cotizadorController.generarPDF);
module.exports = router;