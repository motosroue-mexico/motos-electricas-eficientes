
(async () => {
  try {
    const res = await fetch('/.netlify/functions/wordpress-products?status=publish&all=1', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    localStorage.setItem('woo:products', JSON.stringify(data));
    localStorage.setItem('woo:products:ts', String(Date.now()));
    console.log('Productos guardados en localStorage:', data);
  } catch (e) {
    console.error('Error trayendo productos:', e);
  }
})();
