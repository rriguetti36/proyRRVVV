const express = require('express');
const router = express.Router();
const fs = require('fs');
//const validarCotizacion = require('../middleware/validarCotizacion');
const cotizadorController = require('../controllers/backend_Interface/cotizadorController');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/authMiddleware');

const uploadPath = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

//paginas
router.get("/estudiolista", auth, cotizadorController.listar); // render EJS
router.get("/estudio", auth, cotizadorController.EstudioCot); // render EJS
router.get("/carga", auth, cotizadorController.CargaXML); // render EJS
router.get("/descarga", auth, cotizadorController.DescargaXML); // render EJS
router.get("/resultado", auth, cotizadorController.ResultadosXML); // render EJS
router.get('/parametros', auth, cotizadorController.Paramtetros); // render EJS
router.get("/tasas", auth, cotizadorController.listarTasas); // render EJS
router.get("/valores", auth, cotizadorController.listarValores); // render EJS
router.get('/cfmatriz', auth, cotizadorController.MatrizConfig);
// router.get("/tasas/limites", cotizadorController.LimiteIni); // render EJS
// router.get('/tasas/inversiones', cotizadorController.rentabilidad); // render EJS
//---------------Apis-----------------------------//

//cotizador
router.get("/api/solicitudes", auth, cotizadorController.getSolicitudes);
router.post("/api/cargaresultado", auth, cotizadorController.CargaResultados);
router.post("/api/respuestas", auth, cotizadorController.getRespuestas);
router.post("/api/validasol", auth, cotizadorController.postValidacion);
router.post("/api/aceptasol", auth, cotizadorController.postAceptaCotizacion);
router.post("/api/tasasInd", auth, cotizadorController.getTasasTopes);
router.get("/api/regiones", auth, cotizadorController.getRegion);
router.get("/api/provincias/:idRegion", auth, cotizadorController.getProvincia);
router.get("/api/distritos/:idProvincia", auth, cotizadorController.getDistrito);
router.get("/api/distrito-info/:idDistrito", auth, cotizadorController.getDistritoInfo);
router.get('/api/distritos-search', auth, cotizadorController.searchDistritos);


//cotizador Estudio
router.post("/api/guardar", auth, cotizadorController.guardar);
router.delete("/api/eliminar/:id", auth, cotizadorController.eliminar);
router.get("/api/pdf/:id", auth, cotizadorController.generarPDF);

//Parametros
router.get('/api/cabecera', auth, cotizadorController.Cabecera);
router.post('/api/addcabecera', auth, cotizadorController.addCabecera);
router.get('/api/detalle/:idpar', auth, cotizadorController.getDetalles);
router.post('/api/adddetalle', auth, cotizadorController.addDetalle);
router.put('/api/upddetalle/:id', auth, cotizadorController.updateDetalle);
router.delete('/api/deldetalle/:id', auth, cotizadorController.deleteDetalle);

//tasas
router.get("/api/modulo/:nombre", auth, cotizadorController.cargarModulo);
router.get('/api/filtrar', auth, cotizadorController.filtrar);
router.get('/api/listar/:f_creacion', auth, cotizadorController.listarPorFecha);
router.post('/api/upload', auth, upload.single('archivoXLS'), cotizadorController.uploadExcel);
router.post('/api/actualizar', auth, cotizadorController.actualizar);
router.get('/api/regiones', auth, cotizadorController.regiones);
router.get('/api/monedas', auth, cotizadorController.monedas);
router.get('/api/prestaciones', auth, cotizadorController.prestaciones);
router.get('/api/filtrarRentabilidad', auth, cotizadorController.filtrarRentabiliad);
router.post('/api/guardarRentabilidad', auth, cotizadorController.guardarentabilidad);
router.get('/api/valorpromedio', auth, cotizadorController.obtenervalorvtapromedio);
router.post('/api/guardarpromedio', auth, cotizadorController.guardarvtapromedio);
router.get('/api/periodoscurva', auth, cotizadorController.listPeriodosCurva);
router.get('/api/filtrarcurva', auth, cotizadorController.filtrarByFechaCurva); // ?fecha=YYYY-MM-DD
router.post('/api/uploadcurva', auth, upload.single('archivoExcel'), cotizadorController.uploadExcelCurva); // multer inside controller or middleware

//valores
router.get('/api/filtrargastos', auth, cotizadorController.obtenerPorPeriodoYMonedaGastos);
router.post('/api/guardargastos', auth, cotizadorController.guardarGastos);
router.post('/api/guardargastosb', auth, cotizadorController.guardarGastosb);
router.get('/api/obtenerperiodosipc', auth, cotizadorController.obtenerPorPeriodoIPC);
router.post('/api/guardaripc', auth, cotizadorController.guardarIPC);
router.get('/api/obtenerperiodostc', auth, cotizadorController.obtenerPorFechaTC);
router.post('/api/guardartc', auth, cotizadorController.guardarTC);   
router.get('/api/obtenerperiodostcm', auth, cotizadorController.obtenerPorFechaTCM);
router.post('/api/guardartcm', auth, cotizadorController.guardarTCM);  
router.get('/api/obtenerperiodosgs', auth, cotizadorController.obtenerPorFechaGS);
router.post('/api/guardargs', auth, cotizadorController.guardarGS);  

//Configuracion Matriz Filtros
router.post('/api/actualizarcfm', auth, cotizadorController.MatrizActualiza);
router.post('/api/actualizarmontoscfm', auth, cotizadorController.MAtrizActualizarMontos);

module.exports = router;