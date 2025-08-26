// /assets/scripts/carrusel-principal.js (con logs detallados)
(() => {
  console.log('[carruselMotos] script load');

  let products = [];
  let idx = -1;          // -1 = mostrando HTML inicial (XFX)
  let fetching = false;

  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';
  console.log('[carruselMotos] endpoint =', ENDPOINT);

  function $refs() {
    const root = document.getElementById('carruselMotos');
    if (!root) {
      console.warn('[carruselMotos] $refs: NO root');
      return {};
    }
    const img = root.querySelector('img.motos');
    const h2  = root.querySelector('figcaption h2') || root.querySelector('h2');

    console.log('[carruselMotos] $refs:', {
      root: !!root, img: !!img, h2: !!h2, datasetIdx: root.dataset?.idx
    });

    return { root, img, h2 };
  }

  // Helpers para obtener imagen/título del objeto del API
  function pickSrc(p) {
    const val = p?.acf?.['imagen-landing']?.url
             || p?.acf?.['imagen-landing']
             || p?.image
             || '';
    return val;
  }
  function pickTitle(p) {
    const val = p?.acf?.['nombre-landing']
             || p?.name
             || '';
    return val;
  }

  async function fetchProducts() {
    if (fetching || products.length) {
      console.log('[carruselMotos] fetchProducts: ya había fetch en curso o productos cargados', {
        fetching, currentCount: products.length
      });
      return products;
    }
    fetching = true;
    console.log('[carruselMotos] fetchProducts: iniciando fetch…', ENDPOINT);

    try {
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      console.log('[carruselMotos] fetchProducts: HTTP status', res.status);
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const raw = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      console.log('[carruselMotos] fetchProducts: recibidos', raw?.length, 'items (raw)');

      const filtered = (raw || []).filter(p => {
        const ok = p && (p.status === undefined || p.status === 'publish') && (pickSrc(p) || pickTitle(p));
        if (!ok) {
          console.log('[carruselMotos] filtrado OUT:', {
            id: p?.id, status: p?.status, src: pickSrc(p), ttl: pickTitle(p)
          });
        }
        return ok;
      });

      products = filtered;
      console.log('[carruselMotos] fetchProducts: válidos', products.length);
      if (products[0]) {
        console.log('[carruselMotos] ejemplo[0]:', {
          id: products[0].id,
          title: pickTitle(products[0]),
          src: pickSrc(products[0])
        });
      }
    } catch (e) {
      console.error('[carruselMotos] Error al cargar productos:', e);
      products = [];
    } finally {
      fetching = false;
      console.log('[carruselMotos] fetchProducts: done. fetching=', fetching);
    }
    return products;
  }

  function render(i) {
    const { root, img, h2 } = $refs();
    if (!root || !img || !h2) {
      console.warn('[carruselMotos] render: faltan refs');
      return;
    }
    if (!products.length) {
      console.warn('[carruselMotos] render: no hay products');
      return;
    }

    const len = products.length;
    const original = i;
    i = ((i % len) + len) % len;
    idx = i;

    const p   = products[i];
    const src = pickSrc(p);
    const ttl = pickTitle(p);

    console.log('[carruselMotos] render:', { originalIndex: original, normIndex: i, src, ttl });

    if (src) img.src = src;
    if (ttl) {
      h2.textContent = ttl;
      img.alt = ttl;
      img.title = ttl;
      console.log('[carruselMotos] render: h2/img actualizados');
    }
    root.dataset.idx = String(idx);
    console.log('[carruselMotos] render: root.dataset.idx =', root.dataset.idx);

    // Precarga de la siguiente imagen
    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) {
      const im = new Image();
      im.src = nextSrc;
      console.log('[carruselMotos] render: precarga nextSrc =', nextSrc);
    }
  }

  async function step(delta) {
    console.log('[carruselMotos] step called, delta =', delta, 'idx =', idx);

    const { root, img, h2 } = $refs();
    if (!root || !img || !h2) {
      console.warn('[carruselMotos] step: DOM del carrusel aún no existe');
      return;
    }

    if (!root.dataset.idx) {
      root.dataset.idx = '-1';
      console.log('[carruselMotos] step: init dataset.idx = -1');
    }

    if (!products.length) {
      console.log('[carruselMotos] step: no hay products -> fetch');
      await fetchProducts();
      console.log('[carruselMotos] step: post-fetch count =', products.length);
      if (!products.length) {
        console.warn('[carruselMotos] step: sigue sin productos, salgo');
        return;
      }
      // Primer click: si venías en -1, define punto de partida según la flecha
      idx = (idx < 0) ? (delta >= 0 ? 0 : products.length - 1) : idx;
      console.log('[carruselMotos] step: primer render idx =', idx);
      render(idx);
      if (delta === 0) return; // init simple
    }

    console.log('[carruselMotos] step: render siguiente, idx + delta =', idx + delta);
    render(idx + delta);
  }

  // API pública para tus botones con onclick
  async function next() { console.log('[carruselMotos] next()'); await step(1); }
  async function prev() { console.log('[carruselMotos] prev()'); await step(-1); }
  async function init() { console.log('[carruselMotos] init()'); await step(0); } // pinta el primero cuando lo llames

  window.CarruselRoue = { next, prev, init };
  console.log('[carruselMotos] API expuesta: window.CarruselRoue');

  // Intento de inicialización al cargar el DOM (no reemplaza XFX a menos que llames init())
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[carruselMotos] DOMContentLoaded');
    const { root } = $refs();
    if (root && !root.dataset.idx) {
      root.dataset.idx = '-1';
      console.log('[carruselMotos] DOMContentLoaded: set dataset.idx = -1');
    }
    // Si quieres que pinte el primer producto automáticamente, descomenta:
    // CarruselRoue.init();
  });
})();
