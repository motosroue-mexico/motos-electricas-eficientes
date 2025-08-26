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

  // ---- Lecturas de productos (sin localStorage): inline / data-attr / fetch ----
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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      return Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
    } catch (err) {
      console.warn('[carruselMotos] fetch error:', err);
      return [];
    }
  }
  // ------------------------------------------------------------

  function init() {
    if (started) return;
    started = true;

    let products = readProductsInline();
    if (!products.length) products = readProductsFromDataset();
    console.debug('[carruselMotos] productos iniciales (sin LS):', products.length);

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
      const nxt = products[(i + 1) % len];
      const pre = pickSrc(nxt);
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

    // Si en tu app externa despachas el evento con los productos, actualiza aquí
    document.addEventListener('woo:products:ready', (ev) => {
      const arr = ev?.detail;
      const next = Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
      console.debug('[carruselMotos] woo:products:ready ->', next.length);
      products = next;
    }, { once: false });

    // Intento de carga desde endpoint si no hubo inline/dataset
    (async () => {
      if (!products.length) {
        const fetched = await fetchProductsFromEndpoint();
        if (fetched.length) {
          products = fetched;
          console.debug('[carruselMotos] fetched ->', products.length);
        } else {
          console.warn('[carruselMotos] Sin productos (inline/dataset/fetch falló)');
        }
      }
    })();

    // Si el HTML de #carruselMotos se inserta tarde, reintenta leer data-products
    if (!root) {
      const mo = new MutationObserver(() => {
        const { root } = getRefs();
        if (root && !root.dataset.idx) root.dataset.idx = '-1';
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
