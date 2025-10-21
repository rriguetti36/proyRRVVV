function initConfiguracionMatriz() {
    const tabla = document.getElementById('tablaMatriz');
    const modal = new bootstrap.Modal(document.getElementById('modalMontos'));

    // Click en checkbox: actualizar campo
    // Doble clic: abrir modal
    tabla.addEventListener('dblclick', (e) => {
        const fila = e.target.closest('tr');
        if (!fila) return;

        document.getElementById('editId').value = fila.dataset.id;
        document.getElementById('editDesde').value = fila.children[2].textContent.trim();
        document.getElementById('editHasta').value = fila.children[3].textContent.trim();
        modal.show();
    });

    // Guardar cambios montos
    document.getElementById('btnGuardarMontos').addEventListener('click', async () => {
        const id = document.getElementById('editId').value;
        const desde = document.getElementById('editDesde').value;
        const hasta = document.getElementById('editHasta').value;

        await fetch('/cotizador/api/actualizarmontoscfm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, desde, hasta })
        });

        location.reload();
    });

    document.querySelectorAll('.chkCampo').forEach(chk => {
        chk.addEventListener('change', async e => {
            const tr = e.target.closest('tr');
            const id = tr.dataset.id;
            const campo = e.target.dataset.campo;
            const valor = e.target.checked ? 1 : 0;

            // Si se marcó un check individual, desmarcar "Desactivar"
            if (valor === 1) tr.querySelector('.chkDesactivar').checked = false;

            await fetch('/cotizador/api/actualizarcfm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, campo, valor })
            });
        });
    });

    document.querySelectorAll('.chkDesactivar').forEach(chk => {
        chk.addEventListener('change', async e => {
            const tr = e.target.closest('tr');
            const id = tr.dataset.id;
            const desactivar = e.target.checked ? 1 : 0;

            // Cambiar todos los checks de la fila
            tr.querySelectorAll('.chkCampo').forEach(async campoChk => {
                campoChk.checked = desactivar ? false : campoChk.checked;
                const campo = campoChk.dataset.campo;
                const valor = campoChk.checked ? 1 : 0;

                await fetch('/cotizador/api/actualizarcfm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, campo, valor })
                });
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', initConfiguracionMatriz);