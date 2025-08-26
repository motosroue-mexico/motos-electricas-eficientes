// /assets/scripts/carrusel-principal.js
(() => {
  // --- Config ---
  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';

  // --- Estado ---
  let products = [];
  let idx = -1;                  // -1 = sigues viendo el HTML inicial (XFX)
  let pendingFirstDelta = null;  // guarda el primer clic si ocurre antes del fetch

  // --- Refs (se piden en cada acción) ---
  function refs() {
    const root = document.getElementById('carruselMotos');
    const img  = root?.querySelector('img.motos') || null;
    const h2   = root?.querySelector('figcaption h2, h2') || null;
    return { root, img, h2 };
  }

  // --- Helpers de datos ---
  const pickSrc = p =>
    p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  const pickTitle = p =>
    p?.acf?.['nombre-landing'] || p?.name || '';

  // --- Render ---
  function render(i) {
    const { root, img, h2 } = refs();
    if (!root || !img || !h2 || !products.length) return;

    const len = products.length;
    i = ((i % len) + len) % len;  // normaliza
    idx = i;

    const p   = products[i];
    const src = pickSrc(p);
    const ttl = pickTitle(p);

    if (src) img.src = src;
    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }

    root.dataset.idx = String(idx);

    // Precarga siguiente
    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) { const im = new Image(); im.src = nextSrc; }
  }

  // --- Clicks ---
  function step(delta) {
    const { root } = refs();
    if (!root) return;

    // asegura el marcador inicial
    if (!root.dataset.idx) root.dataset.idx = '-1';

    // Aún no hay data: guarda este primer clic para aplicarlo apenas llegue
    if (!products.length) {
      if (pendingFirstDelta === null) pendingFirstDelta = delta;
      return;
    }

    // Primer movimiento: del -1 pasa a 0 (→) o a último (←)
    if (idx < 0) {
      idx = (delta >= 0) ? 0 : (products.length - 1);
      render(idx);
      return; // ese primer clic solo “posiciona”
    }

    // Resto de clics: ±1
    render(idx + delta);
  }

  // --- API pública para tus onclick ---
  window.CarruselRoue = {
    next: () => step(1),
    prev: () => step(-1),
    init: () => step(0), // opcional: si algún día quieres pintar manualmente el primero
  };

  // --- Fetch INMEDIATO (no toca el DOM; respeta data-idx = -1) ---
  (async () => {
    try {
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const raw = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);

      products = (raw || []).filter(p =>
        p && (p.status === undefined || p.status === 'publish') && (pickSrc(p) || pickTitle(p))
      );

      // Si hubo un clic mientras se cargaba, aplícalo apenas llega la data
      if (products.length && pendingFirstDelta !== null) {
        const { root } = refs();
        if (root && root.dataset.idx === '-1' && idx < 0) {
          const start = pendingFirstDelta >= 0 ? 0 : (products.length - 1);
          render(start);      // aquí recién cambiamos data-idx a 0 o último
        }
        pendingFirstDelta = null;
      }
    } catch (e) {
      products = [];
      // silencio: si falla, el carrusel simplemente no avanza
    }
  })();

  // Marca estado inicial cuando el DOM base esté (sin render automático)
  document.addEventListener('DOMContentLoaded', () => {
    const { root } = refs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';
  });
})();
