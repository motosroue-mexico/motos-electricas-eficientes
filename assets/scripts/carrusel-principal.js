(() => {
  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';

  // Exponer siempre variables globales (aunque falle el fetch)
  window.ROUE_RAW_JSON = [];
  window.ROUE_PRODUCTS_JSON = [];

  let products = [];
  let idx = -1;
  let pendingFirstClick = false;

  function refs() {
    const root = document.getElementById('carruselMotos');
    const img  = root?.querySelector('img.motos') || null;
    const h2   = root?.querySelector('figcaption h2, h2') || null;
    return { root, img, h2 };
  }

  const pickSrc = p =>
    p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  const pickTitle = p =>
    p?.acf?.['nombre-landing'] || p?.name || '';

  function render(i) {
    const { root, img, h2 } = refs();
    if (!root || !img || !h2 || !products.length) return;
    const len = products.length;
    i = ((i % len) + len) % len;
    idx = i;

    const p   = products[i];
    const src = pickSrc(p);
    const ttl = pickTitle(p);

    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }
    if (src) img.src = src;

    root.dataset.idx = String(idx);

    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) { const im = new Image(); im.src = nextSrc; }
  }

  function step(delta) {
    const { root } = refs();
    if (!root) return;
    if (!root.dataset.idx) root.dataset.idx = '-1';
    if (!products.length) { pendingFirstClick = true; return; }
    if (idx < 0) { render(0); return; }
    render(idx + delta);
  }

  window.CarruselRoue = {
    next: () => step(1),
    prev: () => step(-1),
    init: () => step(0),
  };

  (async () => {
    try {
      console.time('fetchProducts');
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const raw  = Array.isArray(data) ? data
                 : (Array.isArray(data?.products) ? data.products : []);

      // Exponer JSON crudo
      window.ROUE_RAW_JSON = raw;
      console.log('[Carrusel] RAW JSON:', raw);
      console.log('[Carrusel] raw length =', Array.isArray(raw) ? raw.length : 'no-array');

      // Filtrar para el carrusel
      products = (raw || []).filter(p =>
        p && (p.status === undefined || p.status === 'publish') && (pickSrc(p) || pickTitle(p))
      );

      // Exponer JSON filtrado
      window.ROUE_PRODUCTS_JSON = products;
      console.log('[Carrusel] PRODUCTS JSON:', products);
      console.log('[Carrusel] filtered length =', products.length);

      if (products.length && pendingFirstClick && idx < 0) {
        const { root } = refs();
        if (root && root.dataset.idx === '-1') render(0);
      }
      pendingFirstClick = false;
      console.timeEnd('fetchProducts');
    } catch (err) {
      products = [];
      window.ROUE_RAW_JSON = null;
      window.ROUE_PRODUCTS_JSON = [];
      console.error('[Carrusel] fetch error:', err);
    }
  })();

  document.addEventListener('DOMContentLoaded', () => {
    const { root } = refs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';
  });
})();