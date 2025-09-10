const express = require('express');
const router = express.Router();
const jwtAuth = require('../middleware/jwtAuth');
const cargasolController = require('../controllers/cargasolController');
const consultaController = require('../controllers/consultasController');
const emisionController = require('../controllers/emisionController');
const reservasController = require('../controllers/reservasController');

//ruta de lo archivos para listar o consultar datos
//TABLAS DE COTIZACION
router.get("/", cargasolController.Listados);

module.exports = router;