document.addEventListener("DOMContentLoaded", () => {
    cargarTabla();

    document.getElementById("btnRecargar").addEventListener("click", () => {
        cargarTabla();
    });

    document.getElementById("btnBuscar").addEventListener("click", () => {

        cargarTablaBuscar();
    });

});

function formatearFecha(fechaISO) {
    if (!fechaISO) return "-";
    try {
        return new Date(fechaISO).toISOString().split("T")[0]; // "2025-09-08"
    } catch {
        return fechaISO;
    }
}

async function cargarTabla() {
    const tbody = document.getElementById("tablaBody");
    tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                </td>
            </tr>
        `;

    try {
        const resp = await fetch("/cotizador/api/solicitudes");
        const data = await resp.json();

        if (!data || !data.data || data.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">No hay registros disponibles</td></tr>`;
            return;
        }

        tbody.innerHTML = ""; // limpiar tabla
        data.data.forEach((item) => {
            let color = "red";
            if (item.id_estado === 1) color = "green";
            if (item.id_estado === 2) color = "orange";

            const fila = document.createElement("tr");
            fila.innerHTML = `
                    <td class="text-center">
                        <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${color};"></span>
                    </td>
                    <td>${item.id}</td>
                    <td>${item.v_descripcion}</td>
                    <td>${formatearFecha(item.fec_envio)}</td>
                    <td>${formatearFecha(item.fec_cierre)}</td>
                    <td>${item.inisol || "-"}</td>
                    <td>${item.finsol || "-"}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-success me-1" onclick="generaexportaxls('${item.id}')" title="Exportar XLS">
                            <i class="fas fa-file-excel"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="generadescargaxml('${item.id}')" title="Descargar XML">
                            <i class="fas fa-file-code"></i>
                        </button>
                    </td>
                `;
            tbody.appendChild(fila);
        });
    } catch (error) {
        console.error("Error cargando tabla:", error);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Error al cargar los datos</td></tr>`;
    }
}

async function cargarTablaBuscar() {
    const fechaSeleccionada = document.getElementById("selectFechas").value;
    if (!fechaSeleccionada) {
        alert("Seleccione una fecha de cierre");
        return;
    }

    const tbody = document.getElementById("tablaBody");
    tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                </td>
            </tr>
        `;

    try {
        const resp = await fetch(`/cotizador/api/solicitudesbuscar?fechaCierre=${encodeURIComponent(fechaSeleccionada)}`);
        const data = await resp.json();

        if (!data || !data.data || data.data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-3">No hay registros disponibles</td></tr>`;
            return;
        }

        tbody.innerHTML = ""; // limpiar tabla
        data.data.forEach((item) => {
            let color = "red";
            if (item.id_estado === 1) color = "green";
            if (item.id_estado === 2) color = "orange";

            const fila = document.createElement("tr");
            fila.innerHTML = `
                    <td class="text-center">
                        <span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${color};"></span>
                    </td>
                    <td>${item.id}</td>
                    <td>${item.v_descripcion}</td>
                    <td>${formatearFecha(item.fec_envio)}</td>
                    <td>${formatearFecha(item.fec_cierre)}</td>
                    <td>${item.inisol || "-"}</td>
                    <td>${item.finsol || "-"}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-success me-1" onclick="generaexportaxls('${item.id}')" title="Exportar XLS">
                            <i class="fas fa-file-excel"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="generadescargaxml('${item.id}')" title="Descargar XML">
                            <i class="fas fa-file-code"></i>
                        </button>
                    </td>
                `;
            tbody.appendChild(fila);
        });
    } catch (error) {
        console.error("Error cargando tabla:", error);
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-3">Error al cargar los datos</td></tr>`;
    }
}

async function generadescargaxml(id) {
    try {
        // 1. Obtener token
        const authResp = await fetch("http://localhost:3000/auth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: "cliente1", clientSecret: "secret123" })
        });
        const authData = await authResp.json();
        if (!authData.token) {
            alert("❌ No se pudo obtener token");
            return;
        }

        // 2. Generar XML
        const respuesta = await fetch("http://localhost:3000/rutinarv/generar-xml", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authData.token}`
            },
            body: JSON.stringify({ id_archivo: id })
        });

        if (!respuesta.ok) {
            const err = await respuesta.json();
            alert("❌ Error: " + err.mensaje);
            return;
        }

        // 3. Descargar archivo
        const blob = await respuesta.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `cargaCot_${new Date().toISOString().slice(0, 10)}.xml`;
        cargarTabla();
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("❌ Error en fetch:", error);
        alert("Error generando XML");
    }
}

function generaexportaxls(id) {
    alert(`📤 Exportar XLS para archivo ${id} (a implementar)`);
}