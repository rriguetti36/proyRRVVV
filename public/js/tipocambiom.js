function initTipocambiom(root) {
    root = root || document;
    const select = root.querySelector('#selectFechas');
    const seltiposbs = root.querySelector('#selTipoSbs');
    const selmonedas = root.querySelector('#selMoneda');
    const n_valor = root.querySelector('#n_valor');
    const btnAgregar = root.querySelector('#btnAgregar');
    const btnGuardar = root.querySelector('#btnGuardar');

    async function cargarDatos(fecha, moneda, tipo) {
        try {
            const res = await fetch(`/cotizador/api/obtenerperiodostcm?fecha=${fecha}&id_moneda=${moneda}&id_tipcam=${tipo}`);
            const data = await res.json();
            n_valor.value = data?.n_valor ?? '';
        } catch (err) {
            console.error(err);
        }
    }

    // Al seleccionar una fecha -> traer valor
    select.addEventListener('change', async (e) => {
        const fecha = e.target.value;
        const moneda = selmonedas.value;
        const tipo = seltiposbs.value;
        cargarDatos(fecha, moneda, tipo);
    });

    selmonedas.addEventListener('change', async (e) => {
        const fecha = select.value;
        const moneda = e.target.value;
        const tipo = seltiposbs.value;
        cargarDatos(fecha, moneda, tipo);
    });

    seltiposbs.addEventListener('change', async (e) => {
        const fecha = select.value;
        const moneda = selmonedas.value;
        const tipo = e.target.value;
        cargarDatos(fecha, moneda, tipo);
    });

    // Agregar tipo cambio -> insertar opción con hoy en index 0 y seleccionarla
    btnAgregar.addEventListener('click', (e) => {
        const partes = select.value.split('-'); // yyyy-mm-dd
        const fechaActual = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
        fechaActual.setUTCMonth(fechaActual.getUTCMonth() + 1);
        const nuevaFecha = fechaActual.toISOString().split('T')[0];
        const option = document.createElement('option');
        option.value = nuevaFecha;
        option.textContent = nuevaFecha; //new Date(nuevaFecha).toLocaleDateString();
        select.insertBefore(option, select.firstChild);
        select.value = nuevaFecha;
        n_valor.value = '';
        Swal.fire('🗓️', `Nuevo periodo generado desde el : ${nuevaFecha}`, 'info');
    });

    // Guardar: envía un solo item (fecha actual seleccionada) al endpoint
    btnGuardar.addEventListener('click', async (e) => {
        const fecha = select.value;
        const tipo = seltiposbs.value;
        const moneda = selmonedas.value;
        const valor = n_valor.value;
        if (!fecha) return Swal.fire("❌", "Selecciona o agrega una fecha antes de guardar.", "Alerta");

        try {
            const res = await fetch('/cotizador/api/guardartcm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha, id_moneda: moneda, n_valor: valor, id_tipcam: tipo })
            });
            const data = await res.json();
            if (data.ok) {
                Swal.fire("✅", "Archivo procesado correctamente ✅", "success");
            } else {
                Swal.fire("❌", data.error || "Error procesando archivo.", "Alerta");
            }
        } catch (err) {
            console.error(err);
            Swal.fire("❌", err || "Error procesando archivo.", "Alerta");
        }
    });
    cargarDatos(select.value, selmonedas.value, seltiposbs.value);
}