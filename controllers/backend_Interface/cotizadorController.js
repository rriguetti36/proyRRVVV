const TablaCot = require('../../models/cotizacionesModel');
const { XMLParser } = require('fast-xml-parser');
const path = require('path');
const libxml = require('libxmljs');
const fs = require('fs');
const { normalizeXmlToUtf8 } = require('../../servicios/normalizaXML');
const codApeseg = process.env.CODIGOCIA;

exports.CargaXML = async (req, res) => {
  res.render("cotizacion/carga", { layout: 'layouts/layoutCT' });
};

exports.DescargaXML = async (req, res) => {
  res.render("cotizacion/descarga", { layout: 'layouts/layoutCT' });
};

exports.ResultadosXML = async (req, res) => {
  const resultados = [];
  res.render("cotizacion/respuesta", { layout: 'layouts/layoutCT', resultados });
};

exports.CargaResultados = async (req, res) => {
  try {

    const xmlContent = normalizeXmlToUtf8(req.body.xmlMinificado, false);
    const xmlPath = xmlContent; // XML en string (textarea o fileReader)
    const xsdPath = fs.readFileSync("./resource/xsd/descargaResultados22.xsd", "utf-8");

    // Parse XML y XSD
    const xmlDoc = libxml.parseXml(xmlPath);
    const xsdDoc = libxml.parseXml(xsdPath);

    // Validación XSD
    if (!xmlDoc.validate(xsdDoc)) {
      console.error(xmlDoc.validationErrors);
      return res.status(400).send("❌ El XML no cumple con el XSD");
    }

    // Convertir XML → JSON
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xmlPath);

    let resultadoSols = parsed?.descargaResultados?.resultadoSol || [];

    let resultados = [];

    if (!Array.isArray(resultadoSols)) {
      resultadoSols = [resultadoSols];
    }
    resultadoSols.forEach((sol) => {
      const nroOperacion = sol?.nroOperacion || "";
      const CUSPP = sol?.CUSPP || "";
      const decisionAfiliado = sol?.decisionAfiliado || "";

      // Un resultadoSol puede tener 1 o muchos resulProducto
      const productos = Array.isArray(sol.resulProducto)
        ? sol.resulProducto
        : sol.resulProducto
          ? [sol.resulProducto]
          : [];

      productos.forEach((prod) => {
        const modalidad = prod?.modalidad || "";
        const moneda = prod?.moneda || "";
        const anosRT = prod?.anosRT || "0";
        const porcentajeRVD = prod?.porcentajeRVD || "0";
        const periodoGarantizado = prod?.periodoGarantizado || "0";
        const derechoCrecer = prod?.derechoCrecer || "0";
        const gratificacion = prod?.gratificacion || "0";

        // resultadoAFP
        const afps = Array.isArray(prod.resultadoAFP)
          ? prod.resultadoAFP
          : prod.resultadoAFP
            ? [prod.resultadoAFP]
            : [];

        afps.forEach((afp) => {
          resultados.push({
            nroOperacion,
            CUSPP,
            decisionAfiliado,
            modalidad,
            moneda,
            pd: parseFloat(anosRT),
            pg: parseFloat(periodoGarantizado),
            porRVD: parseFloat(porcentajeRVD),
            grati: gratificacion,
            dercre: derechoCrecer,
            tipo: "AFP",
            codigo: afp.codigoAFP || "",
            atiende: afp.atiende || "",
            gana: afp.siGanaNoGana || "",
            cotiza: afp.siCotizaNoCotiza || "",
            nroCotizacion: afp.nroCotizacion || "",
            tasaAFP: parseFloat(afp.tasaRPyRT) || 0,
            pensionAFP: parseFloat(afp.primeraPension) || 0,
            tasaAseg: 0,
            pensionAseg: 0
          });
        });

        // resultadoEESS
        const eess = Array.isArray(prod.resultadoEESS)
          ? prod.resultadoEESS
          : prod.resultadoEESS
            ? [prod.resultadoEESS]
            : [];

        eess.forEach((e) => {
          resultados.push({
            nroOperacion,
            CUSPP,
            decisionAfiliado,
            modalidad,
            moneda,
            pd: parseFloat(anosRT),
            pg: parseFloat(periodoGarantizado),
            porRVD: parseFloat(porcentajeRVD),
            grati: gratificacion,
            dercre: derechoCrecer,
            tipo: "EESS",
            codigo: e.codigoEESS || "",
            atiende: e.atiende || "",
            gana: e.siGanaNoGana || "",
            cotiza: e.siCotizaNoCotiza || "",
            nroCotizacion: e.nroCotizacion || "",
            tasaAFP: parseFloat(e.tasaInteresRT) || 0,
            pensionAFP: parseFloat(e.primeraPensionRT) || 0,
            tasaAseg: parseFloat(e.tasaInteresRV) || parseFloat(e.tasaInteresRVD) || 0,
            pensionAseg: parseFloat(e.primeraPensionRV) || parseFloat(e.primeraPensionRVD) || 0
          });
        });
      });
    });
    //console.log("resultados", resultados);

    const idArchivo = await insertSolicitudesResp(resultados, "desResultados_2024_04_23_09_47_59_am.xml");
    // Renderizar tabla en la vista
    res.json({
      id: idArchivo,
      resultados: resultados
    });
    //res.render("cotizacion/respuesta", { resultados });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error procesando el XML");
  }
};

