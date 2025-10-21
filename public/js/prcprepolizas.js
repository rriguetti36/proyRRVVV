let inputUbigeoTarget = null;

// Detecta qué botón abrió el modal
// $('#modalUbigeo').on('show.bs.modal', function (e) {
//   const button = e.relatedTarget;
//   inputUbigeoTarget = $(button).data('target-input'); // por ejemplo "#txtUbigeoExp"
// });

// Al hacer clic en cualquier botón que abre el modal
$(document).on('click', '.btnUbigeo', function () {
    inputUbigeoTarget = $(this).data('targetinput'); // guarda el id del input destino
    $('#modalUbigeo').modal('show');
});

$(document).ready(function () {
    // Inicializar Select2 con dropdown dentro del modal
    $('#regionSelect, #provinciaSelect').select2({
        dropdownParent: $('#modalUbigeo'),
        width: '100%',
        placeholder: 'Seleccione...',
        allowClear: true
    });

    // === Select2 AJAX para búsqueda de distritos (funciona aunque no haya provincias cargadas) ===
    $('#distritoSelect').select2({
        dropdownParent: $('#modalUbigeo'),
        width: '100%',
        placeholder: 'Buscar distrito por nombre...',
        allowClear: true,
        minimumInputLength: 2,
        ajax: {
            url: '/cotizador/api/distritos-search',
            dataType: 'json',
            delay: 250,
            data: function (params) {
                return { q: params.term }; // query
            },
            processResults: function (data) {
                // data debe venir como { results: [{id,text}, ...] }
                return data;
            },
            cache: true
        }
    });

    $('#modalUbigeo').on('show.bs.modal', function () {
        const selectRegion = $('#regionSelect');
        const selectProvincia = $('#provinciaSelect');
        const selectDistrito = $('#distritoSelect');

        // Vaciar selects y reiniciar estados
        selectRegion.val(null).empty().append('<option value=""></option>').trigger('change.select2');
        selectProvincia.val(null).empty().append('<option value=""></option>').trigger('change.select2');
        selectDistrito.val(null).empty().append('<option value=""></option>').trigger('change.select2');
    });

    // Cargar regiones al abrir modal
    $('#modalUbigeo').on('shown.bs.modal', async function () {
        const selectRegion = $('#regionSelect');
        selectRegion.html('<option value="">Cargando...</option>');
        try {
            const res = await fetch('/cotizador/api/regiones');
            const regiones = await res.json();
            selectRegion.empty().append('<option value=""></option>');
            regiones.forEach(r => selectRegion.append(new Option(r.v_nombre, r.id)));
            // trigger update for select2
            selectRegion.trigger('change.select2');
        } catch (err) {
            console.error('Error al cargar regiones:', err);
            selectRegion.html('<option>Error</option>');
        }
    });

    // Cuando cambia Región -> cargar Provincias
    $('#regionSelect').on('change', async function () {
        const idRegion = $(this).val();
        const selectProvincia = $('#provinciaSelect');
        const selectDistrito = $('#distritoSelect');

        //selectProvincia.prop('disabled', true).empty().append('<option value=""></option>').trigger('change.select2');
        //selectDistrito.prop('disabled', true).empty().append('<option value=""></option>').trigger('change.select2');

        if (!idRegion) return;

        try {
            const res = await fetch(`/cotizador/api/provincias/${idRegion}`);
            const provincias = await res.json();
            selectProvincia.empty().append('<option value=""></option>');
            provincias.forEach(p => selectProvincia.append(new Option(p.v_nombre, p.id)));
            //selectProvincia.prop('disabled', false).trigger('change.select2');
        } catch (err) {
            console.error('Error al cargar provincias:', err);
            selectProvincia.html('<option>Error</option>');
        }
    });

    // Cuando cambia Provincia -> cargar Distritos (esto llena la lista normal si quieres)
    $('#provinciaSelect').on('change', async function () {
        const idProvincia = $(this).val();
        const selectDistrito = $('#distritoSelect');

        //selectDistrito.prop('disabled', true).empty().append('<option value=""></option>').trigger('change.select2');

        if (!idProvincia) return;

        try {
            const res = await fetch(`/cotizador/api/distritos/${idProvincia}`);
            const distritos = await res.json();

            // si quieres poblar el select con opciones (ademas del modo AJAX)
            selectDistrito.empty().append('<option value=""></option>');
            distritos.forEach(d => selectDistrito.append(new Option(d.v_nombre, d.id)));
            //selectDistrito.prop('disabled', false).trigger('change.select2');
        } catch (err) {
            console.error('Error al cargar distritos:', err);
            selectDistrito.html('<option>Error</option>');
        }
    });

    // Cuando se selecciona un distrito (desde la búsqueda AJAX o desde la lista poblada)
    $('#distritoSelect').on('select2:select', async function (e) {
        const idDistrito = e.params.data.id;
        if (!idDistrito) return;

        try {
            const res = await fetch(`/cotizador/api/distrito-info/${idDistrito}`);
            if (!res.ok) throw new Error('No encontrado');
            const info = await res.json();
            // info: { idDistrito, distrito, idProvincia, provincia, idRegion, region }
            // 1) Setear region
            $('#regionSelect').val(info.idRegion).trigger('change.select2');

            // 2) Cargar provincias de esa region, luego setear provincia
            const provRes = await fetch(`/cotizador/api/provincias/${info.idRegion}`);
            const provincias = await provRes.json();
            $('#provinciaSelect').empty().append('<option value=""></option>');
            provincias.forEach(p => $('#provinciaSelect').append(new Option(p.v_nombre, p.id)));
            $('#provinciaSelect').val(info.idProvincia).trigger('change.select2');

            // 3) Cargar distritos de esa provincia y setear el distrito seleccionado
            const distRes = await fetch(`/cotizador/api/distritos/${info.idProvincia}`);
            const distritos = await distRes.json();
            $('#distritoSelect').empty().append('<option value=""></option>');
            distritos.forEach(d => $('#distritoSelect').append(new Option(d.v_nombre, d.id)));
            // ahora setear el seleccionado en select2 (necesitamos trigger)
            $('#distritoSelect').val(info.idDistrito).trigger('change.select2');

            // 4) Mostrar texto resumen en el input principal
            $('#txtUbigeo').val(`${info.region} / ${info.provincia} / ${info.distrito}`);
        } catch (err) {
            console.error('Error al obtener info del distrito:', err);
        }
    });

    // Botón seleccionar (en modal) para cerrar y dejar el texto en el input si no viene por select2:select
    $('#btnSeleccionarUbigeo').on('click', function () {
        const idDistrito = $('#distritoSelect').val();

        if (!inputUbigeoTarget) {
            console.warn("No se definió input destino");
            return;
        }

        const $inputDestino = $('#' + inputUbigeoTarget);

        if (!idDistrito) {
            // si no hay distrito seleccionado, intenta tomar labels de selects
            const regionText = $('#regionSelect option:selected').text() || '';
            const provText = $('#provinciaSelect option:selected').text() || '';
            const distText = $('#distritoSelect option:selected').text() || '';
            const text = [regionText, provText, distText].filter(Boolean).join(' / ');
            if (text) $('#txtUbigeo').val(text);
            $('#modalUbigeo').modal('hide');
            return;
        }
        // si hay idDistrito, obtener info rápida y setear
        (async () => {
            const res = await fetch(`/cotizador/api/distrito-info/${idDistrito}`);
            const info = await res.json();
            //$('#txtUbigeoExp').val(`${info.region} / ${info.provincia} / ${info.distrito}`);
            $inputDestino.val(`${info.region} / ${info.provincia} / ${info.distrito}`);
            $('#modalUbigeo').modal('hide');
        })();
    });

    // Asegúrate de que el dropdown de select2 esté por encima del modal
    $('<style>').prop('type', 'text/css').html(`
    .select2-container { z-index: 2100 !important; }
    .select2-container--open { z-index: 2100 !important; }
  `).appendTo('head');

    // --- FIX completo para modal Ubigeo ---
    $('#modalUbigeo').on('hidden.bs.modal', function () {
        // 1️⃣ Asegura que cualquier dropdown Select2 quede cerrado
        $('.select2-container--open').removeClass('select2-container--open');
        $('.select2-dropdown').remove();

        // 2️⃣ Limpia backdrop si Bootstrap no lo hizo
        $('.modal-backdrop').remove();

        // 3️⃣ Restablece scroll y estado del body
        $('body').removeClass('modal-open');
        $('body').css('overflow', '');

        // 4️⃣ Limpia posibles estilos inline que bloqueen nuevos modales
        $('body').css('padding-right', '');

        // 5️⃣ Vuelve a permitir que el modal pueda abrirse nuevamente
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalUbigeo'));
        if (modal) modal.dispose(); // elimina instancia vieja
    });
});
