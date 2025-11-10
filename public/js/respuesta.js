document.addEventListener("DOMContentLoaded", () => {
    const modalInfo = document.getElementById("modalInfo");

    // Cuando el modal se abre, llenar datos
    modalInfo.addEventListener("show.bs.modal", (event) => {
        const button = event.relatedTarget;
        const pd = button.getAttribute("data-pd");
        const pg = button.getAttribute("data-pg");
        const cu = button.getAttribute("data-cu");
        const mo = button.getAttribute("data-mo");
        const mn = button.getAttribute("data-mn");
        const pe = button.getAttribute("data-pe");
        const op = button.getAttribute("data-op");

        document.getElementById("modalPd").value = pd;
        document.getElementById("modalPg").value = pg;
        document.getElementById("modalCU").value = cu;
        document.getElementById("modalMO").value = mo;
        document.getElementById("modalMN").value = mn;
        document.getElementById("modalPE").value = pe;
        document.getElementById("modalOP").value = op;

        document.getElementById("modalFecha").value = ""; // limpio el datepicker
    });

    // Guardar valores
    document.getElementById("btnGuardarModal").addEventListener("click", () => {
        const op = document.getElementById("modalOP").value;
        const pd = document.getElementById("modalPd").value;
        const pg = document.getElementById("modalPg").value;
        const fecha = document.getElementById("modalFecha").value;

        if (!fecha) {
            alert("Por favor seleccione una fecha de aceptación.");
            return;
        }

        console.log("Datos enviados:", { op, pd, pg, fecha });

        // Aquí puedes hacer un fetch POST al backend
        aceptarSolicitud(op, pd, pg, fecha);

    });
});

async function aceptarSolicitud(op, pd, pg, fecha) {
    try {
        const res = await fetch("/cotizador/api/aceptasol", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op, pd, pg, fecha })
        });

        if (!res.ok) {
            const errMsg = await res.text();
            throw new Error(errMsg || "Error en la petición");
        }

        const data = await res.json();
        console.log("Respuesta del servidor:", data);

        // Mostrar mensaje o actualizar UI
        //alert(data.mensaje);
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(modalInfo);
        modal.hide();
        
        Swal.fire("✅", data.mensaje, "success");

        

    } catch (error) {
        console.error("Error al aceptar solicitud:", error);
        Swal.fire("❌", error.message, "error");
        //alert("Hubo un error al registrar la aceptación: " + error.message);
    }
}

document.getElementById("xmlFile").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        const xmlString = e.target.result;

        try {
            // Minificar XML (remueve saltos de línea y espacios extra)
            const xmlMin = xmlString.replace(/\s{2,}|\n|\r/g, "");
            document.getElementById("xmlMinificado").value = xmlMin;

            //agregarLog("✅ XML cargado y procesado correctamente.");
        } catch (error) {
            //agregarLog("❌ Error procesando XML: " + error.message);
        }
    };

    reader.readAsText(file);
});

document.getElementById("btnFetch").addEventListener("click", async () => {
    try {
        const xmlContent = document.getElementById("xmlMinificado").value.trim();
        const fileInput = document.getElementById("xmlFile");
        const file = fileInput.files[0];

        if (!xmlContent) {
            alert("⚠️ Pegue un XML antes de procesar.");
            return;
        }

        const res = await fetch("/cotizador/api/cargaresultado", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ xmlMinificado: xmlContent, nombreArchivo: file.name }),
        });

        if (!res.ok) {
            const errMsg = await res.text();
            throw new Error(errMsg || "Error en la petición");
        }

        const data = await res.json(); // ← ahora esperamos JSON
        const idArchivo = data.id;
        const resultados = data.resultados || [];

        const containerId = document.getElementById("numArchivo");
        containerId.innerHTML = `<input type="hidden" id="idarch" value=${idArchivo}>`;


        const container = document.getElementById("tablaResultados");

        if (resultados.length === 0) {
            container.innerHTML = "<p>No se encontraron resultados en el XML.</p>";
            return;
        }

        // Construir tabla dinámica
        let table = `
                        <div class="table-responsive" style="max-height: 500px; overflow-y: auto; overflow-x: auto;">
                            <table class="table table-striped table-bordered table-hover align-middle">
                            <thead class="table-dark" style="position: sticky; top: 0; z-index: 2;">
                                <tr>
                                ${Object.keys(resultados[0])
                .map((key) => `<th>${key}</th>`)
                .join("")}
                                </tr>
                            </thead>
                            <tbody>
                                ${resultados
                .map(
                    (row) =>
                        `<tr>${Object.values(row)
                            .map((val) => `<td>${val}</td>`)
                            .join("")}</tr>`
                )
                .join("")}
                            </tbody>
                            </table>
                        </div>
                        `;

        container.innerHTML = table;

    } catch (err) {
        console.error("❌ Error:", err);
        document.getElementById("tablaResultados").innerHTML =
            "<p style='color:red;'>❌ Error procesando el XML.</p>";
    }
});

