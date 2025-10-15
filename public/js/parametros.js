document.addEventListener("DOMContentLoaded", async () => {
    let idSeleccionado = null;
    let idDetSeleccionado = null;
    let tipoBoton = 0;
    const modal = new bootstrap.Modal(document.getElementById("modalParametro"));

    // 🔹 Crear nuevo parámetro (cabecera)
    document.getElementById("btnNuevoParametro").addEventListener("click", () => {
        document.getElementById("v_descripcion").value = "";
        modal.show();
    });


    // 🔹 Cargar cabeceras
    async function cargarCabeceras() {
        const res = await fetch("/cotizador/api/cabecera");
        const data = await res.json();
        const tbody = document.querySelector("#tablaCabecera tbody");
        tbody.innerHTML = "";
        data.forEach(p => {
            const row = `<tr data-id="${p.id}"><td>${p.id}</td><td>${p.nombre}</td></tr>`;
            tbody.insertAdjacentHTML("beforeend", row);
        });
    }
    // 🔹 Guardar cabecera
    document.getElementById("btnGuardarCabecera").addEventListener("click", async () => {
        const nombre = document.getElementById("v_descripcion").value;
        if (!nombre) return alert("Ingrese un nombre");
        const res = await fetch("/cotizador/api/addcabecera", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre })
        });
        const data = await res.json();
        if (data.ok) {
            modal.hide();
            await cargarCabeceras();
            Swal.fire("✅", "Parámetro creado correctamente", "success");
        } else {
            Swal.fire("❌", data.error, "error");
        }
    });

    // 🔹 Guardar detalle
    document.getElementById("btnGuardarDetalle").addEventListener("click", async () => {
        //e.preventDefault();
        if (!idSeleccionado) return alert("Seleccione una cabecera primero");
        const payload = {
            id: idDetSeleccionado,
            idpar: idSeleccionado,
            v_cod: document.getElementById("v_cod").value,
            v_nombre: document.getElementById("v_nombre").value,
            n_valor: document.getElementById("n_valor").value,
            v_codsbs: document.getElementById("v_codsbs").value,
            v_nombrecorto: document.getElementById("v_nombrecorto").value,
        };
        let url;
        let method;
        if(tipoBoton==0){
            method = "POST"
            url="/cotizador/api/adddetalle"
        }
        else{
            method = "PUT"
            url=`/cotizador/api/upddetalle/${idDetSeleccionado}`
        }
        const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.ok) {
            Swal.fire("✅", "Detalle guardado correctamente", "success");
            document.querySelector(`#tablaCabecera tr[data-id='${payload.idpar}']`).click();
        }
    });

    // Cargar detalles
    document.querySelectorAll("#tablaCabecera tbody tr").forEach(tr => {
        tr.addEventListener("click", () => cargarDetalles(tr.dataset.id));
    });

    function cargarDetalles(id) {
        idSeleccionado = id;
        tipoBoton = 0;
        fetch(`/cotizador/api/detalle/${id}`)
            .then(res => res.json())
            .then(data => {
                const tbody = document.querySelector("#tablaDetalle tbody");
                tbody.innerHTML = "";
                data.forEach(d => {
                    tbody.insertAdjacentHTML("beforeend", `
                                                        <tr data-id="${d.id}">
                                                            <td>${d.v_cod || ''}</td>
                                                            <td>${d.v_nombre || ''}</td>
                                                            <td>${d.n_valor || ''}</td>
                                                            <td>${d.v_codsbs || ''}</td>
                                                            <td>${d.v_nombrecorto || ''}</td>
                                                            <td>
                                                            <button class="btn btn-warning btn-sm btnEdit">✎</button>
                                                            <button class="btn btn-danger btn-sm btnDel">🗑</button>
                                                            </td>
                                                        </tr>
                                                        `);
                });
                agregarEventosDetalle();
                LimpiaDetalle();
            });
    }

    function LimpiaDetalle() {
        document.getElementById("v_cod").value = "";
        document.getElementById("v_nombre").value = "";
        document.getElementById("n_valor").value = "";
        document.getElementById("v_codsbs").value = "";
        document.getElementById("v_nombrecorto").value = "";
    }
    function agregarEventosDetalle() {
        document.querySelectorAll(".btnEdit").forEach(btn => {
            btn.addEventListener("click", e => {
                tipoBoton = 1;
                
                const tr = e.target.closest("tr");
                idDetSeleccionado = tr.dataset.id;
                document.getElementById("idDetalle").value = tr.dataset.id;
                document.getElementById("v_cod").value = tr.children[0].textContent;
                document.getElementById("v_nombre").value = tr.children[1].textContent;
                document.getElementById("n_valor").value = tr.children[2].textContent;
                document.getElementById("v_codsbs").value = tr.children[3].textContent;
                document.getElementById("v_nombrecorto").value = tr.children[4].textContent;
            });
        });

        document.querySelectorAll(".btnDel").forEach(btn => {
            btn.addEventListener("click", e => {
                const id = e.target.closest("tr").dataset.id;
                if (confirm("¿Eliminar este registro?")) {
                    fetch(`/cotizador/api/deldetalle/${id}`, { method: "DELETE" })
                        .then(res => res.json())
                        .then(() => cargarDetalles(idSeleccionado));
                }
            });
        });
    }

});