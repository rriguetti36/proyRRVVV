const fs_ = require('fs');
const libxml = require('libxmljs');
const { parseString } = require('xml2js')
const path = require('path');
const TablaCot = require('../models/cotizacionesModel');
const TablaPar = require('../models/tabTasasModel');
const fs = require('fs/promises');
const fs2 = require("fs");
const xml2js = require('xml2js');
const XLSX = require("xlsx");
const fetch = require('node-fetch'); // Solo si usas Node <18

exports.AsignacionIntermediarios = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).send('No se recibió cuerpo en la petición.');
        }
        console.log("🚀Asigna intermediario a la solicitud...");
        const data = req.body; // 👈 viene del cliente (el JSON del ejemplo)
        const fechaCarga = new Date().toISOString().split('T')[0];
        console.log("data de asesores", data);

        if (!Array.isArray(data)) {
            return res.status(400).json({ error: "Formato inválido, debe ser un array" });
        }

        // Ruta donde guardarás el archivo

        const rutaCot = process.env.RUTA_COTIZA;
        const filePath = path.join(rutaCot, `CO_${fechaCarga}`, "asignaciones", "asesores.json");
        console.log("🚀Se crea la ruta para Asignacion- " + filePath);
        // Nos aseguramos de que el folder exista
        const dir = path.dirname(filePath);
        if (!fs2.existsSync(dir)) {
            fs2.mkdirSync(dir, { recursive: true });
        }

        // Guardamos el archivo formateado
        fs2.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

        res.json({ mensaje: "Archivo guardado correctamente", ruta: filePath });
    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).send('Error procesando XML');
    }
}

exports.ProcesaSolicitud = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).send('No se recibió cuerpo en la petición.');
        }
        const fechaCarga = new Date().toISOString().split('T')[0];
        const rutaCot = process.env.RUTA_COTIZA;

        let vallidaOk = false
        console.log("🚀Inicia Validando del XML...");
        const { solicitudes_meler } = await ValidaXML(req.body, fechaCarga, rutaCot);                                        //valida con el XSD

        console.log("🚀Valida si ya fue cargado el archivo...");
        vallidaOk = await validarExistente(solicitudes_meler, fechaCarga);                                          //Valida si ya fueron cargadas
        console.log("vallidaOk", vallidaOk.existe);
        //vallidaOk = false;

        if (!vallidaOk.existe) {
            console.log("🚀Empieza a calcular las solicitudes...");
            await SolicitudesCalc(fechaCarga, rutaCot);                                                                      // Calcula las solicitudes

            // 🚀 Ejecutar
            console.log("🚀Setea los datos en las arrays...");
            await CrearCotizacion(fechaCarga, rutaCot).then(({ c_cotizacion, c_detallecotizacion, c_beneficiario }) => {

                const solicitudesMelerValidas = {
                    cabecera: c_cotizacion,
                    detalle: c_detallecotizacion,
                    beneficiario: c_beneficiario
                }
                console.log("🚀Guarda los resultados en las tablas...");
                insertaCotizacionesCalculadas(solicitudesMelerValidas);
                // Aquí puedes trabajar con los arrays, exportarlos, guardarlos, etc.
                // Por ejemplo, para ver el primero:
                //console.log('\n🧾 Primer registro en c_cotizacion:\n', c_detallecotizacion[0]); 
            });
            console.log('Procesado: solicitudes cargadas con exito.');                                                                                              // guarda las cotizaciones las solicitudes
            //res.send(`Procesado: solicitudes cargadas con exito`);
            res.json({ mensaje: "Procesado: solicitudes cargadas con exito" });
        } else {
            console.log('Procesado: Solicitudes ya fueron cargadas, revisar el log.');
            res.json({ mensaje: "Procesado: Solicitudes ya fueron cargadas, revisar el log" });
            //res.send(`Procesado: Solicitudes ya fueron cargadas, revisar el log`);
        }

    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).send('Error procesando XML');
    }
};

exports.Listados = async (req, res) => {
  try {
    const solicitudes = await TablaCot.getTablaSolicitudesMELER();
    //console.log(solicitudes);
    //const recientes = await SolicitudesMeler.getRecientes();

    res.render("index", { layout: 'layouts/layoutCT', solicitudes });
  } catch (err) {
    console.error("Error al obtener solicitudes:", err);
    res.status(500).send("Error en el servidor");
  }
};

