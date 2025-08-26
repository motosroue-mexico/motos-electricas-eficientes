// /assets/scripts/carrusel-principal.js
(() => {
  console.log('[carruselMotos] script loaded');

  // Estado
  let products = [];
  let idx = -1; // -1 = sigues viendo el HTML inicial (XFX)

  // Endpoint Netlify (puedes sobreescribir con window.WOO_PRODUCTS_ENDPOINT antes de este script)
  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';
  console.log('[carruselMotos] endpoint =', ENDPOINT);

  // ---- Refs DOM (sin esperar nada; se revisa en cada clic) ----
  function refs() {
    const root = document.getElementById('carruselMotos');
    const img  = root?.querySelector('img.motos') || null;
    const h2   = root?.querySelector('figcaption h2, h2') || null;
    return { root, img, h2 };
  }

  // ---- Pickers de datos ----
  const pickSrc = p =>
    p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  const pickTitle = p =>
    p?.acf?.['nombre-landing'] || p?.name || '';

  // ---- FETCH: se dispara INMEDIATAMENTE al cargar el script ----
  const fetchPromise = (async () => {
    console.log('[carruselMotos] fetch: start');
    try {
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      console.log('[carruselMotos] fetch: status', res.status);
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const raw = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      console.log('[carruselMotos] fetch: raw items', raw?.length);

      products = (raw || []).filter(p => {
        const ok = p && (p.status === undefined || p.status === 'publish') && (pickSrc(p) || pickTitle(p));
        if (!ok) {
          console.log('[carruselMotos] filtered OUT', {
            id: p?.id, status: p?.status, src: pickSrc(p), ttl: pickTitle(p)
          });
        }
        return ok;
      });
      console.log('[carruselMotos] fetch: valid products', products.length);
    } catch (err) {
      console.error('[carruselMotos] fetch ERROR:', err);
      products = [];
    }
  })();

  // ---- Render ----
  function render(i) {
    const { root, img, h2 } = refs();
    if (!root || !img || !h2) { console.warn('[carruselMotos] render: faltan elementos'); return; }
    if (!products.length)     { console.warn('[carruselMotos] render: sin productos');  return; }

    const len = products.length;
    const original = i;
    i = ((i % len) + len) % len;
    idx = i;

    const p   = products[i];
    const src = pickSrc(p);
    const ttl = pickTitle(p);

    console.log('[carruselMotos] render:', { originalIndex: original, index: i, src, ttl });

    if (src) img.src = src;
    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }
    root.dataset.idx = String(idx);

    // Precarga siguiente
    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) { const im = new Image(); im.src = nextSrc; }
  }

  // ---- Paso al clic (no hace nada hasta que tú cliques) ----
  async function step(delta) {
    console.log('[carruselMotos] step delta=', delta, ' idx=', idx);

    // Asegura refs en el momento del clic (tu loader ya debió inyectarlos)
    const { root, img, h2 } = refs();
    if (!root || !img || !h2) {
      console.warn('[carruselMotos] step: DOM incompleto', { root: !!root, img: !!img, h2: !!h2 });
      return;
    }
    if (!root.dataset.idx) root.dataset.idx = '-1';

    // Espera a que el fetch que arrancó al inicio termine
    await fetchPromise;
    if (!products.length) { console.warn('[carruselMotos] step: sin productos tras fetch'); return; }

    // Primer clic: define punto de partida según flecha
    if (idx < 0) {
      idx = delta >= 0 ? 0 : products.length - 1;
      console.log('[carruselMotos] first render idx=', idx);
      render(idx);
      if (delta === 0) return; // init simple
    }

    render(idx + delta);
  }

  // ---- API pública para onclick ----
  window.CarruselRoue = {
    next: () => { console.log('[carruselMotos] next()'); step(1); },
    prev: () => { console.log('[carruselMotos] prev()'); step(-1); },
    init: () => { console.log('[carruselMotos] init()'); step(0); } // si quieres pintar sin clic
  };
  console.log('[carruselMotos] API expuesta: window.CarruselRoue');

  // Marca el estado inicial cuando el DOM base esté (no renderiza nada)
  document.addEventListener('DOMContentLoaded', () => {
    const { root } = refs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';
  });
})();
