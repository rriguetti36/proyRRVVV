const tablasmortal = require('../models/tmortalModel');
const tablasTasasInd = require('../models/tabTasasModel');
const tablasCotizacion = require('../models/cotizacionesModel');
const fs = require('fs');
const { Console } = require('console');
const path = require('path');
const { Worker } = require('worker_threads');
const os = require('os');
const { generarXML, validarXML } = require('../servicios/generaXML');

exports.calcular = async (req, res) => {
  try {
    const datos = req.body;
    console.log("datos", datos);
    const TasasIPC = await tablasTasasInd.getTasaTasaIPC();
    const TasasMercado = await tablasTasasInd.getTasaMercado();
    const TasasInversion = await tablasTasasInd.getTasaInversiones();
    const TasasCurvaCero = await tablasTasasInd.getTasaCurvaCuponCero();
    const TablasMortal = await tablasmortal.getAllMortalProc();
    const TasasRentabilidad = await tablasTasasInd.getTasaInversiones();

    const datosMod = datos.Modalidad;
    const datosAse = datos.Asegurado;
    const datosBen = datos.Beneficiario;
    const datosGas = datos.Gastos;
    //construye los datos de la cabecera
    const DataModalidad = [];
    const DataBeneficiarios = [];

    //construye los datos de los beneficiarios
    let porcTit = 0
    if (datosAse.TipoPension == 5) {
      porcTit = 0;
    } else if (datosAse.TipoPension == 3) {
      porcTit = 70;
    } else if (datosAse.TipoPension == 4) {
      porcTit = 50;
    } else {
      porcTit = 100;
    }
    const prclegales = await AsignaPorcentajes(datosBen)
    console.log(prclegales);
    //carga al asegurado en la lista de Asegurados
    const filaben = {
      idben: 1,
      idinv: datosAse.TipoInvalidez,
      fecnac: datosAse.FechaNacimiento,
      idsex: datosAse.Genero,
      idpar: 1,
      prcleg: porcTit,
      edadtope: 111,
      edaddev: await edadmesdev(datosAse.FechaDevengue, datosAse.FechaNacimiento),
      tm: await MortalidadPer(datosAse.Genero, datosAse.TipoInvalidez, datosAse.FechaNacimiento, TablasMortal)
    }
    DataBeneficiarios.push(filaben)

    //carga a los beneficiarios 
    let orden = 2;
    let sumprcben = 0;
    let prcben = 0;
    for (const ben of datosBen) {
      const resultado = prclegales.find(x => x[0] === String(ben.Parentesco));
      //console.log("resultado",resultado);
      prcben = resultado ? resultado[2] : 0;
      const filaben = {
        idben: orden,
        idinv: ben.TipoInvalidez,
        fecnac: ben.FechaNacimiento,
        idsex: ben.Genero,
        idpar: ben.Parentesco,
        prcleg: prcben,
        edadtope: await edadtope(ben.Parentesco, ben.TipoInvalidez, datosAse.FechaDevengueSolicitud),
        edaddev: await edadmesdev(datosAse.FechaDevengue, ben.FechaNacimiento),
        tm: await MortalidadPer(ben.Genero, ben.TipoInvalidez, ben.FechaNacimiento, TablasMortal)
      }
      DataBeneficiarios.push(filaben)
      orden = orden + 1;
      sumprcben = sumprcben + prcben;
    }
    //console.log("sumprcben", sumprcben);
    //console.log("DataBeneficiarios", DataBeneficiarios);
    for (const cot of datosMod) {
      const filamod = {
        id: cot.IdModalidad,
        tm: cot.Moneda,
        tr: cot.TipoRenta,
        mo: cot.TipoModalidad,
        pd: cot.PeriodoDiferido * 12,
        pg: cot.PeriodoGarantizado * 12,
        gr: cot.Gratificacion,
        pt: cot.PrimerTramo * 12,
        st: cot.SegundoTramo,
        afp: cot.TasaRentaAFP / 100,
        tmp: cot.RentaTemp / 100,
        tavta: cot.tasaventa / 100,
        taanc: cot.tasaanclaje / 100,
        taprm: cot.tasaventaprom / 100,
        tirtop: cot.tasatirtope / 100,
        pertop: cot.tasaperdidatope / 100,
        com: cot.comision / 100,
        mesdev: await mesdevengado(datosAse.FechaDevengue),
        gs: datos.GastoSepelio,
        dev: datosAse.FechaDevengue,
        cic: datos.MontoCIC,
        pre: datosAse.TipoPension,
        tipcam: datos.TipoCambio,
        gastos: datosGas,

      }
      DataModalidad.push(filamod);
    }

    //EMPIEZA A CALCULAR LS MODALLIDADES
    let resultadoFinal = [];
    let resultadoFinalben = [];
    for (const dostosMod of DataModalidad) {
      //console.log(dostosMod);
      console.log("Inicia calculo modalidad " + dostosMod.id);
      const datosflujos = await calcularflujos(dostosMod, DataBeneficiarios, TasasIPC);
      const resultadoscalpen = await calcularpension_ini(dostosMod, datosflujos, sumprcben, TasasCurvaCero, TasasRentabilidad);
      for (const ben of DataBeneficiarios) {
        const benfila = {
          id: ben.idben,
          prc: ben.prcleg,
          pension: resultadoscalpen.penref * (ben.prcleg / 100)
        }
        resultadoFinalben.push(benfila);
      }
      resultadoscalpen.resultadospen = resultadoFinalben;
      resultadoFinalben = [];
      console.log("acaba de calcular modalidad " + dostosMod.id);
      console.log("Resultados: ", resultadoscalpen);
      resultadoFinal = resultadoFinal.concat(resultadoscalpen);
    }
    res.json(resultadoFinal);

    //res.send('esta en la rutina!!!');
    //res.redirect("/clientes");
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error rutina' });
  }
};

exports.calcularofi_hilo = async (req, res) => {
  const datos = req.body;
  const datosSol = datos.Solicitudes;
  const TasasIPC = await tablasTasasInd.getTasaTasaIPC();
  const TasasMercado = await tablasTasasInd.getTasaMercado();
  //const TasasInversion = await tablasTasasInd.getTasaInversiones();
  const TasasCurvaCero = await tablasTasasInd.getTasaCurvaCuponCero();
  const TablasMortal = await tablasmortal.getAllMortalProc();
  const TablasCicRegion = await tablasTasasInd.getRegionCIC();
  const TablasTopesTasas = await tablasTasasInd.getTopesTasas();
  const TablasVtaPromedio = await tablasTasasInd.getTasaVentaPromedio();
  const TasasRentabilidad = await tablasTasasInd.getTasaInversiones();


  const resultados = await Promise.all(
    datosSol.map(c => calcularRV(c, TasasIPC, TasasMercado, TasasRentabilidad, TasasCurvaCero, TablasMortal, TablasCicRegion, TablasTopesTasas, TablasVtaPromedio))
  );
  res.json(resultados);
};

