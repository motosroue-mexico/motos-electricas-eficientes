// /assets/scripts/carrusel-principal.js
(() => {
  let products = [];
  let idx = -1;               // -1 = sigues viendo el HTML inicial (XFX)
  let fetchPromise = null;    // evita carreras de doble fetch

  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';

  // --- Utils: esperar elementos (incluso si los inyectas después) ---
  function waitFor(selector, root = document, timeout = 15000) {
    return new Promise((resolve) => {
      const foundNow = root.querySelector(selector);
      if (foundNow) return resolve(foundNow);

      const obs = new MutationObserver(() => {
        const el = root.querySelector(selector);
        if (el) { obs.disconnect(); resolve(el); }
      });
      obs.observe(root === document ? document.documentElement : root, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(null); }, timeout);
    });
  }

  async function ensureDOM() {
    console.log('[carruselMotos] ensureDOM -> esperando root');
    const root = await waitFor('#carruselMotos', document, 20000);
    if (!root) { console.warn('[carruselMotos] no apareció #carruselMotos'); return null; }

    console.log('[carruselMotos] ensureDOM -> esperando img.motos y h2 dentro del root');
    const img = await waitFor('img.motos', root, 20000);
    const h2  = await waitFor('figcaption h2, h2', root, 20000);

    const ok = !!(img && h2);
    console.log('[carruselMotos] ensureDOM refs:', { root: !!root, img: !!img, h2: !!h2, ok });

    if (!root.dataset.idx) root.dataset.idx = '-1'; // marca estado inicial
    return ok ? { root, img, h2 } : null;
  }

  // --- Data ---
  function pickSrc(p) {
    return p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  }
  function pickTitle(p) {
    return p?.acf?.['nombre-landing'] || p?.name || '';
  }

  async function ensureData() {
    if (products.length) {
      console.log('[carruselMotos] ensureData -> ya tengo productos:', products.length);
      return products;
    }
    if (fetchPromise) {
      console.log('[carruselMotos] ensureData -> esperando fetch en curso…');
      await fetchPromise;
      return products;
    }
    console.log('[carruselMotos] ensureData -> iniciando fetch:', ENDPOINT);

    fetchPromise = (async () => {
      try {
        const res = await fetch(ENDPOINT, { credentials: 'omit' });
        console.log('[carruselMotos] fetch status:', res.status);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const raw = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
        console.log('[carruselMotos] fetch items (raw):', raw?.length);

        products = (raw || []).filter(p => {
          const ok = p && (p.status === undefined || p.status === 'publish') && (pickSrc(p) || pickTitle(p));
          if (!ok) {
            console.log('[carruselMotos] filtrado OUT:', {
              id: p?.id, status: p?.status, src: pickSrc(p), ttl: pickTitle(p)
            });
          }
          return ok;
        });
        console.log('[carruselMotos] productos válidos:', products.length);
      } catch (err) {
        console.error('[carruselMotos] fetch ERROR:', err);
        products = [];
      } finally {
        const count = products.length;
        fetchPromise = null;
        console.log('[carruselMotos] fetch done. count=', count);
      }
    })();

    await fetchPromise;
    return products;
  }

  // --- Render ---
  function render(i, refs) {
    const { root, img, h2 } = refs || {};
    if (!root || !img || !h2) { console.warn('[carruselMotos] render: faltan refs'); return; }
    if (!products.length) { console.warn('[carruselMotos] render: sin productos'); return; }

    const len = products.length;
    const original = i;
    i = ((i % len) + len) % len;
    idx = i;

    const p   = products[i];
    const src = pickSrc(p);
    const ttl = pickTitle(p);

    console.log('[carruselMotos] render ->', { originalIndex: original, normIndex: i, src, ttl });

    if (src) img.src = src;
    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }
    root.dataset.idx = String(idx);

    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) { const im = new Image(); im.src = nextSrc; }
  }

  // --- Pasos al click ---
  async function step(delta) {
    console.log('[carruselMotos] step(delta=', delta, ') idx=', idx);

    const refs = await ensureDOM();
    if (!refs) { console.warn('[carruselMotos] step: no hay DOM'); return; }

    await ensureData();
    if (!products.length) { console.warn('[carruselMotos] step: sin productos, salgo'); return; }

    if (idx < 0) {
      // Primer uso: parte desde 0 si flecha derecha; desde último si izquierda
      idx = delta >= 0 ? 0 : products.length - 1;
      console.log('[carruselMotos] primer render idx=', idx);
      render(idx, refs);
      if (delta === 0) return;
    }

    render(idx + delta, refs);
  }

  // --- API pública (para tus onclicks) ---
  window.CarruselRoue = {
    next: () => { console.log('[carruselMotos] next()'); return step(1); },
    prev: () => { console.log('[carruselMotos] prev()'); return step(-1); },
    init: () => { console.log('[carruselMotos] init()'); return step(0); }, // si alguna vez quieres pintar sin click
  };

  // Nota: NO hacemos nada en DOMContentLoaded. Todo se ejecuta SOLO al click.
})();
