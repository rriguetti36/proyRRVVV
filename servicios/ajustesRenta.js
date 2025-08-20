async function MonedaAjustada(fechadev, fechacal, valajus) {

    //const tFecdev = new Date(fechadev);
    //const tFecCal = new Date(fechacal);
    //console.log("fechadev", fechadev); // Imprimir YYYY-MM-DD
    //console.log("tFecdev", tFecdev.toISOString().split("T")[0]); // Imprimir YYYY-MM-DD
    //console.log("fechacal", fechacal.toISOString().split("T")[0]); // Imprimir YYYY-MM-DD

    const ajusteanual = valajus / 100;
    const ajustemensual = (1 + ajusteanual) ** (1 / 12) - 1;
    const mesprimerajus = 3 - (fechadev.getMonth() % 3);
    const mesfecdev = fechadev.getMonth() + 1;
    const aniofecdev = fechadev.getFullYear();
    const fecajuspripag = new Date(aniofecdev, mesfecdev + mesprimerajus, 0);
    let fechaInicio = fechadev;
    let fechaFin = fechacal;
    let ajusteacummon = 0;
    let mesant = 0;

    let dataMonedaAjus = [];
    
    //console.log("fechaInicio", fechaInicio.toISOString().split("T")[0]); // Imprimir YYYY-MM-DD
    //console.log("fechaFin", fechaFin.toISOString().split("T")[0]); // Imprimir YYYY-MM-DD
    while (fechaInicio <= fechaFin) {
        //
        //console.log("fechaInicio", fechaInicio.toISOString().split("T")[0]); // Imprimir YYYY-MM-DD
        let mesResi = fechaInicio.getMonth() + 1;
        //console.log("mesResi", mesResi);
        const residuo = (mesResi - 1) % 3
        //console.log("residuo", residuo);
        let mesajuste = mesant;
        //console.log("mesajuste", mesajuste);
        if (residuo == 0) {
            if (fechaInicio <= fecajuspripag) {
                mesajuste = mesprimerajus;
            }
            else {
                mesajuste = mesajuste + 3;
            }
        }
        //console.log("mesajuste", mesajuste);
        ajusteacummon = Math.pow((1 + ajustemensual), mesajuste);
        mesant = mesajuste;
        const dataFactor = {
            mesdev: new Date(fechaInicio),
            factor: ajusteacummon
        }
        //console.log(dataFactor);
        dataMonedaAjus.push(dataFactor);

        fechaInicio.setMonth(fechaInicio.getMonth() + 1);
    }
    //console.log(dataMonedaAjus);
    return dataMonedaAjus;

}

async function MonedaIndexada(fechadev, fechacal, datosIPC) {
    const fechap = fechadev.getMonth() + 1;
    let fechaInicio = fechadev;
    let fechaFin = fechacal;
    const dataMonedaIPC = [];
    let valant = 0;

    while (fechaInicio <= fechaFin) {
        let resValini = datosIPC.find(item => new Date(item.d_periodo).getTime() === fechap.getTime());
        let resValfin = datosIPC.find(item => new Date(item.d_periodo).getTime() === fechaInicio.getTime());

        const ipcValorini = parseFloat(resValini?.n_valor);
        const ipcValorSig = parseFloat(resValfin?.n_valor ?? ipcValorFinDefault);

        const residuo = fechap % 3;
        let factorIpc = residuo === 0 ? ipcValorSig / ipcValorini : valant;
        valant = factorIpc;
        
        const dataFactor = {
            mesdev: new Date(fechaInicio),
            factor: factorIpc
        }
        dataMonedaIPC.push(dataFactor);

        fechaInicio.setMonth(fechaInicio.getMonth() + 1);
    }

    return dataMonedaIPC;
}

module.exports = { MonedaAjustada };