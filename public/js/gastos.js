function initGastos(root) {
    root = root || document;

    const selMoneda = root.querySelector('#selMonedaGasto');
    const selPeriodo = root.querySelector('#selPeriodoGasto');
    const incomsupi = root.querySelector("#n_comsupi");
    const incomsupd = root.querySelector("#n_comsupd");
    const infaclabi = root.querySelector("#n_faclabi");
    const infaclabd = root.querySelector("#n_faclabd");

    const inputs = ['n_gastoadm', 'n_gastoemi', 'n_gastoctrsup', 'n_endeudamiento', 'n_imprenta']
        .reduce((acc, id) => { acc[id] = document.getElementById(id); return acc; }, {})

    async function cargarDatos() {
        const fecha = selPeriodo.value;
        const idmoneda = selMoneda.value;
        const res = await fetch(`/cotizador/api/filtrargastos?fecha=${fecha}&idmoneda=${idmoneda}`);
        const json = await res.json();
        if (json.ok && json.data) {
            for (let k in inputs) inputs[k].value = json.data[k] ?? '';
        } else {
            for (let k in inputs) inputs[k].value = '';
        }
    }

    selMoneda.addEventListener('change', cargarDatos);
    selPeriodo.addEventListener('change', cargarDatos);

    document.getElementById('btnGuardarGasto').addEventListener('click', async () => {
        const body = {
            id_moneda: selMoneda.value,
            f_creacion: selPeriodo.value,
            n_gastoadm: inputs.n_gastoadm.value,
            n_gastoemi: inputs.n_gastoemi.value,
            n_gastoctrsup: inputs.n_gastoctrsup.value,
            n_endeudamiento: inputs.n_endeudamiento.value,
            n_imprenta: inputs.n_imprenta.value
        };
        const res = await fetch('/cotizador/api/guardargastos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const json = await res.json();
        if (json.ok) {
            Swal.fire("✅", json.message || "Archivo procesado correctamente ✅", "success");
        } else {
            //alert(json.error || 'Error procesando archivo ❌');
            Swal.fire("❌", json.error || "Error procesando archivo.", "Alerta");
        }

        //alert(json.message || json.error);
    });

    cargarDatos();

    document.getElementById("btnGuardarGastob").addEventListener("click", async (e) => {
        const data = {
            n_comsupi: incomsupi.value,
            n_comsupd: incomsupd.value,
            n_faclabi: infaclabi.value,
            n_faclabd: infaclabd.value
        };

        const res = await fetch("/cotizador/api/guardargastosb", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        const result = await res.json();
        if (result.ok) {
            Swal.fire("✅", result.message || "Archivo procesado correctamente ✅", "success");
        } else {
            //alert(json.error || 'Error procesando archivo ❌');
            Swal.fire("❌", result.error || "Error procesando archivo.", "Alerta");
        }
        //alert(result.message);
    });
}




