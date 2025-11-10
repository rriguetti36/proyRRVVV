function validarEmision(req, res, next) {

    console.log("➡️ Middleware validarEmision ejecutado");
    console.log("Body recibido:", req.body);
    const datos = req.body;

    // Validar existencia

    const camposFecha = [
        "fec_solicitud",
        "fec_vigencia",
        "fec_dev",
        "fec_devsol",
        "fec_calculo",
        "fec_ingresospp"
    ];

    for (const campo of camposFecha) {
        const valor = datos.poliza[0][campo];

        // Si está vacío o no es string/fecha válida
        if (!valor || isNaN(new Date(valor))) {
            return res.status(400).json({
                error: `El campo ${campo} debe tener una fecha válida`
            });
        }
    }

    if (!datos.poliza.des_direxpediente) {
        return res.status(400).json({ error: "Debe incluir la dirección del Afiliado" });
    }

    if (datos.poliza.txtUbigeoExp == "") {
        return res.status(400).json({ error: "Debe incluir la Ubigeo del Afiliado" });
    }

    if (!datos.poliza.correoafi1 || datos.poliza.correoafi1 == "") {
        return res.status(400).json({ error: "Debe incluir un correo del Afiliado" });
    }

    if (!datos.poliza.telefonoafi1 || datos.poliza.telefonoafi1 == "") {
        return res.status(400).json({ error: "Debe incluir un teléfono del Afiliado" });
    }

    if (!datos.poliza.fecaceptaafi || datos.poliza.fecaceptaafi == "") {
        return res.status(400).json({ error: "Debe incluir la fecha de Aceptación" });
    }

    // if (!Array.isArray(datos.Modalidad) || datos.Modalidad.length === 0) {
    //     return res.status(400).json({ error: "Debe incluir al menos una Modalidad" });
    // }

    next();
}

module.exports = validarEmision;
