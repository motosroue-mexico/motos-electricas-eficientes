// /assets/scripts/comprar-carrusel.js
(() => {
  const STEP = 380;

  // Exponemos la función para que el loader pueda llamarla cuando #comprar esté listo
  window.mountComprarCarousel = function mountComprarCarousel() {
    const cont = document.querySelector('#comprar article');
    const prev = document.getElementById('comprarPrev');
    const next = document.getElementById('comprarNext');
    if (!cont || !prev || !next) return; // aún no está completo

    if (cont.dataset.carouselInit === '1') return; // evita doble init
    cont.dataset.carouselInit = '1';

    cont.style.scrollBehavior = 'smooth';
    cont.style.overflowX = cont.style.overflowX || 'auto';

    const clamp = (x, min, max) => Math.max(min, Math.min(x, max));

    function move(delta) {
      const max = cont.scrollWidth - cont.clientWidth;
      const nextLeft = clamp(cont.scrollLeft + delta, 0, Math.max(0, max));
      cont.scrollTo({ left: nextLeft, behavior: 'smooth' });
    }

    function updateDisabled() {
      const max = cont.scrollWidth - cont.clientWidth - 1;
      prev.disabled = cont.scrollLeft <= 0;
      next.disabled = cont.scrollLeft >= Math.max(0, max);
    }

    function updateVisibility() {
      const scrollable = cont.scrollWidth > cont.clientWidth + 1;
      prev.hidden = next.hidden = !scrollable;
    }

    prev.addEventListener('click', () => move(-STEP));
    next.addEventListener('click', () => move(+STEP));
    cont.addEventListener('scroll', updateDisabled);
    window.addEventListener('resize', () => { updateVisibility(); updateDisabled(); });

    cont.tabIndex = 0;
    cont.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') move(+STEP);
      if (e.key === 'ArrowLeft')  move(-STEP);
    });

    updateVisibility();
    updateDisabled();
    console.log('✅ comprar-carrusel montado');
  };

  // 1) Si ya existe #comprar en el DOM (por cualquier razón), montamos
  if (document.querySelector('#comprar article')) {
    window.mountComprarCarousel();
  }

  // 2) Si el loader avisa que #comprar está listo, montamos
  document.addEventListener('component:ready', (e) => {
    if (e.detail?.id === 'comprar') window.mountComprarCarousel();
  });

  // 3) Fallback: observa el DOM por si algo cargó fuera de lo esperado
  const obs = new MutationObserver(() => {
    if (document.querySelector('#comprar article')) {
      window.mountComprarCarousel();
      obs.disconnect();
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
