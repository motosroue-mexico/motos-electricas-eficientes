// /assets/scripts/carrusel-principal.js
(() => {
  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';

  // Siempre disponibles para inspección
  window.ROUE_RAW_JSON = [];
  window.ROUE_PRODUCTS_JSON = [];

  let products = [];
  let idx = -1;
  let pendingFirstClick = false;

  // ---- DOM refs ----
  function refs() {
    const root = document.getElementById('carruselMotos');
    const img  = root?.querySelector('img.motos') || null;
    const h2   = root?.querySelector('figcaption h2, h2') || null;
    return { root, img, h2 };
  }

  // ---- helpers de meta/ACF ----
  const metaVal = (p, key) => (p?.meta_data || []).find(m => m?.key === key)?.value;

  function landingTitle(p) {
    return (
      metaVal(p, 'nombre-landing') ||
      p?.acf?.['nombre-landing'] ||
      p?.name ||
      p?.title?.rendered ||
      ''
    );
  }

  function landingImage(p) {
    const v = metaVal(p, 'imagen-landing');

    // ID numérico -> buscar en la galería del producto
    if (typeof v === 'string' && /^\d+$/.test(v) && Array.isArray(p?.images)) {
      const im = p.images.find(x => String(x?.id) === v);
      if (im?.src) return im.src;
    }
    // URL directa
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
    // Objeto con url
    if (v && typeof v === 'object' && v.url) return v.url;

    // Fallbacks
    const acf = p?.acf?.['imagen-landing'];
    if (typeof acf === 'string' && /^https?:\/\//i.test(acf)) return acf;
    if (acf && typeof acf === 'object' && acf.url) return acf.url;

    return (
      p?.image?.src ||
      p?.image ||
      p?.images?.[0]?.src ||
      p?._embedded?.['wp:featuredmedia']?.[0]?.source_url ||
      ''
    );
  }

  // ---- render ----
  function render(i) {
    const { root, img, h2 } = refs();
    if (!root || !img || !h2 || !products.length) return;

    const len = products.length;
    i = ((i % len) + len) % len;
    idx = i;

    const p   = products[i];
    const ttl = p.__landing.title;
    const src = p.__landing.image;

    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }
    if (src) img.src = src;

    root.dataset.idx = String(idx);

    // precarga
    const next = products[(idx + 1) % len]?.__landing?.image;
    if (next) { const im = new Image(); im.decoding = 'async'; im.src = next; }
  }

  // ---- navegación ----
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

  // ---- carga ----
  (async () => {
    try {
      console.time('[Carrusel] fetch');
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const raw  = Array.isArray(data) ? data
                 : (Array.isArray(data?.products) ? data.products : []);

      // Exponer y LOGEAR JSON crudo
      window.ROUE_RAW_JSON = raw;
      console.log('[Carrusel] RAW JSON length =', Array.isArray(raw) ? raw.length : 'no-array');
      console.log('[Carrusel] RAW JSON ->', raw);

      // Enriquecer con campos de landing ya resueltos
      products = (raw || []).map(p => {
        const title = landingTitle(p);
        const image = landingImage(p);
        return { ...p, __landing: { title, image } };
      })
      // Quedarnos con los que sirven para mostrar
      .filter(p => p.__landing.title || p.__landing.image);

      // Exponer y LOGEAR JSON filtrado (lo que usa el carrusel)
      window.ROUE_PRODUCTS_JSON = products;
      console.log('[Carrusel] PRODUCTS JSON length =', products.length);
      console.log('[Carrusel] PRODUCTS JSON ->', products);

      // Tabla útil para ver exactamente qué está usando el carrusel
      console.table(products.map(p => ({
        id: p.id,
        title: p.__landing.title,
        image: p.__landing.image
      })));

      // primer render si hubo clic mientras cargaba
      if (products.length && pendingFirstClick && idx < 0) {
        const { root } = refs();
        if (root && root.dataset.idx === '-1') render(0);
      }
      pendingFirstClick = false;
      console.timeEnd('[Carrusel] fetch');

      // Si quieres ver el primer slide sin clic, descomenta:
      // if (products.length && idx < 0) render(0);

    } catch (err) {
      console.error('[Carrusel] fetch error:', err);
      products = [];
      window.ROUE_RAW_JSON = null;
      window.ROUE_PRODUCTS_JSON = [];
    }
  })();

  // estado inicial
  document.addEventListener('DOMContentLoaded', () => {
    const { root } = refs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';
  });
})();