//1 paso valida el XML y compara con el XSD
async function ValidaXML(reqbody, fechaCarga, ruta) {
    try {
        // Aquí tienes el contenido XML como texto
        const xmlString = reqbody;
        const xsdString = fs_.readFileSync('./resource/xsd/descargaSolicitudesEESS25.xsd', 'utf-8');
        console.log('xsdString recibido:', xmlString.substring(0, 200)); // Solo los primeros caracteres para ver que llegó
        const xmlString_mod = xmlString.trim().replace(/�/g, 'Ñ');
        console.log('xmlString_mod recibido:', xmlString_mod.substring(0, 200)); // Solo los primeros caracteres para ver que llegó

        // Parsear XML
        /*  try {
             const xmlDoc = libxml.parseXml(xmlString_mod);
             console.log('XML válido sintácticamente');
         } catch (err) {
             console.error('XML mal formado:', err);
         } */
        const xmlDoc = libxml.parseXml(xmlString_mod);
        const xsdDoc = libxml.parseXml(xsdString);
        //const fechaCarga = new Date().toISOString().split('T')[0];

        // Validate XML against XSD
        if (!xmlDoc.validate(xsdDoc)) {
            console.error('Errores de validación:', xmlDoc.validationErrors);
        }

        const isValid = xmlDoc.validate(xsdDoc);
        if (isValid) {

            console.log('isValid:', isValid);
            const carpetaSalida = path.join(ruta, `CO_${fechaCarga}`, "solicitudes"); //path.join(__dirname, '../json_outputs/solicitudes_' + fechaCarga);

            const parser = new xml2js.Parser({ explicitArray: false });
            const jsonResult = await parser.parseStringPromise(xmlString_mod);
            // Acceder al array de solicitudes
            const solicitudes = jsonResult.descargaSolicitudesEESS.solicitudRecibidaEESS;

            // Asegurar que sea un array
            const listaSolicitudes = Array.isArray(solicitudes) ? solicitudes : [solicitudes];

            // Crear carpeta si no existe
            await fs.mkdir(carpetaSalida, { recursive: true });

            // Iterar y guardar cada archivo
            const solicitudes_meler = [];
            for (const solicitud of listaSolicitudes) {
                const nroOperacion = solicitud.nroOperacion;
                const nombreArchivo = `${nroOperacion}.json`;
                const rutaArchivo = path.join(carpetaSalida, nombreArchivo);

                const datoSol = {
                    numeroop: solicitud.nroOperacion,
                    feccierre: solicitud.fechaCierre,
                    fecenvio: solicitud.fechaEnvio,
                    iderror: 0,
                    descrierror: ''
                }
                solicitudes_meler.push(datoSol);
                // Guardar archivo con contenido JSON bonito
                await fs.writeFile(rutaArchivo, JSON.stringify(solicitud, null, 2), 'utf8');
                //console.log(`✔ Archivo creado: ${nombreArchivo}`);
            }
            console.log('✅ Todas las solicitudes fueron procesadas correctamente.');
            return { solicitudes_meler };
        }
    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).send('Error procesando XML');
    }
}

