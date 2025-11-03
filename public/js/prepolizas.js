
document.addEventListener("DOMContentLoaded", () => {
    // Cargar cotizaciones
    async function cargarCotizaciones(dni = "") {
        const res = await fetch(`/emision/api/cotizaciones?dni=${dni}`);
        const data = await res.json();
        const tbody = document.querySelector("#tablaCotizaciones tbody");
        tbody.innerHTML = "";
        data.forEach((row, i) => {
            tbody.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${row.num_cot}</td>
          <td>${row.num_cuspp}</td>
          <td>${row.afiliado}</td>
          <td>
            <div class="btn-group">
              <a href="/emision/prcprepoliza/${row.id_cot}" class="btn btn-sm btn-outline-primary">
  Pre-Poliza
</a>
            </div>
          </td>
        </tr>`;
        });
    }

    // Cargar pólizas
    async function cargarPolizas(dni = "") {
        const res = await fetch(`/emision/api/polizas?dni=${dni}`);
        const data = await res.json();
        const tbody = document.querySelector("#tablaPolizas tbody");
        tbody.innerHTML = "";
        data.forEach((row, i) => {
            tbody.innerHTML += `
        <tr>
          <td>${i + 1}</td>
          <td>${row.num_pol}</td>
          <td>${row.num_cuspp}</td>
          <td>${row.afiliado}</td>
          <td>
            <div class="btn-group">
              <a href="/emision/prcprepoliza/${row.id_cot}" class="btn btn-sm btn-outline-primary">Pre-Póliza</a>
              <a href="/emision/prcprepoliza/${row.id_cot}" class="btn btn-sm btn-outline-secondary">Recepción AFP</a>
              <a href="/emision/prcprepoliza/${row.id_cot}" class="btn btn-sm btn-outline-success">Emisión AFP</a>
            </div>
          </td>
        </tr>`;
        });
    }

    // Eventos de búsqueda
    document.getElementById("btnBuscarCot").addEventListener("click", () => {
        const dni = document.getElementById("buscarCot").value.trim();
        cargarCotizaciones(dni);
    });

    document.getElementById("btnBuscarPol").addEventListener("click", () => {
        const dni = document.getElementById("buscarPol").value.trim();
        cargarPolizas(dni);
    });

    // Cargar inicial
    cargarCotizaciones();
    cargarPolizas();
});