exports.generaXMLsalida = async (req, res) => {
  try {

    //console.log("Body completo recibido:", req.body.id_archivo);
    //console.log("Tipo:", typeof req.body);
    const usu = req.session.user.id;
    const fechacalculo = new Date().toISOString().slice(0, 10);
    const idarchivo = req.body.id_archivo;
    //console.log('ID del archivo recibido:', idarchivo);
    const resultado = await tablasCotizacion.getCotizacionesCalculadasCarga23(idarchivo); //req.body; // viene del cliente
    //const dataCotiza = JSON.parse(resultado);
    //console.log("dataCotiza", resultado);


    // Ruta donde se guarda temporalmente el archivo XML
    const rutaXML = path.join(__dirname, '../xml_outputs/salida.xml');
    const rutaXSD = path.join(__dirname, '../resource/xsd/cargaCotizaciones23.xsd');

    // 1. Generar XML
    const xmlString = generarXML(resultado, rutaXML);
    console.log("xmlString", xmlString);
    // 2. Validar XML con XSD
    const { isValid, errores } = validarXML(xmlString, rutaXSD);

    if (!isValid) {
      return res.status(400).json({
        mensaje: '❌ El XML no es válido con el XSD.',
        errores
      });
    }

    //2. insert el solicitudes Meler
    const nombrearch = 'cargaCot_' + fechacalculo + '.xml';
    const tipoArchivo = 3;
    const nombreArchivo = nombrearch;
    const fechaCarga = new Date().toISOString().split('T')[0];
    const idusuario = usu;
    const estado = 1;
    const id_archivo_ori = idarchivo;
    const resEnvio = {
      tipoArchivo,
      nombreArchivo,
      fechaCarga,
      idusuario,
      estado,
      id_archivo_ori // 👈 aquí lo convertimos en array
    }
    await tablasCotizacion.insertaSolicitudesEnvioMeler(resEnvio, usu) || 0;

    // 3. Enviar el archivo XML como descarga
    res.download(rutaXML, nombrearch, (err) => {
      if (err) {
        console.error('❌ Error al descargar el archivo:', err);
        res.status(500).send('Error al descargar el archivo XML.');
      }
    });
  } catch (error) {
    console.error('❌ Error general:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
}

exports.calcularofi = async (req, res) => {
  try {
    const datos = req.body;

    const TasasIPC = await tablasTasasInd.getTasaTasaIPC();
    const TasasMercado = await tablasTasasInd.getTasaMercado();
    const TasasInversion = await tablasTasasInd.getTasaInversiones();
    const TasasCurvaCero = await tablasTasasInd.getTasaCurvaCuponCero();
    const TablasMortal = await tablasmortal.getAllMortalProc();
    const TablasCicRegion = await tablasTasasInd.getRegionCIC();
    const TablasTopesTasas = await tablasTasasInd.getTopesTasas();
    const TablasVtaPromedio = await tablasTasasInd.getTasaVentaPromedio();
    const datosSol = datos.Solicitudes;
    let resultadoFinalSol = [];
    const fechacalculo = new Date().toISOString().slice(0, 10);

    for (const filSol of datosSol) {
      console.log("Inicia calculo modalidad " + filSol.IdoperacionSbs);
      const montoCIC = filSol.MontoCIC;
      const tipocambio = filSol.TipoCambio;
      const montoGS = filSol.GastoSepelio
      const datosMod = filSol.Modalidad;
      const datosAse = filSol.Asegurado;
      const datosBen = filSol.Beneficiario;
      const datosGas = filSol.Gastos;

      //construye los datos de la cabecera
      const DataModalidad = [];
      const DataBeneficiarios = [];

      //construye los datos de los beneficiarios
      let porcTit = 0
      if (datosAse.TipoPension == 5) {
        porcTit = 0;
      } else if (datosAse.TipoPension == 3) {
        porcTit = 70;
      } else if (datosAse.TipoPension == 4) {
        porcTit = 50;
      } else {
        porcTit = 100;
      }
      const prclegales = await AsignaPorcentajes(datosBen)
      //console.log(prclegales);
      //carga al asegurado en la lista de Asegurados
      const filaben = {
        idben: 1,
        idinv: datosAse.TipoInvalidez,
        fecnac: datosAse.FechaNacimiento,
        idsex: datosAse.Genero,
        idpar: 1,
        prcleg: porcTit,
        edadtope: 111,
        edaddev: await edadmesdev(datosAse.FechaDevengue, datosAse.FechaNacimiento),
        tm: await MortalidadPer(datosAse.Genero, datosAse.TipoInvalidez, datosAse.FechaNacimiento, TablasMortal)
      }
      DataBeneficiarios.push(filaben)

      //carga a los beneficiarios 
      let orden = 2;
      let sumprcben = 0;
      let prcben = 0;
      for (const ben of datosBen) {
        const resultado = prclegales.find(x => x[0] === String(ben.Parentesco));
        //console.log("resultado",resultado);
        prcben = resultado ? resultado[2] : 0;
        const filaben = {
          idben: orden,
          idinv: ben.TipoInvalidez,
          fecnac: ben.FechaNacimiento,
          idsex: ben.Genero,
          idpar: ben.Parentesco,
          prcleg: prcben,
          edadtope: await edadtope(ben.Parentesco, ben.TipoInvalidez, datosAse.FechaDevengueSolicitud),
          edaddev: await edadmesdev(datosAse.FechaDevengue, ben.FechaNacimiento),
          tm: await MortalidadPer(ben.Genero, ben.TipoInvalidez, ben.FechaNacimiento, TablasMortal)
        }
        DataBeneficiarios.push(filaben)
        orden = orden + 1;
        sumprcben = sumprcben + prcben;
      }
      //console.log("sumprcben", sumprcben);
      //console.log("DataBeneficiarios", DataBeneficiarios);

      //construye los datos de las modalidades
      let prestacion = ""
      //console.log("prestacion inicial", datosAse.TipoPension)
      switch (datosAse.TipoPension) {
        case "1":
          prestacion = "J";
          break;
        case "2":
          prestacion = "J";
          break;
        case "3":
          prestacion = "I";
          break;
        case "4":
          prestacion = "I";
          break;
        case "5":
          prestacion = "S";
          break;
      }
      //console.log("prestacion inicial convertida", prestacion)
      for (const cot of datosMod) {

        let idreg = await ObtieneRegionCIC(TablasCicRegion, montoCIC);
        let valvta = await ObtieneTasasTope(TablasTopesTasas, idreg, cot.Moneda, prestacion, "V");
        let valtir = await ObtieneTasasTope(TablasTopesTasas, idreg, cot.Moneda, prestacion, "T");
        let valper = await ObtieneTasasTope(TablasTopesTasas, idreg, cot.Moneda, prestacion, "P");
        let valpro = await ObtieneTasasVtaPromedio(TablasVtaPromedio, cot.Moneda, prestacion, fechacalculo)
        //console.log("idreg", idreg);
        //console.log("valvta", valvta);
        //console.log("valtir", valtir);
        //console.log("valper", valper);
        //console.log("valpro", valpro);

        const filamod = {
          id: cot.IdModalidad,
          tm: cot.Moneda,
          pd: cot.PeriodoDiferido * 12,
          pg: cot.PeriodoGarantizado * 12,
          gr: cot.Gratificacion,
          pt: cot.PrimerTramo * 12,
          st: cot.SegundoTramo,
          afp: cot.TasaRentaAFP / 100,
          tmp: cot.RentaTemp / 100,
          tavta: valvta / 100,
          taanc: 3 / 100,
          taprm: valpro / 100,
          tirtop: valtir / 100,
          pertop: valper / 100,
          com: cot.comision / 100,
          mesdev: await mesdevengado(datosAse.FechaDevengue),
          gs: montoGS,
          dev: datosAse.FechaDevengue,
          pre: datosAse.TipoPension,
          cic: montoCIC,
          tipcam: tipocambio,
          gastos: datosGas,
        }
        DataModalidad.push(filamod);
      }

      //console.log("DataBeneficiarios", DataBeneficiarios);
      //console.log("DataModalidad ", DataModalidad);
      console.log("termina calculo modalidad " + filSol.IdoperacionSbs);

      let resultadoFinal = [];
      let resultadoFinalben = [];

      for (const dostosMod of DataModalidad) {
        //console.log(dostosMod);
        console.log("Inicia calculo modalidad " + dostosMod.id);
        const datosflujos = await calcularflujos(dostosMod, DataBeneficiarios, TasasIPC);
        //console.log("datosflujos: ", datosflujos);
        const resultadoscalpen = await calcularpension_ini(dostosMod, datosflujos, sumprcben);

        for (const ben of DataBeneficiarios) {
          const benfila = {
            id: ben.idben,
            prc: ben.prcleg,
            pension: resultadoscalpen.penref * (ben.prcleg / 100)
          }
          resultadoFinalben.push(benfila);
        }
        resultadoscalpen.operacion = filSol.IdoperacionSbs;
        resultadoscalpen.resultadospen = resultadoFinalben;
        resultadoFinalben = [];
        console.log("acaba de calcular modalidad " + dostosMod.id);
        //console.log("Resultados: ", resultadoscalpen);
        resultadoFinal = resultadoFinal.concat(resultadoscalpen);
      }
      const solResultados = {
        Solicitud: resultadoFinal
      }
      resultadoFinalSol.push(solResultados);
      //res.json(resultadoFinal);
      console.log("acaba de calcular solicitud " + filSol.IdoperacionSbs);
      //console.log("Resultados: ", resultadoscalpen);
    }

    //console.error('datosSol:', datosSol);
    res.json(resultadoFinalSol);
    //res.send('esta en la rutina!!!');

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error rutina' });
  }

};

async function calcularRV(solicitudes, TasasIPC, TasasMercado, TasasRentabilidad, TasasCurvaCero, TablasMortal, TablasCicRegion, TablasTopesTasas, TablasVtaPromedio) {
  try {
    const pLimit = (await import('p-limit')).default;
    const cpuCores = os.cpus().length; // por ejemplo, 8
    const limit = pLimit(Math.max(2, Math.floor(cpuCores / 2))); // Usa la mitad de los núcleos, al menos 2

    const datosSol = solicitudes;
    let resultadoFinalSol = [];
    const fechacalculo = new Date().toISOString().slice(0, 10);

    console.time(`Cálculando Solicitud-${datosSol.IdoperacionSbs}`);
    //console.log("Inicia calculo modalidad " + datosSol.IdoperacionSbs);
    const montoCIC = datosSol.MontoCIC;
    const tipocambio = datosSol.TipoCambio;
    const montoGS = datosSol.GastoSepelio
    const datosMod = datosSol.Modalidad.filter(x => x.filtro === 0);
    const datosAse = datosSol.Asegurado;
    const datosBen = datosSol.Beneficiario;
    const datosGas = datosSol.Gastos;

    //construye los datos de la cabecera
    const DataModalidad = [];
    const DataBeneficiarios = [];

    //construye los datos de los beneficiarios
    let porcTit = 0
    if (datosAse.TipoPension == 5) {
      porcTit = 0;
    } else if (datosAse.TipoPension == 3) {
      porcTit = 70;
    } else if (datosAse.TipoPension == 4) {
      porcTit = 50;
    } else {
      porcTit = 100;
    }
    const prclegales = await AsignaPorcentajes(datosBen)
    //console.log(prclegales);
    //carga al asegurado en la lista de Asegurados
    const filaben = {
      idben: 1,
      idinv: datosAse.TipoInvalidez,
      fecnac: datosAse.FechaNacimiento,
      idsex: datosAse.Genero,
      idpar: 1,
      prcleg: porcTit,
      edadtope: 111,
      edaddev: await edadmesdev(datosAse.FechaDevengue, datosAse.FechaNacimiento),
      tm: await MortalidadPer(datosAse.Genero, datosAse.TipoInvalidez, datosAse.FechaNacimiento, TablasMortal)
    }
    DataBeneficiarios.push(filaben)

    //carga a los beneficiarios 
    let orden = 2;
    let sumprcben = 0;
    let prcben = 0;
    for (const ben of datosBen) {
      const resultado = prclegales.find(x => x[0] === String(ben.Parentesco));
      //console.log("resultado",resultado);
      prcben = resultado ? resultado[2] : 0;
      const filaben = {
        idben: orden,
        idinv: ben.TipoInvalidez,
        fecnac: ben.FechaNacimiento,
        idsex: ben.Genero,
        idpar: ben.Parentesco,
        prcleg: prcben,
        edadtope: await edadtope(ben.Parentesco, ben.TipoInvalidez, datosAse.FechaDevengueSolicitud),
        edaddev: await edadmesdev(datosAse.FechaDevengue, ben.FechaNacimiento),
        tm: await MortalidadPer(ben.Genero, ben.TipoInvalidez, ben.FechaNacimiento, TablasMortal)
      }
      DataBeneficiarios.push(filaben)
      orden = orden + 1;
      sumprcben = sumprcben + prcben;
    }
    //console.log("sumprcben", sumprcben);
    //console.log("DataBeneficiarios", DataBeneficiarios);

    //construye los datos de las modalidades
    let prestacion = ""
    //console.log("prestacion inicial", datosAse.TipoPension)
    switch (datosAse.TipoPension) {
      case "1":
        prestacion = "J";
        break;
      case "2":
        prestacion = "J";
        break;
      case "3":
        prestacion = "I";
        break;
      case "4":
        prestacion = "I";
        break;
      case "5":
        prestacion = "S";
        break;
    }
    //console.log("datosMod", datosMod)
    for (const cot of datosMod) {

      let idreg = await ObtieneRegionCIC(TablasCicRegion, montoCIC);
      let valvta = await ObtieneTasasTope(TablasTopesTasas, idreg, cot.Moneda, prestacion, "V");
      let valtir = await ObtieneTasasTope(TablasTopesTasas, idreg, cot.Moneda, prestacion, "T");
      let valper = await ObtieneTasasTope(TablasTopesTasas, idreg, cot.Moneda, prestacion, "P");
      let valpro = await ObtieneTasasVtaPromedio(TablasVtaPromedio, cot.Moneda, prestacion, fechacalculo)
      //console.log("cot", cot);
      //console.log("idreg", idreg);
      //console.log("valvta", valvta);
      //console.log("valtir", valtir);
      //console.log("valper", valper);
      //console.log("valpro", valpro);

      const filamod = {
        id: cot.IdModalidad,
        tm: cot.Moneda,
        pd: cot.PeriodoDiferido * 12,
        pg: cot.PeriodoGarantizado * 12,
        gr: cot.Gratificacion,
        pt: cot.PrimerTramo * 12,
        st: cot.SegundoTramo,
        afp: cot.TasaRentaAFP / 100,
        tmp: cot.RentaTemp / 100,
        tavta: valvta / 100,
        taanc: 3 / 100,
        taprm: valpro / 100,
        tirtop: valtir / 100,
        pertop: valper / 100,
        com: cot.comision / 100,
        mesdev: await mesdevengado(datosAse.FechaDevengue),
        gs: montoGS,
        dev: datosAse.FechaDevengue,
        pre: datosAse.TipoPension,
        cic: montoCIC,
        tipcam: tipocambio,
        gastos: datosGas,
        idfiltro: cot.filtro,
        idrechazo: cot.rechazo,
        rechazo: cot.motivorechazo,
      }
      DataModalidad.push(filamod);
    }

    //console.log("DataBeneficiarios", DataBeneficiarios);
    //console.log("DataModalidad ", DataModalidad);
    //console.log("termina calculo modalidad " + datosSol.IdoperacionSbs);

    let resultadoFinal = [];
    let resultadoFinalben = [];

    const resultadosModalidades = await Promise.all(
      DataModalidad.map(dostosMod => limit(async () => {

        const datosflujos = await calcularflujos(dostosMod, DataBeneficiarios, TasasIPC);
        const resultadoscalpen = await calcularTasasWorker({
          idsoliictud: datosSol.IdoperacionSbs,
          objDatosMod: dostosMod,
          objDatoflujos: datosflujos,
          sumprc: sumprcben,
          TasasCurvaCero,
          TasasRentabilidad
        });
        const resultadoFinalben = DataBeneficiarios.map(ben => ({
          id: ben.idben,
          prc: ben.prcleg,
          pension: resultadoscalpen.penref * (ben.prcleg / 100)
        }));

        resultadoscalpen.operacion = datosSol.IdoperacionSbs;
        resultadoscalpen.gastosep = montoGS;
        resultadoscalpen.idfiltro = dostosMod.idfiltro;
        resultadoscalpen.idrechazo = dostosMod.idrechazo;
        resultadoscalpen.rechazo = dostosMod.rechazo;
        resultadoscalpen.resultadospen = resultadoFinalben;

        return resultadoscalpen;
      }))
    );

    resultadoFinal = resultadosModalidades.flat();

    const solResultados = {
      Solicitud: resultadoFinal
    }
    resultadoFinalSol.push(solResultados);
    //res.json(resultadoFinal);
    //console.log("acaba de calcular solicitud " + datosSol.IdoperacionSbs);
    //console.log("Resultados: ", resultadoscalpen);
    console.timeEnd(`Cálculando Solicitud-${datosSol.IdoperacionSbs}`);
    //console.error('datosSol:', datosSol);
    return resultadoFinalSol;
    //res.json(resultadoFinalSol);
    //res.send('esta en la rutina!!!');

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error rutina' });
  }
}

async function AsignaPorcentajes(datosBen) {
  //console.log("conteo ben AsignaPorcentajes", datosBen);
  const conteos = await CuentaBeneficiarios(datosBen);
  //console.log("conteos", conteos)
  const cy = conteos[2] || 0;
  const hi = conteos[6] || 0;
  const pa = conteos[7] || 0;

  const prcoricy = await prclegales('2', cy, hi, pa);
  const prcorihi = await prclegales('6', cy, hi, pa);
  const prcoripa = await prclegales('7', cy, hi, pa);

  const prctotcy = prcoricy * cy;
  const prctothi = prcorihi * hi;
  const prctotpa = prcoripa * pa;
  const totprc = prctotcy + prctothi + prctotpa;

  const prclegcy = prctotcy + prctothi > 100 ? prcoricy / (prctotcy + prctothi) : prcoricy;
  const prcleghi = prctotcy + prctothi > 100 ? prctothi / (prctotcy + prctothi) : prcorihi;
  const prclegpa = totprc > 100 ? totprc - 100 > prctotpa ? 0 : (prctotpa - (totprc - 100)) / pa : prcoripa;

  //console.log("hi", hi)
  const arrayConteos = Object.entries(conteos);
  const valoresExtra = {
    '2': prclegcy,
    '6': prcleghi,
    '7': prclegpa,
  };
  const datosConExtras = arrayConteos.map(([clave, valor]) => {
    return [clave, valor, valoresExtra[clave] || 0]; // si no existe, se pone 0
  });

  //console.log("datosConExtras", datosConExtras)
  return datosConExtras;
}

async function prclegales(idpar, cy, hi, pa) {
  let prcleg = 0;
  switch (idpar) {
    case '2':
      if (hi > 0) {
        prcleg = 35;
      }
      else {
        prcleg = 42;
      }
      break;
    case '6':
      if (cy > 0) {
        if (hi > 0) {
          prcleg = 14;
        }
      } else {
        if (hi > 1) {
          prcleg = (42 + 14 * hi) / hi;
        }
        else if (hi = 1) {
          prcleg = 42;
        } else {
          prcleg = 0;
        }
      }
      break;
    case '7':
      if (pa > 0) {
        prcleg = 14;
      }
      break;
    default:
      console.log('Opción no válida');
  }
  return prcleg;
}

async function CuentaBeneficiarios(datosBen) {
  //console.log("conteo ben CuentaBeneficiarios", datosBen);
  const conteoPorParentesco = {};
  for (const item of datosBen) {
    const parentesco = item.Parentesco;
    conteoPorParentesco[parentesco] = (conteoPorParentesco[parentesco] || 0) + 1;
  };
  // const conteoParentesco = datosBen.reduce((acc, item) => {
  //   const tipo = item.Parentesco;
  //   acc[tipo] = (acc[tipo] || 0) + 1;
  //   return acc;
  // }, {});
  //console.log(conteoPorParentesco);
  return conteoPorParentesco;
}

async function edadtope(idpar, inv, devsol) {
  let edadt = 111;
  const fecsol = new Date('2013-08-01');
  const fecdsl = new Date(devsol);

  if (idpar == 6 && inv == 1) {
    if (fecdsl >= fecsol) {
      edadt = 28;
    }
    else {
      edadt = 18;
    }
  };
  return edadt;
}

async function edadmesdev(fecdev, fecnac) {
  const fecdevt = new Date(fecdev);
  const fecnact = new Date(fecnac);
  const mesfecdev = fecdevt.getMonth() + 1; // getMonth() devuelve 0 (enero) a 11 (diciembre)
  const aniofecdev = fecdevt.getFullYear();
  const mesfecnact = fecnact.getMonth() + 1; // getMonth() devuelve 0 (enero) a 11 (diciembre)
  const aniofecnact = fecnact.getFullYear();
  let edaddv = (aniofecdev * 12 + mesfecdev) - (aniofecnact * 12 + mesfecnact);
  return edaddv;
}

async function MortalidadPer(sex, inv, fecnac, tm) {
  //console.log('Contenido del modelo:', tablasmortal);
  const fecnact = new Date(fecnac);
  const anonac = fecnact.getFullYear();
  const anno = 2017
  //console.log("tm",tm);
  const valores = tm; //await tablasmortal.getAllMortalProc();
  if (!valores || valores.length === 0) {
    return res.status(404).json({ message: 'No se encontraron datos en la tabla de mortalidad' });
  }
  //console.log(valores);
  const tmortal = [];
  const tmortalLX = [];
  let aux = 0;
  let annio = 0;
  let lx = 0;
  let qx = 0;
  let qxant = 0
  let lxant = 0
  let qxfinal = 0

  if (sex == 1) {
    //console.log('tablas mortalidad hombres')
    if (inv == 1) {
      for (const val of valores) {
        //console.log(`edad: ${val.edad} / n_val11: ${val.n_val11} / n_val21: ${val.n_val21} / n_val12: ${val.n_val12} / n_val22: ${val.n_val22}`);
        //console.log(`edad: ${val.edad} / qxbase: ${val.n_val11} / fxmejora: ${val.n_valaxx1} / qxfinal: ${val.n_val11 * Math.pow(1 - val.n_valaxx1, Math.max(anonac + val.edad - anno,0))}`);
        const fila = {
          edad: val.edad,
          qxbase: val.n_val11,
          fxmejora: val.n_valaxx1,
          qxfinal: parseFloat(val.n_val11 * Math.pow(1 - val.n_valaxx1, Math.max(anonac + val.edad - anno, 0)))
        }
        tmortal.push(fila);
      }
    } else {
      for (const val of valores) {
        //console.log(`edad: ${val.edad} / n_val11: ${val.n_val11} / n_val21: ${val.n_val21} / n_val12: ${val.n_val12} / n_val22: ${val.n_val22}`);
        const fila = {
          edad: val.edad,
          qxbase: val.n_val12,
          fxmejora: val.n_valaxx1,
          qxfinal: parseFloat(val.n_val12 * Math.pow(1 - val.n_valaxx1, Math.max(anonac + val.edad - anno, 0)))
        }
        tmortal.push(fila);
      }
    }
  } else {
    //console.log('tablas mortalidad muejeres')
    if (inv == 1) {
      for (const val of valores) {
        //console.log(`edad: ${val.edad} / n_val11: ${val.n_val11} / n_val21: ${val.n_val21} / n_val12: ${val.n_val12} / n_val22: ${val.n_val22}`);
        const fila = {
          edad: val.edad,
          qxbase: val.n_val21,
          fxmejora: val.n_valaxx2,
          qxfinal: parseFloat(val.n_val21 * Math.pow(1 - val.n_valaxx2, Math.max(anonac + val.edad - anno, 0)))
        }
        tmortal.push(fila);
      }
    } else {
      for (const val of valores) {
        //console.log(`edad: ${val.edad} / n_val11: ${val.n_val11} / n_val21: ${val.n_val21} / n_val12: ${val.n_val12} / n_val22: ${val.n_val22}`);
        const fila = {
          edad: val.edad,
          qxbase: val.n_val22,
          fxmejora: val.n_valaxx2,
          qxfinal: parseFloat(val.n_val22 * Math.pow(1 - val.n_valaxx2, Math.max(anonac + val.edad - anno, 0)))
        }
        tmortal.push(fila);
      }
    }
  }
  //console.log("tmortal",tmortal);
  for (let i = 0; i <= 1331; i++) {
    qxfinal = tmortal.find(x => x.edad === annio).qxfinal;
    qx = (1 / 12) * qxfinal / ((12 - aux * qxfinal) / 12);
    lx = i == 0 ? 100000 : lxant * (1 - qxant);
    //console.log(`aux: ${aux} / annio: ${annio} / qxfinal: ${qxfinal} / qx: ${qx} / lx: ${lx}` );
    qxant = qx;
    lxant = lx;

    aux = aux >= 11 ? 0 : aux + 1;
    if (aux === 0 && i !== 0) {
      annio++;
    }

    tmortalLX.push({
      meses: i,
      lx: parseFloat(lx)
    });
    //logMatriz(tmortalLX);
  }
  //console.log(tmortalLX);
  //console.log(tmortal);
  return tmortalLX;
}

async function mesdevengado(fecdev) {
  const fecdevt = new Date(fecdev);
  const feccott = new Date('2024-10-01');
  const mesfec1 = fecdevt.getMonth() + 1; // getMonth() devuelve 0 (enero) a 11 (diciembre)
  const aniofec1 = fecdevt.getFullYear();
  const mesfec2 = feccott.getMonth() + 1; // getMonth() devuelve 0 (enero) a 11 (diciembre)
  const aniofec2 = feccott.getFullYear();
  let mesesedevengado = (aniofec2 * 12 + mesfec2) - (aniofec1 * 12 + mesfec1);
  return mesesedevengado;
}

async function mesesajus(fecha, mes, fechapripag, mesant) {

  const residuo = fecha.getMonth() % 3
  let mesajuste = mesant;
  if (residuo == 0) {
    if (fecha <= fechapripag) {
      mesajuste = mes;
    }
    else {
      mesajuste = mesajuste + 3;
    }
  }
  return mesajuste;
}

async function mesesajusIPCsoles(fechaini, fechafin, valant, datosIPC, ipcValorFinDefault = 1) {
  const fechap = fechafin.getMonth() + 1;

  let resValini = datosIPC.find(item => new Date(item.d_periodo).getTime() === fechaini.getTime());
  let resValfin = datosIPC.find(item => new Date(item.d_periodo).getTime() === fechafin.getTime());

  const ipcValorini = parseFloat(resValini?.n_valor);
  const ipcValorSig = parseFloat(resValfin?.n_valor ?? ipcValorFinDefault);

  const residuo = fechap % 3;
  return residuo === 0 ? ipcValorSig / ipcValorini : valant;
}

async function factorgratificacion(fecha, isgrati) {
  const mes = fecha.getMonth() + 1;
  let grati = 1;
  if (isgrati == "S") {
    if (mes == 7 || mes == 12) {
      grati = 2;
    }
  }
  return grati;
}

async function calcularflujos(objDatosmod, objDatosBen, objDatosIpc) {

  //INICIA LA VARIABLE MATRIZ DE FLUJOS
  const resultado = [];
  const fecdev = objDatosmod.dev;
  const prestacion = objDatosmod.pre;
  const moneda = objDatosmod.tm;
  const fechaInicial = new Date(fecdev); // puedes cambiar esta fecha
  const fechadev = new Date(fecdev);
  const mesprimerajus = 3 - (fechadev.getMonth() % 3)
  const mesfecdev = fechadev.getMonth() + 1;
  const aniofecdev = fechadev.getFullYear();
  const fecajuspripag = new Date(aniofecdev, mesfecdev + mesprimerajus, 0);
  const mesesdevengado = objDatosmod.mesdev + 1;
  const isgrati = objDatosmod.gr;
  const primeresc = objDatosmod.pt;
  const sgdotresc = objDatosmod.st;
  const perdif = objDatosmod.pd;
  const pergar = objDatosmod.pg;
  const mtogs = objDatosmod.gs;
  let mesajuste = 0;
  let mesajustetmp = 0;
  let mescalculo = 0;
  let ajusteacummon = 0;
  let ipcacummon = 1;
  let ipcacummontmp = 1;
  let factorgrati = 1;
  let factorescalonada = 1;

  const ajusteanual = moneda == 1 ? 0 : 2 / 100;
  const ajsutemensual = Math.pow((1 + ajusteanual), (1 / 12)) - 1
  //console.log("ajsutemensual", ajsutemensual);
  //console.log("inicia")

  // Obtener la fecha máxima de la IPC valor ultimo registrado
  const maxFecha = objDatosIpc.reduce((max, item) => {
    return item.d_periodo > max.d_periodo ? item : max;
  });

  for (let i = 0; i <= 1332; i++) {
    const numero1 = i;       // del 0 al 1332
    const numero2 = i + 1;   // del 1 al 1333

    // Clonar la fecha inicial y sumarle i meses
    const fecha = new Date(fechaInicial);
    fecha.setMonth(fecha.getMonth() + i);

    //columna Meses de Calculo
    mescalculo = numero1 <= mesesdevengado ? 0 : mescalculo + 1;

    //columna Meses Ajuste Acumulado
    mesajuste = await mesesajus(fecha, mesprimerajus, fecajuspripag, mesajustetmp);
    mesajustetmp = mesajuste;

    //columna de fecha Convertir la fecha a string en formato YYYY-MM
    const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

    //columna Ajuste Indexadas soles
    const fechaIpcmesini = new Date(fechaInicial.getFullYear(), fechaInicial.getMonth() - 1, 1);
    const fechaIpcmes = new Date(fecha.getFullYear(), fecha.getMonth() - 1, 1);
    ipcacummon = await mesesajusIPCsoles(fechaIpcmesini, fechaIpcmes, ipcacummontmp, objDatosIpc, maxFecha.n_valor);
    ipcacummontmp = ipcacummon;

    //columna Ajustadas soles y dolares
    ajusteacummon = Math.pow((1 + ajsutemensual), mesajuste);

    //columna de gratificacion
    factorgrati = await factorgratificacion(fecha, isgrati);

    //columna de primer tramo
    let stg = primeresc == 0 ? 1 : sgdotresc;
    factorescalonada = numero2 > primeresc ? stg : 1;

    resultado.push([numero1, numero2, mescalculo, fechaStr, mesajuste, moneda == 1 ? ipcacummon : ajusteacummon, factorgrati]);
    //columna datos del Titular

  }
  //console.log("termina")
  //logMatriz(resultado, "resultadoInicialajustes.txt");
  //return "";
  //Agrupa los datos DE FLUJOS DE PENSIONES
  const flujosfamiliar = [];
  for (const datosBen of objDatosBen) {
    let orden = datosBen.idben;
    let edadtop = datosBen.edadtope * 12;
    let mesfecdev = 0;
    if (prestacion == 5) {
      if (orden == 1) {
        mesfecdev = edadtop;
      } else {
        mesfecdev = datosBen.edaddev;
      }
    } else {
      mesfecdev = datosBen.edaddev;
    }

    let prcleg = datosBen.prcleg / 100;
    let qxt = 1;
    let tpx = 1;
    let qxtant = 1;
    let tpxant = 1;
    let flujo = 1;

    for (let i = 0; i <= 1332; i++) {
      let edadxt = mesfecdev + i;

      let lxt = datosBen.tm.find(x => x.meses === edadxt) || 0;
      let lxtd = datosBen.tm.find(x => x.meses === edadxt + 1) || 0;
      if (lxt == 0) {
        qxt = 1;
      } else {
        if (edadxt < (mesfecdev + mesesdevengado)) {
          qxt = 0;
          //console.log("aca")
        } else {
          qxt = 1 - (lxtd?.lx / lxt?.lx);
          //console.log(" des pues aca")
        }
      }

      if (edadxt >= edadtop) {
        tpx = 0;
      } else {
        if (i == 0) {
          if (lxt == 0) {
            tpx = 0;
          }
          else {
            tpx = 1;
          }
        } else {
          tpx = tpxant * (1 - qxtant);

        }
      }
      //console.log("orden",orden)
      let tpxpadre = 0;
      if (orden == 1) {
        if (i + 1 <= perdif) {
          flujo = 0;
        } else if (i + 1 <= perdif + pergar) {
          if (prestacion == 5) {
            flujo = 0;
          } else {
            flujo = 1;
          }
        } else {
          flujo = tpx;
        }
      } else {
        if (i + 1 <= perdif) {
          flujo = 0;
        } else if (i + 1 <= perdif + pergar) {
          if (prestacion == 5) {
            if (edadxt >= 0) {
              flujo = 1;
            } else {
              flujo = 0;
            }
          } else {
            flujo = 0;
          }
        } else {
          tpxpadre = flujosfamiliar.find(x => x.id === 1 && x.num === i);
          flujo = tpx * (1 - tpxpadre?.tpx) * (edadxt >= 0 && edadxt < edadtop ? 1 : 0);

        }
      }
      /*       if(orden==1 && i<=500){
              console.log("|orden: " + orden + "|i: " + i + "|flujo: " + flujo + "|perdif: " + perdif + "|pergar: " + pergar);
            } */

      const fila = resultado.find(fila => fila[0] === i);
      //console.log("fila selecionada", fila);
      if (fila) {
        let valajuste = fila.at(-2); // O fila[fila.length - 1]
        //console.log("| orden:" + orden + "| num:" + i + "| tpx:" + tpx + "| tpxpadre:" + tpxpadre?.tpx + "| flujo:" + flujo + "| prcleg:" + prcleg + "| valajuste:" + valajuste)
        flujo = flujo * prcleg * valajuste
      }

      const filmeses = {
        id: datosBen.idben,
        num: i,
        mes: edadxt,
        lx: lxt?.lx,
        qx: qxt,
        tpx: tpx,
        flujo: flujo,
        flujogs: 0,
        flujototal: 0
      }
      flujosfamiliar.push(filmeses);

      qxtant = qxt;
      tpxant = tpx;
      //console.log("| id=" + datosBen.idben + "| edadxt=" + edadxt + "| qxtant=" + qxtant + "| tpxant=" + tpxant + "| tpx=" + tpx + "| qxt=" + qxt + "| flujo=" + flujo);
    }
  }
  //return ""
  //SACA EL FLUJO DE GASTO DE SEPELIO
  let i = 1;
  const flujos = flujosfamiliar.filter(x => x.id === 1);
  let flujogs = 0;
  for (const benfam of flujos) {
    let edada = benfam.mes;
    let edads = benfam.mes + 1;
    //console.log("|edada=" + edada +  "|edads=" + edads);
    if (i <= Math.max(mesesdevengado, perdif)) {
      tqx = 0;
    } else {
      let tpxa = flujos.find(x => x.mes === edada);
      let tpxs = flujos.find(x => x.mes === edads);
      tqx = tpxa?.tpx - tpxs?.tpx;
      flujogs = tqx;// * mtogs;
      //console.log("|tpxa=" + tpxa?.tpx + "|tpxs=" + tpxs?.tpx + "|tqx=" + tqx + "|mtogs=" + mtogs);
    }
    benfam.flujogs = flujogs;
    i = i + 1;
  }
  //const flujosorden = flujosfamiliar.filter(f => f.id === 7).map(f => f.flujo);
  //logMatriz(flujosorden, "logFlujosCot.txt");
  //logMatriz(flujosfamiliar, "logFlujosCot.txt");
  //return "";
  return flujosfamiliar;
}

function logMatriz(datos, nombre) {

  //const datos = datos;

  // Formatea cada fila como texto (por ejemplo, separando por comas si es un array)
  const contenido = datos.map(fila => Array.isArray(fila) ? fila.join(',') : JSON.stringify(fila)).join('\n');

  // Escribe en archivo log.txt
  fs.writeFileSync(nombre, contenido, (err) => {
    if (err) {
      console.error('Error escribiendo archivo:', err);
    } else {
      console.log('Archivo log.txt creado exitosamente');
    }
  });
}

async function ObtieneRegionCIC(listadoRegion, monto) {
  //console.log("listadoRegion", listadoRegion);
  //console.log("monto", monto);

  const resultado = listadoRegion.find(region => {
    const min = parseFloat(region.n_cicminimo);
    const max = parseFloat(region.n_cicmaximo);
    return monto >= min && monto <= max;
  });

  if (resultado) {
    idreg = resultado.id;
    //console.log(`El valor ${monto} está en el ID: ${resultado.id}`);
  } else {
    console.log('Valor no encontrado en ningún rango');
  }

  //console.log("fx ObtieneRegionCIC", idreg)
  return idreg;

}

async function ObtieneTasasTope(listadoTasas, region, moneda, prestacion, tipo) {

  //console.log("listadoTasas",listadoTasas);
  //console.log("region", region);
  //console.log("moneda", moneda);
  //console.log("prestacion", prestacion);
  //console.log("tipo", tipo);

  let valor = 0;

  switch (tipo) {
    case "V":
      //console.log("entra en v");
      const valtas = listadoTasas.find(x => x.idmrg === Number(region) && x.idmoneda === Number(moneda) && x.idprestacion === prestacion)?.n_valtasini
      valor = valtas;
      //console.log("valtas",valtas);
      break;
    case "T":
      //console.log("entra en t");
      const valtir = listadoTasas.find(x => x.idmrg === Number(region) && x.idmoneda === Number(moneda) && x.idprestacion === prestacion)?.n_valtirini
      valor = valtir;
      //console.log("valtir",valtir);
      break;
    case "P":
      //console.log("entra en p");
      const valper = listadoTasas.find(x => x.idmrg === Number(region) && x.idmoneda === Number(moneda) && x.idprestacion === prestacion)?.n_valperini
      valor = valper;
      //console.log("valper",valper);
      break;
  }
  return valor;
}

async function ObtieneTasasVtaPromedio(listadoTasaVtaProm, moneda, prestacion, fecha) {
  //console.log("fecha", fecha);
  const fechaObj = new Date(fecha);
  // Primero, buscar coincidencia exacta
  let resultado = listadoTasaVtaProm.find(item =>
    item.idmoneda === Number(moneda) &&
    item.idprestacion === prestacion &&
    formatDate(item.v_periodo) === fecha
  );
  // Si no se encuentra, buscar la más reciente anterior o igual
  if (!resultado) {
    resultado = listadoTasaVtaProm
      .filter(item =>
        item.idmoneda === Number(moneda) &&
        item.idprestacion === prestacion &&
        new Date(item.v_periodo) <= fechaObj
      )
      .sort((a, b) => new Date(b.v_periodo) - new Date(a.v_periodo)) // orden descendente
    [0]; // primer más reciente
  }
  return resultado?.n_valor ?? null;
}

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calcularTasasWorker(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '../worker/calcularWorker.js'), {
      workerData: data
    });

    worker.on('message', (msg) => {
      if (msg.ok) resolve(msg.resultado);
      else reject(new Error(msg.error));
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker terminó con código ${code}`));
    });
  });
}



// #region Cálculo de pensión reciclados

async function calcularpension_ini_opti(idsoliictud, objDatosMod, objDatoflujos, sumprc, TasasCurvaCero, TasasRentabilidad) {
  //console.time(`calcularpension_ini_opti pension-${objDatosMod.id}`);

  // Preprocesar flujos por mes
  const flujoMap = new Map();
  for (const flujo of objDatoflujos) {
    if (!flujoMap.has(flujo.num)) flujoMap.set(flujo.num, []);
    flujoMap.get(flujo.num).push(flujo);
  }

  const {
    id: idmod,
    tmp: rentmp,
    cic: mtocic,
    gs: mtogs,
    pd: mesdif,
    tm: moneda,
    tipcam,
    afp,
    com: comision,
    mesdev: mesdevengdoBase,
    pre: prestacion,
    gastos,
    taprm: tasvtapro,
    tirtop: topeTir,
    pertop: topePer,
    tavta: tasvta
  } = objDatosMod;

  const afpmen = Math.pow(1 + afp, 1 / 12) - 1;
  const mesdevengdo = mesdevengdoBase + 1;

  const tasaanual = Math.pow(1 + tasvta, 1 / 12) - 1;
  const tasvtamen = 1 / (1 + tasaanual);

  let crupen = 0, crugs = 0;
  const DatasumaFlujos = [];

  let mescalculo = 0;
  for (let i = 0; i <= 1331; i++) {
    mescalculo = i <= mesdevengdo ? 0 : mescalculo + 1;
    const flujos = flujoMap.get(i) || [];

    const sumFlujo = flujos.reduce((acc, x) => acc + x.flujo, 0);
    const sumFlujoGS = flujos.reduce((acc, x) => acc + x.flujogs, 0);

    crupen += sumFlujo * Math.pow(tasvtamen, mescalculo);
    crugs += sumFlujoGS * Math.pow(tasvtamen, mescalculo);

    DatasumaFlujos.push({
      mes: i,
      mescal: mescalculo,
      flujossumtot: sumFlujo,
      flujosgssumtot: mtogs * sumFlujoGS
    });
  }

  // Calcular factor AFP
  const sumprcpen = sumprc / 100;
  const prctitinv = prestacion === 3 ? 0.7 : prestacion === 4 ? 0.5 : 1;

  let factorAfp = 0;
  if (mesdif > 0) {
    factorAfp = valorActual(0, afpmen / 100, 0) +
      Math.min(mesdevengdo, mesdif) * (prestacion === 5 ? sumprcpen : prctitinv);
  }

  const cruDot = 0;
  const prcfondo = 1;

  const penref = (prcfondo * mtocic - (prestacion === 5 ? 0 : mtogs) * crugs - prcfondo * mtocic * cruDot)
    / (crupen + factorAfp / rentmp);

  const penafp = (mesdif === 0 ? 0 : penref * 2) * (prestacion === 5 ? sumprcpen : prctitinv);
  const pencia = penref * (prestacion === 5 ? sumprcpen : prctitinv);
  const primaafp = (penref * 2) * factorAfp;
  const primacia = prcfondo * mtocic - primaafp;

  //console.time(`Solicictud inicial TciTlr-${idsoliictud}-${idmod}`);
  const resultadoTci = await calcularTciTlr(DatasumaFlujos, penref, moneda, TasasCurvaCero);
  //console.timeEnd(`Solicictud inicial TciTlr-${idsoliictud}-${idmod}`);

  const tasaTci = resultadoTci.valortci;
  const tasaTce = Math.min(tasvta, tasaTci, tasvtapro);
  //console.log("calcularpension_ini_opti |tasaTce: " + tasaTce + "|tasvta: " + tasvta + "|tasaTci: " + tasaTci + "|tasvtapro: " + tasvtapro);
  //console.time(`TIR-${idmod}`);
  const resultadoTir = await calcularTIR(
    resultadoTci.pagos,
    tasaTce,
    moneda,
    primacia,
    comision,
    gastos,
    tipcam,
    TasasRentabilidad
  );
  //console.timeEnd(`TIR-${idmod}`);

  const tasaTir = resultadoTir.valorTir;

  //console.time(`Perdida-${idmod}`);
  const perdida = await calcularPerdida(resultadoTir.valorReserva, primacia);
  //console.timeEnd(`Perdida-${idmod}`);


  // Resultado final
  let resultadoCot = {
    idmod,
    penref,
    penafp,
    pencia: moneda === 1 ? pencia : pencia / tipcam,
    primaafp,
    primacia,
    tasavta: tasvta * 100,
    tasaTci: tasaTci * 100,
    tasaTce: tasaTce * 100,
    tasaTir: tasaTir * 100,
    perdida: perdida * 100
  };
  //aqui iterar hasta hallar una tasas y pension por topes

  let nuevatasavta = tasaanual;
  if (tasaTir < topeTir) {
    resultadoCot = await calcularConReintentos(idsoliictud, idmod, objDatosMod, objDatoflujos, sumprcpen, nuevatasavta, TasasCurvaCero, TasasRentabilidad);
  }

  return resultadoCot;
}

async function calcularpension_rec_opti(idsoliictud, objDatosMod, objDatoflujos, sumprc, tasa, TasasCurvaCero, TasasRentabilidad) {
  //console.time(`calcularpension_rec_opti pension-${objDatosMod.id}`);
  //console.log('calcularpension_rec_opti entra a tasa : ', tasa);
  //Preprocesar flujos por mes
  const flujoMap = new Map();
  for (const flujo of objDatoflujos) {
    if (!flujoMap.has(flujo.num)) flujoMap.set(flujo.num, []);
    flujoMap.get(flujo.num).push(flujo);
  }

  const {
    id: idmod,
    tmp: rentmp,
    cic: mtocic,
    gs: mtogs,
    pd: mesdif,
    tm: moneda,
    tipcam,
    afp,
    com: comision,
    mesdev: mesdevengdoBase,
    pre: prestacion,
    gastos,
    taprm: tasvtapro,
    tirtop: topeTir,
    pertop: topePer
    //tavta: tasvta
  } = objDatosMod;

  const afpmen = Math.pow(1 + afp, 1 / 12) - 1;
  const mesdevengdo = mesdevengdoBase + 1;

  /* const tasvta = tasa;
  const tasaanual = Math.pow(1 + tasvta, 1 / 12) - 1;
  const tasvtamen = 1 / (1 + tasaanual); */

  const tasvta = Math.pow(1 + tasa, 12) - 1;
  const tasaanual = tasa; //Math.pow((1 + tasvta), (1 / 12)) - 1
  const tasvtamen = 1 / (1 + tasaanual);

  //console.log("|tasa: +" + tasa + "|tasvta:" + tasvta + "|tasaanual:" + tasaanual + "|tasvtamen:" + tasvtamen);

  let crupen = 0, crugs = 0;
  const DatasumaFlujos = [];

  let mescalculo = 0;
  for (let i = 0; i <= 1331; i++) {
    mescalculo = i <= mesdevengdo ? 0 : mescalculo + 1;
    const flujos = flujoMap.get(i) || [];

    const sumFlujo = flujos.reduce((acc, x) => acc + x.flujo, 0);
    const sumFlujoGS = flujos.reduce((acc, x) => acc + x.flujogs, 0);

    crupen += sumFlujo * Math.pow(tasvtamen, mescalculo);
    crugs += sumFlujoGS * Math.pow(tasvtamen, mescalculo);

    DatasumaFlujos.push({
      mes: i,
      mescal: mescalculo,
      flujossumtot: sumFlujo,
      flujosgssumtot: mtogs * sumFlujoGS
    });
  }

  // Calcular factor AFP
  const sumprcpen = sumprc / 100;
  const prctitinv = prestacion === 3 ? 0.7 : prestacion === 4 ? 0.5 : 1;

  let factorAfp = 0;
  if (mesdif > 0) {
    factorAfp = valorActual(0, afpmen / 100, 0) +
      Math.min(mesdevengdo, mesdif) * (prestacion === 5 ? sumprcpen : prctitinv);
  }

  const cruDot = 0;
  const prcfondo = 1;

  const penref = (prcfondo * mtocic - (prestacion === 5 ? 0 : mtogs) * crugs - prcfondo * mtocic * cruDot)
    / (crupen + factorAfp / rentmp);

  const penafp = (mesdif === 0 ? 0 : penref * 2) * (prestacion === 5 ? sumprcpen : prctitinv);
  const pencia = penref * (prestacion === 5 ? sumprcpen : prctitinv);
  const primaafp = (penref * 2) * factorAfp;
  const primacia = prcfondo * mtocic - primaafp;

  //console.time(`Solicictud intera TciTlr_opti-${idsoliictud}-${idmod}`);
  const resultadoTci = await calcularTciTlr_opti(DatasumaFlujos, penref, moneda, TasasCurvaCero);
  //console.timeEnd(`Solicictud intera TciTlr_opti-${idsoliictud}-${idmod}`);

  const tasaTci = resultadoTci.valortci;
  const tasaTce = Math.min(tasvta, tasaTci, tasvtapro);

  /*  const [resultadoTir, perdida] = await Promise.all([
     calcularTIR_opti(resultadoTci.pagos, tasaTce, moneda, primacia, comision, gastos, tipcam, TasasRentabilidad),
     calcularPerdida(resultadoTci.valorReserva, primacia)
   ]); */
  //console.log("calcularpension_rec_opti |tasaTce: " + tasaTce + "|tasvta: " + tasvta + "|tasaTci: " + tasaTci + "|tasvtapro: " + tasvtapro);
  //console.time(`calcularpension_rec_opti TIR-${idmod}`);
  const resultadoTir = await calcularTIR_opti(
    resultadoTci.pagos,
    tasaTce,
    moneda,
    primacia,
    comision,
    gastos,
    tipcam,
    TasasRentabilidad
  );
  //console.timeEnd(`calcularpension_rec_opti TIR-${idmod}`);

  const tasaTir = resultadoTir.valorTir;

  //console.time(`Perdida-${idmod}`);
  const perdida = await calcularPerdida(resultadoTir.valorReserva, primacia);
  //console.timeEnd(`Perdida-${idmod}`);

  let tasaSatisf = "ok";
  if (tasaTir < topeTir) {
    //console.log("sigue iterando... por tope de TIR");
    tasaSatisf = "ko";
  }

  if (perdida > topePer) {
    //console.log("sigue iterando...por tope de perdida");
    tasaSatisf = "ko";
  }

  // Resultado final
  const resultadoCot = {
    procede: tasaSatisf,
    idmod: idmod,
    penref: penref,
    penafp: penafp,
    pencia: moneda == 1 ? pencia : moneda == 2 ? pencia : moneda == 3 ? pencia / tipcam : pencia / tipcam,
    primaafp: primaafp,
    primacia: primacia,
    tasavta: (Math.pow(1 + tasaanual, 12) - 1) * 100,
    tasaTci: tasaTci * 100,
    tasaTce: tasaTce * 100,
    tasaTir: tasaTir * 100,
    perdida: perdida * 100
  };
  //console.timeEnd(`calcularpension_rec_opti pension-${idmod}`);
  return resultadoCot;
}

async function calcularConReintentos(idsoliictud, idmod, objDatosMod, objDatoflujos, sumprcpen, tasa, TasasCurvaCero, TasasRentabilidad) {
  let resultado;
  let nuevatasavta = tasa;
  let i = 0
  while (true) {
    resultado = await calcularpension_rec_opti(idsoliictud, objDatosMod, objDatoflujos, sumprcpen, nuevatasavta, TasasCurvaCero, TasasRentabilidad);
    if (resultado.procede === 'ok') break;
    nuevatasavta -= 0.00001;
    if (nuevatasavta <= 0) break;
    i += 1;
    //console.log("|idsoliictud: " + idsoliictud + "| id: " + idmod + "| iteraion #: " +  i)
  }
  return resultado;
}

async function calcularTciTlr_opti(dataSumflujos, pension, moneda, TasasCurvaCero) {
  //console.time(`calcularTciTlr_opti-${moneda}`);

  // Filtrar curva según moneda una sola vez
  const curvaPorMes = new Map();
  for (const item of TasasCurvaCero) {
    if (item.idmoneda === Number(moneda)) {
      curvaPorMes.set(item.mes, item.n_valor);
    }
  }

  // Calcular los valores de flujo de pensión
  for (const data of dataSumflujos) {
    data.valfulpen = (data.flujossumtot * pension) + data.flujosgssumtot;
  }

  // Agrupar los flujos por mescal para acceso rápido
  const flujosPorMes = new Map();
  for (const item of dataSumflujos) {
    const key = item.mescal;
    const actual = flujosPorMes.get(key) || 0;
    flujosPorMes.set(key, actual + item.valfulpen);
  }

  // Calcular pasivos y preparar flujos
  const DataFlujospen = [];
  let totalpasivo = 0;
  let Valflujodev = flujosPorMes.get(0) || 0;

  for (let i = 0; i <= 1332; i++) {
    const valcurvames = curvaPorMes.get(i) ?? 0;
    const valflujo = flujosPorMes.get(i) || 0;

    const tasa = valcurvames / 100;
    const descuento = Math.pow(1 + tasa, i / 12);
    const pasivo = valflujo / descuento;

    totalpasivo += pasivo;

    DataFlujospen.push({
      mest: i,
      valflu: valflujo,
      valfluTLR: valflujo, // temporal, se ajusta más abajo
      valcurva: valcurvames,
      valpasivo: pasivo
    });
  }

  // Ajustar el valor del mes 0 para calcular TCE
  if (DataFlujospen.length > 0) {
    DataFlujospen[0].valfluTLR = Valflujodev - totalpasivo;
  }

  const flujosTLR = DataFlujospen.map(obj => obj.valfluTLR);

  // Calcular TCI usando IRR
  const irr = await calculaIRR(flujosTLR); // Se llama solo una vez
  const valortci = Math.pow(1 + irr, 12) - 1;
  const valortcimen = valortci * 100;

  //console.timeEnd(`calcularTciTlr_opti-${moneda}`);

  return {
    valortci,
    valortcimen,
    pagos: DataFlujospen
  };
}

async function calcularTIR_opti(Datapagos, tce, moneda, primacia, comision, gastos, tc, TasasRentabilidad) {
  const rentabilidadMoneda = TasasRentabilidad.filter(x => x.idmoneda === Number(moneda));
  const aInicial = parseFloat(rentabilidadMoneda[0]?.annio ?? 0);
  const aFinal = parseFloat(rentabilidadMoneda[1]?.annio ?? 0);
  const vInicial = parseFloat(rentabilidadMoneda[0]?.n_valor ?? 0);
  const vFinal = parseFloat(rentabilidadMoneda[1]?.n_valor ?? 0);

  const gastoEmi = [3, 4].includes(moneda) ? gastos.Gastosemi / tc : gastos.Gastosemi;
  const gastoMan = [3, 4].includes(moneda) ? gastos.Gastosmant / tc : gastos.Gastosmant;
  const impuesto = gastos.Impuestos;

  let tasaTce = tce;
  const margenSol = 6.75 / 100;
  let comisionesTotal = (comision + 0.0171) * 1.47;
  let reservacero = 0;
  let q = 0;

  for (const data of Datapagos) {
    const mest = data.mest;
    const pagos = data.valflu;
    const anioDecimal = mest / 12;
    const tasainv = Math.ceil(anioDecimal) < aFinal ? vInicial : vFinal;
    data.tasainvanual = tasainv / 100;

    let reserva = await reservas(pagos, Datapagos, q + 1, tasaTce);
    if (q === 0) {
      reservacero = reserva;
      comisionesTotal = primacia * comisionesTotal;
    }
    data.reserva = reserva;

    const reservaAnt = Datapagos.find(x => x.mest === mest - 1)?.reserva || 0;
    const capital = reserva * margenSol;
    const capitalAnt = Datapagos.find(x => x.mest === mest - 1)?.capital || 0;

    data.capital = capital;

    const gastoMant = (gastoMan / 12) * (reserva / reservacero);
    data.gasmant = gastoMant;

    const pagosT = q === 0 ? 0 : Datapagos.find(x => x.mest === mest - 1)?.valflu || 0;
    data.pagos = pagosT;

    const varReserva = q === 0 ? reservacero : reserva - reservaAnt;
    data.varires = varReserva;

    const prodInver = q === 0
      ? 0
      : (Math.pow(1 + data.tasainvanual, 1 / 12) - 1) * (reservaAnt + capitalAnt);
    data.prodinver = prodInver;

    const utilImp = q === 0
      ? primacia - (comisionesTotal + gastoEmi + gastoMant + pagosT + varReserva) + prodInver
      : 0 - (gastoMant + pagosT + varReserva) + prodInver;
    data.utilimp = utilImp;

    const impuestos = 0; // Ajustar si aplica fórmula real
    data.impuestos = impuestos;

    const varCapital = q === 0 ? capital : capital - capitalAnt;
    data.varcapit = varCapital;

    const flujoAcc = utilImp - impuestos - varCapital;
    data.flujoacc = flujoAcc;

    q++;
  }

  const flujosAcc = Datapagos.map(d => d.flujoacc);
  const tir = await calculaIRR(flujosAcc);
  const tasaTir = Math.pow(1 + tir, 12) - 1;

  return {
    valorTir: tasaTir,
    valorReserva: reservacero
  };
}

async function calcularpension_ini(objDatosMod, objDatoflujos, sumprc, TasasCurvaCero, TasasRentabilidad) {

  let crupen = 0;
  let crugs = 0;
  const prcfondo = 1;
  const cruDot = 0;
  const idmod = objDatosMod.id;
  //console.log("idmod", idmod)
  const rentmp = objDatosMod.tmp;
  const mtocic = objDatosMod.cic;
  const mtogs = objDatosMod.gs;
  const mesdif = objDatosMod.pd;
  const moneda = objDatosMod.tm;
  const tipcam = objDatosMod.tipcam;
  const afp = objDatosMod.afp;
  const comision = objDatosMod.com;
  const afpmen = Math.pow((1 + afp), 1 / 12) - 1;
  const mesdevengdo = objDatosMod.mesdev + 1;
  const prestacion = objDatosMod.pre;
  const gastos = objDatosMod.gastos;
  //console.log(gastos);
  const tasvtapro = objDatosMod.taprm;
  const topeTir = objDatosMod.tirtop;
  const topePer = objDatosMod.pertop;
  //tasas de venta
  const tasvta = objDatosMod.tavta;
  const tasaanual = Math.pow((1 + tasvta), (1 / 12)) - 1
  const tasvtamen = 1 / (1 + tasaanual);

  //SUMATORIAS CRU
  let sumatotflujos = 0;
  let sumatotmtojosgs = 0;
  let mescalculo = 0;
  const DatasumaFlujos = [];
  for (let i = 0; i <= 1331; i++) {
    mescalculo = i <= mesdevengdo ? 0 : mescalculo + 1;
    const flujos = objDatoflujos.filter(x => x.num === i);
    //const valoresTpx = flujos.map(x => x.tpx);
    //const valoresFlujo = flujos.map(x => x.flujo);
    let sumaTotal = flujos.reduce((acc, x) => acc + x.flujo, 0) * Math.pow(tasvtamen, mescalculo);
    let sumaTotalgs = flujos.reduce((acc, x) => acc + x.flujogs, 0) * Math.pow(tasvtamen, mescalculo);
    //console.log("|num=" + i + "|mescalculo=" +  mescalculo + "|sumaTotal=" + sumaTotal + "|tasvtamen=" + tasvtamen + "|valorexp=" + Math.pow(tasvtamen,mescalculo));
    //console.log("|num=" + i + "|mescalculo=" +  mescalculo + "|sumaTotal=" + sumaTotal + "|sumaTotalgs=" + sumaTotalgs);
    crupen = crupen + sumaTotal;
    crugs = crugs + sumaTotalgs || 0
    sumatotflujos = flujos.reduce((acc, x) => acc + x.flujo, 0);
    sumatotmtojosgs = mtogs * flujos.reduce((acc, x) => acc + x.flujogs, 0);
    const filaflujp = {
      mes: i,
      mescal: mescalculo,
      flujossumtot: sumatotflujos,
      flujosgssumtot: sumatotmtojosgs
    }
    DatasumaFlujos.push(filaflujp);
  }
  //logMatriz(DatasumaFlujos, "log_cru_inicial.txt");
  //return ""
  //CALCULA LOS DATOS PARA LOS CASOS DE RENTA DIFERIDA AFP
  let factorAfp = 0;
  let sumprcpen = sumprc / 100; //falta obtener la sumatoria de % d penson del grupo familiar
  let prctitinv = 1;

  if (prestacion == 3) {
    prctitinv = 0.7;
  } else if (prestacion == 4) {
    prctitinv = 0.5;
  } else {
    prctitinv = 1;
  }

  if (mesdif == 0) {
    factorAfp = 0;
  } else {
    //console.log("|afpmen:" + afpmen + "|mesdevengdo:" + mesdevengdo + "|mesdif:" + mesdif + "|prestacion:" + prestacion + "|sumprcpen:" + sumprcpen);
    factorAfp = await valorActual(0, afpmen / 100, 0) + Math.min(mesdevengdo, mesdif) * (prestacion == 5 ? sumprcpen : prctitinv)
  }
  // console.log("factorAfp", factorAfp);
  // console.log("prcfondo", prcfondo);
  // console.log("mtocic", mtocic);
  // console.log("prestacion", prestacion);
  // console.log("mtogs", mtogs);
  // console.log("cruDot", cruDot);
  // console.log("crugs", crugs);
  // console.log("crupen", crupen);
  // console.log("rentmp", rentmp); 
  const penref = (prcfondo * mtocic - (prestacion == 5 ? 0 : mtogs) * crugs - prcfondo * mtocic * cruDot) / (crupen + factorAfp / rentmp);
  const penafp = (mesdif == 0 ? 0 : penref * 2) * (prestacion == 5 ? sumprcpen : prctitinv);
  const pencia = penref * (prestacion == 5 ? sumprcpen : prctitinv);
  const primaafp = (penref * 2) * factorAfp;
  const primacia = prcfondo * mtocic - primaafp;
  //console.log("dataSumflujos",DatasumaFlujos)
  //console.log("penref",penref)
  //console.log("moneda",moneda)
  //return "";
  const resultado = await calcularTciTlr(DatasumaFlujos, penref, moneda, TasasCurvaCero);
  const tasaTci = resultado.valortci;
  const tasaTce = Math.min(tasvta, tasaTci, tasvtapro)
  //console.log("|tasaTce: " + tasaTce + "|tasvta: " + tasvta + "|tasaTci: " + tasaTci + "|tasvtapro: " + tasvtapro);
  //console.log("resultado.pagos",resultado.pagos)
  //console.log("tasaTce",tasaTce)
  //console.log("moneda",moneda)
  //console.log("primacia",primacia)
  //console.log("gastos",gastos)
  const resultadoTir = await calcularTIR(resultado.pagos, tasaTce, moneda, primacia, comision, gastos, tipcam, TasasRentabilidad);
  const tasaTir = resultadoTir.valorTir;
  //console.log("tasaTir",tasaTir)
  //console.log("|primacia: " +  primacia + "|resultadoTir.valorReserva: " +  resultadoTir.valorReserva);
  const perdida = await calcularPerdida(resultadoTir.valorReserva, primacia);
  //console.log('perdida', perdida);
  // SI LA TIR NO SE TOPA 
  let repetir = true;

  //console.log("tasvta_error_tasaanual",tasaanual)
  let nuevatasavta = tasaanual;
  let resultadoCot = {
    idmod: idmod,
    penref: penref,
    penafp: penafp,
    pencia: moneda == 1 ? pencia : moneda == 2 ? pencia : moneda == 3 ? pencia / tipcam : pencia / tipcam,
    primaafp: primaafp,
    primacia: primacia,
    tasavta: tasvta * 100,
    tasaTci: tasaTci * 100,
    tasaTce: tasaTce * 100,
    tasaTir: tasaTir * 100,
    perdida: perdida * 100
  }
  console.log('nuevatasavta', nuevatasavta);
  console.log('tasaTir = ' + tasaTir + '| tasaTir = ' + topeTir);
  if (tasaTir < topeTir) {
    while (repetir) {
      // tu lógica aquí

      resultadoCot = await calcularpension_rec(objDatosMod, objDatoflujos, nuevatasavta, sumprcpen, TasasCurvaCero, TasasRentabilidad);
      //console.log(resultadoCot.procede);
      if (resultadoCot.procede === 'ok') {
        repetir = false;
      } else {
        nuevatasavta = nuevatasavta - 0.00001;
        if (nuevatasavta <= 0) {
          repetir = false;
        }
        //console.log('nuevatasavta', nuevatasavta);
        //console.log('Reintentando...');
      }
    }
  }
  //console.log('resultadoCot_modalidad:' + idmod + "Resultados:" + resultadoCot);
  return resultadoCot;
}

async function calcularpension_rec(objDatosMod, objDatoflujos, tasa, sumprc, TasasCurvaCero, TasasRentabilidad) {

  let crupen = 0;
  let crugs = 0;
  const prcfondo = 1;
  const cruDot = 0;
  const idmod = objDatosMod.id;
  const rentmp = objDatosMod.tmp;
  const mtocic = objDatosMod.cic;
  const mtogs = objDatosMod.gs;
  const mesdif = objDatosMod.pd;
  const moneda = objDatosMod.tm;
  const tipcam = objDatosMod.tipcam;
  const afp = objDatosMod.afp;
  const comision = objDatosMod.com;
  const afpmen = Math.pow((1 + afp), 1 / 12) - 1;
  const mesdevengdo = objDatosMod.mesdev + 1;
  const prestacion = objDatosMod.pre;
  const gastos = objDatosMod.gastos;
  //const tasvta = objDatosMod.tavta;
  const tasvtapro = objDatosMod.taprm;
  const topeTir = objDatosMod.tirtop;
  const topePer = objDatosMod.pertop;
  //console.log("tasvta_error",tasa)
  const tasaanual = tasa; //Math.pow((1 + tasvta), (1 / 12)) - 1
  const tasvtamen = 1 / (1 + tasaanual);
  const tasvta = Math.pow(1 + tasaanual, 12) - 1;

  //console.log("tasvta_error_anual",tasvta)

  //SUMATORIAS CRU
  let sumatotflujos = 0;
  let sumatotmtojosgs = 0;
  let mescalculo = 0;
  const DatasumaFlujos = [];
  for (let i = 0; i <= 1331; i++) {
    mescalculo = i <= mesdevengdo ? 0 : mescalculo + 1;
    const flujos = objDatoflujos.filter(x => x.num === i);
    //const valoresTpx = flujos.map(x => x.tpx);
    //const valoresFlujo = flujos.map(x => x.flujo);
    let sumaTotal = flujos.reduce((acc, x) => acc + x.flujo, 0) * Math.pow(tasvtamen, mescalculo);
    let sumaTotalgs = flujos.reduce((acc, x) => acc + x.flujogs, 0) * Math.pow(tasvtamen, mescalculo);
    //console.log("|num=" + i + "|mescalculo=" +  mescalculo + "|sumaTotal=" + sumaTotal + "|tasvtamen=" + tasvtamen + "|valorexp=" + Math.pow(tasvtamen,mescalculo));
    //console.log("|num=" + i + "|mescalculo=" +  mescalculo + "|sumaTotal=" + sumaTotal + "|sumaTotalgs=" + sumaTotalgs);
    crupen = crupen + sumaTotal;
    crugs = crugs + sumaTotalgs || 0
    sumatotflujos = flujos.reduce((acc, x) => acc + x.flujo, 0);
    sumatotmtojosgs = mtogs * flujos.reduce((acc, x) => acc + x.flujogs, 0);
    const filaflujp = {
      mes: i,
      mescal: mescalculo,
      flujossumtot: sumatotflujos,
      flujosgssumtot: sumatotmtojosgs
    }
    DatasumaFlujos.push(filaflujp);
  }
  //logMatriz(DatasumaFlujos, "log_cru.txt");
  //logMatriz(DatasumaFlujos.map(x=>x.flujossumtot), "log_cru.txt");
  let factorAfp = 0;
  let sumprcpen = sumprc / 100;
  let prctitinv = 1;

  if (prestacion == 3) {
    prctitinv = 0.7;
  } else if (prestacion == 4) {
    prctitinv = 0.5;
  } else {
    prctitinv = 1;
  }

  if (mesdif == 0) {
    factorAfp = 0;
  } else {
    factorAfp = await valorActual(0, afpmen / 100, 0) + Math.min(mesdevengdo, mesdif) * (prestacion == 5 ? sumprcpen : prctitinv)
    //console.log("factorAfp",factorAfp);
  }
  const penref = (prcfondo * mtocic - (prestacion == 5 ? 0 : mtogs) * crugs - prcfondo * mtocic * cruDot) / (crupen + factorAfp / rentmp);
  const penafp = (mesdif == 0 ? 0 : penref * 2) * (prestacion == 5 ? sumprcpen : prctitinv);
  const pencia = penref * (prestacion == 5 ? sumprcpen : prctitinv);
  const primaafp = (penref * 2) * factorAfp;
  const primacia = prcfondo * mtocic - primaafp;
  const resultado = await calcularTciTlr(DatasumaFlujos, penref, moneda, TasasCurvaCero);
  const tasaTci = resultado.valortci;
  const tasaTce = Math.min(tasvta, tasaTci, tasvtapro)
  //console.log("|tasaTce: " + tasaTce + "|tasvta: " + tasvta + "|tasaTci: " + tasaTci + "|tasvtapro: " + tasvtapro);
  //logMatriz(resultado.pagos, "resultadopagosTIR.txt");
  const resultadoTir = await calcularTIR(resultado.pagos, tasaTce, moneda, primacia, comision, gastos, tipcam, TasasRentabilidad);
  const tasaTir = resultadoTir.valorTir;
  const perdida = await calcularPerdida(resultadoTir.valorReserva, primacia);

  /*  console.log("crupen", crupen);
   console.log("crugs", crugs);
   console.log("tasaTir", tasaTir);
   console.log("topeTir", topeTir); */
  let tasaSatisf = "ok";
  if (tasaTir < topeTir) {
    //console.log("sigue iterando... por tope de TIR");
    tasaSatisf = "ko";
  }

  if (perdida > topePer) {
    //console.log("sigue iterando...por tope de perdida");
    tasaSatisf = "ko";
  }

  return {
    procede: tasaSatisf,
    idmod: idmod,
    penref: penref,
    penafp: penafp,
    pencia: moneda == 1 ? pencia : moneda == 2 ? pencia : moneda == 3 ? pencia / tipcam : pencia / tipcam,
    primaafp: primaafp,
    primacia: primacia,
    tasavta: (Math.pow(1 + tasaanual, 12) - 1) * 100,
    tasaTci: tasaTci * 100,
    tasaTce: tasaTce * 100,
    tasaTir: tasaTir * 100,
    perdida: perdida * 100
  };
}

async function calcularTciTlr(dataSumflujos, pension, moneda, TasasCurvaCero) {
  //const TasasCurvaCero = await tablasTasasInd.getTasaCurvaCuponCero();
  //console.log("TasasCurvaCero", TasasCurvaCero);
  const curvamoneda = TasasCurvaCero.filter(x => x.idmoneda === Number(moneda));
  //console.log("curvamoneda", curvamoneda.find(x => x.mes === 0)?.n_valor);
  const DataFlujospen = [];
  let Valflujo = 0;
  let Valflujodev = 0;
  let totalpasivo = 0;
  let pasivo = 0;

  //console.log("pension",pension);
  //console.log("moneda",moneda);
  //SACA LOS FLUJOS DE PENSIONES
  for (const data of dataSumflujos) {
    data.valfulpen = (data.flujossumtot * pension) + data.flujosgssumtot;
  }
  //logMatriz(dataSumflujos, "dataSumflujos.txt");
  //logMatriz(dataSumflujos.map(x=>x.flujossumtot), "log_flujopensionesinicial.txt");
  //ARMA EL CUADRO DE FLUJOS PARA LA TCE
  for (let i = 0; i <= 1332; i++) {
    let valcurvames = curvamoneda.find(x => x.mes === i)?.n_valor;

    if (i == 0) {
      Valflujodev = dataSumflujos.filter(item => item.mescal === 0).reduce((total, item) => total + item.valfulpen, 0);
      Valflujo = dataSumflujos.filter(item => item.mescal === 0).reduce((total, item) => total + item.valfulpen, 0);
    } else {
      Valflujo = dataSumflujos.find(item => item.mescal === i)?.valfulpen || 0;
    }
    pasivo = Valflujo / Math.pow(1 + (valcurvames / 100), i / 12);
    totalpasivo = totalpasivo + pasivo;

    const filaTce = {
      mest: i,
      valflu: Valflujo,
      valfluTLR: Valflujo,
      valcurva: valcurvames,
      valpasivo: pasivo
    }
    DataFlujospen.push(filaTce);
  }

  //logMatriz(DataFlujospen.map(x=>x.valflu), "log_sumpentci.txt");

  const itemcero = DataFlujospen.find(x => x.mest === 0);
  itemcero.valfluTLR = Valflujodev - totalpasivo; // nuevo valor del mes 0 para sacar la tce
  //console.log("Valflujodev", Valflujodev);
  //console.log("totalpasivo", totalpasivo);
  //logMatriz(DataFlujospen, "log_sumpentci.txt");
  const flujosTLR = DataFlujospen.map(obj => obj.valfluTLR);
  //logMatriz(flujosTLR, "log_sumpentci.txt");
  const valorTci = Math.pow((1 + await calculaIRR(flujosTLR)), 12) - 1;
  const valorTciMes = (Math.pow(1 + await calculaIRR(flujosTLR), 12) - 1) * 100
  //console.log("valorTci", valorTci);
  //console.log("valorTciMes", valorTciMes);
  //console.log("DataFlujospen", DataFlujospen);
  return {
    valortci: valorTci,
    valortcimen: valorTciMes,
    pagos: DataFlujospen
  };
  //console.log("totalpasivo", totalpasivo);

  //logMatriz(DataFlujospen, "log_sumpenflu.txt");
  //console.log("DataFlujospen", DataFlujospen);
}

async function calcularTIR(Datapagos, tce, moneda, primacia, comision, gastos, tc, TasasRentabilidad) {
  //const TasasRentabilidad = await tablasTasasInd.getTasaInversiones();
  const rentabilidadmoneda = TasasRentabilidad.filter(x => x.idmoneda === Number(moneda));
  const aInicial = parseFloat(rentabilidadmoneda[0]?.annio ?? 0);
  const aFinal = parseFloat(rentabilidadmoneda[1]?.annio ?? 0);
  const vInicial = parseFloat(rentabilidadmoneda[0]?.n_valor ?? 0);
  const vFinal = parseFloat(rentabilidadmoneda[1]?.n_valor ?? 0);

  const gastoemi = moneda == 3 || moneda == 4 ? gastos.Gastosemi / tc : gastos.Gastosemi;
  const gastoman = moneda == 3 || moneda == 4 ? gastos.Gastosmant / tc : gastos.Gastosmant;
  const impuesto = gastos.Impuestos;
  //console.log("tce", tce);
  let tasatce = tce; //0.0478693558990629; //Math.pow((1 + tce), (1 / 12)) - 1
  let tasaTir = 0;
  let q = 0;
  let reserva = 0;
  let margensol = 6.75 / 100;
  let reservacero = 0;
  let comisiones = (comision + (1.71 / 100)) * 1.47;
  let capital = 0;
  let tasainv = 0;
  let reservaant = 0;
  let capitalant = 0;
  let gastomante = 0;
  let pagost = 0;
  let varreser = 0;
  let prodinver = 0;
  let utilimp = 0;
  let impuestos = 0;
  let flujoacc = 0;
  //logMatriz(Datapagos, "log_Datapagos.txt");
  for (const data of Datapagos) {
    let mest = data.mest;
    let pagos = data.valflu;
    /* if(mest<200){
      console.log("|mest : " + mest + "|anioentero : " + Math.ceil(parseFloat(mest/12)) + "|aniodecimal : " + parseFloat(mest/12));
    } */
    if (Math.ceil(parseFloat(mest / 12)) < aFinal) {
      tasainv = vInicial;
    } else {
      tasainv = vFinal;
    }
    data.tasainvanual = tasainv / 100;
    if (q == 0) {
      //logMatriz(Datapagos.filter(f => f.mest >= q + 1).map(f => f.valflu), "log_sumResrva0.txt");
      reserva = await reservas(pagos, Datapagos, q + 1, tasatce);
      //console.log("tasatce", tasatce);
      //return "acaba";
      reservacero = reserva;
      comisiones = primacia * comisiones;
      /*   console.log("reserva", reserva);
        console.log("pagos", pagos);
        console.log("comisiones", comisiones);
        console.log("gastoemi", gastoemi);
        console.log("reservacero", reservacero); */
      //console.log("reservacero", reservacero);
    }
    else {
      reserva = await reservas(pagos, Datapagos, q + 1, tasatce);
    }
    data.reserva = reserva;
    reservaant = Datapagos.find(x => x.mest === mest - 1)?.reserva;
    capital = reserva * margensol;
    data.capital = capital;
    capitalant = Datapagos.find(x => x.mest === mest - 1)?.capital;
    gastomante = (gastoman / 12) * (reserva / reservacero);
    data.gasmant = gastomante;
    pagost = q == 0 ? 0 : Datapagos.find(x => x.mest === mest - 1)?.valflu;
    data.pagos = pagost;
    varreser = q == 0 ? reservacero : reserva - reservaant;
    data.varires = varreser;
    prodinver = q == 0 ? 0 : (Math.pow((1 + tasainv / 100), 0.083333333333333) - 1) * (reservaant + capitalant);
    data.prodinver = prodinver;
    utilimp = q == 0 ? primacia - (comisiones + gastoemi + gastomante + pagost + varreser) + prodinver : 0 - (gastomante + pagost + varreser) + prodinver;
    data.utilimp = utilimp;
    impuestos = 0; //(utilimp - prodinver) > 0 ? (utilimp - prodinver) * impuesto : 0;
    data.impuestos = impuestos;
    varcapit = q == 0 ? capital : capital - capitalant;
    data.varcapit = varcapit;
    flujoacc = utilimp - impuestos - varcapit;
    data.flujoacc = flujoacc;
    q++;
  }
  //logMatriz(Datapagos, "log_sumpenflu.txt");
  const flujosacc = Datapagos.map(obj => obj.flujoacc);
  tasaTir = Math.pow((1 + await calculaIRR(flujosacc)), 12) - 1;


  //console.log("Datapagos",Datapagos);
  return {
    valorTir: tasaTir,
    valorReserva: reservacero
  };
}

async function reservas(pago, Datapagos, mes, tce) {
  const flujosDesde3 = Datapagos.filter(f => f.mest >= mes).map(f => f.valflu);
  //logMatriz(Datapagos.filter(f => f.mest >= mes).map(f => f.valflu), "log_sumResrva0.txt");

  const tasatcemen = Math.pow((1 + tce), (1 / 12)) - 1;
  const reserva = pago + await calcularVNA(tasatcemen, flujosDesde3);
  return reserva;
}

async function calcularPerdida(reserva, primacia) {
  let valorperdida = (reserva / primacia) - 1;
  //console.log(valorperdida);
  if (Math.round(valorperdida, 5) <= 0) {
    valorperdida = 0;
  }
  return valorperdida;
}

function valorActual(futuro, tasa, periodos) {
  return futuro / Math.pow(1 + tasa, periodos);
}

async function calculaIRR(cashFlows, guess = 0.0025) {
  const maxIterations = 1000;
  const precision = 1e-7;
  let rate = guess;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;
    let safe = true;
    //console.log("iteracion:", i);
    for (let t = 0; t < cashFlows.length; t++) {
      //console.log("rate:", rate);
      const denom = Math.pow(1 + rate, t);
      if (!isFinite(denom) || denom === 0) {
        safe = false;
        break;
      }

      npv += cashFlows[t] / denom;
      derivative -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
      //console.log("rate:" + rate + "|t:" + t + "|denom:" + denom + "|npv:" + npv + "|derivative:" + derivative);
    }

    if (!safe || derivative === 0) return 0;

    const newRate = rate - npv / derivative;
    if (!isFinite(newRate)) return 0;

    if (Math.abs(newRate - rate) < precision) return newRate;

    rate = Math.max(Math.min(newRate, 1), -0.999); //newRate;
  }

  return 0; // No converge
}

async function calcularVNA(tasa, flujos) {
  let vna = 0;
  for (let i = 0; i < flujos.length; i++) {
    vna += flujos[i] / Math.pow(1 + tasa, i + 1); // Descuento desde el año 1
  }
  return vna;
}

// #endregion