// /assets/scripts/carrusel-principal.js
(() => {
  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';

  // Estado
  let products = [];
  let idx = -1;                 // -1 = sigues viendo el HTML inicial (XFX)
  let pendingFirstClick = false;

  // Refs DOM en el momento de usar
  function refs() {
    const root = document.getElementById('carruselMotos');
    const img  = root?.querySelector('img.motos') || null;
    const h2   = root?.querySelector('figcaption h2, h2') || null;
    return { root, img, h2 };
  }

  // Helpers de datos
  const pickSrc = p =>
    p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  const pickTitle = p =>
    p?.acf?.['nombre-landing'] || p?.name || '';

  // Render
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

    // Precarga siguiente
    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) { const im = new Image(); im.src = nextSrc; }
  }

  // Click handler
  function step(delta) {
    const { root } = refs();
    if (!root) return;

    if (!root.dataset.idx) root.dataset.idx = '-1';

    // Si aún no hay datos, recordamos que hubo primer clic
    if (!products.length) {
      pendingFirstClick = true;
      return;
    }

    // Primer clic: del -1 pasa SIEMPRE a 0 (sin importar dirección)
    if (idx < 0) {
      render(0);
      return; // ese primer clic solo “posiciona”
    }

    // Resto de clics: ±1
    render(idx + delta);
  }

  // API pública para tus onclick
  window.CarruselRoue = {
    next: () => step(1),
    prev: () => step(-1),
    init: () => step(0), // opcional
  };

  // Fetch inmediato al cargar (no toca data-idx)
  (async () => {
    try {
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const raw  = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      products = (raw || []).filter(p =>
        p && (p.status === undefined || p.status === 'publish') && (pickSrc(p) || pickTitle(p))
      );

      // Si ya hubo clic mientras cargaba, al llegar la data vamos directo al 0
      if (products.length && pendingFirstClick && idx < 0) {
        const { root } = refs();
        if (root && root.dataset.idx === '-1') render(0);
      }
      pendingFirstClick = false;
    } catch {
      products = []; // si falla, no habrá navegación
    }
  })();

  // Marca data-idx = -1 cuando el DOM base esté (sin render automático)
  document.addEventListener('DOMContentLoaded', () => {
    const { root } = refs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';
  });
})();
