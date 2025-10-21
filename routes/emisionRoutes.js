const express = require('express');
const router = express.Router();
const emisionController = require('../controllers/backend_Interface/emisionController');
const path = require('path');

//paginas
router.get("/prepolizas", emisionController.PrePolizas); // render EJS
router.get("/prcprepoliza", emisionController.PrcPrePoliza); // render EJS

//apis
router.get('/api/cotizaciones', emisionController.listCotizaciones);
router.get('/api/polizas', emisionController.listPolizas);

module.exports = router;