document.getElementById("btnBuscar").addEventListener("click", async () => {
    try {
        const idArchivo = document.getElementById("idarch").value;
        const tipo = document.getElementById("codigoSelect").value;
        const body = {
            idArchivo,
            tipo
        };

        const res = await fetch("/cotizador/api/respuestas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            const errMsg = await res.text();
            throw new Error(errMsg || "Error en la petición");
        }

        const data = await res.json(); // ← ahora esperamos JSON
        const resultados = data.resultados || [];
        const container = document.getElementById("tablaResultados");

        if (resultados.length === 0) {
            container.innerHTML = "<p>No se encontraron resultados en el XML.</p>";
            return;
        }

        // Construir tabla dinámica
        let table = `
<div class="table-responsive" style="max-height: 500px; overflow-y: auto; overflow-x: auto;">
    <table class="table table-striped table-bordered table-hover align-middle">
        <thead class="table-dark" style="position: sticky; top: 0; z-index: 2;">
            <tr>
                ${Object.keys(resultados[0])
                .map((key) => `<th>${key}</th>`)
                .join("")}
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            ${resultados
                .map(
                    (row, index) =>
                        `<tr>
                            ${Object.values(row)
                            .map((val) => `<td>${val}</td>`)
                            .join("")}
                            <td>
                                <button class="btn btn-sm btn-primary" 
                                    data-bs-toggle="modal" 
                                    data-bs-target="#modalInfo" 
                                    data-pd="${row.pd}" 
                                    data-pg="${row.pg}" 
                                    data-cu="${row.CUSPP}"
                                    data-op="${row.nroOperacion}"
                                    data-mo="${row.modalidad}"
                                    data-mn="${row.moneda}"
                                    data-pe="${row.pensionAseg}"
                                    data-index="${index}">
                                    Aceptación
                                </button>
                            </td>
                        </tr>`
                )
                .join("")}
        </tbody>
    </table>
</div>
`;

        container.innerHTML = table;

    } catch (err) {
        console.error("❌ Error:", err);
        document.getElementById("tablaResultados").innerHTML =
            "<p style='color:red;'>❌ Error procesando el XML.</p>";
    }
});

const btn = document.getElementById("btnValidar");
const msgError = document.getElementById("msgError");

btn.addEventListener("click", async function () {
    btnGuardarModal.disabled = true;
    // Limpiar mensajes anteriores
    msgError.innerHTML = "";

    // Tomar valores de inputs
    const datos = {
        arc: document.getElementById("idarch").value,
        ope: document.getElementById("modalOP").value,
        mod: document.getElementById("modalMO").value,
        mon: document.getElementById("modalMN").value,
        pd: document.getElementById("modalPd").value,
        pg: document.getElementById("modalPg").value,
        pens: document.getElementById("modalPE").value
    };

    // Mostrar cargando
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando...';
    btn.disabled = true;

    try {
        const response = await fetch("/cotizador/api/validasol", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });

        const data = await response.json();
        const mensaje = data.mensaje;
        if (mensaje === "OK") {
            // Éxito
            btn.innerHTML = '<i class="fas fa-check"></i> Validación Exitosa.';
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-success");
            // Activar botón Guardar
            btnGuardarModal.disabled = false;
        } else {
            // Error → mostrar mensaje con botón cerrar
            btn.innerHTML = '<i class="fas fa-times"></i> Error';
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-danger");

            msgError.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                  ${mensaje}
                  <button type="button" class="btn-close" id="btnCerrarError"></button>
                </div>
            `;

            // Acción del botón cerrar
            document.getElementById("btnCerrarError").addEventListener("click", () => {
                msgError.innerHTML = "";
                btn.innerHTML = "Validar";
                btn.className = "btn btn-primary";
                btn.disabled = false;
            });
        }
    } catch (err) {
        btn.innerHTML = '<i class="fas fa-times"></i> Error conexión';
        btn.classList.remove("btn-primary");
        btn.classList.add("btn-danger");

        msgError.innerHTML = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
              No se pudo conectar con el servidor
              <button type="button" class="btn-close" id="btnCerrarError"></button>
            </div>
        `;

        // Acción del botón cerrar
        document.getElementById("btnCerrarError").addEventListener("click", () => {
            msgError.innerHTML = "";
            btn.innerHTML = "Validar";
            btn.className = "btn btn-primary";
            btn.disabled = false;
        });
    }
});
