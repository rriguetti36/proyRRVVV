// public/js/tasasInversiones.js

function initRentabilidad(root) {

  let ini = 0;
  root = root || document;

  const btnFiltrar = root.querySelector('#btnFiltrar');
  const btnGuardar = root.querySelector('#btnGuardarRentabilidad');
  const container = root.querySelector('#inputsContainer');
  const selectMoneda = root.querySelector('#selMoneda'); // <-- unificamos nombre
  const filtroFecha = root.querySelector('#filtroFecha');
  //const btnAdd = root.querySelector('#btnAddAnio');
  const btnAddPer = root.querySelector('#btnNuevoPer');

  // Al hacer clic en "Filtrar"
  filtroFecha.addEventListener('change', filtrarDatos);

  // También filtra automáticamente al cambiar la moneda
  selectMoneda.addEventListener('change', filtrarDatos);

  //Agregar inputs 
  //btnAdd.addEventListener('click', () => agregarInput('', ''));
  btnAddPer.addEventListener('click', () => renderInputsNuevo('', ''));

  // Cargar datos al seleccionar moneda + fecha
  async function filtrarDatos() {
    ini = 0;
    const fecha = filtroFecha.value;
    const idmoneda = selectMoneda.value;

    if (!idmoneda || !fecha) {
      alert('Seleccione una fecha y una moneda');
      return;
    }

    try {
      const res = await fetch(`/cotizador/api/filtrarRentabilidad?fecha=${fecha}&idmoneda=${idmoneda}`);
      const data = await res.json();
      renderInputs(data);
    } catch (err) {
      console.error('Error al filtrar:', err);
      Swal.fire("❌", "No se pudieron cargar los datos.", "Alerta");
    }
  }

  // Render dinámico de inputs
  function renderInputs(data) {
    ini = 0;
    container.innerHTML = '';
    if (!data || data.length === 0) {
      ini = 1;
      container.innerHTML = `<p class="text-muted text-center">No hay datos. Puede ingresar nuevos valores.</p>`;
      //agregarInput(1, ''); // crear uno por defecto
      //Botón para agregar más años
      const btnAdd = document.createElement('button');
      btnAdd.className = 'btn btn btn-primary mt-3';
      btnAdd.textContent = 'Agregar año';
      btnAdd.addEventListener('click', () => agregarInput('', ''));
      container.appendChild(btnAdd);
      return;
    }

    data.forEach((item, i) => {
      agregarInput(item.annio, item.n_valor);
    });

    //Botón para agregar más años
    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn btn btn-primary mt-3';
    btnAdd.textContent = 'Agregar año';
    btnAdd.addEventListener('click', () => agregarInput('', ''));
    container.appendChild(btnAdd);
  }

  // Render dinámico de inputs
  function renderInputsNuevo() {
    
    //console.log('selectedIndex:', filtroFecha.selectedIndex);
    //console.log('text:', filtroFecha.options[filtroFecha.selectedIndex].text);
    //console.log('value:', filtroFecha.value);

    const fechaOpt = filtroFecha.value
    const hoy = new Date();
    const fechahoy = hoy.toISOString().split('T')[0];

    if (fechaOpt == fechahoy) {
      Swal.fire("❌", "Ya existen datos guardados con la fecha de hoy!.", "Alerta");
      return;
    }

    ini = 1;
    container.innerHTML = '';
    ///agregarInput(1, ''); // crear uno por defecto
    //Botón para agregar más años
    const btnAdd = document.createElement('button');
    btnAdd.className = 'btn btn btn-primary mt-3';
    btnAdd.textContent = 'Agregar año';
    btnAdd.addEventListener('click', () => agregarInput('', ''));
    container.appendChild(btnAdd);
    return;
  }

  // Función para crear par de inputs año / valor
  function agregarInput(annio, valor) {
    const div = document.createElement('div');
    div.className = 'row g-2 align-items-center mb-2';
    div.innerHTML = `
      <div class="col-md-2 text-end">
        <label class="form-label mb-0">Año:</label>
      </div>
      <div class="col-md-2">
        <input type="number" class="form-control annio" value="${annio || ''}" placeholder="Ej: 1">
      </div>
      <div class="col-md-2 text-end">
        <label class="form-label mb-0">Valor:</label>
      </div>
      <div class="col-md-2">
        <input type="number" class="form-control n_valor" step="0.001" value="${valor || ''}" placeholder="Ej: 3.24">
      </div>
      
    `;
    container.appendChild(div);
    // <div class="col-md-2">
    //   <button class="btn btn-outline-danger btn-sm btnEliminar">✕</button>
    // </div>
    // div.querySelector('.btnEliminar').addEventListener('click', () => div.remove());
  }

  // Guardar
  btnGuardar.addEventListener('click', async () => {

    let fecha = document.getElementById('filtroFecha').value;
    const hoy = new Date();
    if (ini == 1) {
      fecha = hoy.toISOString().split('T')[0];
    }
    const idmoneda = document.getElementById('selMoneda').value;
    const annioInputs = container.querySelectorAll('.annio');
    const valorInputs = container.querySelectorAll('.n_valor');

    const registros = Array.from(annioInputs).map((input, i) => ({
      annio: input.value,
      idmoneda,
      n_valor: valorInputs[i].value,
      activo: 1,
      f_creacion: fecha
    }));

    const res = await fetch('/cotizador/api/guardarRentabilidad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registros })
    });

    const data = await res.json();
    if (data.success) Swal.fire("✅", "Dato actualizado correctamente", "success");
    else Swal.fire("❌", data.error || "Error desconocido", "error");
  });
}


