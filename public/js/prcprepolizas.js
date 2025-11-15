document.addEventListener("DOMContentLoaded", () => {

    let inputUbigeoTarget = null;
    let inputIdUbigeoTarget = null;
    let ubigeoInitialized = false;

    // Cuenta handlers click en document para .btnUbigeo
    console.log('handlers click .btnUbigeo:', $._data(document, 'events')?.click?.filter(h => h.selector && h.selector.includes('.btnUbigeo')).length || 0);

    // Escucha show/hidden para ver cuántas veces se llaman
    $('#modalUbigeo').on('show.bs.modal debug', () => console.log('SHOW modalUbigeo', new Date().toISOString()));
    $('#modalUbigeo').on('shown.bs.modal debug', () => console.log('SHOWN modalUbigeo', new Date().toISOString()));
    $('#modalUbigeo').on('hide.bs.modal debug', () => console.log('HIDE modalUbigeo', new Date().toISOString()));
    $('#modalUbigeo').on('hidden.bs.modal debug', () => console.log('HIDDEN modalUbigeo', new Date().toISOString()));

    // ✅ Captura el botón y guarda los inputs destino
    $(document).off('click.ubigeo', '.btnUbigeo').on('click.ubigeo', '.btnUbigeo', function () {
        inputUbigeoTarget = $(this).data('targetinput');
        inputIdUbigeoTarget = $(this).data('targetid');

        // Mostramos el modal manualmente (evita doble instancia)
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalUbigeo'));
        modal.show();
    });

    // ✅ Cuando el modal esté completamente visible (aquí sí funciona Select2)
    $('#modalUbigeo').off('shown.bs.modal.ubigeo').on('shown.bs.modal.ubigeo', async function () {
        if (!ubigeoInitialized) {
            initSelect2Ubigeo();
            ubigeoInitialized = true;
        }
        await loadRegiones(); // carga lista inicial
    });

    function initSelect2Ubigeo() {
        $('#regionSelect, #provinciaSelect').select2({
            dropdownParent: $('#modalUbigeo'),
            width: '100%',
            placeholder: 'Seleccione...',
            allowClear: true
        });

        $('#distritoSelect').select2({
            dropdownParent: $('#modalUbigeo'),
            width: '100%',
            placeholder: 'Buscar distrito...',
            allowClear: true,
            minimumInputLength: 2,
            ajax: {
                url: '/cotizador/api/distritos-search',
                dataType: 'json',
                delay: 250,
                data: params => ({ q: params.term }),
                processResults: data => data,
                /* processResults: data => ({
                    results: data.map(item => ({
                        id: item.id,
                        text: item.v_nombre
                    }))
                }) */
            }
        });
    }

    async function loadRegiones() {
        const selectRegion = $('#regionSelect');
        const selectProvincia = $('#provinciaSelect');
        const selectDistrito = $('#distritoSelect');

        // Reset selects
        [selectRegion, selectProvincia, selectDistrito].forEach(s => {
            s.empty().append('<option value=""></option>').trigger('change.select2');
        });

        try {
            const res = await fetch('/cotizador/api/regiones');
            const regiones = await res.json();

            // Si el backend devuelve { id, v_nombre }
            regiones.forEach(r => {
                selectRegion.append(new Option(r.v_nombre, r.id));
            });
            selectRegion.trigger('change.select2');
        } catch (err) {
            console.error('Error cargando regiones:', err);
        }
    }

    // ✅ Provincias al cambiar región
    $('#regionSelect').off('change.ubigeo').on('change.ubigeo', async function () {
        const idRegion = $(this).val();
        const selectProvincia = $('#provinciaSelect');
        if (!idRegion) return;

        selectProvincia.empty().append('<option></option>').trigger('change.select2');

        try {
            const res = await fetch(`/cotizador/api/provincias/${idRegion}`);
            const provincias = await res.json();

            provincias.forEach(p => selectProvincia.append(new Option(p.v_nombre, p.id)));
            selectProvincia.trigger('change.select2');
        } catch (err) {
            console.error('Error cargando provincias:', err);
        }
    });

    // ✅ Distritos al cambiar provincia
    $('#provinciaSelect').off('change.ubigeo').on('change.ubigeo', async function () {
        const idProvincia = $(this).val();
        const selectDistrito = $('#distritoSelect');
        if (!idProvincia) return;

        selectDistrito.empty().append('<option></option>').trigger('change.select2');

        try {
            const res = await fetch(`/cotizador/api/distritos/${idProvincia}`);
            const distritos = await res.json();

            distritos.forEach(d => selectDistrito.append(new Option(d.v_nombre, d.id)));
            selectDistrito.trigger('change.select2');
        } catch (err) {
            console.error('Error cargando distritos:', err);
        }
    });

    // ✅ Selección de distrito
    $('#distritoSelect').off('select2:select.ubigeo').on('select2:select.ubigeo', async e => {
        const idDistrito = e.params.data.id;
        if (!idDistrito) return;
        await fillUbigeoInfo(idDistrito);
    });

    // ✅ Botón "Seleccionar"
    $('#btnSeleccionarUbigeo').off('click.ubigeo').on('click.ubigeo', async () => {
        const idDistrito = $('#distritoSelect').val();
        if (idDistrito) return await fillUbigeoInfo(idDistrito);
        closeModal();
    });

    async function fillUbigeoInfo(idDistrito) {
        if (!inputUbigeoTarget) return;
        try {
            const res = await fetch(`/cotizador/api/distrito-info/${idDistrito}`);
            const info = await res.json();

            $('#' + inputUbigeoTarget).val(`${info.region} / ${info.provincia} / ${info.distrito}`);
            $('#' + inputIdUbigeoTarget).val(idDistrito);

            closeModal();
        } catch (err) {
            console.error('Error al obtener distrito:', err);
        }
    }

    // ✅ Limpieza al cerrar modal
    $('#modalUbigeo').off('hidden.bs.modal.ubigeo').on('hidden.bs.modal.ubigeo', () => {
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open').css({ overflow: '', paddingRight: '' });
        $('.select2-dropdown').remove();
    });

    function closeModal() {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalUbigeo')).hide();
    }
});


