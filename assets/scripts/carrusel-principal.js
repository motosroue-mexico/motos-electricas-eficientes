// /assets/scripts/carrusel-principal.js
(() => {
  let products = [];
  let idx = -1;
  let fetched = false;

  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/roue-products';

  function refs() {
    const root = document.getElementById('carruselMotos');
    if (!root) return {};
    return { root, img: root.querySelector('img.motos'), h2: root.querySelector('h2') };
  }

  function pickSrc(p) {
    return p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  }
  function pickTitle(p) {
    return p?.acf?.['nombre-landing'] || p?.name || '';
  }

  async function loadProducts() {
    if (fetched) return products;
    fetched = true;
    try {
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      // Si trae "status", deja solo publish; si no trae status, acepta todos
      products = (arr || []).filter(p => p && (p.status === undefined || p.status === 'publish'));
    } catch (e) {
      products = [];
      console.error('[carruselMotos] fetch error', e);
    }
    return products;
  }

  function render(i) {
    const { root, img, h2 } = refs();
    if (!root || !img || !h2 || !products.length) return;

    const len = products.length;
    idx = ((i % len) + len) % len;

    const p = products[idx];
    const src = pickSrc(p);
    const ttl = pickTitle(p);

    if (src) img.src = src;
    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }

    root.dataset.idx = String(idx);

    // Precarga de la siguiente imagen
    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) { const im = new Image(); im.src = nextSrc; }
  }

  async function ensureReady() {
    const { root, img, h2 } = refs();
    if (!root || !img || !h2) return false;
    if (!root.dataset.idx) root.dataset.idx = '-1';
    if (!products.length) await loadProducts();
    if (products.length && root.dataset.idx === '-1') render(0);
    return products.length > 0;
  }

  async function next() {
    const ok = await ensureReady();
    if (!ok) return;
    render(idx + 1);
  }
  async function prev() {
    const ok = await ensureReady();
    if (!ok) return;
    render(idx - 1);
  }
  async function init() { await ensureReady(); }

  // API pública para tus botones onclick
  window.CarruselRoue = { init, next, prev };

  // Inicializa cuando el DOM ya está y también cuando tu loader inyecta el componente
  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('component:ready', (e) => {
    if (e?.detail?.id === 'carruselMotos') init();
  });
})();
