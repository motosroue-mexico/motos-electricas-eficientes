// /assets/scripts/carrusel-principal.js
(() => {
  let products = [];
  let idx = -1;          // -1 = todavía mostrando el HTML inicial (XFX)
  let fetching = false;

  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';

  function $refs() {
    const root = document.getElementById('carruselMotos');
    if (!root) return {};
    return {
      root,
      img: root.querySelector('img.motos'),
      h2:  root.querySelector('figcaption h2') || root.querySelector('h2'),
    };
  }

  // Helpers para obtener imagen/título del objeto del API
  function pickSrc(p) {
    return p?.acf?.['imagen-landing']?.url
        || p?.acf?.['imagen-landing']
        || p?.image
        || '';
  }
  function pickTitle(p) {
    return p?.acf?.['nombre-landing']
        || p?.name
        || '';
  }

  async function fetchProducts() {
    if (fetching || products.length) return products;
    fetching = true;
    try {
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      // Acepta todos si no traen status; si traen status, solo publish
      const filtered = (arr || []).filter(p =>
        p && (p.status === undefined || p.status === 'publish') && (pickSrc(p) || pickTitle(p))
      );
      products = filtered;
    } catch (e) {
      console.error('[carruselMotos] Error al cargar productos:', e);
      products = [];
    } finally {
      fetching = false;
    }
    return products;
  }

  function render(i) {
    const { root, img, h2 } = $refs();
    if (!root || !img || !h2 || !products.length) return;

    const len = products.length;
    // normaliza índice
    i = ((i % len) + len) % len;
    idx = i;

    const p   = products[i];
    const src = pickSrc(p);
    const ttl = pickTitle(p);

    if (src) img.src = src;
    if (ttl) {
      h2.textContent = ttl;
      img.alt = ttl;
      img.title = ttl;
    }
    root.dataset.idx = String(idx);

    // Precarga siguiente
    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) { const im = new Image(); im.src = nextSrc; }
  }

  async function step(delta) {
    const { root, img, h2 } = $refs();
    if (!root || !img || !h2) return; // aún no está el DOM del carrusel

    if (!products.length) {
      await fetchProducts();
      if (!products.length) return; // no hay datos, salimos
      // Primer click: si venías en -1, define punto de partida según la flecha
      idx = (idx < 0) ? (delta >= 0 ? 0 : products.length - 1) : idx;
      render(idx);
      if (delta === 0) return; // init simple
    }

    // Siguiente / Anterior
    render(idx + delta);
  }

  // API pública para tus botones con onclick
  async function next() { await step(1); }
  async function prev() { await step(-1); }
  async function init() { await step(0); } // opcional: pinta el primero cuando lo llames

  window.CarruselRoue = { next, prev, init };

  // Si quieres que intente pintar automáticamente cuando cargue el DOM:
  document.addEventListener('DOMContentLoaded', () => {
    const { root } = $refs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';
    // Puedes llamar init() aquí si quieres que reemplace XFX por el primer producto sin click:
    // CarruselRoue.init();
  });
})();
