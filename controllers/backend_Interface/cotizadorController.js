const TablaCot = require('../../models/cotizacionesModel');
const TablaPar = require('../../models/tabTasasModel');
const tablasTasasInd = require('../../models/tabTasasModel');
const { XMLParser } = require('fast-xml-parser');
const path = require('path');
const libxml = require('libxmljs');
const fs = require('fs');
const { normalizeXmlToUtf8 } = require('../../servicios/normalizaXML');
const EstudioModel = require('../../models/estudioModel');
const codApeseg = process.env.CODIGOCIA;
const pdf = require("html-pdf-node");
const ejs = require("ejs");
const XLSX = require('xlsx');

exports.cargarModulo = async (req, res) => {
  try {
    let fechas;
    let registros
    const nombre = req.params.nombre.toLowerCase();
    console.log("nombre", nombre);
    // Mapeo del nombre de la pestaña con su vista parcial
    const modulos = {
      "limite tasas estudio": "tasas/limitesE",
      "limite tasas oficial": "tasas/limitesI",
      "limite tasas mejoras": "tasas/limitesM",
      "tasas rentabilidad": "tasas/rentabilidad",
      "tasas venta promedio": "tasas/promedio",
      "curva de tasas": "tasas/curvatasas",
      "parametros de gastos": "valores/gastos",
      "ipc mensual": "valores/ipc",
      "tipo cambio": "valores/tipocambio",
      "tipo cambio mensual": "valores/tipocambiom",
      "gastos de sepelio": "valores/sepelio",
      // agrega más si hay otros
    };

    const vista = modulos[nombre];
    if (!vista) return res.status(404).send("Módulo no encontrado");

    const paramtetros = await TablaPar.getParametros();
    const tipoMon = paramtetros.filter(x => x.idpar === 10);
    const tipoMonOri = paramtetros.filter(x => x.idpar === 11).sort((a, b) => b.v_cod - a.v_cod);
    const tipSBS = paramtetros.filter(x => x.idpar === 22);
    const tipoPen = paramtetros.filter(x => x.idpar === 33);
    const regiones = await TablaPar.getRegiones();

    const tasas = await TablaPar.listarTasas();
    const filtros = await TablaPar.listarFiltros();
    const periodos = await TablaPar.listaPeriodosVtaProm();

    switch (vista) {
      case "tasas/limitesE":
        fechas = await TablaPar.listarFechas("c_tasastopecalc");
        break;
      case "tasas/limitesI":
        fechas = await TablaPar.listarFechas("c_tasastopecalc");
        break;
      case "tasas/limitesM":
        fechas = await TablaPar.listarFechas("c_tasastopecalc");
        break;
      case "tasas/rentabilidad":
        fechas = await TablaPar.listarFechas("c_tablatasainversiones");
        break;
      case "tasas/promedio":
        fechas = await TablaPar.listarFechas("c_tablatasainversiones");
        break;
      case "valores/gastos":
        registros = await TablaPar.getMValoresOtros();
        fechas = await TablaPar.listarFechas("m_tablagasto");
        break;
      case "valores/ipc":
        fechas = await TablaPar.listarPeriodosIPC();
        break;
      case "valores/tipocambio":
        fechas = await TablaPar.listarPeriodosTC();
        break;
      case "valores/tipocambiom":
        fechas = await TablaPar.listarPeriodosTCM();
        break;
      case "valores/sepelio":
        fechas = await TablaPar.listarPeriodosGS();
        break;
    }
    //console.log(registros);
    //console.log(fechas);
    //console.log(tasas)

    res.render(`cotizacion/${vista}`, {
      layout: false,
      tipoMon,
      tipoPen,
      regiones,
      fechas,
      tasas,
      filtros,
      periodos,
      selectedDate: null,
      registros,
      tipoMonOri,
      tipSBS
    }); // sin layout
  } catch (err) {
    console.error("Error cargando módulo:", err);
    res.status(500).send("Error al cargar el módulo");
  }
};

