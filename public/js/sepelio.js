function initSepelio(root) {
    root = root || document;
    const select = root.querySelector('#selectFechas');
    const n_valor = root.querySelector('#n_valor');
    const btnAgregar = root.querySelector('#btnAgregar');
    const btnGuardar = root.querySelector('#btnGuardar');

    async function cargarDatos(fecha) {
        try {
            const res = await fetch(`/cotizador/api/obtenerperiodosgs?fecha=${fecha}`);
            const data = await res.json();
            n_valor.value = data?.n_valor ?? '';
        } catch (err) {
            console.error(err);
        }
    }

    // Al seleccionar una fecha -> traer valor
    select.addEventListener('change', async (e) => {
        const fecha = e.target.value;
        cargarDatos(fecha);
    });

    // Agregar tipo cambio -> insertar opción con hoy en index 0 y seleccionarla
    btnAgregar.addEventListener('click', (e) => {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = '01';//String(hoy.getDate()).padStart(2, '0');
        const hoyIso = `${yyyy}-${mm}-${dd}`;

        // crear option y poner al inicio
        const opt = document.createElement('option');
        opt.value = hoyIso;
        opt.textContent = hoyIso;

        // insertar al inicio
        if (select.firstChild) select.insertBefore(opt, select.firstChild);
        else select.appendChild(opt);

        select.value = hoyIso;
        n_valor.value = '';
    });

    // Guardar: envía un solo item (fecha actual seleccionada) al endpoint
    btnGuardar.addEventListener('click', async (e) => {
        const fecha = select.value;
        const valor = n_valor.value;
        if (!fecha) return Swal.fire("❌", "Selecciona o agrega una fecha antes de guardar.", "Alerta");

        try {
            const res = await fetch('/cotizador/api/guardargs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha, n_valor: valor })
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
    cargarDatos(select.value);
}