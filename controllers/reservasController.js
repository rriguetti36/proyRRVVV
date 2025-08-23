const tablasmortal = require('../models/tmortalModel');
const tablasTasasInd = require('../models/tabTasasModel');
const fs = require('fs');
const fsp = require("fs").promises;
const { Console } = require('console');
const path = require('path');
const { Worker } = require('worker_threads');
const os = require('os');

exports.ProcesoCalculoReservas = async (req, res) => {

    try {
        const pLimit = (await import('p-limit')).default;
        const cpuCores = os.cpus().length; // por ejemplo, 8
        const limit = pLimit(Math.max(2, Math.floor(cpuCores / 2))); // Usa la mitad de los núcleos, al menos 2

        const datos = req.body;
        const TasasIPC = await tablasTasasInd.getTasaTasaIPC();
        const TasasMercado = await tablasTasasInd.getTasaMercado();
        //const TasasInversion = await tablasTasasInd.getTasaInversiones();
        const TasasCurvaCero = await tablasTasasInd.getTasaCurvaCuponCero();
        const TablasMortal = await tablasmortal.getAllMortalProc();
        const TablasCicRegion = await tablasTasasInd.getRegionCIC();
        const TablasTopesTasas = await tablasTasasInd.getTopesTasas();
        const TablasVtaPromedio = await tablasTasasInd.getTasaVentaPromedio();
        const TasasRentabilidad = await tablasTasasInd.getTasaInversiones();

        //Crea la foto temporal
        const carpeta = await creaTemporalesJson(datos);

        // Ruta del archivo
        const rutaArchivo = path.join(__dirname, `../json_outputs/reservas_${datos.proceso}`, "polizasdatos.json");

        // Leer archivo
        const data = JSON.parse(fs.readFileSync(rutaArchivo, "utf8"));
        const datosPol = data.Polizas;


        // Carpeta dinámica con la fecha del proceso para guardar los flujos
        const ruta = "D:\\DataReservasRRVV" //"../json_outputs"
        const carpetaFlujos = path.join(ruta, `flujos_polizas_${data.proceso}`);
        //const carpeta = path.join(__dirname, "../json_outputs", `flujos_reservas_${feccalculo}`, "flujos");

        // Crear carpeta si no existe
        if (!fs.existsSync(carpetaFlujos)) {
            fs.mkdirSync(carpetaFlujos, { recursive: true });
        }

        /* const resultados = await Promise.all(
            datosPol.map(c => calcularRes(c, datos.proceso, TasasIPC, TasasRentabilidad, TasasCurvaCero, TablasMortal, TablasVtaPromedio, carpetaFlujos))
        ); */
        /* const resultadosRM = await Promise.all(
            datosPol.map(async (c) => {
                const label = `Cálcula reserva Poliza-${c.poliza}`;
                console.time(label);

                const resultado = await calcularRes(
                    c,
                    datos.proceso,
                    datos.montosepelio,
                    datos.tipocambio,
                    TasasIPC,
                    TasasRentabilidad,
                    TasasCurvaCero,
                    TablasMortal,
                    TablasVtaPromedio,
                    carpetaFlujos
                );

                console.timeEnd(label);
                return {
                    poliza: c.poliza,
                    reserva: resultado
                };
            })
        ); */
        const tareas = datosPol.map((c) =>
            limit(async () => {
                const label = `Cálcula reserva Poliza-${c.poliza}`;
                console.time(label);

                const resultado = await calcularRes(
                    c,
                    datos.proceso,
                    datos.montosepelio,
                    datos.tipocambio,
                    TasasIPC,
                    TasasRentabilidad,
                    TasasCurvaCero,
                    TablasMortal,
                    TablasVtaPromedio,
                    carpetaFlujos
                );

                console.timeEnd(label);
                return { poliza: c.poliza, reserva: resultado };
            })
        );
        const resultadosRM = await Promise.all(tareas);
        res.json(resultadosRM);


        //res.json({ mensaje: `Datos guardados en ${carpeta}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error guardando archivos" });
    }
};

