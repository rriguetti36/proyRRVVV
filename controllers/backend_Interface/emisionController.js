const fs_ = require('fs');
const libxml = require('libxmljs');
const { parseString } = require('xml2js')
const path = require('path');
const fs = require('fs/promises');
const xml2js = require('xml2js');
const fetch = require('node-fetch'); // Solo si usas Node <18
const TablaEmi = require('../../models/emisionModel');
const TablaPar = require('../../models/tabTasasModel');
const tablasTasasInd = require('../../models/tabTasasModel');
const rutinaAjusteRenta = require('../../servicios/ajustesRenta');

exports.PrePolizas = async (req, res) => {
    res.render('emision/prepolizas', { title: 'Gestión de Cotizaciones y Pólizas' });
};

exports.PrcPrePoliza = async (req, res) => {
    res.render('emision/prcprepolizas', { title: 'Gestión de Cotizaciones y Pólizas' });
};

exports.listCotizaciones = async (req, res) => {
    try {
        const dni = req.query.dni || '';
        const cotizaciones = await TablaEmi.getCotizaciones(dni);
        res.json(cotizaciones);
    } catch (err) {
        console.error('Error en listCotizaciones:', err);
        res.status(500).json({ error: 'Error al obtener cotizaciones' });
    }
};

exports.listPolizas = async (req, res) => {
    try {
      const dni = req.query.dni || '';
      const polizas = await TablaEmi.getPolizas(dni);
      res.json(polizas);
    } catch (err) {
      console.error('Error en listPolizas:', err);
      res.status(500).json({ error: 'Error al obtener pólizas' });
    }
}

exports.SolicitudAFP = async (req, res) => {

};

exports.RecepcionPrima = async (req, res) => {

};

