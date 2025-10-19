document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll('#tasasTabs .nav-link');

  const moduleScripts = {
    limites: '/js/limitesIni.js',
    rentabilidad: '/js/rentabilidad.js',
    promedio: '/js/promedio.js',
    curva: '/js/curva.js'
  };

  tabs.forEach(tab => {
    tab.addEventListener("shown.bs.tab", async (event) => {
      const nombre = event.target.dataset.nombre.trim().toLowerCase();
      const nombrejs = event.target.dataset.script.trim().toLowerCase();
      const targetId = event.target.getAttribute("data-bs-target");
      const contenedor = document.querySelector(targetId);

      // Evita recargar si ya cargó
      if (contenedor.dataset.loaded === "true") return;

      contenedor.innerHTML = `
        <div class="text-center text-muted py-4">
          <div class="spinner-border text-primary"></div>
          <p class="mt-2 mb-0">Cargando módulo <strong>${nombre}</strong>...</p>
        </div>
      `;

      try {
        const res = await fetch(`/cotizador/api/modulo/${encodeURIComponent(nombre)}`);
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const html = await res.text();
        contenedor.innerHTML = html;
        contenedor.dataset.loaded = "true";

        // Cargar script solo si hay uno asociado
        const scriptPath = moduleScripts[nombrejs];
        if (scriptPath) {
          // Evitar cargarlo nuevamente si ya existe
          const alreadyLoaded = document.querySelector(`script[src="${scriptPath}"]`);
          if (!alreadyLoaded) {
            const script = document.createElement("script");
            script.src = scriptPath;
            script.defer = true;
            script.onload = () => {
              console.log(`✅ Script ${nombrejs} cargado`);
              runInit(nombrejs, contenedor);
            };
            document.body.appendChild(script);
          } else {
            console.log(`🔁 Reejecutando init de ${nombrejs}`);
            runInit(nombrejs, contenedor);
          }
        }

      } catch (err) {
        contenedor.innerHTML = `<div class="alert alert-danger">Error al cargar módulo ${nombre}: ${err.message}</div>`;
      }
    });
  });

  // Cargar automáticamente la primera pestaña
  const activeTab = document.querySelector('#tasasTabs .nav-link.active');
  if (activeTab) activeTab.dispatchEvent(new Event('shown.bs.tab'));
});

// 🔹 Función helper para ejecutar init del módulo pasándole el contenedor
function runInit(nombrejs, contenedor) {
  const initFn = window[`init${nombrejs.charAt(0).toUpperCase() + nombrejs.slice(1)}`];
  if (typeof initFn === "function") initFn(contenedor);
}