//2 paso procesa las solicitudes y las cotiza
async function SolicitudesCalc(fechaCarga, ruta) {
    const carpetaEntrada = path.join(ruta, `CO_${fechaCarga}`, "solicitudes"); //path.join(__dirname, '../json_outputs/solicitudes_' + fechaCarga);
    const carpetaSalida = path.join(ruta, `CO_${fechaCarga}`, "cotizaciones"); //path.join(__dirname, '../json_outputs/cotizaciones_' + fechaCarga); // Puedes cambiarla si quieres
    const archivoSalida = path.join(carpetaSalida, "solicitudes_calcular.json"); //path.join(carpetaSalida, 'solicitudes_calcular.json');
    const archivoresultados = path.join(carpetaSalida, "solicitudes_resultados.json"); //path.join(carpetaSalida, 'solicitudes_resultados.json');
    const tabparametros = await TablaPar.getParametros();
    const tabparametrosMatriz = await TablaPar.getMatrizConfig();
    //console.log(tabparametrosMatriz);
    const resultado = { Solicitudes: [] };
    const nroOP = 0;
    try {
        const archivos = await fs.readdir(carpetaEntrada);

        for (const archivo of archivos) {
            if (!archivo.endsWith('.json')) continue;

            const ruta = path.join(carpetaEntrada, archivo);
            const contenido = await fs.readFile(ruta, 'utf8');
            const solicitud = JSON.parse(contenido);

            const nroOperacion = solicitud.nroOperacion;

            // Convertir producto(s)
            const productos = Array.isArray(solicitud.producto) ? solicitud.producto : [solicitud.producto];
            const productosValid = await validarProducto(productos, solicitud.fondo.capitalPension, tabparametrosMatriz);
            //console.log(productosValid);
            const modalidades = productosValid.map((p, index) => ({
                IdModalidad: index + 1,
                Moneda: tabparametros.find(x => x.v_codsbs === p.moneda)?.v_cod || "",
                PeriodoDiferido: p.anosRT || "",
                PeriodoGarantizado: p.periodoGarantizado || "",
                Gratificacion: p.gratificacion || "",
                PrimerTramo: p.primertramo || "",
                SegundoTramo: p.segundotramo || "",
                TasaRentaAFP: parseFloat(solicitud.tasaRPyRT) || 0,
                RentaTemp: parseFloat(p.porcentajeRVD) || 50,
                tasaanclaje: 0,
                tasaventaprom: 0,
                tasaventa: 0,
                tasatirtope: 0,
                tasaperdidatope: 0,
                comision: 2.4,
                filtro: p.idfiltro,
                rechazo: p.idrechazo,
                motivorechazo: p.v_rechazo
            }));

            // Asegurado (afiliado)
            const afiliado = solicitud.afiliado;
            const valinva = afiliado.gradoInvalidez || 'N';
            const valpres = solicitud.tipoBeneficio;

            let valorInvali = tabparametros.find(x => x.v_codsbs === valinva)?.v_cod
            let valorTippen = tabparametros.find(x => x.v_codsbs === valpres)?.v_cod
            if (valpres == "C") {
                if (valinva == "T") {
                    valorTippen = "3";
                }
                else {
                    valorTippen = "4";
                }
            } else if (valpres == "A") {
                valorTippen = "1";
            } else if (valpres == "B") {
                valorTippen = "2";
            } else {
                valorTippen = "5";
            }

            const asegurado = {
                IdBeneficiario: 1,
                TipoInvalidez: valorInvali,
                FechaNacimiento: afiliado.fechaNacimiento,
                Genero: tabparametros.find(x => x.v_codsbs === afiliado.genero)?.v_cod,
                ComisionAFP: solicitud.tasaRPyRT,
                TipoPension: valorTippen,
                FechaDevengue: solicitud.fechaDevengue,
                FechaDevengueSolicitud: solicitud.devengueSolicitud
            };

            // Beneficiarios (excluye afiliado)
            let beneficiarios = solicitud.beneficiario;

            if (!beneficiarios) {
                beneficiarios = [];
            } else if (!Array.isArray(beneficiarios)) {
                beneficiarios = [beneficiarios];
            }
            const beneficiariosTransformados = beneficiarios.length > 0
                ? beneficiarios.map((ben, idx) => ({
                    IdBeneficiario: idx + 2,
                    Parentesco: tabparametros.find(x => x.v_codsbs === ben.parentesco)?.v_cod || '',
                    FechaNacimiento: ben.fechaNacimiento || '',
                    Genero: tabparametros.find(x => x.v_codsbs === ben.genero)?.v_cod || '',
                    TipoInvalidez: ben.condicionInvalidez === "N" ? "1" : "2"
                }))
                : [];

            const nuevaSolicitud = {
                IdoperacionSbs: nroOperacion,
                Cliente: "01",
                TipoCambio: solicitud.tipoCambio,
                GastoSepelio: 5448.54,
                MontoCIC: solicitud.fondo.capitalPension,
                Licencia: "Usuario",
                Gastos: {
                    Gastosmant: 280,
                    Gastosemi: 3000,
                    Porcentajedeuda: 0,
                    Impuestos: 30
                },
                Asegurado: asegurado,
                Beneficiario: beneficiariosTransformados,
                Modalidad: modalidades
            };

            resultado.Solicitudes.push(nuevaSolicitud);
        }
        //console.log("resultado: ",resultado)



        // Crear carpeta y guardar archivo final
        await fs.mkdir(carpetaSalida, { recursive: true });
        await fs.writeFile(archivoSalida, JSON.stringify(resultado, null, 2), 'utf8');
        //await fs.writeFile(archivoSalida, JSON.stringify(resultado), 'utf8');

        console.log(`✅ Archivo generado: ${archivoSalida}`);

        const respuesta = await fetch('http://localhost:3000/rutinarv/calcularOfi_optim', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(resultado) // minificado automáticamente
        });

        if (!respuesta.ok) {
            // Si no fue un 200, mostramos lo que devolvió realmente
            const errorText = await respuesta.text();
            throw new Error(`❌ Error HTTP ${respuesta.status}: ${errorText}`);
        }

        let data;
        try {
            data = await respuesta.json();
        } catch (err) {
            const rawText = await respuesta.text();
            throw new Error(`❌ La respuesta no era JSON válido:\n${rawText}`);
        }

        //const data = await respuesta.json();
        //console.log(JSON.stringify(data, null, 2));
        await fs.writeFile(archivoresultados, JSON.stringify(data, null, 2), 'utf8');


        //console.log('Respuesta del servicio interno:', data);

    } catch (err) {
        console.error('❌ Error generando archivo final: nro_op=' + nroOP, err);
    }
}

