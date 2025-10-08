// Navegación del wizard
document.querySelectorAll(".nextBtn").forEach(btn => {
    btn.addEventListener("click", function () {
        let currentStep = this.closest(".wizard-step");
        let nextStep = currentStep.nextElementSibling;
        if (nextStep) {
            currentStep.classList.add("d-none");
            nextStep.classList.remove("d-none");
        }
    });
});

document.querySelectorAll(".prevBtn").forEach(btn => {
    btn.addEventListener("click", function () {
        let currentStep = this.closest(".wizard-step");
        let prevStep = currentStep.previousElementSibling;
        if (prevStep) {
            currentStep.classList.add("d-none");
            prevStep.classList.remove("d-none");
        }
    });
});

let beneficiarios = [];
let countBeneficiario = 1;
let modalidades = [];
let countModalidad = 0;

let beneficiariosData = [];
let modalidadesData = [];
let resultadosModalidadData = [];

// Guardar Beneficiarios
document.getElementById("btnGuardarBeneficiario").addEventListener("click", () => {
    countBeneficiario++;
    const data = {
        IdBeneficiario: countBeneficiario,
        Parentesco: parseFloat(document.getElementById("benParentesco").value),
        Genero: parseFloat(document.getElementById("benSexo").value),
        FechaNacimiento: document.getElementById("benFechaNac").value,
        TipoInvalidez: parseFloat(document.getElementById("benInvalidez").value)
    };
    //muestra las descripciones
    let selectPar = document.getElementById("benParentesco");
    data.DescriTipoPar = selectPar.options[selectPar.selectedIndex].text;
    let selectSex = document.getElementById("benSexo");
    data.DescriTipoSex = selectSex.options[selectSex.selectedIndex].text;
    let selectInv = document.getElementById("benInvalidez");
    data.DescriTipoInv = selectInv.options[selectInv.selectedIndex].text;
    beneficiarios.push(data);

    if (!data.Parentesco || !data.Genero || !data.FechaNacimiento || !data.TipoInvalidez) {
        alert("Complete los campos obligatorios.");
        return;
    }

    //Crea data para guardar
    const dataBen = {
        id_orden: countBeneficiario,
        id_tipodociden: 0,
        num_dociden: "",
        des_nombre: "",
        des_segundonombre: "",
        des_apepaterno: "",
        des_apematerno: "",
        id_parentesco: parseFloat(document.getElementById("benParentesco").value),
        id_sexo: parseFloat(document.getElementById("benSexo").value),
        fec_nacimiento: document.getElementById("benFechaNac").value,
        id_ivalido: parseFloat(document.getElementById("benInvalidez").value),
        val_pension: 0,
        mto_pension: 0,
    }
    beneficiariosData.push(dataBen);

    renderTablaBeneficiarios();
    document.getElementById("formBeneficiario").reset();
    bootstrap.Modal.getInstance(document.getElementById("modalBeneficiario")).hide();
});

function renderTablaBeneficiarios() {
    const tbody = document.querySelector("#tablaBeneficiarios tbody");
    tbody.innerHTML = "";
    beneficiarios.forEach((b, index) => {
        tbody.innerHTML += `
        <tr>
            <td>${index + 1}</td>
            <td>${b.DescriTipoPar}</td>
            <td>${b.DescriTipoSex}</td>
            <td>${b.FechaNacimiento}</td>
            <td>${b.DescriTipoInv}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarbeneficiarios(${b.IdBeneficiario})">
                <i class="fa fa-trash"></i>
                </button>
            </td>
        </tr>
      `;
    });
}

function eliminarbeneficiarios(id) {
    beneficiarios = beneficiarios.filter(m => m.IdBeneficiario !== id);
    renderTablaBeneficiarios();
}

