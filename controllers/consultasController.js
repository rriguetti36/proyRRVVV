// controllers/consultaController.js
const consultaModel = require('../models/querys/consultaModel');

exports.consultar = async (req, res) => {
  try {
    //const { campos, filtros, tablas } = req.body;
    //const resultado = await consultaModel.ejecutarConsulta(campos, filtros, tablas);
    //console.log(req.body)
    const resultado = await consultaModel.ejecutarConsulta(req.body);
    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
