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

  // cuando tu loader termine TODOS los componentes
  document.addEventListener('components:all-ready', run, { once: true });
  // fallback por si acaso
  window.addEventListener('load', run, { once: true });
})();