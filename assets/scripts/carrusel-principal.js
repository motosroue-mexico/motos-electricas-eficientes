// /assets/scripts/carrusel-principal.js
(() => {
  let products = [];
  let idx = -1;
  let fetching = false;
  let inited = false;

  function getRefs() {
    const root = document.getElementById('carruselMotos');
    if (!root) return {};
    return {
      root,
      img: root.querySelector('img.motos'),
      h2:  root.querySelector('h2'),
      endpoint: root.dataset.endpoint || window.WOO_PRODUCTS_ENDPOINT || ''
    };
  }

  function pickSrc(p) {
    return p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  }
  function pickTitle(p) {
    return p?.acf?.['nombre-landing'] || p?.name || '';
  }

  function render(i) {
    const { root, img, h2 } = getRefs();
    if (!root || !img || !h2 || !products.length) return;

    const len = products.length;
    idx = ((i % len) + len) % len;
    const p = products[idx];

    const src = pickSrc(p);
    const ttl = pickTitle(p);

    if (src) img.src = src;
    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }

    root.dataset.idx = String(idx);

    // Precarga siguiente
    const pre = pickSrc(products[(idx + 1) % len]);
    if (pre) { const im = new Image(); im.src = pre; }
  }

  async function fetchProducts() {
    const { endpoint } = getRefs();
    if (!endpoint) return [];
    try {
      const res = await fetch(endpoint, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      return Array.isArray(arr) ? arr.filter(p => p && p.status === 'publish') : [];
    } catch {
      return [];
    }
  }

  async function init() {
    if (inited) return;
    const { root, img, h2 } = getRefs();
    if (!root || !img || !h2) return; // aún no existe el DOM del carrusel

    inited = true;
    if (!root.dataset.idx) root.dataset.idx = '-1';

    if (!products.length && !fetching) {
      fetching = true;
      products = await fetchProducts();
      fetching = false;
      if (products.length) {
        // pinto la primera
        render(0);
      }
    }
  }

  async function next() {
    if (!products.length) { await init(); if (!products.length) return; }
    render(idx + 1);
  }
  async function prev() {
    if (!products.length) { await init(); if (!products.length) return; }
    render(idx - 1);
  }

  // API global para tus botones onclick
  window.CarruselRoue = { init, next, prev };

  // Inicializa cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', init);

  // O cuando tu loader termine de inyectar el componente del carrusel
  document.addEventListener('component:ready', (e) => {
    if (e?.detail?.id === 'carruselMotos') init();
  });

  // (Opcional) si ya tienes los productos en otro script, puedes mandarlos así:
  // document.dispatchEvent(new CustomEvent('woo:products:ready', { detail: [...] }));
  document.addEventListener('woo:products:ready', (e) => {
    const arr = e?.detail;
    if (Array.isArray(arr) && arr.length) {
      products = arr.filter(p => p && p.status === 'publish');
      if (products.length) render(0);
    }
  });
})();
