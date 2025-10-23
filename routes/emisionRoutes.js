const express = require('express');
const router = express.Router();
const emisionController = require('../controllers/backend_Interface/emisionController');
const path = require('path');

//paginas
router.get("/prepolizas", emisionController.PrePolizas); // render EJS
router.get("/prcprepoliza/:id_cot", emisionController.PrcPrePoliza); // render EJS

//apis
router.get('/api/cotizaciones', emisionController.listCotizaciones);
router.get('/api/polizas', emisionController.listPolizas);
router.get("/api/getbeneficiario/:id_cot", emisionController.getBeneficiariosPorCotizacion); // Obtener todos los beneficiarios de una cotización
router.get("/api/getbeneficiario/:id_cot/:id_orden", emisionController.getBeneficiarioById); // Obtener beneficiario específico (por id_orden)

module.exports = router;