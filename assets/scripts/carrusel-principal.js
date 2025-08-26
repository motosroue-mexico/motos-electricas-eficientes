// /assets/scripts/carrusel-principal.js
(() => {
  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';

  let products = [];
  let idx = -1;                // -1 = sigues viendo el HTML inicial
  let pendingFirstDelta = null;

  // --- DOM refs en el momento de usar ---
  function refs() {
    const root = document.getElementById('carruselMotos');
    const img  = root?.querySelector('img.motos') || null;
    const h2   = root?.querySelector('figcaption h2, h2') || null;
    return { root, img, h2 };
  }

  // --- helpers de datos ---
  const pickSrc   = p => p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  const pickTitle = p => p?.acf?.['nombre-landing'] || p?.name || '';

  // --- precarga N imágenes para clicks ultra veloces ---
  function warmImages(n = 8) {
    const seen = new Set();
    for (let i = 0; i < Math.min(n, products.length); i++) {
      const s = pickSrc(products[i]);
      if (s && !seen.has(s)) { seen.add(s); const im = new Image(); im.src = s; }
    }
  }

  // --- render con precarga del frame objetivo (h2 inmediato, imagen al cargar) ---
  function renderTo(targetIdx) {
    const { root, img, h2 } = refs();
    if (!root || !img || !h2 || !products.length) return;

    const len = products.length;
    targetIdx = ((targetIdx % len) + len) % len;

    const p   = products[targetIdx];
    const src = pickSrc(p);
    const ttl = pickTitle(p);

    // Texto al instante
    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }

    // Cambia imagen cuando termine de cargar (sin parpadeo)
    if (src) {
      const pre = new Image();
      pre.onload = () => { img.src = src; };
      pre.onerror = () => { img.src = src; }; // fallback: igual la ponemos
      pre.src = src;
    }

    idx = targetIdx;
    root.dataset.idx = String(idx);

    // precarga la siguiente
    const nextSrc = pickSrc(products[(idx + 1) % len]);
    if (nextSrc) { const im = new Image(); im.src = nextSrc; }
  }

  // --- click handler “rápido” ---
  function step(delta) {
    const { root } = refs();
    if (!root) return;
    if (!root.dataset.idx) root.dataset.idx = '-1';

    if (!products.length) {
      // aún no está la data: guarda este primer clic para aplicarlo en cuanto llegue
      if (pendingFirstDelta === null) pendingFirstDelta = delta;
      return;
    }

    if (idx < 0) {
      // primer clic: 0 si derecha, último si izquierda (y NO sumamos más)
      const start = delta >= 0 ? 0 : (products.length - 1);
      renderTo(start);
      return;
    }

    renderTo(idx + delta);
  }

  // --- API pública para tus onclick ---
  window.CarruselRoue = {
    next: () => step(1),
    prev: () => step(-1),
    init: () => step(0), // opcional
  };

  // --- fetch inmediato al cargar (y calienta imágenes) ---
  (async () => {
    try {
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const raw  = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      products = (raw || []).filter(p => (pickSrc(p) || pickTitle(p)) && (p.status === undefined || p.status === 'publish'));

      if (products.length) {
        warmImages(10); // precalienta las primeras

        // si el usuario ya había clickeado mientras cargaba, respóndele YA
        if (pendingFirstDelta !== null) {
          const { root } = refs();
          if (root && root.dataset.idx === '-1' && idx < 0) {
            const start = pendingFirstDelta >= 0 ? 0 : (products.length - 1);
            renderTo(start);
          }
          pendingFirstDelta = null;
        }
      }
    } catch (e) {
      products = []; // si falla, no hay navegación
    }
  })();

  // marca data-idx = -1 cuando el DOM base esté (no pinta nada)
  document.addEventListener('DOMContentLoaded', () => {
    const { root } = refs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';
  });
})();
