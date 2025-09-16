const TablaCot = require('../../models/cotizacionesModel');
const { XMLParser } = require('fast-xml-parser');
const path = require('path');
const libxml = require('libxmljs');
const fs = require('fs');

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
    const xmlPath = req.body.xmlMinificado; // XML en string (textarea o fileReader)
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
            pd: anosRT,
            pg: periodoGarantizado,
            porRVD: porcentajeRVD,
            grati: gratificacion,
            dercre: derechoCrecer,
            tipo: "AFP",
            codigo: afp.codigoAFP || "",
            atiende: afp.atiende || "",
            gana: afp.siGanaNoGana || "",
            cotiza: afp.siCotizaNoCotiza || "",
            nroCotizacion: afp.nroCotizacion || "",
            tasaAFP: afp.tasaRPyRT || "0",
            pensionAFP: afp.primeraPension || "0",
            tasaAseg: "0",
            pensionAseg: "0"
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
            pd: anosRT,
            pg: periodoGarantizado,
            porRVD: porcentajeRVD,
            grati: gratificacion,
            dercre: derechoCrecer,
            tipo: "EESS",
            codigo: e.codigoEESS || "",
            atiende: e.atiende || "",
            gana: e.siGanaNoGana || "",
            cotiza: e.siCotizaNoCotiza || "",
            nroCotizacion: e.nroCotizacion || "",
            tasaAFP: e.tasaInteresRT || "0",
            pensionAFP: e.primeraPensionRT || "0",
            tasaAseg: e.tasaInteresRV || e.tasaInteresRVD || "0",
            pensionAseg: e.primeraPensionRV || e.primeraPensionRVD || "0"
          });
        });
      });
    });
    console.log("resultados", resultados);
    // Renderizar tabla en la vista
    res.json({ resultados });
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

