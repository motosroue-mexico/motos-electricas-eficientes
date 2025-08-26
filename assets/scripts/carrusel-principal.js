// /assets/scripts/carrusel-principal.js
(() => {
  // Endpoint (puedes sobreescribir con window.WOO_PRODUCTS_ENDPOINT antes de este script)
  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';

  // Estado
  let products = [];
  let idx = -1;                 // -1 = sigues viendo el HTML inicial (XFX)
  let pendingFirstDelta = null; // recuerda el primer clic si ocurre antes del fetch

  // Refs DOM en el momento de usar
  function refs() {
    const root = document.getElementById('carruselMotos');
    const img  = root?.querySelector('img.motos') || null;
    const h2   = root?.querySelector('figcaption h2, h2') || null;
    return { root, img, h2 };
  }

  // Pickers de datos
  const pickSrc = p =>
    p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  const pickTitle = p =>
    p?.acf?.['nombre-landing'] || p?.name || '';

  // Render inmediato (texto e imagen)
  function render(i) {
    const { root, img, h2 } = refs();
    if (!root || !img || !h2 || !products.length) return;

    const len = products.length;
    i = ((i % len) + len) % len; // normaliza
    idx = i;

    const p   = products[i];
    const src = pickSrc(p);
    const ttl = pickTitle(p);

    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }
    if (src) img.src = src;

    root.dataset.idx = String(idx);

    // Pre-carga siguiente para que el próximo clic sea fluido
    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) { const im = new Image(); im.src = nextSrc; }
  }

  // Manejo de clic
  function step(delta) {
    const { root } = refs();
    if (!root) return;

    // Asegura el marcador de estado inicial
    if (!root.dataset.idx) root.dataset.idx = '-1';

    // Si aún no hay data, recuerda este primer clic y sal
    if (!products.length) {
      if (pendingFirstDelta === null) pendingFirstDelta = delta;
      return;
    }

    // Primer clic: del -1 pasa a 0 (→) o último (←)
    if (idx < 0) {
      const start = (delta >= 0) ? 0 : (products.length - 1);
      render(start);
      return; // el primer clic solo posiciona
    }

    // Resto de clics: ±1
    render(idx + delta);
  }

  // API pública para tus botones con onclick
  window.CarruselRoue = {
    next: () => step(1),
    prev: () => step(-1),
    init: () => step(0), // opcional: si algún día quieres pintar el primero manualmente
  };

  // Fetch inmediato al cargar (sin tocar data-idx)
  (async () => {
    try {
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const raw  = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      products = (raw || []).filter(p =>
        p && (p.status === undefined || p.status === 'publish') && (pickSrc(p) || pickTitle(p))
      );

      // Si alguien ya clicó mientras cargaba, aplica ese primer clic ahora
      if (products.length && pendingFirstDelta !== null) {
        const { root } = refs();
        if (root && root.dataset.idx === '-1' && idx < 0) {
          const start = pendingFirstDelta >= 0 ? 0 : (products.length - 1);
          render(start); // aquí recién cambiamos data-idx a 0 o último
        }
        pendingFirstDelta = null;
      }
    } catch {
      products = []; // si falla, no habrá navegación
    }
  })();

  // Marca data-idx = -1 cuando el DOM base esté (no pinta nada)
  document.addEventListener('DOMContentLoaded', () => {
    const { root } = refs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';
  });
})();