//#region cotizador Estudio
exports.EstudioCot = async (req, res) => {

  const paramtetros = await TablaPar.getParametros();
  const parGastosSepelio = await TablaPar.getGastosSepelio();
  const parGastosAdm = await TablaPar.getGastosAdm();
  const hoy = new Date();
  let fechacalculo = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const tipoAfp = paramtetros.filter(x => x.idpar === 1);
  const tipoMod = paramtetros.filter(x => x.idpar === 2);
  const tiposex = paramtetros.filter(x => x.idpar === 7);
  const tipoInv = paramtetros.filter(x => x.idpar === 8);
  const tipoMon = paramtetros.filter(x => x.idpar === 10);
  const tipoRen = paramtetros.filter(x => x.idpar === 13);
  const tipodoc = paramtetros.filter(x => x.idpar === 15);
  const tipoPen = paramtetros.filter(x => x.idpar === 33);
  const tipoPar = paramtetros.filter(x => x.idpar === 34);
  const gasSep = await ObtieneGastosSep(parGastosSepelio, formatDate(fechacalculo));
  const gasEmi = parGastosAdm.n_gastoemi || 0;
  const gasMan = parGastosAdm.n_gastomant || 0;
  const gasImp = parGastosAdm.n_impuesto || 0;
  const tipCam = 3.722;
  const Gastos = { "Gastosmant": gasMan, "Gastosemi": gasEmi, "Porcentajedeuda": 0.0, "Impuestos": gasImp };

  res.render("cotizacion/estudio", { layout: 'layouts/layoutCT', tipoAfp, tipoMod, tipoPar, tiposex, tipoInv, tipoMon, tipoPen, tipoRen, tipodoc, gasSep, tipCam, Gastos });
};

exports.guardar = async (req, res) => {
  try {
    const usu = req.session.user.id;
    const result = await EstudioModel.guardarEstudio(req.body, usu);
    res.json(result);
  } catch (error) {
    console.error("❌ Error en guardarEstudio:", error);

    // Si el error viene del driver SQL, puede tener detalles útiles:
    const mensaje = error.message || "Error interno en el servidor";
    const detalle = error.originalError ? error.originalError.message : null;

    res.status(500).json({
      ok: false,
      message: "Error al guardar el estudio",
      error: mensaje,
      detalle
    });
  }

};

exports.listar = async (req, res) => {
  const paramtetros = await TablaPar.getParametros();
  const tipodoc = paramtetros.filter(x => x.idpar === 15);
  try {
    const filtros = {
      tipoDoc: req.query.tipoDoc || null,
      numDoc: req.query.numDoc || null,
      nombre: req.query.nombre || null,
      apepat: req.query.apepat || null,
      apemat: req.query.apemat || null
    };

    const estudios = await EstudioModel.listarEstudios(filtros);

    res.render('cotizacion/estudiolistar', {
      title: 'Listado de Cotizaciones',
      estudios,
      filtros,
      tipodoc
    });
  } catch (err) {
    console.error('Error en controlador listar:', err);
    res.status(500).send('Error al listar estudios');
  }
};

exports.eliminar = async (req, res) => {
  const { id } = req.params;
  const result = await EstudioModel.eliminarEstudio(id);
  res.json(result);
};

