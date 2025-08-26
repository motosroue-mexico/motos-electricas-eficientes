// /assets/scripts/carrusel-principal.js
(() => {
  let started = false;

  // ==== helpers ====
  function getRefs() {
    const root = document.getElementById('carruselMotos');
    if (!root) return {};
    return {
      root,
      img: root.querySelector('img.motos'),
      h2:  root.querySelector('h2'),
    };
  }

  // Fuentes de datos (sin localStorage)
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

  async function fetchProductsFromEndpoint() {
    const { root } = getRefs();
    const url = root?.dataset?.endpoint || window.WOO_PRODUCTS_ENDPOINT;
    if (!url) return [];
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      return Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
    } catch { return []; }
  }

  async function hydrateProducts() {
    let products = readProductsInline();
    if (!products.length) products = readProductsFromDataset();
    if (!products.length) products = await fetchProductsFromEndpoint();
    return products;
  }

  function pickSrc(p) {
    return p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  }
  function pickTitle(p) {
    return p?.acf?.['nombre-landing'] || p?.name || '';
  }

  // ==== init ====
  function init() {
    if (started) return;
    started = true;

    const { root } = getRefs();
    if (!root) return;
    if (!root.dataset.idx) root.dataset.idx = '-1'; // mantener XFX hasta primer click

    let products = [];

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
      if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }
      root.dataset.idx = String(i);

      // Precarga de la siguiente imagen
      const pre = pickSrc(products[(i + 1) % len]);
      if (pre) { const im = new Image(); im.src = pre; }
    }

    function move(delta) {
      if (!products.length) return;
      const { root } = getRefs();
      if (!root) return;
      const current = parseInt(root.dataset.idx ?? '-1', 10);
      renderByIndex((Number.isNaN(current) ? -1 : current) + delta);
    }

    // Navegación (delegada)
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

    // Recibir datos por evento externo
    document.addEventListener('woo:products:ready', (ev) => {
      const arr = ev?.detail;
      const next = Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
      if (next.length) {
        products = next;
        if (root.dataset.idx === '-1') renderByIndex(0);
      }
    }, { once: false });

    // Hidratar cuando el propio componente queda listo
    document.addEventListener('component:ready', async ({ detail }) => {
      if (detail?.id === 'carruselMotos') {
        const next = await hydrateProducts();
        if (next.length) {
          products = next;
          if (root.dataset.idx === '-1') renderByIndex(0);
        }
      }
    }, { once: true });

    // Respaldo cuando todos los componentes declaran estar listos
    document.addEventListener('components:all-ready', async () => {
      if (products.length) return;
      const next = await hydrateProducts();
      if (next.length) {
        products = next;
        if (root.dataset.idx === '-1') renderByIndex(0);
      }
    }, { once: true });

    // Detectar inyección tardía de data-products en el root
    const mo = new MutationObserver(() => {
      const next = readProductsFromDataset();
      if (next.length) {
        products = next;
        if (root.dataset.idx === '-1') renderByIndex(0);
        mo.disconnect();
      }
    });
    mo.observe(root, { attributes: true, attributeFilter: ['data-products'] });

    // Primera hidratación inmediata
    (async () => {
      const next = await hydrateProducts();
      if (next.length) {
        products = next;
        if (root.dataset.idx === '-1') renderByIndex(0);
      }
    })();
  }

  // ==== bootstrap: espera a que exista #carruselMotos antes de iniciar ====
  function waitForElement(selector, { timeout = 15000 } = {}) {
    return new Promise(resolve => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const el2 = document.querySelector(selector);
        if (el2) { obs.disconnect(); resolve(el2); }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
    });
  }

  (async () => {
    await waitForElement('#carruselMotos'); // no inicia hasta que exista
    init();
  })();
})();