exports.ProcesoCalculoPagos = async (req, res) => {
    try {
        const { polizas, beneficiarios, fechaproceso, interesanual } = req.body;

        if (!polizas || !beneficiarios) {
            return res.status(400).json({ error: 'Faltan datos de polizas o beneficiarios' });
        }
        const TasasIPC = await tablasTasasInd.getTasaTasaIPC();
        const feccal = parseFechaDia1(fechaproceso);
        const tasaAnual = interesanual;


        const resultadoPromises = polizas.map(async poliza => {
            const beneficiariosPoliza = beneficiarios.filter(b => b.poliza === poliza.poliza);
            console.log("Inicia calculo de poliza numero: ", poliza.poliza);
            const resultadoPagos = await CalcularPagos(poliza, beneficiariosPoliza, feccal, tasaAnual, TasasIPC)
            //console.log("resultadoPagos", resultadoPagos);
            return resultadoPagos;
        });

        // Esperar que todas las promesas terminen
        const resultadosFinales = await Promise.all(resultadoPromises);

        res.json({ ok: true, data: resultadosFinales });

    } catch (error) {
        console.error('Error procesando polizas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

exports.ProcesoCalculoEndosos = async (req, res) => {

};

async function CalcularPagos(Polizas, Beneficiarios, Feccal, Tasaanual, IPC) {

    let numpoliza = Polizas.poliza;

    let FecCalculo = new Date(Feccal);
    //console.log("FecCalculo", FecCalculo);
    let aFecCalc = parseInt(FecCalculo.getFullYear());
    let mFecCalc = parseInt(FecCalculo.getMonth() + 1);
    let dFecCalc = parseInt(FecCalculo.getDay());
    let dultimoFecCal = obtenerUltimoDia(Feccal);
    let moneda = parseInt(Polizas.moneda);
    let pension = Polizas.pension;
    let pensiongar = Polizas.pensiongar;
    let gratificacion = Polizas.gratificacion;
    let fecdevsol = parseFecha(Polizas.devenguesol);
    let mesesdifer = Polizas.mesestemp;
    let fecGarFin = parseFecha(Polizas.fechafingarantizado) || parseFecha(Polizas.devengue);
    let fecIniPago = parseFecha(Polizas.fechainicio);
    let afecIniPago = parseInt(fecIniPago.getFullYear());
    let mfecIniPago = parseInt(fecIniPago.getMonth() + 1);
    let dfecIniPago = parseInt(fecIniPago.getDay());
    //console.log("Polizas.devengue", Polizas.devengue);
    let fecdev = parseFecha(Polizas.devengue);
    //console.log("fecdev", fecdev);
    let fecdevd1 = parseFechaDia1(Polizas.devengue);
    let afecdev = parseInt(fecdevd1.getFullYear());
    let mfecdev = parseInt(fecdevd1.getMonth() + 1);
    let dfecdev = parseInt(fecdevd1.getDay());
    let fecdevAct = new Date(fecdev); // clonar
    fecdevAct.setMonth(fecdevAct.getMonth() + parseInt(mesesdifer));
    //console.log("fecdev", fecdev);
    let afecdevAct = parseInt(fecdevAct.getFullYear());
    let mfecdevAct = parseInt(fecdevAct.getMonth() + 1);
    let dfecdevAct = parseInt(fecdevAct.getDay());
    let pagapension = 1;
    let xFactorAjuste = 1;
    let validaPerGar = false;
    let PensionAjustada = 0;
    let PensionFinalAjustada = 0;
    const tablaPagosRecurrentes = [];

    //---obtiene el listado de ajustes
    switch (moneda) {
        case 1:
            //let factoresIPC = rutinaAjusteRenta.MonedaIndexada(fecdevd1, FecCalculo, IPC);
            //--obtiene el ajsute del mes en calculo
            xFactorAjuste = 1; //buscarFactorCercano(factoresIPC,FecCalculo);
            break;
        case 3:
            //Aqui ahara algo para los dolares nominales
            break;
        case 2:
        case 4:
            //console.log("fecdev", fecdev);
            let factoresAjus = await rutinaAjusteRenta.MonedaAjustada(fecdevd1, FecCalculo, Tasaanual);
            //console.log("tipo", typeof factoresAjus);
            //console.log("es array?", Array.isArray(factoresAjus));
            //console.log("valor", factoresAjus);
            //--obtiene el ajsute del mes en calculo
            //xFactorAjuste = factoresAjus.mesdev === FecCalculo.toISOString().split("T")[0] ? factoresAjus.factor : 0;
            xFactorAjuste = factoresAjus.find(item =>
                new Date(item.mesdev).getTime() === FecCalculo.getTime()
            ).factor || 0;

            //xFactorAjuste = factoresAjus.find(x => x.mesdev === FecCalculo).factor || 0;
            break;
        default:
            console.log("Opción no válida");
    }


    //--valida que este dentro del periodo garantizado
    if (isNaN(fecdevd1) || isNaN(fecGarFin) || isNaN(FecCalculo)) {
        return 1;
    }

    // Condición: proceso entre inicio y fin (inclusive)
    if (FecCalculo >= fecdevd1 && FecCalculo <= fecGarFin) {
        // Si es igual al inicio => false, caso contrario true
        validaPerGar = FecCalculo.getTime() !== fecdevd1.getTime();
    }
    //console.log("xFactorAjuste", xFactorAjuste);
    if (validaPerGar == true) {
        PensionAjustada = pensiongar * xFactorAjuste;
    } else {
        PensionAjustada = pension * xFactorAjuste;
    }
    //console.log("PensionAjustada", PensionAjustada);
    //--valida que el mes de calculo sea trimestre
    let esTrimestre = [1, 4, 7, 10].includes(mfecIniPago);
    if (esTrimestre === true) {
        PensionFinalAjustada = PensionAjustada;
    }
    //console.log("PensionFinalAjustada", PensionFinalAjustada);

    //Emepezara el rrecorrido de los benficiairios 
    const resultadoBen = Beneficiarios.map(beneficiario => {
        let ordenben = parseInt(beneficiario.idorden);
        let edadben = parseInt(beneficiario.Edad);
        let nacimientoben = parseFecha(beneficiario.nacimiento);
        let certificaSupervivencia = parseInt(beneficiario.certifsup);
        let certificaEstudios = parseInt(beneficiario.certifest);
        let parentescoben = parseInt(beneficiario.parentesco);
        let invalidezben = beneficiario.invalidez;
        let estudianteben = beneficiario.estudiante;
        let porcentajeben = parseFloat(beneficiario.porcentaje) / 100;
        let porcentajegarben = parseFloat(beneficiario.porcentajegar) / 100;
        let retencionben = beneficiario.retencion;
        let tiporetencion = beneficiario.tiporetencion;
        let valretencion = parseFloat(beneficiario.valretencion);
        let essaludben = beneficiario.essalud;
        let tipoessalud = beneficiario.tipoessalud;
        let valessalud = parseFloat(beneficiario.valessalud);
        let diaNacimiento = parseInt(nacimientoben.getDay);
        let diasresto = dultimoFecCal - dfecdevAct;
        let pensionben = 0;

        //console.log("ordenben", ordenben);
        if (parentescoben == 6) {
            if (edadben >= 18) {
                if (estudianteben == "N") {
                    pagapension = 0;
                } else {
                    if (invalidezben == "N") {
                        if (certificaEstudios == 0) {
                            pagapension = 0;
                        }
                    }
                }
            } else {
                if (certificaSupervivencia == 0) {
                    pagapension = 0;
                }
            }
        } else {
            if (certificaSupervivencia == 0) {
                pagapension = 0;
            }
        }
        //console.log("pagapension", pagapension);
        let montoPension = 0;
        let montoDescuento = 0;
        let montoNetopagar = 0;
        let montoRetencion = 0;
        let montoPensionGrati = 0;
        //console.log("PensionAjustada", PensionAjustada);
        //console.log("porcentajegarben", porcentajegarben);
        //console.log("porcentajeben", porcentajeben);
        if (pagapension == 1) {
            if (validaPerGar == true) {
                pensionben = PensionAjustada * porcentajegarben;
            } else {
                pensionben = PensionAjustada * porcentajeben;
            }
            //console.log("pensionben", pensionben);
            //busca pensiones con prorrateo
            if (parentescoben == 6) {
                if (invalidezben == "N") {
                    if (edadben == 18) {
                        if (estudianteben == "N") {
                            if (mFecCalc == nacimientoben.getMonth + 1) {
                                pensionben = (pensionben / 30) * diaNacimiento;
                            }
                        }
                    }
                }
            } else {
                if (dfecdevAct != 1) {
                    if ((aFecCalc * 12 + mFecCalc) == (afecdevAct * 12 + mfecdevAct)) {
                        pensionben = (pensionben / 30) * diasresto;
                    }
                }
            }
            //console.log("pensionben", pensionben);

            montoPension = pensionben;

            if (essaludben != "N") {
                let valorEssalud = tipoessalud === "P" ? valessalud / 100 : valessalud;
                if (tipoessalud === "P") {
                    montoDescuento = montoPension * valorEssalud;
                } else {
                    montoDescuento = montoPension - valorEssalud;
                }
            }
            montoNetopagar = montoPension - montoDescuento;
            if (retencionben != "N") {
                let valorRetencion = tiporetencion === "P" ? valretencion / 100 : valretencion;
                if (tiporetencion === "P") {
                    montoRetencion = montoNetopagar * valorRetencion;
                } else {
                    montoRetencion = montoNetopagar - valorRetencion;
                }
            }
            if (gratificacion != "N") {
                montoPensionGrati = pensionben * 2;
            }

        }

        const resultadosBenPagos = {
            poliza: numpoliza,
            numID: ordenben,
            factoraAjuste: xFactorAjuste,
            pensionAjustada: PensionAjustada,
            pensionTrimActual: PensionFinalAjustada,
            montobruto: montoPension,
            montoessalud: montoDescuento,
            montoretencion: montoRetencion,
            montoneto: montoNetopagar,
            montogratificacion: montoPensionGrati
        }
        //tablaPagosRecurrentes.push(resultadosBenPagos);
        return resultadosBenPagos;
    });

    return resultadoBen;
}

function obtenerUltimoDia(fecha) {
    const f = new Date(fecha);
    return new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate();
}

function parseFecha(fechaStr) {
    if (!fechaStr) return null;
    const [anio, mes, dia] = fechaStr.split("-").map(Number);
    return new Date(anio, mes - 1, dia); // mes - 1 porque getMonth() es base 0
}

function parseFechaDia1(fechaStr) {
    if (!fechaStr) return null;
    const [anio, mes, dia] = fechaStr.split("-").map(Number);
    return new Date(anio, mes - 1, 1); // fechas con dia 1 
}

function buscarFactorCercano(factoresIPC, FecCalculo) {
    const fechaCalculo = new Date(FecCalculo);

    // ordenar por fecha ascendente
    const ordenado = [...factoresIPC].sort(
        (a, b) => new Date(a.mesdev) - new Date(b.mesdev)
    );

    // buscar el primer >= fechaCalculo
    let encontrado = ordenado.find(f => new Date(f.mesdev) >= fechaCalculo);

    // si no hay mayor o igual, tomar el último (el más cercano anterior)
    if (!encontrado) {
        encontrado = ordenado[ordenado.length - 1];
    }

    return encontrado ? encontrado.factor : 0;
}

exports.ConsultasEmision = async (req, res) => {

};

