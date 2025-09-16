const express = require('express');
const router = express.Router();
const cotizadorController = require('../controllers/backend_Interface/cotizadorController');

router.get("/carga", cotizadorController.CargaXML);
router.get("/descarga", cotizadorController.DescargaXML);
router.get("/api/solicitudes", cotizadorController.getSolicitudes);
router.get("/resultado", cotizadorController.ResultadosXML);
router.post("/cargaresultado", cotizadorController.CargaResultados);
module.exports = router;