//3 paso procesa las solicitudes y las cotiza
async function CrearCotizacion(fechaCarga, ruta) {
    const tabparametros = await TablaPar.getParametros();
    const c_cotizacion = [];
    const c_detallecotizacion = [];
    const c_beneficiario = [];
    //console.log(fechaCarga)
    try {
        const carpetaEntrada = path.join(ruta, `CO_${fechaCarga}`, "solicitudes"); //path.join(__dirname, '../json_outputs/solicitudes_' + fechaCarga);
        const carpetaSalida = path.join(ruta, `CO_${fechaCarga}`, "cotizaciones"); //path.join(__dirname, '../json_outputs/cotizaciones_' + fechaCarga); // Puedes cambiarla si quieres
        const archivos = await fs.readdir(carpetaEntrada);

        const ResultadosSol = path.join(carpetaSalida, "solicitudes_resultados.json"); //path.join(__dirname, '../json_outputs/cotizaciones_' + fechaCarga + '/solicitudes_resultados.json');
        const contenido = fs_.readFileSync(ResultadosSol, 'utf8');
        const resultados = JSON.parse(contenido); // Esto será un array
        // Paso 1: Aplanar todos los arrays de nivel 1
        const solResultados = resultados.flatMap(
            grupo => grupo.flatMap(
                item => item.Solicitud || []
            )
        );

        const ResultadosCal = path.join(carpetaSalida, "solicitudes_calcular.json"); //path.join(__dirname, '../json_outputs/cotizaciones_' + fechaCarga + '/solicitudes_calcular.json');
        const contenidoCal = fs_.readFileSync(ResultadosCal, 'utf8');
        //console.log("contenidoCal", contenidoCal);
        const resultadosCal = JSON.parse(contenidoCal); // Esto será un array
        //console.log("resultadosCal", resultadosCal);
        const solicitudesCal = resultadosCal.Solicitudes;
        for (const archivo of archivos) {
            if (!archivo.endsWith('.json')) continue;

            const ruta = path.join(carpetaEntrada, archivo);
            const contenido = await fs.readFile(ruta, 'utf8');
            const solicitud = JSON.parse(contenido);

            const nroOperacion = solicitud.nroOperacion;
            const resOperacion = solResultados.filter(x => x.operacion === nroOperacion);
            const calOperacion = solicitudesCal.filter(x => x.IdoperacionSbs === nroOperacion);
            const prestacion = await obtenerPrestacion(tabparametros, solicitud.tipoBeneficio, solicitud.afiliado.condicionInvalidez);
            //console.log("calOperacion", calOperacion[0].Modalidad);
            //console.log("calOperacion", calOperacion);

            // 📌 1. Datos para c_cotizacion
            const cotizacion = {
                //num_cot: 0,
                //id_archivo: 0,
                num_operacion: nroOperacion,
                fec_suscripcion: solicitud.fechaSuscripcionIII,
                fec_envio: solicitud.fechaEnvio,
                fec_cierre: solicitud.fechaCierre,
                fec_devenge: solicitud.fechaDevengue,
                id_afp: tabparametros.find(x => x.v_codsbs === solicitud.AFP)?.v_cod || "",
                id_prestacion: prestacion,
                id_tipobenef: solicitud.tipoBeneficio,
                //id_estciv: 0,
                //ind_clientecia: 0,
                num_cuspp: solicitud.CUSPP,
                id_sucursal: solicitud.AFP,
                num_aniojubila: await obtenerEdadJub(solicitud.afiliado.fechaNacimiento),
                //num_cargas: 0,
                id_agente: 0,
                num_docagente: await aisgnaIntermediario(nroOperacion, fechaCarga) || "",
                id_moneda: tabparametros.find(x => x.v_codsbs === solicitud.fondo.moneda)?.v_cod || "",
                val_tcfondo: parseFloat(solicitud.tipoCambio),
                mto_capitalfon: parseFloat(solicitud.fondo.capitalPension),
                mto_cicfon: parseFloat(solicitud.fondo.saldoCic),
                mto_bonofon: 0,
                mto_priuni: parseFloat(solicitud.fondo.capitalPension),
                mto_cic: parseFloat(solicitud.fondo.saldoCic),
                mto_bono: 0,
                val_tasart: parseFloat(solicitud.tasaRPyRT),
                mto_apoadi: parseFloat(solicitud.fondo.saldoCic),
                ind_cober: solicitud.fondo.tieneCobertura,
                id_tipocot: "C",
                id_estadocot: 2,
                num_mensual: solicitud.numeroMensualidad,
                id_tipofon: solicitud.tipoFondo,
                id_region: 0,
                fec_devsol: solicitud.devengueSolicitud,
            };
            c_cotizacion.push(cotizacion);

            // 📌 2. Datos para c_detallecotizacion (productos)
            let idcorrelativo = 1;
            const productos = Array.isArray(solicitud.producto) ? solicitud.producto : [solicitud.producto];
            for (const producto of productos) {
                const resModalidad = resOperacion.find(x => x.idmod === idcorrelativo) || 0;
                const resModalidadCal = calOperacion[0].Modalidad.find(x => x.IdModalidad === idcorrelativo) || 0;
                //console.log("resModalidadCal", resModalidadCal)
                //console.log("producto", producto)
                const detcotizacion = {
                    //id_cot: 0,
                    //num_cot: 0,
                    id_correlativo: idcorrelativo,
                    //id_archivo: 0,
                    num_operacion: nroOperacion,
                    fec_calcot: fechaCarga,
                    id_moneda: tabparametros.find(x => x.v_codsbs === solicitud.fondo.moneda)?.v_cod || "",
                    val_tcmon: 0,
                    mto_priuni: parseFloat(solicitud.fondo.capitalPension) || 0,
                    mto_capital: parseFloat(solicitud.fondo.saldoCic) || 0,
                    mto_bono: 0,
                    val_agecom: 0,
                    val_agecomreal: 0,
                    mto_agecom: 0,
                    id_tipren: tabparametros.find(x => x.v_codsbs === producto.modalidad)?.v_cod || "",
                    num_mesdif: parseFloat(producto.anosRT) || 0,
                    id_modalidad: producto.periodoGarantizado > 0 ? "2" : "1",
                    num_mesgar: parseFloat(producto.periodoGarantizado) || 0,
                    num_mesesc: producto.modalidad == 'RVE' ? parseFloat(producto.anosRT) : 0,
                    val_rentaesc: producto.modalidad == 'RVE' ? parseFloat(producto.porcentajeRVD) : 0,
                    val_tasartafp: parseFloat(solicitud.tasaRPyRT) || 0,
                    val_rentart: parseFloat(producto.porcentajeRVD) || 0,
                    //mto_factorella: 0,
                    //val_facorella: 0,
                    mto_sepelio: resModalidad != 0 ? parseFloat(resModalidad.gastosep) || 0 : 0,
                    val_tasatce: resModalidad != 0 ? parseFloat(resModalidad.tasaTce) || 0 : 0,
                    val_tasavta: resModalidad != 0 ? parseFloat(resModalidad.tasavta) || 0 : 0,
                    val_tasatir: resModalidad != 0 ? parseFloat(resModalidad.tasaTir) || 0 : 0,
                    //val_tasagar: 0,
                    mto_priuni: resModalidad != 0 ? parseFloat(resModalidad.primacia) || 0 : 0,
                    mto_pension: resModalidad != 0 ? parseFloat(resModalidad.penref) || 0 : 0,
                    mto_pensiongar: resModalidad != 0 ? parseFloat(resModalidad.penref) || 0 : 0,
                    mto_priAFP: resModalidad != 0 ? parseFloat(resModalidad.primaafp) || 0 : 0,
                    mto_pensionRT: resModalidad != 0 ? parseFloat(resModalidad.penafp) || 0 : 0,
                    //mto_reservamat: 0,
                    val_rentapentmp: 0,
                    mto_sumpenben: resModalidad != 0 ? parseFloat(resModalidad.pencia) || 0 : 0,
                    //mto_penanual: 0,
                    //mto_reservamatpen: 0,
                    //mto_reservamatgs: 0,
                    //mto_perdida: 0,
                    val_perdida: resModalidad != 0 ? parseFloat(resModalidad.perdida) || 0 : 0,
                    ind_cober: 0,
                    ind_dercre: producto.derechoCrecer,
                    ind_dergra: producto.gratificacion,
                    id_estado: 1,
                    fec_acepta: "",
                    id_rechazo: resModalidadCal.rechazo,
                    //mto_resmatsepeliorv: 0,
                    //val_ajusteipc: 0,
                    mto_parcap: 0,
                    //ind_calsobdiferida: 0,
                    //val_reajustetri: 0,
                    //val_reajustemen: 0,
                    des_error: resModalidadCal.motivorechazo,
                    ind_sisco: 0,
                    ind_pasofiltro: resModalidadCal.filtro,
                }
                c_detallecotizacion.push(detcotizacion);
                idcorrelativo++;
            }

            // 📌 3. Datos para c_beneficiario
            // Afiliado como primer beneficiario
            const resultadosPen = solResultados.flatMap(item => item.resultadospen || []);
            const benefTit = resultadosPen.find(x => x.id === 1);
            c_beneficiario.push({
                //id_cot: 0,
                //num_cot: 0,
                id_orden: 1,
                //id_archivo: 0,
                num_operacion: nroOperacion,
                id_parentesco: 1,
                id_grupofam: 1,
                id_sexo: tabparametros.find(x => x.v_codsbs === solicitud.afiliado.genero)?.v_cod || "",
                id_invalido: tabparametros.find(x => x.v_codsbs === solicitud.afiliado.gradoInvalidez || 'N')?.v_cod,
                //fec_invalido: 0,
                //id_causainv: 0,
                id_derpen: 99,
                //ind_dercre: solicitud.afiliado,
                id_tipodociden: tabparametros.find(x => x.v_codsbs === solicitud.afiliado.tipoDoc)?.v_cod || "",
                num_dociden: solicitud.afiliado.nroDoc,
                des_nombre: solicitud.afiliado.primerNombre,
                des_nombresegundo: solicitud.afiliado.segundoNombre || "",
                des_apepaterno: solicitud.afiliado.apellidoPaterno,
                des_apematerno: solicitud.afiliado.apellidoMaterno,
                fec_nacimiento: solicitud.afiliado.fechaNacimiento,
                fec_fallecimiento: prestacion == 5 ? solicitud.fechaDevengue : "",
                fec_nachijomayor: "",
                val_pension: benefTit.prc,
                val_pensionleg: benefTit.prc,
                //val_pensionrep: 0,
                mto_pension: benefTit.pension,
                mto_pensiongar: benefTit.pension,
                ind_estsob: solicitud.afiliado.estadoSobrevivencia,
                ind_estudiante: "",
            });

            // Luego, beneficiarios
            let idorden = 2;
            let beneficiarios = solicitud.beneficiario;

            if (!beneficiarios) {
                beneficiarios = [];
            } else if (!Array.isArray(beneficiarios)) {
                beneficiarios = [beneficiarios];
            }
            for (const ben of beneficiarios) {
                const benef = resultadosPen.find(x => x.id === idorden) || {};

                const beneficiario = {
                    id_orden: idorden,
                    num_operacion: nroOperacion,
                    id_parentesco: tabparametros.find(x => x.v_codsbs === ben.parentesco)?.v_cod || "",
                    id_grupofam: 1,
                    id_sexo: tabparametros.find(x => x.v_codsbs === ben.genero)?.v_cod || "",
                    id_invalido: ben.condicionInvalidez === "N" ? "1" : "2", // ✅ corregido el "=" por "==="
                    id_derpen: 99,
                    id_tipodociden: "",
                    num_dociden: "",
                    des_nombre: ben.primerNombre || "",
                    des_nombresegundo: ben.segundoNombre || "",
                    des_apepaterno: ben.apellidoPaterno || "",
                    des_apematerno: ben.apellidoMaterno || "",
                    fec_nacimiento: ben.fechaNacimiento || "",
                    fec_fallecimiento: "",
                    fec_nachijomayor: "",
                    val_pension: benef.prc || 0,
                    val_pensionleg: benef.prc || 0,
                    mto_pension: benef.pension || 0,
                    mto_pensiongar: benef.pension || 0,
                    ind_estsob: solicitud.afiliado?.estadoSobrevivencia || "",
                    ind_estudiante: "",
                };

                c_beneficiario.push(beneficiario);
                idorden++;
            }
        }

        // Crear carpeta si no existe
        await fs.mkdir(carpetaSalida, { recursive: true });

        // Guardar archivos
        await fs.writeFile(
            path.join(carpetaSalida, 'c_cotizacion.json'),
            JSON.stringify(c_cotizacion, null, 2),
            'utf8'
        );
        await fs.writeFile(
            path.join(carpetaSalida, 'c_cotizaciondet.json'),
            JSON.stringify(c_detallecotizacion, null, 2),
            'utf8'
        );
        await fs.writeFile(
            path.join(carpetaSalida, 'c_cotizacionben.json'),
            JSON.stringify(c_beneficiario, null, 2),
            'utf8'
        );
        /* console.log('✅ Datos procesados:');
        console.log('c_cotizacion:', c_cotizacion.length, 'registros');
        console.log('c_detallecotizacion:', c_detallecotizacion.length, 'registros');
        console.log('c_beneficiario:', c_beneficiario.length, 'registros');
 */
        return { c_cotizacion, c_detallecotizacion, c_beneficiario };

    } catch (err) {
        console.error('❌ Error procesando archivos JSON:', err);
    }
}