// Guardar Modalidad
document.getElementById("btnGuardarModalidad").addEventListener("click", async () => {
    countModalidad++;
    const data = {
        IdModalidad: countModalidad,
        Moneda: parseFloat(document.getElementById("moneda").value),
        PeriodoDiferido: parseFloat(document.getElementById("periodoDiferido").value || 0),
        PeriodoGarantizado: parseFloat(document.getElementById("periodoGarantizado").value || 0),
        Gratificacion: document.getElementById("gratificacion").value,
        PrimerTramo: parseFloat(document.getElementById("primerTramo").value || 0),
        SegundoTramo: parseFloat(document.getElementById("segundoTramo").value || 0),
    };
    //trae las tasas y topes de cada modalidad
    const MontoCIC = parseFloat(document.getElementById("aseCic").value || 0);
    const TipoPension = document.getElementById("asePension").value;
    const IdAfp = document.getElementById("aseAfp").value;
    const body = {
        moneda: data.moneda,
        montoCIC: MontoCIC,
        prestacion: TipoPension,
        afp: IdAfp
    };
    const response = await fetch("http://localhost:3000/cotizador/api/tasasInd", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    const result = await response.json();

    const valorAFP = parseFloat(result.prcafp || 0);
    data.TasaRentaAFP = valorAFP
    //document.getElementById("ValAfp").value = valorAFP;
    data.RentaTemp = 50;
    data.tasaanclaje = parseFloat(result.valtac || 0);
    data.tasaventaprom = parseFloat(result.valpro || 0);
    data.tasaventa = parseFloat(result.valvta || 0);
    data.tasatirtope = parseFloat(result.valtir || 0);
    data.tasaperdidatope = parseFloat(result.valper || 0);
    data.comision = parseFloat(result.comision || 0);

    //muestra las descripciones
    let selectMon = document.getElementById("moneda");
    data.DescriTipoMoneda = selectMon.options[selectMon.selectedIndex].text;
    modalidades.push(data);

    if (!data.Moneda) {
        alert("Complete los campos obligatorios.");
        return;
    }

    const dataMod = {
        id_correlativo: countModalidad,
        id_moneda: parseFloat(document.getElementById("moneda").value),
        num_mesdif: parseFloat(document.getElementById("periodoDiferido").value || 0),
        num_mesgar: parseFloat(document.getElementById("periodoGarantizado").value || 0),
        ind_dergra: document.getElementById("gratificacion").value,
        num_mesesc: parseFloat(document.getElementById("primerTramo").value || 0),
        val_rentaesc: parseFloat(document.getElementById("segundoTramo").value || 0),
    };
    modalidadesData.push(dataMod);

    //console.log(modalidadesData);
    renderTablaModalidades();
    document.getElementById("formModalidad").reset();
    bootstrap.Modal.getInstance(document.getElementById("modalAgregarModalidad")).hide();
});

function renderTablaModalidades() {
    const tbody = document.querySelector("#tablaModalidades tbody");
    tbody.innerHTML = "";
    modalidades.forEach((m, index) => {
        tbody.innerHTML += `
        <tr>
          <td>${index + 1}</td>
          <td>${m.DescriTipoMoneda}</td>
          <td>${m.PeriodoDiferido}</td>
          <td>${m.PeriodoGarantizado}</td>
          <td>${m.Gratificacion}</td>
          <td>${m.PrimerTramo}</td>
          <td>${m.SegundoTramo}</td>
          <td>${m.TasaRentaAFP}%</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="eliminarModalidad(${m.IdModalidad})">
              <i class="fa fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });
}

function eliminarModalidad(id) {
    modalidades = modalidades.filter(m => m.IdModalidad !== id);
    renderTablaModalidades();
}

document.getElementById("btnCalcular").addEventListener("click", async () => {
    const loader = document.getElementById("loader");
    loader.style.display = "block"; // 👈 Mostrar loader
    await new Promise(r => setTimeout(r, 50));

    const numeroDoc = document.getElementById("aseNumDoc").value;
    if(!numeroDoc){
        msjAdvertencia("Debe agregar un numero de documento");
        return;
    }

    // --- Datos del asegurado (ejemplo: tomados de inputs) ---
    const asegurado = {
        IdBeneficiario: 1,
        TipoInvalidez: parseFloat(document.getElementById("aseInvalidez").value),
        FechaNacimiento: document.getElementById("aseFechaNac").value,
        Genero: parseFloat(document.getElementById("aseSexo").value),
        ComisionAFP: parseFloat(document.getElementById("ValAfp").value),
        TipoPension: document.getElementById("asePension").value,
        FechaDevengue: document.getElementById("aseFechaDev").value,
        FechaDevengueSolicitud: document.getElementById("aseFechaDevSol").value
    };

    // --- Datos generales ---
    const payload = {
        IdoperacionSbs: 0,
        Cliente: "01",
        TipoCambio: parseFloat(document.getElementById("tipoCambio").value || 0),
        GastoSepelio: parseFloat(document.getElementById("gastoSep").value || 0),
        MontoCIC: parseFloat(document.getElementById("aseCic").value || 0),
        Licencia: "",
        Gastos: {
            Gastosmant: parseFloat(document.getElementById("GasAdm").value || 0),
            Gastosemi: parseFloat(document.getElementById("GasEmi").value || 0),
            Porcentajedeuda: 0,
            Impuestos: parseFloat(document.getElementById("GasImp").value || 0)
        },
        Asegurado: asegurado,
        Beneficiario: beneficiarios, // tu array construido en el paso 2
        Modalidad: modalidades       // tu array construido en el paso 3
    };

    console.log("📤 Enviando JSON:", payload);

    calcularCotizacionOptCard(payload);
});

document.addEventListener('DOMContentLoaded', () => {

    const departamento = document.getElementById('aseDepartamento');
    const provincia = document.getElementById('aseProvincia');
    const distrito = document.getElementById('aseDistrito');

    // 1. Cargar regiones al inicio
    fetch('/cotizador/api/regiones')
        .then(res => res.json())
        .then(data => {
            data.forEach(r => {
                const option = document.createElement('option');
                option.value = r.id;
                option.textContent = r.v_nombre;
                departamento.appendChild(option);
            });
        });

    // 2. Al cambiar región -> provincias
    departamento.addEventListener('change', () => {
        const idRegion = departamento.value;
        provincia.innerHTML = '<option value="">-- Seleccione --</option>';
        distrito.innerHTML = '<option value="">-- Seleccione --</option>';
        if (!idRegion) return;

        fetch(`/cotizador/api/provincias/${idRegion}`)
            .then(res => res.json())
            .then(data => {
                data.forEach(p => {
                    const option = document.createElement('option');
                    option.value = p.id;
                    option.textContent = p.v_nombre;
                    provincia.appendChild(option);
                });
            });
    });

    // 3. Al cambiar provincia -> distritos
    provincia.addEventListener('change', () => {
        const idProvincia = provincia.value;
        distrito.innerHTML = '<option value="">-- Seleccione --</option>';
        if (!idProvincia) return;

        fetch(`/cotizador/api/distritos/${idProvincia}`)
            .then(res => res.json())
            .then(data => {
                data.forEach(d => {
                    const option = document.createElement('option');
                    option.value = d.id;
                    option.textContent = d.v_nombre;
                    distrito.appendChild(option);
                });
            });
    });

    // 4. Al elegir un distrito -> autocompletar provincia y región
    distrito.addEventListener('change', () => {
        const idDistrito = distrito.value;
        if (!idDistrito) return;

        fetch(`/cotizador/api/distrito-info/${idDistrito}`)
            .then(res => res.json())
            .then(info => {
                provincia.value = info.idProvincia;
                departamento.value = info.idRegion;
            });
    });

    //5. Eleccion de AFP y carga de valor Comision
    const selectAfp = document.getElementById('aseAfp');
    const inputValor = document.getElementById('ValAfp');

    selectAfp.addEventListener('change', function () {
        const valorSeleccionado = this.options[this.selectedIndex].getAttribute('data-valor');
        inputValor.value = valorSeleccionado || '';
        console.log("Valor AFP seleccionado:", inputValor.value);
    });
});

async function calcularCotizacionOptTab(payload) {
    try {
        // 1️⃣ Obtener token
        const tokenRes = await fetch("http://localhost:3000/auth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: "cliente1", clientSecret: "secret123" })
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok) {
            throw new Error(tokenData.error || "Error al obtener el token");
        }

        const token = tokenData.token;

        // 2️⃣ Llamar al endpoint de cálculo
        const calcRes = await fetch("http://localhost:3000/rutinarv/calcular", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const calcData = await calcRes.json();

        if (!calcRes.ok) {
            throw new Error(calcData.error || "Error en el cálculo de la cotización");
        }

        console.log("✅ Respuesta backend:", calcData);

        // 3️⃣ Mostrar éxito
        Swal.fire({
            title: "¡Éxito!",
            text: "Cotización calculada correctamente",
            icon: "success",
            confirmButtonText: "Aceptar",
            confirmButtonColor: "#3085d6"
        });

        // 4️⃣ Renderizar resultados en tabla
        const tbody = document.querySelector("#tablaResultados tbody");
        tbody.innerHTML = ""; // Limpiamos tabla previa

        calcData.forEach(item => {
            const fila = document.createElement("tr");

            const resultadosPenHTML = Array.isArray(item.resultadospen)
                ? item.resultadospen.map(rp => `
                    <tr>
                        <td>${rp.id}</td>
                        <td>${rp.prc}</td>
                        <td>${formato(rp.pension)}</td>
                    </tr>
                `).join("")
                : `<tr><td colspan="3">No hay datos</td></tr>`;

            fila.innerHTML = `
                <td>${item.idmod ?? ""}</td>
                <td>${formato(item.penafp) ?? ""}</td>
                <td>${formato(item.pencia) ?? ""}</td>
                <td>${formato(item.primaafp) ?? ""}</td>
                <td>${formato(item.primacia) ?? ""}</td>
                <td>${formato(item.tasavta) ?? ""}</td>
                <td>
                    <table class="table table-sm table-borderless mb-0">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>%</th>
                                <th>Pensión</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${resultadosPenHTML}
                        </tbody>
                    </table>
                </td>
            `;

            tbody.appendChild(fila);
        });

    } catch (err) {
        console.error("❌ Error:", err.message);

        Swal.fire({
            title: "Error",
            text: err.message,
            icon: "error",
            confirmButtonText: "Cerrar",
            confirmButtonColor: "#d33"
        });
    } finally {
        loader.style.display = "none"; // 👈 Ocultar loader siempre
    }
}

async function calcularCotizacionOptCard(payload) {
    try {
        // 1️⃣ Obtener token
        const tokenRes = await fetch("http://localhost:3000/auth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId: "cliente1", clientSecret: "secret123" })
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok) {
            throw new Error(tokenData.error || "Error al obtener el token");
        }

        const token = tokenData.token;

        // 2️⃣ Llamar al endpoint de cálculo
        const calcRes = await fetch("http://localhost:3000/rutinarv/calcular", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const calcData = await calcRes.json();

        if (!calcRes.ok) {
            throw new Error(calcData.error || "Error en el cálculo de la cotización");
        }

        console.log("✅ Respuesta backend:", calcData);

        // 3️⃣ Mostrar éxito
        Swal.fire({
            title: "¡Éxito!",
            text: "Cotización calculada correctamente",
            icon: "success",
            confirmButtonText: "Aceptar",
            confirmButtonColor: "#3085d6"
        });

        const container = document.getElementById("cardContainer");
        container.innerHTML = ""; // limpiar contenido previo

        calcData.forEach(item => {
            // construimos los "chips" para resultadospen
            const resultadosPenHTML = Array.isArray(item.resultadospen)
                ? item.resultadospen.map(rp => `
                                <span class="badge bg-secondary me-1 mb-1">
                                    <strong>${rp.id}</strong>: ${rp.prc}% → ${formato(rp.pension)}
                                </span>
                            `).join("")
                : `<span class="text-muted">No hay datos</span>`;



            // creamos el card
            const card = document.createElement("div");
            card.classList.add("col-md-3", "mb-4");

            card.innerHTML = `
                                <div class="card shadow-sm border-0 h-100">
                                    <div class="card-body">
                                        <h5 class="card-title text-primary mb-3">
                                            <i class="bi bi-graph-up"></i> Modalidad: ${item.idmod ?? "N/A"}
                                        </h5>

                                        <ul class="list-group list-group-flush small mb-3">
                                            <li class="list-group-item">
                                                <strong>Pensión AFP:</strong> ${formato(item.penafp) ?? ""}
                                            </li>
                                            <li class="list-group-item">
                                                <strong>Pensión CIA:</strong> ${formato(item.pencia) ?? ""}
                                            </li>
                                            <li class="list-group-item">
                                                <strong>Prima AFP:</strong> ${formato(item.primaafp) ?? ""}
                                            </li>
                                            <li class="list-group-item">
                                                <strong>Prima CIA:</strong> ${formato(item.primacia) ?? ""}
                                            </li>
                                            <li class="list-group-item">
                                                <strong>Tasa Venta:</strong> ${formato(item.tasavta) ?? ""}
                                            </li>
                                        </ul>

                                        <div>
                                            <h6 class="fw-bold text-muted mb-2">Pensiones:</h6>
                                            ${resultadosPenHTML}
                                        </div>
                                    </div>
                                </div>
                                `;

            container.appendChild(card);

            //gurda tabla temporal de reultados para ser enviado al Backend
            const resultadosMod = {
                id_correlativo: item.idmod,
                mto_pensionref: formato(item.penref),
                mto_pensionafp: formato(item.penafp),
                mto_pension: formato(item.pencia),
                mto_primaafp: formato(item.primaafp),
                mto_primacia: formato(item.primacia),
                val_tasavta: formato(item.tasavta),
                val_tasaTci: formato(item.tasaTci),
                val_tasaTce: formato(item.tasaTce),
                val_tasaTir: formato(item.tasaTir),
                val_perdida: formato(item.perdida),
                resultadosben: item.resultadospen
            }
            resultadosModalidadData.push(resultadosMod)
        });

    } catch (err) {
        console.error("❌ Error:", err.message);

        Swal.fire({
            title: "Error",
            text: err.message,
            icon: "error",
            confirmButtonText: "Cerrar",
            confirmButtonColor: "#d33"
        });
    } finally {
        loader.style.display = "none"; // 👈 Ocultar loader siempre
    }
}

function formato(num, decimales = 2) {
    return (typeof num === "number" && !isNaN(num))
        ? num.toFixed(decimales)
        : "";
}

async function agregaModalidadesPack(mon, dif, gar, gra, pri, seg) {
    countModalidad++;
    const data = {
        IdModalidad: countModalidad,
        Moneda: mon,
        PeriodoDiferido: dif,
        PeriodoGarantizado: gar,
        Gratificacion: gra,
        PrimerTramo: pri,
        SegundoTramo: seg,
    };

    //carga un objeto conlos datos que guardara en BD
    const dataMod = {
        id_correlativo: countModalidad,
        id_moneda: mon,
        num_mesdif: dif,
        num_mesgar: gar,
        ind_dergra: gra,
        num_mesesc: pri,
        val_rentaesc: seg,
    };
    modalidadesData.push(dataMod);

    //trae las tasas y topes de cada modalidad
    const MontoCIC = parseFloat(document.getElementById("aseCic").value || 0);
    const TipoPension = document.getElementById("asePension").value;
    const IdAfp = document.getElementById("aseAfp").value;
    const body = {
        moneda: data.moneda,
        montoCIC: MontoCIC,
        prestacion: TipoPension,
        afp: IdAfp
    };
    const response = await fetch("http://localhost:3000/cotizador/api/tasasInd", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    const result = await response.json();

    data.TasaRentaAFP = parseFloat(result.prcafp || 0);
    data.RentaTemp = 50;
    data.tasaanclaje = parseFloat(result.valtac || 0);
    data.tasaventaprom = parseFloat(result.valpro || 0);
    data.tasaventa = parseFloat(result.valvta || 0);
    data.tasatirtope = parseFloat(result.valtir || 0);
    data.tasaperdidatope = parseFloat(result.valper || 0);
    data.comision = parseFloat(result.comision || 0);

    //muestra las descripciones
    let selectMon = document.getElementById("moneda");
    data.DescriTipoMoneda = selectMon.options[mon].text;


    modalidades.push(data);
    console.log(modalidades);
    renderTablaModalidades();
}

document.getElementById("btnModalidasDefsinPG").addEventListener("click", async () => {
    countModalidad = 0;
    agregaModalidadesPack(2, 0, 0, "N", 0, 0);
    agregaModalidadesPack(2, 1, 0, "N", 0, 0);
    agregaModalidadesPack(2, 3, 0, "N", 0, 0);
    agregaModalidadesPack(2, 5, 0, "N", 0, 0);
});

document.getElementById("btnModalidasDefconPG").addEventListener("click", async () => {
    countModalidad = 0;
    agregaModalidadesPack(2, 0, 10, "N", 0, 0);
    agregaModalidadesPack(2, 1, 10, "N", 0, 0);
    agregaModalidadesPack(2, 3, 10, "N", 0, 0);
    agregaModalidadesPack(2, 5, 10, "N", 0, 0);
    agregaModalidadesPack(2, 0, 15, "N", 0, 0);
    agregaModalidadesPack(2, 1, 15, "N", 0, 0);
    agregaModalidadesPack(2, 3, 15, "N", 0, 0);
    agregaModalidadesPack(2, 5, 15, "N", 0, 0);
});

document.getElementById("btnGuardar").addEventListener("click", async () => {
    guardarEstudio();
});

async function guardarEstudio() {
    const loader = document.getElementById("loader");
    loader.style.display = "block"; // 👈 Mostrar loader
    await new Promise(r => setTimeout(r, 50));

    try {
        const data = {

            num_cot: "",
            mto_priuni: parseFloat(document.getElementById("aseCic").value),
            mto_gassep: parseFloat(document.getElementById("gastoSep").value),
            val_tc: parseFloat(document.getElementById("tipoCambio").value),
            id_afp: parseFloat(document.getElementById("aseAfp").value),
            id_estado: 1,
            asegurado: {
                id_tipodociden: parseFloat(document.getElementById("aseTipoDoc").value),
                num_dociden: document.getElementById("aseNumDoc").value,
                cod_cuspp: document.getElementById("aseCuspp").value,
                des_nombre: document.getElementById("aseNombres").value,
                des_segundonombre: "",
                des_apepaterno: document.getElementById("aseApellidoPat").value,
                des_apematerno: document.getElementById("aseApellidoMat").value,
                id_reg: parseFloat(document.getElementById("aseDepartamento").value),
                id_ivalido: parseFloat(document.getElementById("aseInvalidez").value),
                fec_nacimiento: document.getElementById("aseFechaNac").value,
                id_sexo: parseFloat(document.getElementById("aseSexo").value),
                val_afp: parseFloat(document.getElementById("aseAfp").value),
                id_prestacion: document.getElementById("asePension").value,
                fec_dev: document.getElementById("aseFechaDev").value,
                fec_devsol: document.getElementById("aseFechaDevSol").value
            },
            beneficiarios: beneficiariosData,
            modalidades: modalidadesData,
            resultados: resultadosModalidadData
        };

        const response = await fetch('http://localhost:3000/cotizador/api/guardar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        // ⚠️ Si el backend devuelve error HTTP (500, 400, etc.)
        if (!response.ok) {
            const errorText = await response.text(); // Intentar leer el mensaje
            throw new Error(`Error del servidor (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        console.log("✅ Respuesta backend:", result);

        // 3️⃣ Mostrar éxito
        Swal.fire({
            title: "¡Éxito!",
            text: "Cotización calculada correctamente",
            icon: "success",
            confirmButtonText: "Aceptar",
            confirmButtonColor: "#3085d6"
        }).then(() => {
            // 👇 Redirige al listado después del OK
            window.location.href = "/cotizador/estudiolista";
        });;

    } catch (err) {
        console.error("❌ Error:", err.message);

        Swal.fire({
            title: "Error",
            text: err.message,
            icon: "error",
            confirmButtonText: "Cerrar",
            confirmButtonColor: "#d33"
        });
    } finally {
        loader.style.display = "none"; // 👈 Ocultar loader siempre
    }
    //alert(result.message);
}

function msjAdvertencia(msj){
     Swal.fire({
            title: "¡Avertencia!",
            text: msj,
            icon: "error",
            confirmButtonText: "Aceptar",
            confirmButtonColor: "#d6a130ff"
        });
}

function msjSatisfactorio(msj){
     Swal.fire({
            title: "¡Éxito!",
            text: msj,
            icon: "success",
            confirmButtonText: "Aceptar",
            confirmButtonColor: "#3085d6"
        });
}

function msjError(msj){
     Swal.fire({
            title: "Error",
            text: err.message,
            icon: "error",
            confirmButtonText: "Cerrar",
            confirmButtonColor: "#d33"
        });
}



//listados
document.querySelectorAll('.btnEliminar').forEach(btn => {
    btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const confirm = await Swal.fire({
            title: '¿Eliminar cotización?',
            text: 'Esta acción no se puede deshacer',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });
        if (confirm.isConfirmed) {
            const res = await fetch('/cotizador/eliminar/' + id, { method: 'DELETE' });
            const result = await res.json();
            if (result.ok) {
                Swal.fire('Eliminado', result.message, 'success').then(() => location.reload());
            } else {
                Swal.fire('Error', result.message, 'error');
            }
        }
    });
});