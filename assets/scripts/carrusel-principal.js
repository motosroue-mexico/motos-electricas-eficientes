// /assets/scripts/carrusel-principal.js
(() => {
  // --- Config ---
  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';
  const AUTO_INIT_AFTER_FETCH = true; // pone en true para que, apenas llegue la data, pinte el 1er producto

  // --- Estado ---
  let products = [];
  let idx = -1;            // -1 = sigues viendo el HTML inicial (XFX)
  let fetched = false;

  // --- Refs DOM (resueltos en el momento del clic/render) ---
  function refs() {
    const root = document.getElementById('carruselMotos');
    const img  = root?.querySelector('img.motos') || null;
    const h2   = root?.querySelector('figcaption h2, h2') || null;
    return { root, img, h2 };
  }

  // --- Pickers de datos ---
  const pickSrc = p =>
    p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  const pickTitle = p =>
    p?.acf?.['nombre-landing'] || p?.name || '';

  // --- Render ---
  function render(i) {
    const { root, img, h2 } = refs();
    if (!root || !img || !h2 || !products.length) return;

    const len = products.length;
    i = ((i % len) + len) % len;
    idx = i;

    const p   = products[i];
    const src = pickSrc(p);
    const ttl = pickTitle(p);

    if (src) img.src = src;
    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }
    root.dataset.idx = String(idx);

    // Precarga la siguiente
    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) { const im = new Image(); im.src = nextSrc; }
  }

  // --- Acciones al clic (no bloquean por fetch) ---
  function step(delta) {
    const { root } = refs();
    if (!root) return;

    if (!root.dataset.idx) root.dataset.idx = '-1';

    if (!products.length) {
      // Aún no llegó la data: no bloqueamos el clic; el siguiente clic ya será instantáneo
      return;
    }

    if (idx < 0) {
      // Primer salto: decide desde dónde arrancar
      idx = delta >= 0 ? 0 : products.length - 1;
      render(idx);
      if (delta === 0) return;
    }

    render(idx + delta);
  }

  // --- API pública para tus onclick ---
  window.CarruselRoue = {
    next: () => step(1),
    prev: () => step(-1),
    init: () => step(0), // si quieres dispararlo manualmente en algún momento
  };

  // --- Fetch inmediato al cargar el script (sin bloquear clics) ---
  (async () => {
    try {
      // timeout defensivo para no colgar
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(ENDPOINT, { credentials: 'omit', signal: controller.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const raw = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);

      products = (raw || []).filter(p =>
        p && (p.status === undefined || p.status === 'publish') && (pickSrc(p) || pickTitle(p))
      );

      fetched = true;

      // Si quieres máxima rapidez de clic, deja esto en true:
      if (AUTO_INIT_AFTER_FETCH) {
        const { root } = refs();
        if (root && root.dataset.idx === '-1' && products.length) {
          // Pintamos el primero de una vez; así el primer clic ya navega instantáneo
          render(0);
        }
      }
    } catch (e) {
      // Si falla, no bloqueamos nada; simplemente no habrá navegación
      fetched = true;
      products = [];
      // console.error('fetch error', e);
    }
  })();

  // Marca estado inicial cuando el DOM base esté (no obliga a render)
  document.addEventListener('DOMContentLoaded', () => {
    const { root } = refs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';
  });
})();