async function validarProducto(Productos, Mtocic, Matriz) {
    const productos = Productos;

    if (!Array.isArray(productos)) {
        return res.status(400).json({ error: "Campo 'producto' debe ser un array" });
    }

    const productosValidados = productos.map((producto) => {
        let idfiltro = 0;
        let idrechazo = 0;
        let mensajes = [];

        // Validar monto si viene el campo `mont`
        if (typeof Mtocic !== "undefined") {
            const monto = parseFloat(Mtocic);

            // Filtrar filas coincidentes con modalidad o moneda
            const coincidencias = Matriz.filter(
                (t) =>
                    t.n_jubleg === 1 &&
                    (t.v_sbs === producto.modalidad || t.v_sbs === producto.moneda)
            );

            const enRango = coincidencias.some(
                (c) =>
                    monto >= parseFloat(c.n_mtodesde) &&
                    monto <= parseFloat(c.n_mtohasta)
            );

            if (!enRango) {
                return {
                    ...producto,
                    idfiltro: 1,
                    idrechazo: 1,
                    v_rechazo: "Monto CIC está fuera del monto configurado."
                };
            }
        }

        // Si pasa monto (o no existe), se valida modalidad y moneda

        const modalidadOk = Matriz.some(
            (t) => t.v_sbs === producto.modalidad && t.n_jubleg === 1
        );

        const monedaOk = Matriz.some(
            (t) => t.v_sbs === producto.moneda && t.n_jubleg === 1
        );

        if (!modalidadOk) {
            idfiltro: 1;
            idrechazo = 1;
            mensajes.push("Modalidad no configurada");
        }

        if (!monedaOk) {
            idfiltro: 1;
            idrechazo = 1;
            mensajes.push("Moneda no configurada");
        }

        return {
            ...producto,
            idfiltro,
            idrechazo,
            v_rechazo: mensajes.join(", ")
        };
    });
    //console.log(productosValidados);
    //req.body.producto = productosValidados;
    //next();
    return productosValidados;
}

