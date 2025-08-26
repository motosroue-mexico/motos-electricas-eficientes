// /assets/scripts/comprar-render.js
(() => {
  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';
  const STEP = 380;

  // --- helpers de datos ---
  const pickSrc   = p => p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  const pickTitle = p => p?.acf?.['nombre-landing'] || p?.name || '';
  const pickUrl   = p => p?.permalink || '#';
  const pickPrice = p => {
    const raw = p?.sale_price || p?.price || p?.regular_price || '';
    if (raw === '') return 'Ver detalles';
    const n = Number(raw);
    if (Number.isFinite(n)) return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    return /^\$/.test(raw) ? raw : ('$' + raw);
  };

  // --- UI helpers ---
  function syncButtons(cont) {
    const prev = document.getElementById('comprarPrev');
    const next = document.getElementById('comprarNext');
    if (!cont || !prev || !next) return;

    const max = cont.scrollWidth - cont.clientWidth - 1;
    prev.disabled = cont.scrollLeft <= 0;
    next.disabled = cont.scrollLeft >= Math.max(0, max);

    const scrollable = cont.scrollWidth > cont.clientWidth + 1;
    prev.hidden = next.hidden = !scrollable;
  }

  function ensureContainerReady() {
    const cont = document.querySelector('#comprar article');
    if (!cont) return null;
    // estilos mínimos para scroll suave
    if (!cont.style.scrollBehavior) cont.style.scrollBehavior = 'smooth';
    if (!cont.style.overflowX) cont.style.overflowX = 'auto';
    if (!cont.hasAttribute('tabindex')) cont.tabIndex = 0;

    // listeners idempotentes
    if (!cont.dataset.scrollListeners) {
      cont.addEventListener('scroll', () => syncButtons(cont));
      window.addEventListener('resize', () => syncButtons(cont));
      cont.dataset.scrollListeners = '1';
    }
    return cont;
  }

  // --- API pública para inline onclick ---
  window.ComprarCarousel = {
    next() {
      const cont = ensureContainerReady();
      if (!cont) return;
      cont.scrollBy({ left: +STEP, behavior: 'smooth' });
      // sync después de un frame
      requestAnimationFrame(() => syncButtons(cont));
    },
    prev() {
      const cont = ensureContainerReady();
      if (!cont) return;
      cont.scrollBy({ left: -STEP, behavior: 'smooth' });
      requestAnimationFrame(() => syncButtons(cont));
    }
  };

  // --- Render de productos ---
  async function fetchProducts() {
    const res = await fetch(ENDPOINT, { credentials: 'omit' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const raw  = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
    return (raw || []).filter(p =>
      p && (p.status === undefined || p.status === 'publish') && (pickSrc(p) || pickTitle(p))
    );
  }

  function renderComprar(products) {
    const cont = ensureContainerReady();
    if (!cont) return;
    if (cont.dataset.rendered === '1') return; // evita doble render
    cont.innerHTML = '';

    const tpl = document.getElementById('tplComprarItem');
    const frag = document.createDocumentFragment();

    for (const p of products) {
      let fig;
      if (tpl) {
        fig = tpl.content.firstElementChild.cloneNode(true);
      } else {
        fig = document.createElement('figure');
        fig.innerHTML = `
          <img loading="lazy" decoding="async" width="320" height="220">
          <figcaption>
            <h3></h3>
            <a class="btn BGNegro" target="_blank"></a>
          </figcaption>
        `;
      }

      const img = fig.querySelector('img');
      const h3  = fig.querySelector('h3');
      const a   = fig.querySelector('a');

      const src   = pickSrc(p);
      const title = pickTitle(p) || 'Producto';
      const url   = pickUrl(p);
      const price = pickPrice(p);

      if (src) img.src = src;
      img.alt = title;
      h3.textContent = title;
      a.href = url;
      a.textContent = price;

      frag.appendChild(fig);
    }

    cont.appendChild(frag);
    cont.dataset.rendered = '1';
    // Ajusta estado de botones ya con contenido real
    syncButtons(cont);
  }

  // --- Boot: intenta render cuando haya DOM del bloque y datos ---
  async function tryBoot() {
    const cont = document.querySelector('#comprar article');
    if (!cont) return; // aún no está el componente
    try {
      const products = await fetchProducts();
      if (products.length) renderComprar(products);
    } catch (e) {
      console.error('[comprar] no se pudo renderizar:', e);
    }
  }

  // 1) si ya está en DOM ahora
  if (document.querySelector('#comprar article')) tryBoot();

  // 2) cuando tu loader lo anuncie
  document.addEventListener('component:ready', (e) => {
    if (e?.detail?.id === 'comprar') tryBoot();
  });

  // 3) fallback por inyección tardía
  const obs = new MutationObserver(() => {
    if (document.querySelector('#comprar article')) { tryBoot(); obs.disconnect(); }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