async function creaTemporalesJson(data) {
    if (!data.proceso || !data.polizas || !data.beneficiarios) {
        return false; //res.status(400).json({ error: "JSON inválido" });
    }

    // 🔹 Anidar beneficiarios en cada poliza (sin incluir proceso dentro de cada una)
    const polizasFinal = data.polizas.map(poliza => {
        const beneficiariosPoliza = data.beneficiarios
            .filter(b => b.poliza === poliza.poliza)
            .map(b => {
                // eliminamos campo "poliza" de cada beneficiario para no duplicar
                const { poliza, ...rest } = b;
                return rest;
            });

        return {
            ...poliza,
            beneficiarios: beneficiariosPoliza
        };
    });

    // 🔹 Estructura final con proceso arriba
    const estructuraFinal = {
        proceso: data.proceso,
        Polizas: polizasFinal
    };

    // Carpeta dinámica con la fecha del proceso
    const carpeta = path.join(__dirname, "../json_outputs", `reservas_${data.proceso}`);

    // Crear carpeta si no existe
    if (!fs.existsSync(carpeta)) {
        fs.mkdirSync(carpeta, { recursive: true });
    }

    // Guardar en un único archivo reservas.json
    fs.writeFileSync(
        path.join(carpeta, "polizasdatos.json"),
        JSON.stringify(estructuraFinal, null, 2)
    );

    return carpeta;
}

async function calcularRes(poliza, feccalculo, montosepelio, tipocambio, TasasIPC, TasasRentabilidad, TasasCurvaCero, TablasMortal, TablasVtaPromedio, carpeta) {
    try {

        const datosPol = poliza;
        const datosBen = datosPol.beneficiarios;
        const fechacalculo = parseFecha(feccalculo); //.toISOString().slice(0, 10);
        const sepelio = parseFloat(montosepelio);
        const tc = parseFloat(tipocambio);
        const dataPoliza = [];
        const dataBeneficiarios = [];

        let gastosep = sepelio
        if (datosPol.moneda == 3 || datosPol.moneda == 4) {
            gastosep = Math.round(sepelio / tc, 2);
        }

        //console.time(`Cálculo Poliza-${datosPol.poliza}`);
        const datos = {
            id: datosPol.poliza,
            pre: datosPol.prestacion,
            cic: datosPol.primacia,
            pen: datosPol.pension,
            est: datosPol.estado,
            tavtce: datosPol.tasastce,
            tasres: datosPol.tasares,
            tr: datosPol.renta,
            mo: datosPol.modalidad,
            tm: datosPol.moneda,
            pd: datosPol.mesesdiferidos,
            pg: datosPol.mesesgarantizados,
            gr: datosPol.gratificacion,
            pt: datosPol.mesesescalonada,
            st: datosPol.porcentajeescalonada,
            mesdev: await mesdevengado(datosPol.fechadevengue, feccalculo),
            gs: gastosep,
            dev: datosPol.fechadevengue
        }
        dataPoliza.push(datos);
        //console.log(dataPoliza);

        for (const ben of datosBen) {
            const filaben = {
                idben: ben.idorden,
                idinv: ben.invalidez,
                fecnac: ben.nacimiento,
                idsex: ben.sexo,
                idpar: ben.parentesco,
                prcleg: ben.porcentaje,
                edadtope: await edadtope(ben.parentesco, ben.invalidez, datosPol.fechadevenguesolicitud),
                edadtopemes: await edadtopemes(datosPol.fechadevengue, ben.nacimiento, ben.fallecimiento, ben.parentesco, ben.invalidez, ben.estudiante, await edadtope(ben.parentesco, ben.invalidez, datosPol.fechadevenguesolicitud)),
                edaddevengue: await edadmesdev(datosPol.fechadevengue, ben.nacimiento),
                tm: await MortalidadPer(ben.sexo, ben.invalidez, ben.nacimiento, TablasMortal)
            }
            dataBeneficiarios.push(filaben)
            //sumprcben = sumprcben + prcleg;
        }
        //console.log(dataBeneficiarios);
        //logMatriz(dataBeneficiarios, "dataBeneficiarios_flu.txt", "T");
        const datosflujos = await calcularflujos(dataPoliza, dataBeneficiarios, TasasIPC);
        //guarda los flujos en rchivo json fisicos en una ruta

        const resultadosFlujos = {
            poliza: datosPol.poliza,
            flujos: datosflujos
        };
        // Guardar en un único archivo reservas.json
        fs.writeFileSync(
            path.join(carpeta, "polizaflujos_" + datosPol.poliza + ".json"),
            JSON.stringify(resultadosFlujos, null, 2)
        );

        // Calcula la reseva matematica
        const reservamatetica = await calcularReservaMat(datosflujos, datosPol.tasares / 100);
        console.log("|poliza : " + datosPol.poliza + " |reservamatetica : " + reservamatetica);

        //console.timeEnd(`Cálculo Poliza-${datosPol.poliza}`);

        return reservamatetica;
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error rutina' });
    }
}

