(() => {
  let started = false;
  let observersReady = false;

  // Helpers de selección (rebuscan por si el HTML se montó tarde)
  function getRefs() {
    const root = document.getElementById('carruselMotos');
    if (!root) return {};
    return {
      root,
      img: root.querySelector('img.motos'),
      h2:  root.querySelector('h2'),
      box: root.querySelector('figcaption') || root, // contenedor para ajustar el texto
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

  // Programar un ajuste tras el siguiente frame
  function scheduleFit() {
    const { h2, box } = getRefs();
    if (!h2 || !box) return;
    requestAnimationFrame(() => fitText(h2, box, { min: 14, max: 64, precision: 0.5 }));
  }

  function ensureObservers() {
    if (observersReady) return;
    const { h2, box } = getRefs();
    if (!h2 || !box) return;

    new ResizeObserver(scheduleFit).observe(box);
    new MutationObserver(scheduleFit).observe(h2, { childList: true, characterData: true, subtree: true });

    if (document.fonts?.ready) {
      document.fonts.ready.then(scheduleFit).catch(() => {});
    }
    window.addEventListener('resize', scheduleFit);
    observersReady = true;
    scheduleFit();
  }
  // ---------------------------------------------------------

  function init() {
    if (started) return;
    started = true;

    let products = readProductsFromCache();

    // Mantener XFX hasta primer click
    const { root } = getRefs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';

    ensureObservers();

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
        scheduleFit(); // ajustar tamaño del título después de cambiar el texto
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

      e.preventDefault();
      e.stopPropagation();

      if (!products.length) return;

      if (der) move(1);
      else if (izq) move(-1);
    });

    // Actualiza productos cuando llegue tu evento (mantén XFX hasta click)
    document.addEventListener('woo:products:ready', (ev) => {
      const arr = ev?.detail;
      products = Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
      scheduleFit(); // por si cambia el layout
    }, { once: false });

    // Si el HTML de #carruselMotos se inserta tarde
    if (!root) {
      const mo = new MutationObserver(() => {
        const { root } = getRefs();
        if (root && !root.dataset.idx) root.dataset.idx = '-1';
        ensureObservers();
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } else {
      scheduleFit();
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
