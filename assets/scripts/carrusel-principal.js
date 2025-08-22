
(() => {
  let started = false;

  // Helpers de selección (rebuscan por si el HTML se montó tarde)
  function getRefs() {
    const root = document.getElementById('carruselMotos');
    if (!root) return {};
    return {
      root,
      img: root.querySelector('img.motos'),
      h2:  root.querySelector('h2'),
    };
  }

  // Lectura inicial del cache
  function readProductsFromCache() {
    try {
      const cached = localStorage.getItem('woo:products');
      if (!cached) return [];
      const arr = JSON.parse(cached);
      return Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
    } catch {
      return [];
    }
  }

  function init() {
    if (started) return;
    started = true;

    let products = readProductsFromCache();

    // Mantener XFX hasta primer click
    const { root } = getRefs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';

    const pickSrc = p =>
      p?.acf?.['imagen-landing']?.url ||
      p?.acf?.['imagen-landing'] ||
      p?.image || '';

    const pickTitle = p =>
      p?.acf?.['nombre-landing'] || p?.name || '';

    function renderByIndex(nextIndex) {
      if (!products.length) return;

      const { root, img, h2 } = getRefs();
      if (!root || !img || !h2) return;

      const len = products.length;
      const i = ((nextIndex % len) + len) % len;
      const p = products[i];

      const src = pickSrc(p);
      const ttl = pickTitle(p);

      if (src) img.src = src;
      if (ttl) {
        h2.textContent = ttl;
        img.alt = ttl;
        img.title = ttl;
      }
      root.dataset.idx = String(i);

      // Precarga siguiente
      const next = products[(i + 1) % len];
      const pre = pickSrc(next);
      if (pre) { const im = new Image(); im.src = pre; }
    }

    function move(delta) {
      if (!products.length) return;
      const { root } = getRefs();
      if (!root) return;
      const current = parseInt(root.dataset.idx ?? '-1', 10);
      renderByIndex((Number.isNaN(current) ? -1 : current) + delta);
    }

    // Delegación de eventos para que funcione aunque el DOM cambie
    document.addEventListener('click', (e) => {
      const der = e.target.closest('#motoDer');
      const izq = e.target.closest('#motoIzq');
      if (!der && !izq) return;

      // Evita navegación si son <a>
      e.preventDefault();
      e.stopPropagation();

      // No intentes mover si aún no hay productos
      if (!products.length) return;

      if (der) move(1);
      else if (izq) move(-1);
    });

    // Actualiza productos cuando llegue tu evento
    document.addEventListener('woo:products:ready', (ev) => {
      const arr = ev?.detail;
      products = Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
      // No render aquí: mantenemos XFX hasta que el usuario haga click
    }, { once: false });

    // Por si el HTML de #carruselMotos se inserta tarde, ajusta idx cuando exista
    if (!root) {
      const mo = new MutationObserver(() => {
        const { root } = getRefs();
        if (root && !root.dataset.idx) root.dataset.idx = '-1';
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      // El observer puede quedarse; es barato y solo setea data-idx si falta.
    }
  }

  // Inicia cuando el DOM esté listo y también cuando tu loader lo indique
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  document.addEventListener('components:all-ready', init, { once: true });
})();
