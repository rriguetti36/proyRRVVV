const express = require('express');
const router = express.Router();
const jwtAuth = require('../middleware/jwtAuth');
const rutinaController = require('../controllers/rutinaController');
const cargasolController = require('../controllers/cargasolController');
//const consultaController = require('../controllers/consultasController');
//const emisionController = require('../controllers/emisionController');
//const reservasController = require('../controllers/reservasController');
const validarCotizacion = require('../middleware/validarCotizacion');

// Rutas de clientes

router.post("/asignacionasesor", jwtAuth, cargasolController.AsignacionIntermediarios);
router.post("/cargasol", jwtAuth,
    express.text({ type: ['application/xml'] }),
    cargasolController.ProcesaSolicitud);
router.post("/calcular", jwtAuth, validarCotizacion, rutinaController.calcular);
router.post('/generar-xml', jwtAuth, rutinaController.generaXMLsalida);
router.post("/calcularOfi_optim", rutinaController.calcularofi_hilo);
//router.post('/calcularpagos', jwtAuth, emisionController.ProcesoCalculoPagos);
//router.post('/calculareservas', jwtAuth, reservasController.ProcesoCalculoReservas);
//router.post('/consultar', jwtAuth, consultaController.consultar);
//router.post("/calcularOfi", rutinaController.calcularofi);


module.exports = router;