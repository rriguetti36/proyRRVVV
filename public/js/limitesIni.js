function initLimites(root) {
  // root es el contenedor del EJS cargado dinámicamente
  root = root || document;

  console.log("🚀 Inicializando módulo de Límites...");

  const uploadBtn = root.querySelector('#btnUpload');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      const fileInput = root.querySelector('#archivoXLS');
      const formData = new FormData();
      formData.append('archivoXLS', fileInput.files[0]);

      try {
        const response = await fetch('/cotizador/api/upload', { method: 'POST', body: formData });
        const data = await response.json();
        console.log(data);
        if (data.ok) {
          Swal.fire("✅", "Dato Actulizado correctamente", "success");

          const ultimaFecha = data.ultimaFecha;
          if (ultimaFecha) {
            const filtroFecha = root.querySelector('#filtroFecha');
            const optionExiste = Array.from(filtroFecha.options).some(opt => opt.value === ultimaFecha);
            if (!optionExiste) {
              const nuevaOption = document.createElement('option');
              nuevaOption.value = ultimaFecha;
              nuevaOption.textContent = ultimaFecha;
              filtroFecha.prepend(nuevaOption);
            }
            filtroFecha.value = ultimaFecha;
            await filtrarTasas({ root, fecha: ultimaFecha });
          }

        } else {
          Swal.fire("❌", data.error, "error");
        }
      } catch (error) {
        console.error('Error al cargar archivo:', error);
        Swal.fire("❌", error, "error");
      }
    });
  }

  // Inicializar selects
  const selects = {
    region: root.querySelector("#region"),
    moneda: root.querySelector("#moneda"),
    prestacion: root.querySelector("#prestacion"),
    filtroFecha: root.querySelector("#filtroFecha")
  };

  for (const [key, el] of Object.entries(selects)) {
    if (!el) {
      console.warn(`⚠️ No se encontró el elemento: ${key}`);
      return;
    }
  }

  cargarRegiones(selects.region);
  cargarMonedas(selects.moneda);
  cargarPrestaciones(selects.prestacion);

  // Eventos de cambio
  selects.region.addEventListener("change", () => filtrarTasas({ root }));
  selects.moneda.addEventListener("change", () => filtrarTasas({ root }));
  selects.prestacion.addEventListener("change", () => filtrarTasas({ root }));
  selects.filtroFecha.addEventListener("change", () => filtrarTasas({ root }));
  initGuardarTasas(root);
  console.log("✅ Eventos inicializados correctamente en límites.");
}

function initGuardarTasas(root) {
  root = root || document;

  // Delegación de eventos: escucha clicks en cualquier botón dentro del contenedor
  root.addEventListener('click', async e => {
    if (!e.target.classList.contains('btnGuardar')) return;

    const tr = e.target.closest('tr');
    if (!tr) return;

    const id = tr.dataset.id;
    const n_valtasini = tr.querySelector('.valtas')?.value || 0;
    const n_valtirini = tr.querySelector('.valtir')?.value || 0;
    const n_valperini = tr.querySelector('.valper')?.value || 0;

    // 🔹 Determinar tipo según pestaña
    const tipo = root.dataset.tipo; // ej: <div id="limitesTab" data-tipo="estudio">

    try {
      const res = await fetch('/cotizador/api/actualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, n_valtasini, n_valtirini, n_valperini, tipo })
      });
      const data = await res.json();
      if (data.success) Swal.fire("✅", "Dato actualizado correctamente", "success");
      else Swal.fire("❌", data.error || "Error desconocido", "error");
    } catch (err) {
      console.error("❌ Error al guardar fila:", err);
      Swal.fire("❌", err.message || "Error al guardar", "error");
    }
  });
}
// Filtrar tasas adaptado para root
async function filtrarTasas({ root, fecha } = {}) {
  root = root || document;
  const region = root.querySelector('#region')?.value || '';
  const moneda = root.querySelector('#moneda')?.value || '';
  const prestacion = root.querySelector('#prestacion')?.value || '';
  const filtroFecha = fecha || root.querySelector('#filtroFecha')?.value || '';

  const params = new URLSearchParams({ region, moneda, prestacion, fecha: filtroFecha });
  const res = await fetch(`/cotizador/api/filtrar?${params}`);
  const data = await res.json();

  if (data.success) {
    const tbody = root.querySelector('#tablaTasas tbody');
    if (!tbody) return;
    tbody.innerHTML = data.data.map(t => `
      <tr data-id="${t.id}">
        <td>${t.region}</td>
        <td>${t.moneda}</td>
        <td>${t.prestacion}</td>
        <td><input class="form-control form-control-sm valtas" type="number" value="${t.n_valtasini ?? ''}"></td>
        <td><input class="form-control form-control-sm valtir" type="number" value="${t.n_valtirini ?? ''}"></td>
        <td><input class="form-control form-control-sm valper" type="number" value="${t.n_valperini ?? ''}"></td>
        <td><button class="btn btn-success btn-sm btnGuardar">💾</button></td>
      </tr>
    `).join('');
  }
}
// Cargar datos en selects adaptados
async function cargarRegiones(sel) {
  try {
    const res = await fetch(`/cotizador/api/regiones`);
    const data = await res.json();
    sel.innerHTML = `<option value="">-- Seleccionar --</option>`;
    data.forEach(r => sel.innerHTML += `<option value="${r.id}">${r.v_nombre}</option>`);
  } catch (err) { console.error(err); }
}
async function cargarMonedas(sel) {
  try {
    const res = await fetch(`/cotizador/api/monedas`);
    const data = await res.json();
    sel.innerHTML = `<option value="">-- Seleccionar --</option>`;
    data.forEach(m => sel.innerHTML += `<option value="${m.v_cod}">${m.v_nombre}</option>`);
  } catch (err) { console.error(err); }
}
async function cargarPrestaciones(sel) {
  try {
    const res = await fetch(`/cotizador/api/prestaciones`);
    const data = await res.json();
    sel.innerHTML = `<option value="">-- Seleccionar --</option>`;
    data.forEach(p => sel.innerHTML += `<option value="${p.v_cod}">${p.v_nombre}</option>`);
  } catch (err) { console.error(err); }
}


// document.addEventListener('click', async e => {
//   if (e.target.classList.contains('btnGuardar')) {
//     const tr = e.target.closest('tr');
//     const id = tr.dataset.id;
//     const n_valtasini = tr.querySelector('.valtas').value;
//     const n_valtirini = tr.querySelector('.valtir').value;
//     const n_valperini = tr.querySelector('.valper').value;
//     const res = await fetch('/cotizador/api/actualizar',
//       {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ id, n_valtasini, n_valtirini, n_valperini })
//       });
//     const data = await res.json();
//     if (data.success) Swal.fire("✅", "Dato Actulizado correctamente", "success");
//     else Swal.fire("❌", data.error, "error");
//   }
// });