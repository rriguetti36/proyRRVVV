const express = require('express');
const router = express.Router();
const emisionController = require('../controllers/backend_Interface/emisionController');
const path = require('path');
const auth = require('../middleware/authMiddleware');
const validarEmision = require('../middleware/validarEmision');

//paginas
router.get("/prepolizas", auth, emisionController.PrePolizas); // render EJS
router.get("/prcprepoliza/:id_cot", auth, emisionController.PrcPrePoliza); // render EJS
router.get("/prcprepolizaedit/:id_cot", auth, emisionController.PrcPrePolizaEdit); // render EJS
router.get("/prcantecedenteafp/:id_cot", auth, emisionController.prcantecedenteafp); // render EJS
router.get("/prcemision/:id_cot", auth, emisionController.prcemision); // render EJS
router.get("/prcgenarchivo", auth, emisionController.PrcGeneraArchivo); // render EJS
router.get("/lisprimasrecepcionadas", auth, emisionController.ListaPrimasRecepcionadas); // render EJS

//apis
router.get('/api/cotizaciones', auth, emisionController.listCotizaciones);
router.get('/api/polizas', auth, emisionController.listPolizas);
router.get("/api/getcotizacionafi/:id_cot", auth, emisionController.getCotizacionAfibyId);
router.get("/api/getbeneficiario/:id_cot", auth, emisionController.getBeneficiariosPorCotizacion); // Obtener todos los beneficiarios de una cotización
router.get("/api/getbeneficiario/:id_cot/:id_orden", auth, emisionController.getBeneficiarioById); // Obtener beneficiario específico (por id_orden)
router.post("/api/grabarprepoliza", auth, validarEmision, emisionController.GrabarPrepoliza);
/* router.post("/api/grabarprepoliza",
    (req, res, next) => {
        console.log("👉 Paso 1: llegada a la ruta");
        next();
    },
    auth,
    (req, res, next) => {
        console.log("👉 Paso 2: pasó auth");
        next();
    },
    validarEmision,
    (req, res, next) => {
        console.log("👉 Paso 3: pasó validarEmision");
        next();
    },
    emisionController.GrabarPrepoliza
); */
module.exports = router;