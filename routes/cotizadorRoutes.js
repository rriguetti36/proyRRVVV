const express = require('express');
const router = express.Router();
const cotizadorController = require('../controllers/backend_Interface/cotizadorController');

//paginas
router.get("/estudio", cotizadorController.EstudioCot);
router.get("/carga", cotizadorController.CargaXML);
router.get("/descarga", cotizadorController.DescargaXML);
router.get("/resultado", cotizadorController.ResultadosXML);

//Api
router.get("/api/solicitudes", cotizadorController.getSolicitudes);
router.post("/api/cargaresultado", cotizadorController.CargaResultados);
router.post("/api/respuestas", cotizadorController.getRespuestas);
router.post("/api/validasol", cotizadorController.postValidacion);
router.post("/api/aceptasol", cotizadorController.postAceptaCotizacion);
router.post("/api/tasasInd", cotizadorController.getTasasTopes);
module.exports = router;