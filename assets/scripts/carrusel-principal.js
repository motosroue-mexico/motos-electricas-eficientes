
(() => {
  let started = false;

  async function run() {
    if (started) return;
    started = true;
    try {
      const ENDPOINT = '/.netlify/functions/wordpress-products?status=publish&all=1';
      const res  = await fetch(ENDPOINT, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      localStorage.setItem('woo:products', JSON.stringify(data));
      localStorage.setItem('woo:products:ts', String(Date.now()));
      console.log('Productos guardados en localStorage:', data);

      document.dispatchEvent(new CustomEvent('woo:products:ready', { detail: data }));
    } catch (e) {
      console.error('Error trayendo productos:', e);
      const cached = localStorage.getItem('woo:products');
      if (cached) {
        const data = JSON.parse(cached);
        console.warn('Usando cache previo de localStorage');
        document.dispatchEvent(new CustomEvent('woo:products:ready', { detail: data }));
      }
    }
  }

  // corre al final de tu loader y, por si acaso, al load
  document.addEventListener('components:all-ready', run, { once: true });
  window.addEventListener('load', run, { once: true });
})();



(() => {
  let started = false;

  function init() {
    if (started) return;
    started = true;

    const root   = document.getElementById('carruselMotos');
    const img    = root?.querySelector('img.motos');
    const h2     = root?.querySelector('h2');
    const btnDer = document.getElementById('motoDer');
    const btnIzq = document.getElementById('motoIzq');
    if (!root || !img || !h2 || !btnDer || !btnIzq) return;

    let products = [];

    // Carga inicial desde localStorage (sin tocar tu fetch)
    try {
      const cached = localStorage.getItem('woo:products');
      if (cached) {
        const arr = JSON.parse(cached);
        products = Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
      }
    } catch (_) {}

    // Mantén la XFX inicial: primer click -> primer producto
    if (!root.dataset.idx) root.dataset.idx = '-1';

    const pickSrc = (p) =>
      p?.acf?.['imagen-landing']?.url ||
      p?.acf?.['imagen-landing'] ||
      p?.image || '';

    const pickTitle = (p) =>
      p?.acf?.['nombre-landing'] || p?.name || '';

    function renderByIndex(nextIndex) {
      if (!products.length) return;
      const len = products.length;
      const i = ((nextIndex % len) + len) % len;
      const p = products[i];

      const src = pickSrc(p);
      const ttl = pickTitle(p);

      if (src) img.src = src;
      if (ttl) {
        h2.textContent = ttl;
        img.alt = ttl;
        img.title = ttl;
      }
      root.dataset.idx = String(i);
    }

    function move(delta) {
      if (!products.length) return;
      const current = parseInt(root.dataset.idx || '-1', 10) || 0;
      renderByIndex(current + delta);
    }

    btnDer.addEventListener('click', () => move(1));
    btnIzq.addEventListener('click', () => move(-1));

    // Actualiza la lista cuando llegue el evento de tu fetch (sin render inmediato)
    document.addEventListener('woo:products:ready', (e) => {
      const arr = e?.detail;
      products = Array.isArray(arr) ? arr.filter(p => p?.status === 'publish') : [];
    });
  }

  // Ejecuta cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Y también cuando tu orquestador de componentes avise
  document.addEventListener('components:all-ready', init, { once: true });
})();