async function calcularflujos(objDatosPol, objDatosBen, objDatosIpc) {

    //INICIA LA VARIABLE MATRIZ DE FLUJOS
    const resultado = [];
    const [datospol] = objDatosPol;
    const fecdev = datospol.dev;
    //console.log("objDatosmod.dev",datospol.dev);
    //console.log("objDatosmod.pre",datospol.pre);
    const pension = parseFloat(datospol.pen);
    const prestacion = parseInt(datospol.pre);
    const moneda = parseInt(datospol.tm);
    const fechaInicial = parseFecha(fecdev); // puedes cambiar esta fecha
    const fechadev = parseFecha(fecdev);
    const mesprimerajus = 3 - (fechadev.getMonth() % 3)
    const mesfecdev = fechadev.getMonth() + 1;
    const aniofecdev = fechadev.getFullYear();
    const fecajuspripag = new Date(aniofecdev, mesfecdev + mesprimerajus, 0);
    const mesesdevengado = parseInt(datospol.mesdev) + 1;
    const mesesconsumidos = parseInt(datospol.mesdev);
    //console.log("mesesconsumidos",mesesconsumidos);
    const isgrati = datospol.gr;
    const primeresc = parseInt(datospol.pt);
    const sgdotresc = parseInt(datospol.st);
    const perdif = parseInt(datospol.pd);
    const pergar = parseInt(datospol.pg);
    const mtogs = parseFloat(datospol.gs);
    const tasares = parseFloat(datospol.tasres);
    const mesesedevgar = perdif + pergar;
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
        mescalculo = numero1 <= mesesconsumidos ? 0 : mescalculo + 1;

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
    //logMatriz(resultado, "resultadoInicialajustes.txt", "T");
    //return "";
    //Agrupa los datos DE FLUJOS DE PENSIONES
    const flujosfamiliar = [];
    for (const datosBen of objDatosBen) {
        let orden = parseInt(datosBen.idben);
        let edadt = datosBen.edadtope;
        let edadtop = datosBen.edadtopemes;
        let edaddev = datosBen.edaddevengue;

        let mesfecdev = 0;
        //let finper = 1332;

        if (orden == 1) {
            if (prestacion == 5) {
                mesfecdev = edadt * 12;
            } else {
                mesfecdev = edaddev;
            }
        } else {
            mesfecdev = edaddev;
        }


        /* if (prestacion == 5) {
            if (orden == 1) {
                mesfecdev = edadtop;
            } else {
                mesfecdev = edaddev;
            }
        } else {
            mesfecdev = edaddev;
        } */


        let prcleg = datosBen.prcleg / 100;
        let qxt = 1;
        let tpx = 1;
        let qxtant = 1;
        let tpxant = 1;
        let flujo = 1;
        let tpxTit = 0;
        /*    if (orden == 1) {
               if ([6, 7, 8, 9].includes(prestacion)) {
                   finper = mesesedevgar;
               }
           } */

        for (let i = 0; i <= 1332; i++) {
            let edadxt = mesfecdev + i;

            let lxt = datosBen.tm.find(x => x.meses === edadxt) || 0;
            let lxtd = datosBen.tm.find(x => x.meses === edadxt + 1) || 0;
            //console.log("lxt", lxt);
            //saca el qxt
            if (lxt == 0) {
                qxt = 1;
            } else {
                if (edadxt < (mesfecdev + mesesconsumidos)) {
                    qxt = 0;
                    //console.log("aca")
                } else {
                    qxt = 1 - (lxtd?.lx / lxt?.lx);
                    //console.log(" des pues aca")
                }
            }

            //saca el tpx
            if (orden == 1) {
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
            } else {
                if (i == 0) {
                    if (lxt == 0) {
                        tpx = 0;
                    } else {
                        tpx = 1;
                    }
                } else {
                    tpx = tpxant * (1 - qxtant);
                }

            }

            //obtiene el flujo de pension 
            let tpxpadre = 0;
            if (orden == 1) {
                if (i + 1 <= perdif) {
                    flujo = 0;
                } else if (i + 1 <= mesesedevgar) {
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
                } else if (i + 1 <= mesesedevgar) {
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
                    tpxpadre = flujosfamiliar.find(x => x.id == 1 && x.num == i);
                    if (prestacion == 5) {
                        tpxTit = 0;
                    } else {
                        tpxTit = tpxpadre?.tpx;
                    }
                    flujo = tpx * (1 - tpxTit) * (edadxt >= 0 && edadxt < edadtop ? 1 : 0);
                }
            }

            /* if (orden == 2 && i <= 500) {
                console.log("|orden: " + orden + "|i: " + i + "| edadxt:" + edadxt + "| lxt:" + lxt?.lx + "| tpx:" + tpx + "| tpxTit:" + tpxTit + "|flujo: " + flujo + "|perdif: " + perdif + "|pergar: " + pergar + "|edadtop: " + edadtop);
            } */
            let mescalc = 0;
            const fila = resultado.find(fila => fila[0] === i);
            //console.log("fila selecionada", fila);
            if (fila) {
                let valajuste = fila.at(-2); // O fila[fila.length - 1]
                mescalc = fila.at(-5);
                //if (orden == 2 && i <= 500) {
                //console.log("| orden:" + orden + "| num:" + i + "| qxt:" + qxt + "| tpx:" + tpx + "| tpxpadre:" + tpxpadre?.tpx + "| flujo:" + flujo + "| prcleg:" + prcleg + "| valajuste:" + valajuste)
                //}
                //console.log("| orden:" + orden + "| num:" + i + "| tpx:" + tpx + "| tpxpadre:" + tpxpadre?.tpx + "| flujo:" + flujo + "| prcleg:" + prcleg + "| valajuste:" + valajuste)
                flujo = flujo * prcleg * valajuste
            }

            const filmeses = {
                id: orden,
                num: i,
                mes: edadxt,
                mescal: mescalc,
                lx: lxt?.lx,
                qx: qxt,
                tpx: tpx,
                flujo: flujo,
                flujogs: 0,
                flujopension: i + 1 <= mesesconsumidos ? 0 : pension * flujo,
                flujosepelio: 0
                // , prcleg: prcleg
                // , valajuste: fila.at(-2)
                // , edadt: edadt
                // , edadtop: edadtop
                // , edaddev: edaddev
            }
            flujosfamiliar.push(filmeses);
            //if (orden == 1 && i <= 500) {
            //logMatriz(flujosfamiliar, "logFlujosCot.txt");
            //}
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
        if (i <= Math.max(mesesconsumidos, perdif)) {
            tqx = 0;
        } else {
            let tpxa = flujos.find(x => x.mes === edada);
            let tpxs = flujos.find(x => x.mes === edads);
            tqx = tpxa?.tpx - tpxs?.tpx;
            flujogs = tqx;// * mtogs;
            //console.log("|tpxa=" + tpxa?.tpx + "|tpxs=" + tpxs?.tpx + "|tqx=" + tqx + "|mtogs=" + mtogs);
        }
        benfam.flujogs = flujogs;
        benfam.flujosepelio = mtogs * flujogs;
        i = i + 1;
    }
    //const flujosorden = flujosfamiliar.filter(f => f.id === 2).map(f => f.flujo);
    //logMatriz(flujosorden, "logFlujosCot.txt");
    //logMatriz(flujosfamiliar, "logFlujosCot.txt", "J");
    //return "";
    return flujosfamiliar;
}

async function calcularReservaMat(objDatoflujos, tasares) {
    // Preprocesar flujos por mes
    const tasanu = (1 + tasares) ** (1 / 12) - 1;
    //console.log(tasanu);
    const tasmen = 1 / (1 + tasanu);
    //console.log(tasmen);
    const flujoMap = new Map();
    for (const flujo of objDatoflujos) {
        if (!flujoMap.has(flujo.num)) flujoMap.set(flujo.num, []);
        flujoMap.get(flujo.num).push(flujo);
    }
    //console.log(flujoMap);
    let sumpentotal = 0, sumgstotal = 0, sumFlujoTotalRenta = 0, sumFlujoTotaldescontado = 0;
    const DatasumaFlujos = [];
    for (let i = 0; i <= 1331; i++) {
        const flujos = flujoMap.get(i) || [];
        let mescalculado = flujos.length > 0 ? flujos[0].mescal : null;
        //obtiene el flujo de sepelio de un mes antes
        const flujosant = flujoMap.get(i - 1) || [];
        let flusepant = flujosant.length > 0 ? flujosant[0].flujosepelio : null;
        //console.log(mescalculado);
        const sumFlujo = flujos.reduce((acc, x) => acc + x.flujopension, 0);
        const sumFlujoGS = flusepant;//flujos.reduce((acc, x) => acc + x.flujosepelio, 0);

        //OBTIENE LA RESERVA MATEMATICA
        sumFlujoTotalRenta = sumFlujo + sumFlujoGS
        sumFlujoTotaldescontado = sumFlujoTotalRenta * Math.pow(tasmen, mescalculado);
        DatasumaFlujos.push({
            mes: i,
            mescal: mescalculado,
            flujossumtot: sumFlujo,
            flujosgssumtot: sumFlujoGS,
            sumFlujoTotalRenta: sumFlujoTotalRenta,
            sumFlujoTotaldescontado: sumFlujoTotaldescontado || 0
        });
    }
    logMatriz(DatasumaFlujos, "DatasumaFlujos.txt", "T");
    const reservafinal = DatasumaFlujos.reduce((acc, x) => acc + x.sumFlujoTotaldescontado, 0);
    return reservafinal;

    //logMatriz(DatasumaFlujos, "DatasumaFlujos.txt", "T");
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

async function edadtopemes(fecdev, fecnac, fecfal, parentesco, invalido, estudiante, edadtope) {
    const fecdevt = new Date(fecdev);
    const fecnact = new Date(fecnac);
    const fecfalt = new Date(fecfal);
    const mesfecdev = fecdevt.getMonth() + 1; // getMonth() devuelve 0 (enero) a 11 (diciembre)
    const aniofecdev = fecdevt.getFullYear();
    const mesfecnact = fecnact.getMonth() + 1; // getMonth() devuelve 0 (enero) a 11 (diciembre)
    const aniofecnact = fecnact.getFullYear();
    const mesfecfalt = fecfalt.getMonth() + 1; // getMonth() devuelve 0 (enero) a 11 (diciembre)
    const aniofecfalt = fecfalt.getFullYear();
    const edadlegal = 18;
    const edadbenef = 28;
    let edaddv = 0;

    if (fecfal == "") {
        if (parentesco == 6 && invalido == 1) {
            if (estudiante == "N") {
                edaddv = edadlegal * 12;
            } else {
                edaddv = edadtope * 12;
            }
        } else {
            edaddv = edadtope * 12;
        }
    } else {
        edaddv = (aniofecfalt * 12 + mesfecfalt) - (aniofecnact * 12 + mesfecnact);
    }

    return edaddv;
}

async function edadmesdev(fecdev, fecnac) {
    const fecdevt = parseFecha(fecdev);
    const fecnact = parseFecha(fecnac);
    const mesfecdev = fecdevt.getMonth() + 1; // getMonth() devuelve 0 (enero) a 11 (diciembre)
    const aniofecdev = fecdevt.getFullYear();
    const mesfecnact = fecnact.getMonth() + 1; // getMonth() devuelve 0 (enero) a 11 (diciembre)
    const aniofecnact = fecnact.getFullYear();

    //console.log("| aniofecdev=" + aniofecdev + "| mesfecdev=" + mesfecdev + "| aniofecnact=" + aniofecnact + "| mesfecnact=" + mesfecnact)
    let edaddv = (aniofecdev * 12 + mesfecdev) - (aniofecnact * 12 + mesfecnact);
    return edaddv;
}

async function MortalidadPer(sex, inv, fecnac, tm) {
    /* console.log('sex', sex);
    console.log('inv', inv);
    console.log('fecnac', fecnac); */
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
        //logMatriz(tmortalLX,"tmortalLX_flu");
    }
    //console.log(tmortalLX);
    //console.log(tmortal);
    return tmortalLX;
}

async function mesdevengado(fecdev, feccal) {
    const fecdevt = parseFecha(fecdev);
    const feccott = parseFecha(feccal);
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

function logMatriz(datos, nombre, tipo) {

    let contenido = [];
    if (tipo == "J") {
        contenido = JSON.stringify(datos, null, 2);
    } else {
        contenido = datos.map(fila => Array.isArray(fila) ? fila.join(',') : JSON.stringify(fila)).join('\n');
    }


    // Formatea cada fila como texto (por ejemplo, separando por comas si es un array)
    //const contenido = datos.map(fila => Array.isArray(fila) ? fila.join(',') : JSON.stringify(fila)).join('\n');

    // Escribe en archivo log.txt
    fs.writeFileSync(nombre, contenido, (err) => {
        if (err) {
            console.error('Error escribiendo archivo:', err);
        } else {
            console.log('Archivo log.txt creado exitosamente');
        }
    });
}

function parseFecha(fechaStr) {
    if (!fechaStr) return null;
    const [anio, mes, dia] = fechaStr.split("-").map(Number);
    return new Date(anio, mes - 1, dia); // mes - 1 porque getMonth() es base 0
}