const express = require('express');
const router = express.Router();
const fs = require('fs');
//const validarCotizacion = require('../middleware/validarCotizacion');
const cotizadorController = require('../controllers/backend_Interface/cotizadorController');
const multer = require('multer');
const path = require('path');

const uploadPath = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

//paginas
router.get("/estudiolista", cotizadorController.listar); // render EJS
router.get("/estudio", cotizadorController.EstudioCot); // render EJS
router.get("/carga", cotizadorController.CargaXML); // render EJS
router.get("/descarga", cotizadorController.DescargaXML); // render EJS
router.get("/resultado", cotizadorController.ResultadosXML); // render EJS
router.get('/parametros', cotizadorController.Paramtetros); // render EJS
router.get("/tasas", cotizadorController.listarTasas); // render EJS
router.get("/valores", cotizadorController.listarValores); // render EJS
// router.get("/tasas/limites", cotizadorController.LimiteIni); // render EJS
// router.get('/tasas/inversiones', cotizadorController.rentabilidad); // render EJS
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

//Parametros
router.get('/api/cabecera', cotizadorController.Cabecera);
router.post('/api/addcabecera', cotizadorController.addCabecera);
router.get('/api/detalle/:idpar', cotizadorController.getDetalles);
router.post('/api/adddetalle', cotizadorController.addDetalle);
router.put('/api/upddetalle/:id', cotizadorController.updateDetalle);
router.delete('/api/deldetalle/:id', cotizadorController.deleteDetalle);

//tasas
router.get("/api/modulo/:nombre", cotizadorController.cargarModulo);
router.get('/api/filtrar', cotizadorController.filtrar);
router.get('/api/listar/:f_creacion', cotizadorController.listarPorFecha);
router.post('/api/upload', upload.single('archivoXLS'), cotizadorController.uploadExcel);
router.post('/api/actualizar', cotizadorController.actualizar);
router.get('/api/regiones', cotizadorController.regiones);
router.get('/api/monedas', cotizadorController.monedas);
router.get('/api/prestaciones', cotizadorController.prestaciones);
router.get('/api/filtrarRentabilidad', cotizadorController.filtrarRentabiliad);
router.post('/api/guardarRentabilidad', cotizadorController.guardarentabilidad);
router.get('/api/valorpromedio', cotizadorController.obtenervalorvtapromedio);
router.post('/api/guardarpromedio', cotizadorController.guardarvtapromedio);
router.get('/api/periodoscurva', cotizadorController.listPeriodosCurva);
router.get('/api/filtrarcurva', cotizadorController.filtrarByFechaCurva); // ?fecha=YYYY-MM-DD
router.post('/api/uploadcurva', upload.single('archivoExcel'), cotizadorController.uploadExcelCurva); // multer inside controller or middleware

//valores
router.get('/api/filtrargastos', cotizadorController.obtenerPorPeriodoYMonedaGastos);
router.post('/api/guardargastos', cotizadorController.guardarGastos);
router.post('/api/guardargastosb', cotizadorController.guardarGastosb);
router.get('/api/obtenerperiodosipc', cotizadorController.obtenerPorPeriodoIPC);
router.post('/api/guardaripc', cotizadorController.guardarIPC);
router.get('/api/obtenerperiodostc', cotizadorController.obtenerPorFechaTC);
router.post('/api/guardartc', cotizadorController.guardarTC);   
router.get('/api/obtenerperiodostcm', cotizadorController.obtenerPorFechaTCM);
router.post('/api/guardartcm', cotizadorController.guardarTCM);  
module.exports = router;