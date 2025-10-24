// /assets/scripts/carrusel-principal.js
(() => {
  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';

  // Exponer JSON siempre
  window.ROUE_RAW_JSON = [];
  window.ROUE_PRODUCTS_JSON = [];

  // Estado
  let products = [];
  let idx = -1;
  let pendingFirstClick = false;

  // Refs DOM
  function refs() {
    const root = document.getElementById('carruselMotos');
    const img  = root?.querySelector('img.motos') || null;
    const h2   = root?.querySelector('figcaption h2, h2') || null;
    return { root, img, h2 };
  }

  // --- Helpers para leer ACF en meta_data (Woo) ---
  const metaVal = (p, key) => (p?.meta_data || []).find(m => m?.key === key)?.value;

  // Título PRIORIDAD: meta "nombre-landing" -> ACF -> name/title
  const pickTitle = (p) =>
    metaVal(p, 'nombre-landing') ||
    p?.acf?.['nombre-landing'] ||
    p?.name ||
    p?.title?.rendered ||
    '';

  // Imagen PRIORIDAD: meta "imagen-landing"
  // - Si es ID numérico, busca en p.images por id
  // - Si es URL, úsala
  // - Si es objeto {url}, úsala
  // Fallback: ACF imagen-landing (url/string) -> p.image / p.images[0].src -> featured
  const pickSrc = (p) => {
    const v = metaVal(p, 'imagen-landing');

    // ID numérico -> buscar en galería del producto
    if (typeof v === 'string' && /^\d+$/.test(v) && Array.isArray(p?.images)) {
      const im = p.images.find(x => String(x?.id) === v);
      if (im?.src) return im.src;
    }
    // URL directa
    if (typeof v === 'string' && /^https?:\/\//i.test(v)) return v;
    // Objeto con url
    if (v && typeof v === 'object' && v.url) return v.url;

    // ACF directo
    const acfImg = p?.acf?.['imagen-landing'];
    if (typeof acfImg === 'string' && /^https?:\/\//i.test(acfImg)) return acfImg;
    if (acfImg && typeof acfImg === 'object' && acfImg.url) return acfImg.url;

    // Fallbacks Woo/WP
    return p?.image?.src || p?.image || p?.images?.[0]?.src ||
           p?._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
  };

  // Render
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

    // Precarga siguiente
    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) { const im = new Image(); im.decoding = 'async'; im.src = nextSrc; }
  }

  // Navegación
  function step(delta) {
    const { root } = refs();
    if (!root) return;
    if (!root.dataset.idx) root.dataset.idx = '-1';

    if (!products.length) { pendingFirstClick = true; return; }
    if (idx < 0) { render(0); return; }
    render(idx + delta);
  }

  // API pública
  window.CarruselRoue = {
    next: () => step(1),
    prev: () => step(-1),
    init: () => step(0),
  };

  // Carga
  (async () => {
    try {
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const raw  = Array.isArray(data) ? data
                 : (Array.isArray(data?.products) ? data.products : []);

      window.ROUE_RAW_JSON = raw;

      products = (raw || []).filter(p =>
        p &&
        (p.status === undefined || p.status === 'publish' || p.status === 'published') &&
        (pickSrc(p) || pickTitle(p))
      );

      window.ROUE_PRODUCTS_JSON = products;

      if (products.length && pendingFirstClick && idx < 0) {
        const { root } = refs();
        if (root && root.dataset.idx === '-1') render(0);
      }
      pendingFirstClick = false;
    } catch (err) {
      products = [];
      window.ROUE_RAW_JSON = null;
      window.ROUE_PRODUCTS_JSON = [];
      console.error('[Carrusel] fetch error:', err);
    }
  })();

  // Inicial
  document.addEventListener('DOMContentLoaded', () => {
    const { root } = refs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';
  });
})();