let cotizacionafi = [];
let beneficiarios = [];
let poliza = [];
let polizaver = [];
let polizabeneficiario = [];
let idordenEditado = null;
let ind_excluido = null;
let ind_estudia = "N";
document.addEventListener("DOMContentLoaded", async function () {
    // Detectar clic en el botón editar

    const tipoPagafi = document.getElementById("tipoPagafi");
    const tipoSucafi = document.getElementById("tipoSucafi");
    const tipoBcoafi = document.getElementById("tipoBcoafi");
    const tipoctaafi = document.getElementById("tipoctaafi");
    const numeroctaafi = document.getElementById("numeroctaafi");
    const numerocciafi = document.getElementById("numerocciafi");

    tipoSucafi.disabled = true;
    tipoBcoafi.disabled = true;
    tipoctaafi.disabled = true;
    numeroctaafi.disabled = true;
    numerocciafi.disabled = true;

    const id = document.getElementById("idcot").value;

    // 1️⃣ Traer todos los beneficiarios del backend al cargar la página
    try {

        const responsecab = await fetch(`/emision/api/getcotizacionafi/${id}`);
        if (!responsecab.ok) throw new Error("No se pudo obtener los beneficiarios");
        cotizacionafi = await responsecab.json();
        cargaDataAfili(cotizacionafi);

        const response = await fetch(`/emision/api/getbeneficiario/${id}`);
        if (!response.ok) throw new Error("No se pudo obtener los beneficiarios");
        beneficiarios = await response.json();
        cargaDataBen(beneficiarios);
    } catch (error) {
        console.error("Error cargando beneficiarios:", error);
    }

    const inputExclusionFal = document.getElementById("excluyefall");
    const inputExclusionMay = document.getElementById("excluyemayor");

    inputExclusionFal.addEventListener("change", () => {
        if (inputExclusionFal.checked) {
            inputExclusionMay.checked = false;
        }
    });

    inputExclusionMay.addEventListener("change", () => {
        if (inputExclusionMay.checked) {
            inputExclusionFal.checked = false;
        }
    });

    document.querySelector("#tablaBeneficiarios").addEventListener("click", async function (e) {
        if (e.target.closest(".editar-beneficiario")) {
            const idord = e.target.closest(".editar-beneficiario").dataset.id;
            //const tipdoc = fila.querySelector(".tipdoc").textContent.trim();
            //const numdoc = fila.querySelector(".numdoc").textContent.trim();
            idordenEditado = parseInt(idord);

            const ben = beneficiarios.find(b => b.id_orden === idordenEditado);
            if (!ben) return alert("No se encontró el beneficiario seleccionado");

            // 👉 Cargar datos al formulario
            document.getElementById("tipodocben").value = ben.id_tipodociden;
            document.getElementById("numeroidenben").value = ben.num_dociden;
            document.getElementById("nombreben").value = ben.des_nombre || '';
            document.getElementById("nombresegben").value = ben.des_nombresegundo || '';
            document.getElementById("apepatben").value = ben.des_apepaterno || '';
            document.getElementById("apematben").value = ben.des_apematerno || '';
            document.getElementById("grupofamben").value = ben.id_grupofam || '';
            document.getElementById("sexoben").value = ben.id_sexo || '';
            document.getElementById("invalidezben").value = ben.id_invalido || '';
            document.getElementById("parentescoben").value = ben.id_parentesco || '';
            document.getElementById("prcpenben").value = ben.val_pension || 0;
            document.getElementById("montopenben").value = ben.mto_pension || 0;
            //document.getElementById("estudiantesi").checked = !!ben.ind_estudiante;
            document.getElementById("estudiantesi").checked = false;
            if (cotizacionafi.ind_estudiante == 'S' && ben.id_parentesco == 6) {
                document.getElementById("estudiantesi").checked = true;
            }
            document.getElementById("nacimientoben").value = ben.fec_nacimiento
                ? ben.fec_nacimiento.split('T')[0]
                : '';
            document.getElementById("fallecimientoben").value = ben.fec_fallecimiento
                ? ben.fec_fallecimiento.split('T')[0]
                : '';
            document.getElementById("txtDireccionoExpBen").value = ben.des_direxpediente || '';
            document.getElementById("iddirexp").value = ben.id_direxpediente || '';
            document.getElementById("txtUbigeoExpBen").value = ben.des_ubiexp || '';

            document.getElementById("txtDireccionCorBen").value = ben.des_dircorrespon || '';
            document.getElementById("iddircor").value = ben.id_ubidircorrespon || '';
            document.getElementById("txtUbigeoCorBen").value = ben.des_ubicor || '';

            document.getElementById("correoben1").value = ben.des_email1 || '';
            document.getElementById("correoben2").value = ben.des_email2 || '';
            document.getElementById("correoben3").value = ben.des_email3 || '';
            document.getElementById("telefonoben1").value = ben.des_telef1 || '';
            document.getElementById("telefonoben2").value = ben.des_telef2 || '';
            document.getElementById("telefonoben3").value = ben.des_telef3 || '';

        }
    });

    // 2️⃣ Acción del botón Actualizar
    document.getElementById("btnActualizarBen").addEventListener("click", () => {
        // Obtener valores actuales desde los inputs
        if (!idordenEditado) {
            alert("Primero seleccione un beneficiario para editar");
            return;
        }
        const idOrden = idordenEditado;

        // Buscar el beneficiario dentro del array
        const index = beneficiarios.findIndex(b => b.id_orden === idOrden);

        const inputTipoDoc = document.getElementById("tipodocben");
        const inputTipoDocText = inputTipoDoc.options[inputTipoDoc.selectedIndex].text;
        const inputNumDoc = document.getElementById("numeroidenben");
        const selectCauInv = document.getElementById("causainvalidezben");
        const inputFecInv = document.getElementById("fechainvalidezben");
        const inputFecFal = document.getElementById("fallecimientoben");

        const inputEstudiante = document.getElementById("estudiantesi"); // hacer que este valor llege e 1 en el cotizador

        const inputProtecDatos = document.getElementById("protecdatosben");
        const inputBoletaPagos = document.getElementById("boletapagben");
        const inputExclusionFal = document.getElementById("excluyefall");
        const inputExclusionMay = document.getElementById("excluyemayor");
        const inputDireccionExp = document.getElementById("txtDireccionoExpBen");
        const inputDireccionCor = document.getElementById("txtDireccionCorBen");
        const inputidDirExp = document.getElementById("iddirexp");
        const inputidDirCor = document.getElementById("iddircor");
        const inputTxtUbiExp = document.getElementById("txtUbigeoExpBen");
        const inputTxtUbiCor = document.getElementById("txtUbigeoCorBen");
        const inputTel1 = document.getElementById("telefonoben1");
        const inputTel2 = document.getElementById("telefonoben2");
        const inputTel3 = document.getElementById("telefonoben3");
        const inputCorreo1 = document.getElementById("correoben1");
        const inputCorreo2 = document.getElementById("correoben2");
        const inputCorreo3 = document.getElementById("correoben3");
        const ind_estudiante = document.getElementById("estudiantesi")

        if (inputExclusionFal.checked) {
            ind_excluido = 1;
        } else if (inputExclusionMay.checked) {
            ind_excluido = 1;
        } else {
            ind_excluido = 0; // Ninguna exclusión
        }

        if (ind_estudiante.checked) {
            ind_estudia = "S"
        } else {
            ind_estudia = "N"
        }

        if (index !== -1) {
            // Actualizar los valores modificados desde los inputs
            beneficiarios[index] = {
                ...beneficiarios[index],
                id_tipodociden: inputTipoDoc?.value,
                num_dociden: inputNumDoc?.value,
                id_causainv: selectCauInv?.value,
                fec_invalido: inputFecInv?.value,
                fec_fallecimiento: inputFecFal?.value,
                des_tipodoc: inputTipoDocText,
                id_protecdatos: inputProtecDatos?.value,
                id_genboleta: inputBoletaPagos?.value,
                ind_excluido: ind_excluido,
                id_benefestudios: inputEstudiante?.value,
                id_ubidircorrespon: inputidDirCor?.value,
                id_direxpediente: inputidDirExp?.value,
                des_dircorrespon: inputDireccionCor?.value,
                des_direxpediente: inputDireccionExp?.value,
                des_telef1: inputTel1?.value,
                des_telef2: inputTel2?.value,
                des_telef3: inputTel3?.value,
                des_email1: inputCorreo1?.value,
                des_email2: inputCorreo2?.value,
                des_email3: inputCorreo3?.value,
                ind_estudiante: ind_estudia,
                id_estado: 1,
                val_pensiongar: 0,
                id_derpago: 0,
                ind_dercre: 1,
                des_ubiexp: inputTxtUbiExp.value,
                des_ubicor: inputTxtUbiCor.value
                // agrega más campos según tu formulario
            };
        }

        console.log("✅ Nuevo array actualizado:", beneficiarios);

        // Volver a pintar la tabla con los cambios
        cargaDataBen(beneficiarios);

        Swal.fire("✅", "Dato Actulizado correctamente", "success");
    });

    document.getElementById("btnGuardarPrepoliza").addEventListener("click", () => {

        poliza = [];
        polizaver = [];
        polizabeneficiario = [];
        const inputfecspp = document.getElementById("fecspp");
        const selectNacio = document.getElementById("Nacionalidadfi");
        const inputapepat = document.getElementById("apepatafi");
        const inputapemat = document.getElementById("apematafi");
        const inputnombre = document.getElementById("nombreafi");
        const inputnomseg = document.getElementById("nombresegafi");

        //const inputTipoDocText = inputTipoDoc.options[inputTipoDoc.selectedIndex].text;
        const inputfecfal = document.getElementById("fecfalafi");
        const inputdirexp = document.getElementById("direxpafi");
        const inputiddirexp = document.getElementById("iddirexpafi");
        const inputdircor = document.getElementById("dircorafi");
        const inputiddircor = document.getElementById("iddircorafi");
        const inputcorreoafi1 = document.getElementById("correoafi1");
        const inputcorreoafi2 = document.getElementById("correoafi2");
        const inputcorreoafi3 = document.getElementById("correoafi3");
        const inputtelefonoafi1 = document.getElementById("telefonoafi1");
        const inputtelefonoafi2 = document.getElementById("telefonoafi2");
        const inputtelefonoafi3 = document.getElementById("telefonoafi3");
        const inputtipoCiv = document.getElementById("tipoCivafi");
        const inputtipoEss = document.getElementById("tipoEssafi");
        const inputRepresentante = document.getElementById("Representanteafi");
        const inputfecaceptaa = document.getElementById("fecaceptaafi");
        const chkprotecdat = document.getElementById("protecdatafi")
        const chkboletapag = document.getElementById("boletapagafi")
        const inputPrestaion = document.getElementById("tipopenafi")
        const inputtipoPag = document.getElementById("tipoPagafi");
        const inputtipoAfp = document.getElementById("tipoAfpafi");
        const inputtipoBco = document.getElementById("tipoBcoafi");
        const inputtipocta = document.getElementById("tipoctaafi");
        const inputnumerocta = document.getElementById("numeroctaafi");
        const inputnumerocci = document.getElementById("numerocciafi");

        const polizadata = {
            id_correlativo: cotizacionafi.id_correlativo,
            num_cot: cotizacionafi.num_cot,
            id_afp: cotizacionafi.id_afp,
            id_tipobenef: cotizacionafi.id_tipobenef,
            num_cuspp: cotizacionafi.num_cuspp,
            fec_solicitud: cotizacionafi.fec_suscripcion,
            fec_ingreso: "",
            fec_vigencia: primerdia(cotizacionafi.fec_devenge),
            fec_dev: cotizacionafi.fec_devenge,
            fec_devsol: cotizacionafi.fec_devsol,
            num_annojub: cotizacionafi.num_aniojubila,
            fec_calculo: cotizacionafi.fec_calcot,
            fec_iniciocia : sumarMeses(cotizacionafi.fec_devenge, cotizacionafi.num_mesdif),
            fec_efecto : sumarMeses(cotizacionafi.fec_devenge, cotizacionafi.num_mesdif),
            fec_ingresospp: inputfecspp?.value,
            id_tipoorigen: "",
            id_estado: 1,
            fec_acepta: inputfecaceptaa?.value
        }
        poliza.push(polizadata);

        const polizaversiondata = {
            id_end: 0,
            fec_vigini: primerdia(cotizacionafi.fec_devenge),
            id_prestacion: inputPrestaion.value, //cotizacionafi.id_prestacion,
            id_estciv: inputtipoCiv?.value,
            id_monfondo: 1,
            val_tcfondo: cotizacionafi.val_tcfondo,
            mto_capitalfon: cotizacionafi.mto_capitalfon,
            mto_cicfon: cotizacionafi.mto_cicfon,
            mto_bonofon: cotizacionafi.mto_bonofon,
            mto_apoadi: cotizacionafi.mto_apoadi,
            mto_priuni: cotizacionafi.mto_priuni,
            mto_cic: cotizacionafi.mto_cic,
            mto_bono: cotizacionafi.mto_bono,
            val_tasarptr: cotizacionafi.val_tasart,
            ind_cober: cotizacionafi.ind_cober,
            //id_bensocial: cotizacionafi.,
            id_moneda: cotizacionafi.id_moneda,
            val_tcmon: cotizacionafi.val_tcmon,
            id_tipren: cotizacionafi.id_tipren,
            id_modalidad: cotizacionafi.id_modalidad,
            num_mesdif: cotizacionafi.num_mesdif,
            num_mesgar: cotizacionafi.num_mesgar,
            num_mesesc: cotizacionafi.num_mesesc,
            val_rentaesc: cotizacionafi.val_rentaesc,
            id_dercre: cotizacionafi.ind_dercre,
            id_dergra: cotizacionafi.ind_dergra,
            val_rentaafp: cotizacionafi.val_tasartafp,
            val_rentatmp: cotizacionafi.val_rentart,
            mto_gassep: cotizacionafi.mto_sepelio,
            val_tasatce: cotizacionafi.val_tasatce,
            val_tasavta: cotizacionafi.val_tasavta,
            val_tasatir: cotizacionafi.val_tasatir,
            val_taspergar: 0,
            val_prerentmp: cotizacionafi.val_rentapentmp,
            val_perdida: cotizacionafi.val_perdida,
            mto_priunitot: cotizacionafi.mto_priuni,
            mto_priunieess: cotizacionafi.mto_priuni_CIA || 0,
            mto_peninicial: cotizacionafi.mto_pension,
            mto_pension: cotizacionafi.mto_pension,
            mto_pensiongar: cotizacionafi.mto_pensiongar,
            mto_priuniafpeess: cotizacionafi.mto_priAFP,
            mto_pensionafp: cotizacionafi.mto_pensionRT,
            fec_finperiododif: sumarMeses(cotizacionafi.fec_devenge, cotizacionafi.num_mesdif),
            fec_finperiodogar: sumarMeses(cotizacionafi.fec_devenge, cotizacionafi.num_mesgar),
            fec_finrentaesc: cotizacionafi.num_mesesc > 0 ? sumarMeses(cotizacionafi.fec_devenge, cotizacionafi.num_mesesc) : '',
            mto_ajusteipc: 1,
            val_reajustetri: 0.49629316,
            val_reajustemen: 0.16515813,
            id_estver: 1
        }
        polizaver.push(polizaversiondata);

        const polizabeneficiariodata = {
            id_orden: 1,
            id_parentesco: 1,
            id_grupofam: 0,
            id_sexo: cotizacionafi.id_sexo,
            id_invalido: cotizacionafi.id_invalido,
            fec_invalido: cotizacionafi.fec_invalido,
            //id_causainv: cotizacionafi.,
            id_estado: cotizacionafi.id_prestacion = 5 ? 2 : 1,
            id_dercre: "N",
            id_tipodociden: cotizacionafi.id_tipodociden,
            num_dociden: cotizacionafi.num_dociden,
            des_nombre: inputnombre?.value,
            des_nombresegundo: inputnomseg?.value,
            des_apepaterno: inputapepat?.value,
            des_apematerno: inputapemat?.value,
            fec_nacimiento: cotizacionafi.fec_nacimiento,
            fec_fallecimiento: cotizacionafi.fec_fallecimiento,
            //fec_nachijomayor: cotizacionafi.,
            //fec_ingresocia: cotizacionafi.,
            //fec_iniciopagopen: cotizacionafi.,
            fec_terminapergar: sumarMeses(cotizacionafi.fec_devenge, cotizacionafi.num_mesgar),
            mto_pension: cotizacionafi.mto_pensionben,
            val_pension: cotizacionafi.val_pension,
            val_pensionleg: cotizacionafi.val_pensionleg,
            mto_pensiongar: cotizacionafi.mto_pensiongarben,
            val_pensiongar: 0,
            id_derpago: cotizacionafi.id_prestacion = 5 ? 2 : 1,
            des_telef1: inputtelefonoafi1?.value,
            des_telef2: inputtelefonoafi2?.value,
            des_telef3: inputtelefonoafi3?.value,
            des_email1: inputcorreoafi1?.value,
            des_email2: inputcorreoafi2?.value,
            des_email3: inputcorreoafi3?.value,
            id_benefestudios: cotizacionafi.ind_estudiante = "S" ? 1 : 0,
            //ec_efectiva: cotizacionafi.,
            des_dircorrespon: inputdircor?.value,
            id_ubidircorrespon: inputiddircor?.value,
            des_direxpediente: inputdirexp?.value,
            id_direxpediente: inputiddirexp?.value,
            id_protecdatos: chkprotecdat.checked ? 1 : 0,
            id_genboleta: chkboletapag.checked ? 1 : 0,
            id_nacionalidad: "P",
            id_viapago: inputtipoPag.value,
            id_tipocuenta: inputtipocta.value,
            id_banco: inputtipoBco.value,
            num_cuenta: inputnumerocta?.value,
            num_cuentacci: inputnumerocci?.value,
            //ind_incluido: cotizacionafi.,
            ind_excluido: 0,
            id_instsalud: inputtipoEss.value,
            //id_modalidasalud: cotizacionafi.,
            mto_plansalud: 4
            //id_causasuspencion: "",
            //fec_suspencion: ""
        }
        polizabeneficiario.push(polizabeneficiariodata);
        polizabeneficiario.push(...beneficiarios);

        console.log("✅ Nuevo array poliza:", poliza);
        console.log("✅ Nuevo array polizaver:", polizaver);
        console.log("✅ Nuevo array polizabeneficiario:", polizabeneficiario);

        const payload = {
            poliza: poliza,
            polizaver: polizaver, // tu array construido en el paso 2
            polizabeneficiario: polizabeneficiario       // tu array construido en el paso 3
        }
        GuardarPrepoliza(payload);
    });

    tipoPagafi.addEventListener("change", async (e) => {
        const viaPago = e.target.value;
        actualizarCampos(viaPago);
    });

    // 3️⃣ Función para mostrar la tabla
    function cargaDataBen(lista) {
        const tbody = document.querySelector("#tablaBeneficiarios tbody");
        tbody.innerHTML = "";

        lista.forEach((b, i) => {
            const fila = `
                <tr>
                    <td>${b.id_orden}</td>
                    <td>${b.desparentesco || ""}</td>
                    <td>${b.nombres || ""}</td>
                    <td class="tipdoc">${b.des_tipodoc || ""}</td>
                    <td class="numdoc">${b.num_dociden || ""}</td>
                    <td>
                        <button class="btn btn-sm btn-primary editar-beneficiario"
                            data-id="${b.id_orden}">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML("beforeend", fila);
        });
    }

    function cargaDataAfili(data) {
        // 👉 Cargar datos al formulario
        document.getElementById("tipodocafi").value = data.id_tipodociden;
        document.getElementById("Documentoafi").value = data.num_dociden;
        document.getElementById("tiposexafi").value = data.id_sexo;
        document.getElementById("apepatafi").value = data.des_apepaterno;
        document.getElementById("apematafi").value = data.des_apematerno;
        document.getElementById("nombreafi").value = data.des_nombre;
        document.getElementById("nombresegafi").value = data.des_nombresegundo;
        document.getElementById("fecnacafi").value = data.fec_nacimiento;
        document.getElementById("fecfalafi").value = data.fec_fallecimiento;
        document.getElementById("tipopenafi").value = data.id_prestacion;
        document.getElementById("fecinvafi").value = data.fec_invalido;
        document.getElementById("tipovejafi").value = data.id_tipobenef;
        document.getElementById("tipoAfpafi").value = data.id_afp;
        document.getElementById("tipoSucafi").value = data.id_afp;
        //document.getElementById("estudiantesi").value = data.ind_estudiante;
    }

    function primerdia(fecha) {
        //const fecha = cotizacionafi.fec_devenge; // "2022-05-06"
        const d = new Date(fecha);

        // Obtener primer día del mes
        const primerDia = new Date(d.getFullYear(), d.getMonth(), 1);

        // Formato YYYY-MM-DD
        const primerDiaStr = primerDia.toISOString().split('T')[0];

        return primerDiaStr;
    }

    function sumarMeses(fechaStr, meses) {
        const fecha = new Date(fechaStr);
        fecha.setMonth(fecha.getMonth() + meses);

        // Ajuste para evitar que meses con menos días desfasen la fecha
        if (fecha.getDate() < new Date(fecha.getFullYear(), fecha.getMonth(), 0).getDate()) {
            fecha.setDate(1);
        }

        return fecha.toISOString().split('T')[0];
    }

    async function GuardarPrepoliza(datos) {
        try {
            // 2️⃣ Llamar al endpoint de cálculo
            const calcRes = await fetch("/emision/api/grabarprepoliza", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(datos)
            });

            const calcData = await calcRes.json();

            if (!calcRes.ok) {
                throw new Error(calcData.error || "Error en Grabación");
            }

            console.log("✅ Respuesta backend:", calcData);

            // 3️⃣ Mostrar éxito
            Swal.fire({
                title: "¡Éxito!",
                text: "Pre-Poliza Registrada correctamente",
                icon: "success",
                confirmButtonText: "Aceptar",
                confirmButtonColor: "#3085d6"
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

    async function actualizarCampos(viaPago) {
        // Primero habilitamos todos
        [tipoBcoafi, tipoctaafi, numeroctaafi, numerocciafi].forEach(campo => campo.disabled = false);

        // Luego deshabilitamos según la opción elegida
        switch (viaPago) {
            case '1': // DEPOSITO EN CUENTA
                //tipoSucafi.disabled = true;
                //tipoSucafi.selectedIndex = 0;
                break;
            case '2': // TRANSFERENCIA AFP
                tipoBcoafi.disabled = true;
                tipoBcoafi.selectedIndex = 0;
                tipoctaafi.disabled = true;
                tipoctaafi.selectedIndex = 0;
                numeroctaafi.disabled = true;
                numerocciafi.disabled = true;
                break;
            case '3': // VENTANILLA BANCO
                //tipoSucafi.disabled = true;
                //tipoSucafi.selectedIndex = 0;
                tipoctaafi.disabled = true;
                tipoctaafi.selectedIndex = 0;
                numeroctaafi.disabled = true;
                numerocciafi.disabled = true;
                break;
            case 'Seleccionar':
                //tipoSucafi.disabled = true;
                //tipoSucafi.selectedIndex = 0;
                tipoBcoafi.disabled = true;
                tipoBcoafi.selectedIndex = 0;
                tipoctaafi.disabled = true;
                tipoctaafi.selectedIndex = 0;
                numeroctaafi.disabled = true;
                numerocciafi.disabled = true;
                break;
        }
    }
});


