function initIpc(root) {
    root = root || document;
    const periodoSelect = root.querySelector('#periodoSelect');
    const n_valor = root.querySelector('#n_valor');
    const n_porcent = root.querySelector('#n_porcent');

    async function cargarDatos(periodo) {
        const res = await fetch(`/cotizador/api/obtenerperiodosipc?periodo=${periodo}`);
        const data = await res.json();
        n_valor.value = data?.n_valor ?? '';
        n_porcent.value = data?.n_porcent ?? '';
    }

    periodoSelect.addEventListener('change', () => {
        const periodo = periodoSelect.value;
        if (periodo) cargarDatos(periodo);
    });

    document.getElementById('btnGuardar').addEventListener('click', async () => {
        const periodo = periodoSelect.value;
        const valor = n_valor.value;
        const porcent = n_porcent.value;

        const res = await fetch('/cotizador/api/guardaripc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ periodo, valor, porcent })
        });

        const data = await res.json();
        if (data.ok) {
            Swal.fire("✅", "Archivo procesado correctamente ✅", "success");
            const periodo = periodoSelect.value;
            if (periodo) cargarDatos(periodo);
        } else {
            //alert(json.error || 'Error procesando archivo ❌');
            Swal.fire("❌", data.error || "Error procesando archivo.", "Alerta");
        }
        //alert(data.success ? 'Guardado correctamente' : 'Error al guardar');
        //if (data.ok) location.reload();
    });

    document.getElementById('btnAgregarPeriodo').addEventListener('click', () => {
        const partes = periodoSelect.value.split('-'); // yyyy-mm-dd
        const fechaActual = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
        fechaActual.setUTCMonth(fechaActual.getUTCMonth() + 1);
        const nuevaFecha = fechaActual.toISOString().split('T')[0];
        const option = document.createElement('option');
        option.value = nuevaFecha;
        option.textContent = nuevaFecha; //new Date(nuevaFecha).toLocaleDateString();
        periodoSelect.insertBefore(option, periodoSelect.firstChild);
        periodoSelect.value = nuevaFecha;
        n_valor.value = '';
        n_porcent.value = '';
        Swal.fire('🗓️', `Nuevo periodo generado desde el : ${nuevaFecha}`, 'info');
    });

    // carga inicial
    if (periodoSelect.value) cargarDatos(periodoSelect.value);
}