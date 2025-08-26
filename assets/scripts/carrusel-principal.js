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

  // ---- Lecturas de productos (cache / inline / data-attr) ----
  function readProductsFromCache() {
    try {
      const cached = localStorage.getItem('woo:products');
      if (!cached) return [];
      const arr = JSON.parse(cached);
      return Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
    } catch { return []; }
  }

  function readProductsInline() {
    const tag = document.getElementById('woo-products-json'); // <script type="application/json" id="woo-products-json">[...]</script>
    if (!tag) return [];
    try {
      const arr = JSON.parse(tag.textContent || '[]');
      return Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
    } catch { return []; }
  }

  function readProductsFromDataset() {
    const { root } = getRefs();
    if (!root?.dataset?.products) return [];
    try {
      const arr = JSON.parse(root.dataset.products);
      return Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
    } catch { return []; }
  }

  function readProductsFromAnywhere() {
    const a = readProductsFromCache();
    if (a.length) return a;
    const b = readProductsInline();
    if (b.length) return b;
    const c = readProductsFromDataset();
    if (c.length) return c;
    return [];
  }
  // ------------------------------------------------------------

  function init() {
    if (started) return;
    started = true;

    let products = readProductsFromAnywhere();
    console.debug('[carruselMotos] productos iniciales:', products.length);

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

      e.preventDefault();
      e.stopPropagation();

      if (!products.length) return;

      if (der) move(1);
      else if (izq) move(-1);
    });

    // Actualiza productos cuando llegue tu evento (mantén XFX hasta click)
    document.addEventListener('woo:products:ready', (ev) => {
      const arr = ev?.detail;
      const next = Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
      console.debug('[carruselMotos] woo:products:ready ->', next.length);
      products = next;
      // persiste para próximas visitas/perfiles del mismo origen
      try { localStorage.setItem('woo:products', JSON.stringify(next)); } catch {}
    }, { once: false });

    // Si otro tab (mismo origen) actualiza el cache, sincroniza
    window.addEventListener('storage', (e) => {
      if (e.key !== 'woo:products') return;
      try {
        const arr = JSON.parse(e.newValue || '[]');
        const next = Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
        console.debug('[carruselMotos] storage woo:products ->', next.length);
        products = next;
      } catch {}
    });

    // Si el HTML de #carruselMotos se inserta tarde, solo inicializa idx y reintenta leer data-products
    if (!root) {
      const mo = new MutationObserver(() => {
        const { root } = getRefs();
        if (root && !root.dataset.idx) {
          root.dataset.idx = '-1';
        }
        if (root && !products.length) {
          const fromData = readProductsFromDataset();
          if (fromData.length) {
            products = fromData;
            console.debug('[carruselMotos] dataset fallback ->', products.length);
          }
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
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
