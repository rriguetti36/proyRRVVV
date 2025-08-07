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

async function calcularPerdida(reserva, primacia) {
    let valorperdida = (reserva / primacia) - 1;
    //console.log(valorperdida);
    if (Math.round(valorperdida, 5) <= 0) {
        valorperdida = 0;
    }
    return valorperdida;
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
        tavta: tasvta,
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
    const resultadoTci = await calcularTciTlr_opti(DatasumaFlujos, penref, moneda, TasasCurvaCero);
    //console.timeEnd(`Solicictud inicial TciTlr-${idsoliictud}-${idmod}`);

    const tasaTci = resultadoTci.valortci;
    const tasaTce = Math.min(tasvta, tasaTci, tasvtapro);
    //console.log("calcularpension_ini_opti |tasaTce: " + tasaTce + "|tasvta: " + tasvta + "|tasaTci: " + tasaTci + "|tasvtapro: " + tasvtapro);
    //console.time(`TIR-${idmod}`);
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

    /* const [resultadoTir, perdida] = await Promise.all([
        calcularTIR_opti(resultadoTci.pagos, tasaTce, moneda, primacia, comision, gastos, tipcam, TasasRentabilidad),
        calcularPerdida(resultadoTci.valorReserva, primacia)
    ]); */
    //console.log("calcularpension_rec_opti |tasaTce: " + tasaTce + "|tasvta: " + tasvta + "|tasaTci: " + tasaTci + "|tasvtapro: " + tasvtapro);
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

async function reservas(pago, Datapagos, mes, tce) {
    const flujosDesde3 = Datapagos.filter(f => f.mest >= mes).map(f => f.valflu);
    //logMatriz(Datapagos.filter(f => f.mest >= mes).map(f => f.valflu), "log_sumResrva0.txt");

    const tasatcemen = Math.pow((1 + tce), (1 / 12)) - 1;
    const reserva = pago + await calcularVNA(tasatcemen, flujosDesde3);
    return reserva;
}

module.exports = {
    calcularTciTlr_opti,
    calcularTIR_opti,
    calcularPerdida,
    calcularConReintentos,
    calcularpension_ini_opti,
    valorActual,
    calculaIRR,
    calcularVNA,
    reservas,
    calcularpension_rec_opti
};