const express = require('express');
const router = express.Router();
const jwtAuth = require('../middleware/jwtAuth');
const rutinaController = require('../controllers/rutinaController');
const cargasolController = require('../controllers/cargasolController');
const consultaController = require('../controllers/consultasController');
const emisionController = require('../controllers/emisionController');

// Rutas de clientes
router.post("/calcular", jwtAuth, rutinaController.calcular);
router.post("/cargasol", jwtAuth,
    express.text({ type: ['application/xml'] }),
    cargasolController.ProcesaSolicitud);
router.post('/generar-xml', jwtAuth, rutinaController.generaXMLsalida);
router.post('/consultar', jwtAuth, consultaController.consultar);
router.post('/calcularpagos', jwtAuth, emisionController.ProcesoCalculoPagos);

//router.post("/calcularOfi", rutinaController.calcularofi);
//router.post("/calcularOfi_optim", rutinaController.calcularofi_hilo);

module.exports = router;