async function obtenerPrestacion(tabparametros, tb, gr) {
    const valinva = gr || 'N';
    const valpres = tb;

    let valorTippen = tabparametros.find(x => x.v_codsbs === valpres)?.v_cod
    if (valpres == "C") {
        if (valinva == "T") {
            valorTippen = "3";
        }
        else {
            valorTippen = "4";
        }
    } else if (valpres == "A") {
        valorTippen = "1";
    } else if (valpres == "B") {
        valorTippen = "2";
    } else {
        valorTippen = "5";
    }
    return valorTippen;
}

async function obtenerEdadJub(fechaNac) {
    const nacimiento = new Date(fechaNac);
    let anio = nacimiento.getFullYear() + 65;
    return anio;
}

async function validarExistente(solicitudes_meler, fechacarga) {
    let iderror = 0;
    let descrierror = "";
    let caeSol = false;
    for (const solicitud of solicitudes_meler) {

        const valor = await TablaCot.validaExisteOperacion(solicitud.numeroop);
        /// console.log("|| op: " + solicitud.numeroop + "|| valor: " + valor);
        //console.log("valor",valor)
        if (valor > 0) {
            iderror = 100;
            descrierror = "numero de operacion o solicitud ya existe.";
            caeSol = true;
            //console.log("existe numero de operacion " + solicitud.numeroop);
            //break;
        }
        solicitud.iderror = iderror;
        solicitud.descrierror = descrierror;
    };

    const solicitudesMelerValid = {
        tipoArchivo: 1,
        nombreArchivo: "desSolicitudes_2024_03_25.xml",
        fechaCarga: fechacarga,
        idusuario: 1,
        estado: caeSol ? 0 : 1,
        solicitudes: solicitudes_meler
    };
    //console.log(solicitudesMelerValid)

    const resultado = await TablaCot.insertaSolicitudesMeler(solicitudesMelerValid);
    console.log("Resultado ID Archivo:", resultado);
    /* TablaCot.insertaSolicitudesMeler(solicitudesMelerValid).catch(() => {
        // Ya se manejó el error internamente
    });; */
    console.log("caeSol", caeSol)
    return {existe: caeSol, idArchivo: resultado};
}

