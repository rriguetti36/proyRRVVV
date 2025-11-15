function validarEmision(req, res, next) {

    console.log("➡️ Middleware validarEmision ejecutado");
    //console.log("Body recibido:", req.body);
    const datos = req.body;

    // Validar existencia

    const tipoprestacion = datos.polizaver[0].id_prestacion;
    console.log("tipoprestacion", tipoprestacion);
    const errores = [];
    const camposFecha = [
        "fec_solicitud",
        "fec_vigencia",
        "fec_dev",
        "fec_devsol",
        "fec_calculo",
        "fec_ingresospp",
        "fec_acepta"
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



    //valida la direccion y correos de titular asegurado
    if (tipoprestacion != 5) {
        if (
            !datos.polizabeneficiario[0].des_direxpediente ||
            datos.polizabeneficiario[0].des_direxpediente.trim() === ""
        ) {
            return res.status(400).json({ error: "Debe incluir la dirección del Afiliado" });
        }

        if (
            !datos.polizabeneficiario[0].id_direxpediente ||
            datos.polizabeneficiario[0].id_direxpediente.trim() === ""
        ) {
            return res.status(400).json({ error: "Debe incluir una ubicación" });
        }

        if (
            !datos.polizabeneficiario[0].des_email1 ||
            datos.polizabeneficiario[0].des_email1.trim() === ""
        ) {
            return res.status(400).json({ error: "Debe incluir un correo electronico del Afiliado" });
        }

        if (
            !datos.polizabeneficiario[0].des_telef1 ||
            datos.polizabeneficiario[0].des_telef1.trim() === ""
        ) {
            return res.status(400).json({ error: "Debe incluir un telefono del Afiliado" });
        }
    }

    if (
        !datos.polizabeneficiario[0].id_viapago ||
        datos.polizabeneficiario[0].id_viapago.trim() === "Seleccionar"
    ) {
        return res.status(400).json({ error: "Debe elegir una forma de pago" });
    }
    const viapago = datos.polizabeneficiario[0].id_viapago;

    switch (viapago) {
        case '1': // DEPOSITO EN CUENTA
            if (
                !datos.polizabeneficiario[0].id_banco ||
                datos.polizabeneficiario[0].id_banco.trim() === "Seleccionar"
            ) {
                return res.status(400).json({ error: "Debe elegir un banco" });
            }
            if (
                !datos.polizabeneficiario[0].id_tipocuenta ||
                datos.polizabeneficiario[0].id_tipocuenta.trim() === "Seleccionar"
            ) {
                return res.status(400).json({ error: "Debe elegir un el tipo de cuenta" });
            }
            if (
                !datos.polizabeneficiario[0].num_cuenta ||
                datos.polizabeneficiario[0].num_cuenta.trim() === ""
            ) {
                return res.status(400).json({ error: "Debe tener un número de cuenta" });
            }
            break;
        case '2': // TRANSFERENCIA AFP

            break;
        case '3': // VENTANILLA BANCO
            if (
                !datos.polizabeneficiario[0].id_banco ||
                datos.polizabeneficiario[0].id_banco.trim() === "Seleccionar"
            ) {
                return res.status(400).json({ error: "Debe tener un número de cuenta" });
            }
            break;
    }

    if (tipoprestacion == 5) {
        datos.polizabeneficiario.forEach((b, i) => {
            const idx = i + 1;

            if (b.id_orden != 1) {

                // CORREGIDO – ahora SI compara, no asigna
                if (b.id_tipodociden === 0) {
                    errores.push(`Nro Orden ${idx}: falta el Tipo de documento`);
                }

                if (!b.num_dociden || b.num_dociden.trim() === "") {
                    errores.push(`Beneficiario ${idx}: falta el número de documento`);
                }

                if (!b.des_direxpediente || b.des_direxpediente.trim() === "") {
                    errores.push(`Nro Orden ${idx}: debe incluir dirección del expediente`);
                }

                if (!b.des_telef1 || b.des_telef1.trim() === "") {
                    errores.push(`Nro Orden ${idx}: debe registrar al menos un teléfono`);
                }

                if (!b.des_email1 || b.des_email1.trim() === "") {
                    errores.push(`Nro Orden ${idx}: debe registrar al menos un correo electronico`);
                }
            }
        });

        // SOLO si hay errores → 400
        if (errores.length > 0) {
            return res.status(400).json({ error: errores });
        }
    }


    next();
}

module.exports = validarEmision;
