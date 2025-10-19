function initPromedio(root) {
    root = root || document;
    const selPeriodo = root.querySelector('#v_periodo');
    const selMoneda = root.querySelector('#id_moneda');
    const selPrestacion = root.querySelector('#id_prestacion');
    const txtValor = root.querySelector('#n_valor');
    const btnGuardar = root.querySelector('#btnGuardar');
    const btnNuevo = root.querySelector('#btnNuevoPer');

    // Función auxiliar: obtener valor existente
    async function cargarValor() {
        const v_periodo = selPeriodo.value;
        const id_moneda = selMoneda.value;
        const id_prestacion = selPrestacion.value;

        if (!v_periodo || !id_moneda || !id_prestacion) return;

        try {
            const res = await fetch(`/cotizador/api/valorpromedio?v_periodo=${v_periodo}&id_moneda=${id_moneda}&id_prestacion=${id_prestacion}`);
            const data = await res.json();
            txtValor.value = data?.n_valor || '0';
        } catch (err) {
            console.error('Error al cargar valor:', err);
        }
    }

    // Cargar valor cuando cambien los filtros
    [selPeriodo, selMoneda, selPrestacion].forEach(sel => {
        sel.addEventListener('change', cargarValor);
    });

    // Botón Nuevo → limpia campos
    btnNuevo.addEventListener('click', () => {
        const opciones = selPeriodo.querySelectorAll('option');
        if (opciones.length === 0) {
            Swal.fire('⚠️', 'No hay periodos registrados para generar el siguiente.', 'warning');
            return;
        }
        //selPeriodo.value = '';
        // Tomamos la primera opción (más reciente)
        const primeraOpcion = opciones[0].value;

        // Interpretar la fecha como local (evita que JS reste un día por zona horaria)
        const [anio, mes, dia] = primeraOpcion.split('-').map(Number);
        const primeraFecha = new Date(anio, mes - 1, dia);

        if (isNaN(primeraFecha)) {
            Swal.fire('❌', 'El primer periodo no es una fecha válida.', 'error');
            return;
        }

        // Sumar 1 mes
        primeraFecha.setMonth(primeraFecha.getMonth() + 1);

        // Fijar siempre el día 1
        primeraFecha.setDate(1);

        // Formatear YYYY-MM-DD
        const nuevaFechaStr = primeraFecha.toISOString().split('T')[0];

        // Evita duplicados
        const existe = Array.from(opciones).some(opt => opt.value === nuevaFechaStr);
        if (!existe) {
            const nuevaOption = document.createElement('option');
            nuevaOption.value = nuevaFechaStr;
            nuevaOption.textContent = nuevaFechaStr;

            // Insertar al inicio para mantener orden descendente
            selPeriodo.insertBefore(nuevaOption, opciones[0]);
        }

        // Seleccionar el nuevo periodo
        selPeriodo.value = nuevaFechaStr;
        selMoneda.value = '';
        selPrestacion.value = '';
        txtValor.value = '';
        txtValor.focus();

        Swal.fire('🗓️', `Nuevo periodo generado: ${nuevaFechaStr}`, 'info');
    });

    // Botón Guardar
    btnGuardar.addEventListener('click', async () => {
        const v_periodo = selPeriodo.value;
        const id_moneda = selMoneda.value;
        const id_prestacion = selPrestacion.value;
        const n_valor = txtValor.value;

        if (!v_periodo || !id_moneda || !id_prestacion || !n_valor) {
            Swal.fire('⚠️', 'Debe completar todos los campos.', 'warning');
            return;
        }

        try {
            const res = await fetch('/cotizador/api/guardarpromedio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ v_periodo, id_moneda, id_prestacion, n_valor })
            });

            const data = await res.json();
            if (data.success) {
                Swal.fire('✅', data.message, 'success');
            } else {
                Swal.fire('❌', data.error || 'Error al guardar', 'error');
            }
        } catch (error) {
            console.error('Error al guardar valor:', error);
            Swal.fire('❌', 'Error inesperado al guardar', 'error');
        }
    });
}

// Inicializa el módulo cuando se cargue
//document.addEventListener('DOMContentLoaded', iniPromedio);