exports.getSolicitudes = async (req, res) => {
  try {
    const solicitudesMeler = await TablaCot.getTablaSolicitudesMELER(); // 👈 OJO con los ()
    //console.log(solicitudesMeler); // ahora verás el array de objetos

    res.json({ data: solicitudesMeler }); // DataTables lo consume
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRespuestas = async (req, res) => {
  try {
    const { idArchivo, tipo } = req.body;

    let respuestasMeler = await TablaCot.getTablaSolicitudRespuesta(idArchivo); // 👈 OJO con los ()


    if (tipo == 2) {
      respuestasMeler = respuestasMeler.filter(r => r.gana === 'S' && r.codigo != codApeseg);
    }

    if (tipo == 3) {
      respuestasMeler = respuestasMeler.filter(r => r.gana === 'S' && r.codigo === codApeseg);
    }

    respuestasMeler = respuestasMeler.map(r => ({
      ...r,
      porRVD: r.porRVD !== null ? Number(parseFloat(r.porRVD).toFixed(2)) : null,
      tasaAFP: r.tasaAFP !== null ? Number(parseFloat(r.tasaAFP).toFixed(2)) : null,
      pensionAFP: r.pensionAFP !== null ? Number(parseFloat(r.pensionAFP).toFixed(2)) : null,
      tasaAseg: r.tasaAseg !== null ? Number(parseFloat(r.tasaAseg).toFixed(2)) : null,
      pensionAseg: r.pensionAseg !== null ? Number(parseFloat(r.pensionAseg).toFixed(2)) : null
    }));
    
    console.log("respuestasMeler", respuestasMeler)
    res.json({ resultados: respuestasMeler }); // DataTables lo consume
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};


async function insertSolicitudesResp(resultados, nombrearch) {
  try {

    const tipoArchivo = 2;
    const nombreArchivo = nombrearch;
    const fechaCarga = new Date().toISOString().split('T')[0];
    const idusuario = 1;
    const estado = 1;
    const resultado = {
      tipoArchivo,
      nombreArchivo,
      fechaCarga,
      idusuario,
      estado,
      respuestas: [...resultados] // 👈 aquí lo convertimos en array
    }

    const idarchivo = await TablaCot.insertaSolicitudesRespuesta(resultado) || 0;

    return idarchivo;
  } catch (error) {
    console.error(error);
    res.status(500).send("Error procesando el XML");
  }
};
