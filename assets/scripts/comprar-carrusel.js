// /assets/scripts/comprar-render.js
(() => {
  const ENDPOINT = window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products';

  let products = [];
  const fetchPromise = (async () => {
    try {
      const res = await fetch(ENDPOINT, { credentials: 'omit' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const raw  = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      // Filtra y acepta ítems con imagen o nombre (y status publish si viene)
      products = (raw || []).filter(p =>
        p && (p.status === undefined || p.status === 'publish') && (pickSrc(p) || pickTitle(p))
      );
    } catch (e) {
      products = [];
      console.error('[comprar] fetch error:', e);
    }
  })();

  // ----- helpers de mapeo -----
  function pickSrc(p) {
    return p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  }
  function pickTitle(p) {
    return p?.acf?.['nombre-landing'] || p?.name || '';
  }
  function pickUrl(p) {
    return p?.permalink || '';
  }
  function pickPrice(p) {
    const raw = p?.sale_price || p?.price || p?.regular_price || '';
    if (raw === '') return 'Ver detalles';
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
    }
    // si Woo da string no numérico, al menos anteponer $
    return /^\$/.test(raw) ? raw : ('$' + raw);
  }

  // ----- render -----
  function renderComprar() {
    const cont = document.querySelector('#comprar article');
    if (!cont) return;
    if (cont.dataset.rendered === '1') return; // evita doble render

    const tpl = document.getElementById('tplComprarItem');
    const frag = document.createDocumentFragment();

    // Limpia placeholders actuales
    cont.innerHTML = '';

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
      const url   = pickUrl(p) || '#';
      const price = pickPrice(p);

      if (src)  { img.src = src; }
      img.alt   = title;
      h3.textContent = title;
      a.href = url;
      a.textContent = price;

      frag.appendChild(fig);
    }

    cont.appendChild(frag);
    cont.dataset.rendered = '1';

    // Monta tu carrusel de scroll si ya está cargado
    if (typeof window.mountComprarCarousel === 'function') {
      window.mountComprarCarousel();
    }
  }

  async function tryRender() {
    await fetchPromise;
    if (products.length) renderComprar();
  }

  // 1) Si ya existe el bloque en el DOM ahora mismo, intenta render
  if (document.querySelector('#comprar article')) {
    tryRender();
  }

  // 2) Cuando tu loader diga que #comprar está listo, render
  document.addEventListener('component:ready', (e) => {
    if (e?.detail?.id === 'comprar') tryRender();
  });

  // 3) Fallback: observa el DOM por si lo insertan por otra vía
  const obs = new MutationObserver(() => {
    if (document.querySelector('#comprar article')) {
      tryRender();
      obs.disconnect();
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
