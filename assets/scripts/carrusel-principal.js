// /assets/scripts/carrusel-principal.js
(() => {
  'use strict';

  // ========================
  // Configuración editable
  // ========================
  const CFG = {
    ENDPOINT: window.WOO_PRODUCTS_ENDPOINT || '/.netlify/functions/wordpress-products',
    // Selectores dentro del root
    rootId: 'carruselMotos',
    imgSel: 'img.motos',
    titleSel: 'figcaption h2, h2',
    // Campos esperados (ACF / REST) para imagen y título
    fields: {
      img: ['acf.imagen-landing.url', 'acf.imagen-landing', 'image', 'images.0.src', 'yoast_head_json.og_image.0.url'],
      title: ['acf.nombre-landing', 'name', 'title.rendered', 'title']
    },
    // UX
    preloadNext: true,
    autoplayMs: 0,           // 0 = desactivado. Ej: 5000 para 5s
    swipeMinPx: 40,          // distancia mínima para considerar swipe
    fetchTimeoutMs: 12000,   // timeout de red
    lazyInit: true,          // esperar a que el carrusel sea visible para iniciar
    fallbackImg: '',         // opcional: URL de fallback si falta imagen
  };

  // ========================
  // Estado interno
  // ========================
  const state = {
    products: /** @type {Array<any>} */([]),
    idx: -1,                  // -1 = mostrar HTML inicial
    pendingFirstClick: false,
    autoplayTimer: null,
    visible: !CFG.lazyInit
  };

  // ========================
  // Utils
  // ========================

  // Acceso seguro a rutas tipo "a.b.c" sobre objetos
  function getPath(obj, path) {
    try {
      return path.split('.').reduce((acc, k) => acc?.[k], obj);
    } catch { return undefined; }
  }

  // Devuelve el primer valor truthy según lista de rutas
  function pick(obj, paths) {
    for (const p of paths) {
      const v = getPath(obj, p);
      if (v) return v;
    }
    return undefined;
  }

  // Normaliza un producto al shape mínimo {src, title, raw}
  function normalize(p) {
    const src = pick(p, CFG.fields.img) || '';
    const title = (pick(p, CFG.fields.title) || '').toString().replace(/<[^>]*>/g, '');
    return { src, title, raw: p };
  }

  // Quita duplicados por src+title
  function dedupe(items) {
    const seen = new Set();
    return items.filter(({ src, title }) => {
      const key = `${src}|${title}`;
      if (!src && !title) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // Referencias DOM (siempre frescas)
  function refs() {
    const root = document.getElementById(CFG.rootId);
    const img  = root?.querySelector(CFG.imgSel) || null;
    const h2   = root?.querySelector(CFG.titleSel) || null;
    return { root, img, h2 };
  }

  function clampIndex(i, len) {
    return ((i % len) + len) % len;
  }

  function preload(src) {
    if (!CFG.preloadNext || !src) return;
    const im = new Image();
    im.decoding = 'async';
    im.src = src;
  }

  // ========================
  // Render
  // ========================
  function render(i) {
    const { root, img, h2 } = refs();
    if (!root || !img || !h2 || !state.products.length) return;

    const len = state.products.length;
    state.idx = clampIndex(i, len);

    const item = state.products[state.idx];
    const src  = item.src || CFG.fallbackImg || '';
    const ttl  = item.title || '';

    if (ttl) { h2.textContent = ttl; img.alt = ttl; img.title = ttl; }
    if (src)  img.src = src;

    root.dataset.idx = String(state.idx);

    // precarga siguiente
    const next = state.products[clampIndex(state.idx + 1, len)];
    if (next?.src) preload(next.src);
  }

  // ========================
  // Navegación
  // ========================
  function step(delta) {
    const { root } = refs();
    if (!root) return;

    if (!root.dataset.idx) root.dataset.idx = '-1';

    if (!state.products.length) {
      state.pendingFirstClick = true;
      return;
    }

    if (state.idx < 0) {
      render(0);
      return;
    }

    render(state.idx + delta);
  }

  // ========================
  // Autoplay
  // ========================
  function stopAutoplay() {
    if (state.autoplayTimer) {
      clearInterval(state.autoplayTimer);
      state.autoplayTimer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    if (!CFG.autoplayMs || CFG.autoplayMs < 1000) return;
    state.autoplayTimer = setInterval(() => step(1), CFG.autoplayMs);
  }

  // Pausar en hover/oculto
  function wireAutoplayUX() {
    const { root } = refs();
    if (!root) return;

    root.addEventListener('mouseenter', stopAutoplay);
    root.addEventListener('mouseleave', startAutoplay);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAutoplay();
      else startAutoplay();
    });
  }

  // ========================
  // Entrada: teclado y swipe
  // ========================
  function wireInput() {
    const { root } = refs();
    if (!root) return;

    // Teclado
    root.setAttribute('tabindex', root.getAttribute('tabindex') || '0');
    root.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); step(1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); step(-1); }
    });

    // Swipe táctil
    let startX = 0;
    let tracking = false;

    root.addEventListener('touchstart', (e) => {
      if (!e.touches?.length) return;
      tracking = true;
      startX = e.touches[0].clientX;
    }, { passive: true });

    root.addEventListener('touchmove', (e) => {
      if (!tracking || !e.touches?.length) return;
      const dx = e.touches[0].clientX - startX;
      if (Math.abs(dx) > CFG.swipeMinPx) {
        tracking = false;
        dx < 0 ? step(1) : step(-1);
      }
    }, { passive: true });

    root.addEventListener('touchend', () => { tracking = false; }, { passive: true });
  }

  // ========================
  // Fetch de productos
  // ========================
  async function fetchProducts() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), CFG.fetchTimeoutMs);

    try {
      const res = await fetch(CFG.ENDPOINT, { credentials: 'omit', signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      const raw  = Array.isArray(data) ? data
                  : Array.isArray(data?.products) ? data.products
                  : [];

      // Publica en debug
      window.__CarruselDebug && (window.__CarruselDebug.raw = raw);

      // Filtra publicables y normaliza
      const normalized = raw
        .filter(p => p && (p.status === undefined || p.status === 'publish'))
        .map(normalize);

      state.products = dedupe(normalized);

      // Si hubo clic mientras cargaba, posiciona en el 0
      if (state.products.length && state.pendingFirstClick && state.idx < 0) {
        const { root } = refs();
        if (root && root.dataset.idx === '-1') render(0);
      }
      state.pendingFirstClick = false;

      // Autoplay arranca solo si hay data
      if (state.products.length) startAutoplay();

    } catch (err) {
      // Silencioso, pero expone en debug
      window.__CarruselDebug && (window.__CarruselDebug.fetchError = String(err));
      state.products = [];
      stopAutoplay();
    } finally {
      clearTimeout(t);
    }
  }

  // ========================
  // Lazy init (visible) + boot
  // ========================
  function ensureIdxAttr() {
    const { root } = refs();
    if (root && !root.dataset.idx) root.dataset.idx = '-1';
  }

  function initWhenVisible() {
    if (!CFG.lazyInit) {
      state.visible = true;
      boot();
      return;
    }

    const { root } = refs();
    if (!root) return;

    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        state.visible = true;
        io.disconnect();
        boot();
      }
    }, { root: null, threshold: 0.05 });

    io.observe(root);
  }

  function boot() {
    ensureIdxAttr();
    wireInput();
    wireAutoplayUX();
    fetchProducts();
  }

  // ========================
  // API pública
  // ========================
  window.CarruselRoue = {
    next: () => step(1),
    prev: () => step(-1),
    init: () => { state.idx < 0 ? render(0) : render(state.idx); },
    goTo: (i) => {
      if (!state.products.length) return;
      render(Number(i) || 0);
    },
    getState: () => ({
      idx: state.idx,
      total: state.products.length,
      visible: state.visible
    }),
    // Opcional: recargar datos manualmente
    reload: () => fetchProducts()
  };

  // ========================
  // Debug helpers (opcionales)
  // ========================
  window.__CarruselDebug = window.__CarruselDebug || {};
  Object.defineProperties(window.__CarruselDebug, {
    products: { get() { return state.products; } },
    idx:      { get() { return state.idx; } },
    refs:     { get() { return refs(); } },
    normalize:{ value: normalize },
  });

  // ========================
  // Arranque
  // ========================
  document.addEventListener('DOMContentLoaded', () => {
    ensureIdxAttr();
    initWhenVisible();
  });
})();
