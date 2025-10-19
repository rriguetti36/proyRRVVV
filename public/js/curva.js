
// inicializa el módulo (llama desde tasas.js o directamente)
function initCurva(root = document) {
    const selPeriodos = root.querySelector('#selPeriodos');
    const btnCargarPeriodo = root.querySelector('#btnCargarPeriodo');
    const btnUpload = root.querySelector('#btnUpload');
    const archivoInput = root.querySelector('#archivoExcel');
    const fechaCreacion = root.querySelector('#fechaCreacion');
    const chkReplace = root.querySelector('#chkReplace');
    const tbody = root.querySelector('#tbodyCurva');

    // 1) Función para cargar periodos en select
    async function loadPeriodos() {
        try {
            const res = await fetch('/cotizador/api/periodoscurva');
            const data = await res.json();
            selPeriodos.innerHTML = '';
            data.forEach(p => {
                // p.periodo assumed to be ISO date string yyyy-mm-dd or JS date string
                const v = (p.periodo instanceof Object && p.periodo.v_periodo) ? p.periodo.v_periodo : p.periodo;
                // normalize to yyyy-mm-dd
                const val = new Date(v).toISOString().slice(0, 10);
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = val;
                selPeriodos.appendChild(opt);
            });
        } catch (err) {
            console.error('Error cargando periodos:', err);
        }
    }

    // 2) Función para pedir datos por fecha y pintar la tabla (pivot)
    async function cargarDatosPeriodo(fecha) {
        try {
            const res = await fetch(`/cotizador/api/filtrarcurva?fecha=${encodeURIComponent(fecha)}`);
            const data = await res.json();
            renderTabla(data);
        } catch (err) {
            console.error('Error cargando datos del periodo:', err);
        }
    }

    function renderTabla(rows) {
        tbody.innerHTML = '';
        if (!rows || rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-muted">No hay datos para este periodo</td></tr>';
            return;
        }
        rows.forEach(r => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
          <td>${r.mes}</td>
          <td>${r.Solesi || 0}</td>
          <td>${r.Solesa || 0}</td>
          <td>${r.Dolaresi || 0}</td>
          <td>${r.Dolaresa || 0}</td>
        `;
            tbody.appendChild(tr);
        });
    }

    // upload handler
    btnUpload.addEventListener('click', async () => {
        if (!archivoInput.files.length) {
            //alert('Selecciona un archivo Excel');
            Swal.fire("❌", "Selecciona un archivo Excel.", "Alerta");
            return;
        }

        const file = archivoInput.files[0];
        const form = new FormData();
        form.append('archivoExcel', file);

        // Opcionalmente si tienes controles adicionales:
        const fecha = fechaCreacion ? fechaCreacion.value : new Date().toISOString().slice(0, 10);
        const reemplazar = chkReplace && chkReplace.checked ? '1' : '0';
        form.append('fecha', fecha);
        form.append('reemplazar', reemplazar);

        try {
            btnUpload.disabled = true;
            btnUpload.textContent = 'Subiendo...';

            const res = await fetch('/cotizador/api/uploadcurva', {
                method: 'POST',
                body: form
            });

            const json = await res.json();

            if (json.ok) {
                // 🔹 Si el backend devuelve un mensaje, mostrarlo
                //alert(json.message || 'Archivo procesado correctamente ✅');
                Swal.fire("✅", json.message || "Archivo procesado correctamente ✅", "success");

                // 🔹 Si el backend devuelve el periodo o fecha procesada
                if (json.result && json.result.periodo && selPeriodos) {
                    selPeriodos.value = json.result.periodo;
                    if (typeof cargarDatosPeriodo === 'function') {
                        await cargarDatosPeriodo(json.result.periodo);
                    }
                }

                // 🔹 Refresca listado de periodos (si tienes función)
                if (typeof loadPeriodos === 'function') {
                    await loadPeriodos();
                }
            } else {
                //alert(json.error || 'Error procesando archivo ❌');
                Swal.fire("❌", json.error || "Error procesando archivo.", "Alerta");
            }
        } catch (err) {
            console.error('Error upload:', err);
            //alert('Error subiendo archivo ⚠️');
            Swal.fire("❌", err || "Error subiendo archivo ⚠️", "Alerta");
        } finally {
            btnUpload.disabled = false;
            btnUpload.textContent = 'Subir y Guardar';
        }
    });

    // cargar periodo seleccionado (doble click o botón)
    // btnCargarPeriodo.addEventListener('click', () => {
    //     const v = selPeriodos.value;
    //     if (!v) return alert('Selecciona un periodo');
    //     cargarDatosPeriodo(v);
    // });

    selPeriodos.addEventListener('dblclick', () => {
        const v = selPeriodos.value;
        if (!v) return;
        cargarDatosPeriodo(v);
    });

    // Inicial
    loadPeriodos();
    // auto seleccionar primer periodo si existe
    if (selPeriodos.options.length > 0) {
        selPeriodos.selectedIndex = 0;
        cargarDatosPeriodo(selPeriodos.value);
    }
}

// // Si este EJS se inyecta dinámicamente, asegúrate de llamar initCurvaCuponCero()
// document.addEventListener('DOMContentLoaded', () => {
//     if (typeof initCurvaCuponCero === 'function') initCurvaCuponCero();
// });