exports.generarPDF = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔹 Trae toda la información del estudio
    const estudio = await EstudioModel.obtenerEstudioCompleto(id);
    if (!estudio) return res.status(404).send("Estudio no encontrado");

    // 🔹 Renderiza HTML desde un template EJS
    const html = await ejs.renderFile(
      path.join(__dirname, "../../pdf/templates/cotizacionTemplate.ejs"),
      { estudio }
    );

    // 🔹 Genera el PDF con html-pdf-node (alternativa simple a puppeteer)
    const file = { content: html };
    const pdfBuffer = await pdf.generatePdf(file, {
      format: "A4",
      margin: { top: "20mm", bottom: "20mm" }
    });

    // 🔹 Opción 1: mostrar en navegador
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=cotizacion_${id}.pdf`);
    res.send(pdfBuffer);

    // 🔹 Opción 2 (si prefieres guardar en carpeta):
    // const outputPath = path.join(__dirname, "../pdf/generated", `cotizacion_${id}.pdf`);
    // fs.writeFileSync(outputPath, pdfBuffer);

  } catch (err) {
    console.error("Error al generar PDF:", err);
    res.status(500).send("Error al generar el PDF");
  }
};
//#endregion

//#region Mantenedor Parametros
exports.Paramtetros = async (req, res) => {
  const cabeceras = await TablaCot.getCabecerasParam();
  res.render('cotizacion/parametros', { cabeceras });
}

exports.Cabecera = async (req, res) => {
  const cabeceras = await TablaCot.getCabecerasParam();
  res.json(cabeceras);
}

exports.addCabecera = async (req, res) => {
  const { nombre } = req.body;
  await TablaCot.insertCabeceraParam(nombre);
  const cabeceras = await TablaCot.getCabecerasParam();
  res.json({ ok: true, cabeceras });
}

exports.getDetalles = async (req, res) => {
  const { idpar } = req.params;
  const detalles = await TablaCot.getDetallesParam(idpar);
  res.json(detalles);
}

exports.addDetalle = async (req, res) => {
  await TablaCot.insertDetalleParam(req.body);
  res.json({ ok: true, mensaje: "Detalle agregado correctamente" });
}

exports.updateDetalle = async (req, res) => {
  await TablaCot.updateDetalleParam(req.body);
  res.json({ ok: true, mensaje: "Detalle actualizado correctamente" });
}

exports.deleteDetalle = async (req, res) => {
  const { id } = req.params;
  await TablaCot.deleteDetalleParam(id);
  res.json({ ok: true, mensaje: "Detalle eliminado" });
}
//#endregion

//#region Mantenedor Tasas
exports.listarTasas = async (req, res) => {
  try {
    const tasas = await TablaPar.getMtasas();
    res.render("cotizacion/tasas", { tasas });
  } catch (error) {
    console.error("Error en listarTasas:", error);
    res.status(500).send("Error al obtener tasas");
  }
};

exports.LimiteIni = async (req, res) => {
  try {
    const fechas = await TablaPar.listarFechas();
    const tasas = await TablaPar.listarTasas();
    const filtros = await TablaPar.listarFiltros();
    res.render('cotizacion/tasas/limites', { fechas, tasas, filtros, selectedDate: null });
  } catch (err) {
    console.error('Error en index tasas:', err);
    res.status(500).send('Error al cargar tasas');
  }
};

exports.uploadExcel = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Debe subir un archivo Excel' });

    const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    const registros = [];

    for (const row of data) {
      // Suponiendo columnas: Region, Moneda, Prestacion, TasaIni, TIRIni, PERIni
      const idmrg = await TablaPar.obtenerIdRegion(row.region);
      const idmoneda = await TablaPar.obtenerIdParametro(row.moneda, 10);
      const idprestacion = await TablaPar.obtenerIdParametro(row.prestacion, 33);

      // console.log("Region",row.region)
      // console.log("Moneda",row.moneda)
      // console.log("Prestacion",row.prestacion)
      // console.log("idmrg",idmrg)
      // console.log("idmoneda",idmoneda)
      // console.log("idprestacion",idprestacion)
      if (!idmrg || !idmoneda || !idprestacion) {
        console.warn(`Fila omitida: ${JSON.stringify(row)}`);
        continue;
      }

      registros.push({
        idmrg,
        idmoneda,
        idprestacion,
        n_valtasini: row.n_valtasini || 0,
        n_valtirini: row.n_valtirini || 0,
        n_valperini: row.n_valperini || 0
      });
    }

    await TablaPar.insertarDesdeExcel(registros);
    fs.unlinkSync(filePath);

    // Obtener la última fecha activa
    const ultimaFecha = await TablaPar.ultimafecha(); // devuelve un DATE
    let fechaFormateada = null;

    if (ultimaFecha && ultimaFecha.length > 0) {
      // Si es un objeto Date válido
      console.log("ultimaFecha", ultimaFecha)
      const fecha = ultimaFecha[0].ultimaFecha;
      if (fecha instanceof Date && !isNaN(fecha)) {
        fechaFormateada = fecha.toISOString().split('T')[0];
      } else if (typeof fecha === 'string') {
        const d = new Date(fecha);
        if (!isNaN(d)) fechaFormateada = d.toISOString().split('T')[0];
      }
    }
    // const fechaFormateada = ultimaFecha
    //   ? new Date(ultimaFecha).toISOString().split('T')[0]  // "YYYY-MM-DD"
    //   : null;
    console.log(fechaFormateada);
    res.json({ ok: true, mensaje: `Se cargaron ${registros.length} registros correctamente.`, ultimaFecha: fechaFormateada });
  } catch (err) {
    console.error('Error al procesar Excel:', err);
    res.status(500).json({ error: 'Error al procesar archivo Excel' });
  }
};

exports.listarPorFecha = async (req, res) => {
  try {
    const { f_creacion } = req.params;
    const tasas = await TablaPar.listar(f_creacion);
    res.json(tasas);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar tasas por fecha' });
  }
}

exports.filtrar = async (req, res) => {
  try {
    const { region, moneda, prestacion, fecha } = req.query;
    const tasas = await TablaPar.obtenerTasas({ region, moneda, prestacion, fecha });
    res.json({ success: true, data: tasas });
  } catch (error) {
    console.error('Error al filtrar tasas:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

exports.actualizar = async (req, res) => {
  try {
    const { tipo } = req.body; // recibir tipo desde el frontend
    const result = await TablaPar.actualizarValores({ ...req.body, tipo });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar tasa' });
  }
};

exports.regiones = async (req, res) => {
  try {
    const regiones = await TablaPar.getRegiones();
    res.json(regiones);
  } catch (err) {
    console.error("❌ Error obteniendo monedas:", err);
    res.status(500).json({ error: "Error interno al obtener monedas" });
  }
}

exports.monedas = async (req, res) => {
  try {
    const paramtetros = await TablaPar.getParametros();
    const tipoMon = paramtetros.filter(x => x.idpar === 10);
    res.json(tipoMon);
  } catch (err) {
    console.error("❌ Error obteniendo monedas:", err);
    res.status(500).json({ error: "Error interno al obtener monedas" });
  }
}

exports.prestaciones = async (req, res) => {
  try {
    const paramtetros = await TablaPar.getParametros();
    const tipoPen = paramtetros.filter(x => x.idpar === 33);
    res.json(tipoPen);
  } catch (err) {
    console.error("❌ Error obteniendo monedas:", err);
    res.status(500).json({ error: "Error interno al obtener monedas" });
  }
}

//Rentabilidad
exports.rentabilidad = async (req, res) => {
  // renderiza EJS con años y monedas (trae monedas desde tu modelo de parametros)
  // const monedas = await /* tu consulta de monedas, por ejemplo */ require('../models/TablaPar').getMonedas();
  const paramtetros = await TablaPar.getParametros();
  const monedas = paramtetros.filter(x => x.idpar === 10);
  const años = [new Date().getFullYear(), new Date().getFullYear() + 1]; // ejemplo
  res.render('cotizacion/tasas/rentabilidad', { monedas, años });
};

exports.filtrarRentabiliad = async (req, res) => {
  try {
    const { fecha, idmoneda } = req.query;
    const result = await TablaPar.obtenerPorFechaYMoneda(fecha, idmoneda);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
};

exports.guardarentabilidad = async (req, res) => {
  try {
    const { registros } = req.body;
    await TablaPar.guardarRegistros(registros);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

//ventas promedio
exports.obtenervalorvtapromedio = async (req, res) => {
  try {
    const { v_periodo, id_moneda, id_prestacion } = req.query;

    const valor = await TablaPar.obtenerValorVtaProm({
      v_periodo,
      id_moneda,
      id_prestacion
    });

    res.json(valor || {});
  } catch (error) {
    console.error('Error al obtener valor:', error);
    res.status(500).json({ error: 'Error al obtener valor' });
  }
};

exports.guardarvtapromedio = async (req, res) => {
  try {
    const { v_periodo, id_moneda, id_prestacion, n_valor } = req.body;

    await TablaPar.guardarRegistrosVtaProm({
      v_periodo,
      id_moneda,
      id_prestacion,
      n_valor
    });
    return res.json({ success: true, message: 'Valor registrado correctamente.' });

  } catch (error) {
    console.error('Error al guardar venta promedio:', error);
    res.status(500).json({ error: 'Error al guardar valor' });
  }
};

//curva tasas
exports.listPeriodosCurva = async (req, res) => {
  try {
    const rows = await TablaPar.getListaPeriodoCurva();
    // normalizar a yyyy-mm-dd
    const periodos = rows.map(r => {
      const d = new Date(r.periodo);
      return { periodo: d.toISOString().slice(0, 10) };
    });
    res.json(periodos);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
};

exports.filtrarByFechaCurva = async (req, res) => {
  try {
    const fecha = req.query.fecha;
    if (!fecha) return res.status(400).json([]);
    const rows = await TablaPar.getPivotByFechaCurva(fecha);
    res.json(rows);
  } catch (err) {
    console.error('Error filtrarByFecha', err);
    res.status(500).json([]);
  }
};

exports.uploadExcelCurva = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se subió ningún archivo" });
    }
    const filePath = path.join(process.cwd(), 'uploads', req.file.filename);
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log("data", data[0]?.[2])
    // 🔹 Leer la fecha de vigencia en la celda C1
    const fechaVigenciaRaw = data[0]?.[2];
    let fechaVigenciaE;
    console.log("fechaVigenciaRaw", fechaVigenciaRaw)
    if (typeof fechaVigenciaRaw === 'number') {
      fechaVigenciaE = excelDateToJSDate(fechaVigenciaRaw);
    } else if (typeof fechaVigenciaRaw === 'string') {
      fechaVigenciaE = new Date(fechaVigenciaRaw);
    }
    console.log("fechaVigenciaE", fechaVigenciaE)
    if (!fechaVigenciaE) {
      throw new Error("No se encontró la fecha de vigencia (celda C1)");
    }

    const fechaFormateada = fechaVigenciaE.toISOString().split('T')[0];
    console.log('Fecha vigencia formateada:', fechaFormateada);

    // Convertir fecha Excel: "1/10/2025"
    const partes = fechaFormateada.split("/");
    const fechaVigencia = new Date(
      parseInt(partes[2], 10),
      parseInt(partes[1], 10) - 1,
      parseInt(partes[0], 10)
    );

    const fechaHoy = new Date();
    const fechaISO = fechaHoy.toISOString().slice(0, 10);

    // 🔹 Parsear las filas de datos (desde la fila 4)
    const registros = [];
    for (let i = 3; i < data.length; i++) {
      const fila = data[i];
      if (!fila || fila.length < 4) continue;

      const mes = parseInt(fila[0]);
      if (isNaN(mes)) continue;

      const valores = [
        { idmoneda: 1, valor: parseFloat((fila[1] + "").replace("%", "")) * 100 },
        { idmoneda: 2, valor: parseFloat((fila[2] + "").replace("%", "")) * 100 },
        { idmoneda: 4, valor: parseFloat((fila[3] + "").replace("%", "")) * 100 },
      ];

      for (const v of valores) {
        if (!isNaN(v.valor)) {
          registros.push({
            mes,
            idmoneda: v.idmoneda,
            n_valor: v.valor,
            activo: 1,
            f_creacion: fechaISO,
          });
        }
      }
    }

    if (registros.length === 0) {
      throw new Error("No se encontraron datos válidos en el archivo Excel");
    }

    // 🔹 Guardar en base de datos usando tu modelo
    const result = await TablaPar.insertRegistrosCurva(registros, {
      fecha: fechaISO,
      reemplazar: true,
    });

    fs.unlinkSync(filePath);

    res.json({
      ok: true,
      message: `Se cargaron ${registros.length} registros correctamente`,
      result,
    });
  } catch (error) {
    console.error("Error al procesar Excel:", error);
    res.status(500).json({ error: error.message });
  }
};

function excelDateToJSDate(serial) {
  // Excel cuenta desde 1900-01-01 (día 1)
  const utc_days = Math.floor(serial - 25569);
  const date = new Date(utc_days * 86400 * 1000);
  return date;
}


//#endregion

//#region Mantenedor Valores 
//gastos
exports.listarValores = async (req, res) => {
  try {
    const valores = await TablaPar.getMValores();
    res.render("cotizacion/valores", { valores });
  } catch (error) {
    console.error("Error en listarTasas:", error);
    res.status(500).send("Error al obtener tasas");
  }
};

exports.obtenerPorPeriodoYMonedaGastos = async (req, res) => {
  try {
    const { fecha, idmoneda } = req.query;
    const data = await TablaPar.listarPorPeriodoYMoneda(fecha, idmoneda);
    res.json({ ok: true, data });
  } catch (error) {
    console.error('Error al obtener gasto:', error);
    res.status(500).json({ ok: false, error: 'Error obteniendo datos' });
  }
};

exports.guardarGastos = async (req, res) => {
  try {
    const result = await TablaPar.guardarRegistroG(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error al guardar gasto:', error);
    res.status(500).json({ ok: false, error: 'Error al guardar' });
  }
};

exports.guardarGastosb = async (req, res) => {
  try {
    const result = await TablaPar.guardarRegistroGb(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error al guardar gasto:', error);
    res.status(500).json({ ok: false, error: 'Error al guardar' });
  }
};

//IPC
exports.obtenerPorPeriodoIPC = async (req, res) => {
  try {
    const { periodo } = req.query;
    const data = await TablaPar.obtenerPorPeriodoIPC(periodo);
    res.json(data || {});
  } catch (error) {
    console.error('Error al obtener periodo:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

exports.guardarIPC = async (req, res) => {
  try {
    const { periodo, valor, porcent } = req.body;
    const result = await TablaPar.guardarOActualizarIPC(periodo, valor, porcent);
    res.json(result);
  } catch (error) {
    console.error('Error al guardar:', error);
    res.status(500).json({ error: 'Error interno' });
  }
};

//Tipo Cambio
exports.obtenerPorFechaTC = async (req, res) => {
  try {
    const { fecha, id_moneda } = req.query;
    const data = await TablaPar.obtenerPorFechaTC(fecha, id_moneda ? parseInt(id_moneda) : null);
    res.json(data || {});
  } catch (err) {
    console.error('Error obtenerPorFecha controller:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};

exports.guardarTC = async (req, res) => {
  try {
    const { fecha, n_valor, id_moneda } = req.body;
    const result = await TablaPar.guardarOActualizarTC({ fecha, id_moneda: id_moneda || 1, n_valor });
    return res.json(result);
  } catch (err) {
    console.error('Error guardar controller:', err);
    res.status(500).json({ message: 'error al guardar' });
  }
};

//Tipo Cambio Mensual
exports.obtenerPorFechaTCM = async (req, res) => {
  try {
    const { fecha, id_moneda, id_tipcam } = req.query;

    const data = await TablaPar.obtenerPorFechaTCM(fecha, id_moneda ? parseInt(id_moneda) : null, id_tipcam);
    res.json(data || {});
  } catch (err) {
    console.error('Error obtenerPorFecha controller:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};

exports.guardarTCM = async (req, res) => {
  try {
    const { fecha, id_moneda, n_valor, id_tipcam } = req.body;
    console.log(fecha);
    console.log(id_moneda);
    console.log(n_valor);
    console.log(id_tipcam);
    const result = await TablaPar.guardarOActualizarTCM({ fecha, id_moneda, n_valor, id_tipcam });
    return res.json(result);
  } catch (err) {
    console.error('Error guardar controller:', err);
    res.status(500).json({ message: 'error al guardar' });
  }
};

//Gastos de sepelio
exports.obtenerPorFechaGS = async (req, res) => {
  try {
    const { fecha } = req.query;

    const data = await TablaPar.obtenerPorFechaGS(fecha);
    res.json(data || {});
  } catch (err) {
    console.error('Error obtenerPorFecha controller:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};

exports.guardarGS = async (req, res) => {
  try {
    const { fecha, n_valor } = req.body;
    console.log(fecha);
    console.log(n_valor);
    const result = await TablaPar.guardarOActualizarGS({ fecha, n_valor });
    return res.json(result);
  } catch (err) {
    console.error('Error guardar controller:', err);
    res.status(500).json({ message: 'error al guardar' });
  }
};

//#endregion

//#region Filtros Configuracion
exports.MatrizConfig = async (req, res) => {
  try {
    const registros = await TablaCot.ConfiguracionMatrizCF();
    res.render('cotizacion/cfmatriz', { registros });
  } catch (err) {
    res.status(500).send('Error al cargar vista configuración matriz');
  }
}

exports.MatrizActualiza = async (req, res) => {
  try {
    const { id, campo, valor } = req.body;
    const resultado = await TablaCot.actualizarCampoMatrizCF(id, campo, valor);
    res.json(resultado);
  } catch (err) {
    console.error('Error en actualizarCampo controller:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar campo' });
  }
}

exports.MAtrizActualizarMontos = async (req, res) => {
  try {
    const { id, desde, hasta } = req.body;
    const resultado = await TablaCot.actualizarMontosMatrizCF(id, desde, hasta);
    res.json(resultado);
  } catch (err) {
    console.error('Error actualizarMontos:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar campo' });
  }
};
//#endregion

//#region Cotizador Masivo
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

exports.postValidacion = async (req, res) => {
  try {
    const { arc, ope, mod, mon, pd, pg, pens } = req.body;
    const validacion = await validaModalidad(arc, ope, mod, mon, pd, pg, pens);
    console.log("validacion", validacion);
    res.json({ mensaje: validacion }); // DataTables lo consume

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

exports.postAceptaCotizacion = async (req, res) => {
  try {
    const { ope, cor, fecha } = req.body;
    const respuesta = await registraAceptacion(ope, cor, fecha);
    console.log("respuestaAceptacion", respuesta);
    res.json({ mensaje: validacion }); // DataTables lo consume

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

exports.getTasasTopes = async (req, res) => {
  try {
    const { moneda, prestacion, montoCIC, afp } = req.body;

    console.log("entra a getTasasTopes");

    const fechacalculo = new Date().toISOString().slice(0, 10);
    const TablasCicRegion = await tablasTasasInd.getRegionCIC();
    const TablasTopesTasas = await tablasTasasInd.getTopesTasas();
    const TablasVtaPromedio = await tablasTasasInd.getTasaVentaPromedio();
    const porcentajeAFP = await TablaPar.getParametros();

    let idreg = await ObtieneRegionCIC(TablasCicRegion, montoCIC);
    //console.log("idreg",idreg);
    let valtac = 3;
    let valvta = await ObtieneTasasTope(TablasTopesTasas, idreg, moneda, prestacion, "V");
    //console.log("valvta",valvta);
    let valtir = await ObtieneTasasTope(TablasTopesTasas, idreg, moneda, prestacion, "T");
    //console.log("valtir",valtir);
    let valper = await ObtieneTasasTope(TablasTopesTasas, idreg, moneda, prestacion, "P");
    //console.log("valper",valper);
    let valpro = await ObtieneTasasVtaPromedio(TablasVtaPromedio, moneda, prestacion, fechacalculo)
    //console.log("valpro",valpro);
    let comision = 2;
    let prcafp = porcentajeAFP.find(x => x.v_cod === afp).n_valor || 0;

    res.json({ valtac: valtac, valvta: valvta, valtir: valtir, valper: valper, valpro: valpro, comision: comision, prcafp }); // DataTables lo consume
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

exports.getRegion = async (req, res) => {
  try {
    const regiones = await TablaPar.getRegiones();
    res.json(regiones);
  } catch (err) {
    console.error("Error getRegiones:", err);
    res.status(500).json({ error: err.message });
  }
}

exports.getProvincia = async (req, res) => {
  try {
    const provincias = await TablaPar.getProvincias(req.params.idRegion);
    res.json(provincias);
  } catch (err) {
    console.error("Error getProvincias:", err);
    res.status(500).json({ error: err.message });
  }
}

exports.getDistrito = async (req, res) => {
  try {
    const distritos = await TablaPar.getDistritos(req.params.idProvincia);
    res.json(distritos);
  } catch (err) {
    console.error("Error getDistritos:", err);
    res.status(500).json({ error: err.message });
  }
}

exports.getDistritoInfo = async (req, res) => {
  try {
    const info = await TablaPar.getDistritoInfo(req.params.idDistrito);
    res.json(info);
  } catch (err) {
    console.error("Error getDistritoInfo:", err);
    res.status(500).json({ error: err.message });
  }
}
// searchDistritos: recibe ?q=texto y devuelve { id, text }
exports.searchDistritos = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      // devuelve vacio para no cargar todo
      return res.json([]);
    }
    const info = await TablaPar.getDistritoBusca(q);
    // Select2 espera { results: [ {id, text}, ... ] }
    res.json({
      results: info.map(d => ({
        id: d.id,
        text: d.v_nombre
      }))
    });
    //res.json(info);
  } catch (err) {
    console.error('Error searchDistritos:', err);
    res.status(500).json({ error: 'Error al buscar distritos' });
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

async function validaModalidad(idArch, operacion, modalidad, moneda, pd, pg, pen) {
  try {
    const tabparametros = await TablaPar.getParametros();
    const respuestasMeler = await TablaCot.getTablaSolicitudRespuesta(idArch); // 👈 OJO con los ()
    const cotizacionelegida = await TablaCot.getCotizacionind(parseFloat(operacion));
    let mensaje = "OK"; //;

    const idmod = tabparametros.find(x => x.v_codsbs === modalidad)?.v_cod || "";
    const idmon = tabparametros.find(x => x.v_codsbs === moneda)?.v_cod || "";
    const mesdif = parseFloat(pd);
    const mesgar = parseFloat(pg);
    const pension = parseFloat(pen);

    const encontrado = cotizacionelegida.find(
      x => x.id_tipren === idmod && x.id_moneda === idmon && x.num_mesdif === mesdif && x.num_mergar === mesgar
    );
    const pensionCalculada = encontrado ? encontrado.mto_pension : 0;

    console.log("pensionCalculada", pensionCalculada)
    if (pensionCalculada == 0) {
      mensaje = "Modalida Invalida!. No existe la Solicitud elegida."; // 
      return mensaje;
    }

    if (pensionCalculada != pension) {
      mensaje = "Modalida Invlida!. Monto de Pensión elegida no coincide con la calculada."; //
      return mensaje;
    }

    return mensaje; //
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

async function registraAceptacion(ope, cor, fecha) {
  try {
    let mensaje = "OK"; //;
    const actualizado = await Modelo.insertRegistraAcepta(ope, cor, fecha);
    if (actualizado) {
      mensaje = "OK"; //
      return mensaje;
    } else {
      mensaje = "No se encontró ningún registro con esos parámetros"; //
      return mensaje;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
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

async function ObtieneGastosSep(parGastosSepelio, fechacalculo) {
  //console.log("parGastosSepelio",parGastosSepelio)
  // función para formatear a YYYY-MM-DD
  const toYMD = (f) => new Date(f).toISOString().slice(0, 10);

  // normalizamos la fecha de cálculo
  const fechaCalcStr = toYMD(fechacalculo);
  console.log("fechaCalcStr", fechaCalcStr)
  // intentamos encontrar coincidencia exacta
  let gasSep = parGastosSepelio.find(x => toYMD(x.d_periodo) === fechaCalcStr);
  console.log("gasSep", gasSep)
  if (!gasSep) {
    // si no hay coincidencia, buscamos la más reciente anterior
    gasSep = parGastosSepelio
      .filter(x => new Date(x.d_periodo) < new Date(fechacalculo)) // solo las anteriores
      .sort((a, b) => new Date(b.d_periodo) - new Date(a.d_periodo)) // orden descendente
    [0]; // tomamos la primera (más reciente)
    console.log("gasSep-", gasSep)
  }

  const valor = gasSep ? Number(parseFloat(gasSep.n_valor).toFixed(2)) : 0;
  return valor;
}

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
//#endregion