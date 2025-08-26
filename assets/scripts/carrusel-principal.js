// /assets/scripts/carrusel-principal.js
(() => {
  const state = {
    started: false,
    products: [],
  };

  // ---- Espera a que TODOS los selectores existan ----
  function waitForAll(selectors, { timeout = 20000 } = {}) {
    return new Promise((resolve) => {
      const haveAll = () => selectors.every((s) => document.querySelector(s));
      if (haveAll()) return resolve(selectors.map((s) => document.querySelector(s)));

      const obs = new MutationObserver(() => {
        if (haveAll()) {
          obs.disconnect();
          resolve(selectors.map((s) => document.querySelector(s)));
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });

      setTimeout(() => {
        obs.disconnect();
        resolve(selectors.map((s) => document.querySelector(s))); // puede incluir null si no llegaron
      }, timeout);
    });
  }

  // ---- Refs y utilidades ----
  function getRefs() {
    const root = document.getElementById('carruselMotos');
    if (!root) return {};
    return {
      root,
      img: root.querySelector('img.motos'),
      h2:  root.querySelector('h2'),
    };
  }

  const pickSrc   = (p) => p?.acf?.['imagen-landing']?.url || p?.acf?.['imagen-landing'] || p?.image || '';
  const pickTitle = (p) => p?.acf?.['nombre-landing'] || p?.name || '';

  // ---- Fuentes de datos (sin localStorage) ----
  function readProductsInline() {
    const tag = document.getElementById('woo-products-json'); // <script type="application/json" id="woo-products-json">[...]
    if (!tag) return [];
    try {
      const arr = JSON.parse(tag.textContent || '[]');
      return Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
    } catch { return []; }
  }

  function readProductsFromDataset() {
    const { root } = getRefs();
    if (!root?.dataset?.products) return [];
    try {
      const arr = JSON.parse(root.dataset.products);
      return Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
    } catch { return []; }
  }

  async function fetchProductsFromEndpoint() {
    const { root } = getRefs();
    const url = root?.dataset?.endpoint || window.WOO_PRODUCTS_ENDPOINT;
    if (!url) return [];
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (Array.isArray(data?.products) ? data.products : []);
      return Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
    } catch {
      return [];
    }
  }

  async function hydrateProductsOnce() {
    if (state.products.length) return state.products;

    let products = readProductsInline();
    if (!products.length) products = readProductsFromDataset();
    if (!products.length) products = await fetchProductsFromEndpoint();

    if (products.length) state.products = products;
    return state.products;
  }

  // ---- Render / navegación ----
  function renderByIndex(nextIndex) {
    const { root, img, h2 } = getRefs();
    const products = state.products;
    if (!root || !img || !h2 || !products.length) return;

    const len = products.length;
    const i = ((nextIndex % len) + len) % len;
    const p = products[i];

    const src = pickSrc(p);
    const ttl = pickTitle(p);

    if (src) img.src = src;
    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }

    root.dataset.idx = String(i);

    // Precarga siguiente
    const pre = pickSrc(products[(i + 1) % len]);
    if (pre) { const im = new Image(); im.src = pre; }
  }

  function getCurrentIdx() {
    const { root } = getRefs();
    if (!root) return -1;
    const current = parseInt(root.dataset.idx ?? '-1', 10);
    return Number.isNaN(current) ? -1 : current;
  }

  async function ensureReady() {
    if (!state.started) {
      // Espera a que existan TODOS los elementos clave del carrusel
      await waitForAll(['#carruselMotos', '#carruselMotos img.motos', '#carruselMotos h2']);
      const { root } = getRefs();
      if (!root) return false;
      if (!root.dataset.idx) root.dataset.idx = '-1';
      state.started = true;

      // Observa si luego le inyectan data-products
      const mo = new MutationObserver(() => {
        const arr = readProductsFromDataset();
        if (arr.length) {
          state.products = arr;
          if (root.dataset.idx === '-1') renderByIndex(0);
          mo.disconnect();
        }
      });
      mo.observe(root, { attributes: true, attributeFilter: ['data-products'] });

      // También escucha el evento externo
      document.addEventListener('woo:products:ready', (ev) => {
        const arr = ev?.detail;
        const next = Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
        if (next.length) {
          state.products = next;
          if (root.dataset.idx === '-1') renderByIndex(0);
        }
      });
    }
    return true;
  }

  async function ensureDataAndFirstRender() {
    const ok = await ensureReady();
    if (!ok) return false;

    if (!state.products.length) {
      await hydrateProductsOnce();
    }
    const { root } = getRefs();
    if (state.products.length && root?.dataset.idx === '-1') {
      renderByIndex(0);
    }
    return !!state.products.length;
  }

  // ---- API pública para usar con onclick ----
  async function next() {
    const ready = await ensureDataAndFirstRender();
    if (!ready) return;
    renderByIndex(getCurrentIdx() + 1);
  }
  async function prev() {
    const ready = await ensureDataAndFirstRender();
    if (!ready) return;
    renderByIndex(getCurrentIdx() - 1);
  }
  async function init() {
    await ensureDataAndFirstRender();
  }

  // Exponer API global
  window.CarruselRoue = { init, next, prev };

  // Opcional: alias si quieres usar nombres cortos en onclick
  window.motoDerClick = () => { window.CarruselRoue.next(); };
  window.motoIzqClick = () => { window.CarruselRoue.prev(); };

  // Bootstrap perezoso: intenta iniciar cuando el root exista
  (async () => {
    await waitForAll(['#carruselMotos']);
    await init(); // si aún no hay datos, se quedará listo esperando
  })();
})();
