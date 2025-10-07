function validarCotizacion(req, res, next) {

    console.log("➡️ Middleware validarCotizacion ejecutado");
    console.log("Body recibido:", req.body);
    const datos = req.body;

    // Validar existencia
    if (typeof datos.TipoCambio !== "number" || datos.TipoCambio == 0) {
        return res.status(400).json({ error: "Tipo de cambio esta en 0" });
    }

    if (!datos.Asegurado || typeof datos.Asegurado !== "object") {
        return res.status(400).json({ error: "Debe incluir los datos del Asegurado" });
    }

    if (!datos.Asegurado.Genero) {
        return res.status(400).json({ error: "Genero del Asegurado es obligatoria" });
    }

    // Ejemplo: validar subcampos del asegurado
    if (!datos.Asegurado.FechaNacimiento) {
        return res.status(400).json({ error: "FechaNacimiento del Asegurado es obligatoria" });
    }

    if (typeof datos.Asegurado.ComisionAFP !== "number" || datos.Asegurado.ComisionAFP <= 0) {
        return res.status(400).json({ error: "Eliga el AFP es obligatoria" });
    }

    if (!datos.Asegurado.TipoPension) {
        return res.status(400).json({ error: "Prestación del Asegurado es obligatoria" });
    }

    if (!datos.Asegurado.TipoInvalidez) {
        return res.status(400).json({ error: "Tipo invalidez del Asegurado es obligatoria" });
    }

    if (typeof datos.MontoCIC !== "number" || datos.MontoCIC <= 0) {
        return res.status(400).json({ error: "Registra el Monto Cic" });
    }

    if (!datos.Asegurado.FechaDevengue) {
        return res.status(400).json({ error: "Fecha de devengue del Asegurado es obligatoria" });
    }

    if (!datos.Asegurado.FechaDevengueSolicitud) {
        return res.status(400).json({ error: "Fecha de devengue solicitud del Asegurado es obligatoria" });
    }

    if (!Array.isArray(datos.Modalidad) || datos.Modalidad.length === 0) {
        return res.status(400).json({ error: "Debe incluir al menos una Modalidad" });
    }

    next();
}

module.exports = validarCotizacion;
