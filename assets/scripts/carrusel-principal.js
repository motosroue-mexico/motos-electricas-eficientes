(async () => {
  const res = await fetch('/.netlify/functions/woo-products?status=publish&all=1');
  const data = await res.json();
  localStorage.setItem('woo:products', JSON.stringify(data));
  console.log('Guardado en localStorage:', data);
})();