async function insertaCotizacionesCalculadas(data) {
    await TablaCot.insertaCotizacionesCalc(data);
}

async function aisgnaIntermediario(operacion, fechaCarga) {
    try {
        const rutaCot = process.env.RUTA_COTIZA;
        const carpetaAsignacion = path.join(rutaCot, `CO_${fechaCarga}`, "asignaciones", "asesores.json");
        //const carpetaAsignacion = path.join(__dirname, '../json_outputs/asignaciones');
        const asignacionesInter = await fs.readFile(carpetaAsignacion, 'utf8');
        const asesor = JSON.parse(asignacionesInter);
        console.log(operacion);
        const numerodni = asesor.find(x => x.nroOperacion === operacion)?.dniAsesor || "";
        console.log(numerodni);
        return numerodni;
    } catch (err) {
        console.error('❌ Error procesando archivos JSON:', err);
    }
}

function parseFecha(fechaStr) {
    if (!fechaStr) return null;
    const [anio, mes, dia] = fechaStr.split("-").map(Number);
    return new Date(anio, mes - 1, dia); // mes - 1 porque getMonth() es base 0
}

async function CotizacionCrea(fechaCarga) {
    const c_cotizacion = [];
    const c_detallecotizacion = [];
    const c_beneficiario = [];

    try {
        const carpetaEntrada = path.join(__dirname, '../json_outputs/solicitudes_' + fechaCarga);
        const carpetaSalida = path.join(__dirname, '../json_outputs/cotizaciones_' + fechaCarga); // Puedes cambiarla si quieres
        const archivos = await fs.readdir(carpetaEntrada);

        for (const archivo of archivos) {
            if (!archivo.endsWith('.json')) continue;

            const ruta = path.join(carpetaEntrada, archivo);
            const contenido = await fs.readFile(ruta, 'utf8');
            const solicitud = JSON.parse(contenido);

            const nroOperacion = solicitud.nroOperacion;

            // 📌 1. Datos para c_cotizacion
            const cotizacion = {
                nroOperacion,
                AFP: solicitud.AFP,
                CUSPP: solicitud.CUSPP,
                tipoBeneficio: solicitud.tipoBeneficio,
                cambioModalidad: solicitud.cambioModalidad,
                pensionPreliminar: solicitud.pensionPreliminar,
                tasaRPyRT: solicitud.tasaRPyRT,
                fechaDevengue: solicitud.fechaDevengue,
                fechaSuscripcionIII: solicitud.fechaSuscripcionIII,
                devengueSolicitud: solicitud.devengueSolicitud,
                fechaEnvio: solicitud.fechaEnvio,
                fechaCierre: solicitud.fechaCierre,
                tipoCambio: solicitud.tipoCambio,
                diaCita: solicitud.diaCita,
                horaCita: solicitud.horaCita,
                lugarCita: solicitud.lugarCita,
                numeroMensualidad: solicitud.numeroMensualidad,
                tipoFondo: solicitud.tipoFondo
            };
            c_cotizacion.push(cotizacion);

            // 📌 2. Datos para c_detallecotizacion (productos)
            const productos = Array.isArray(solicitud.producto) ? solicitud.producto : [solicitud.producto];
            for (const producto of productos) {
                c_detallecotizacion.push({
                    nroOperacion,
                    ...producto
                });
            }

            // 📌 3. Datos para c_beneficiario

            // Afiliado como primer beneficiario
            c_beneficiario.push({
                nroOperacion,
                tipo: 'AFILIADO',
                ...solicitud.afiliado
            });

            // Luego, beneficiarios
            const beneficiarios = Array.isArray(solicitud.beneficiario) ? solicitud.beneficiario : [solicitud.beneficiario];
            for (const ben of beneficiarios) {
                c_beneficiario.push({
                    nroOperacion,
                    tipo: 'BENEFICIARIO',
                    ...ben
                });
            }
        }

        // Crear carpeta si no existe
        await fs.mkdir(carpetaSalida, { recursive: true });

        // Guardar archivos
        await fs.writeFile(
            path.join(carpetaSalida, 'c_cotizacion.json'),
            JSON.stringify(c_cotizacion, null, 2),
            'utf8'
        );
        await fs.writeFile(
            path.join(carpetaSalida, 'c_detallecotizacion.json'),
            JSON.stringify(c_detallecotizacion, null, 2),
            'utf8'
        );
        await fs.writeFile(
            path.join(carpetaSalida, 'c_beneficiario.json'),
            JSON.stringify(c_beneficiario, null, 2),
            'utf8'
        );
        /* console.log('✅ Datos procesados:');
        console.log('c_cotizacion:', c_cotizacion.length, 'registros');
        console.log('c_detallecotizacion:', c_detallecotizacion.length, 'registros');
        console.log('c_beneficiario:', c_beneficiario.length, 'registros');
 */
        return { c_cotizacion, c_detallecotizacion, c_beneficiario };

    } catch (err) {
        console.error('❌ Error procesando archivos JSON:', err);
    }
}

async function leerArchivo(path) {
    try {
        console.log("entra funcion leerArchivo");


        console.log("entra a leerArchivo");
        const data = await fs.readFile(path, 'utf8');
        const jsonData = JSON.parse(data);
        return jsonData;
    } catch (err) {
        console.error('Error al leer el archivo:', err);
    }
}

