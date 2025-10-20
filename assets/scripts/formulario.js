(() => {
  // === CONFIG ===
  const SITE_KEY  = '6LccHIsqAAAAAAb2LiEEl4pkrdk9S8EJ7l4FQrs4'; // tu v3 pública
  const FORM_ID   = 'mc-embedded-subscribe-form';
  const BTN_ID    = 'mc-embedded-subscribe';
  const BADGE_SLOT_ID = 'recaptcha-badge-slot';
  const FUNCTION_ENDPOINT = '/api/submit'; // cambia si tu función es otra (ej. /api/submit-distribuidor)

  const $  = id => document.getElementById(id);
  const val = id => ($(id)?.value || '').trim();

  // Estilos mínimos / badge estático
  (function injectStyles(){
    if (document.getElementById('recaptcha-v3-styles')) return;
    const s=document.createElement('style'); s.id='recaptcha-v3-styles';
    s.textContent = `
      iframe[name="mc-submit-bridge"]{display:none;width:0;height:0;border:0}
      #${BADGE_SLOT_ID}{margin-top:.5rem}
      #${BADGE_SLOT_ID} .grecaptcha-badge{
        position:static!important; right:auto!important; bottom:auto!important; box-shadow:none!important;
        transform:none!important;
      }
    `;
    document.head.appendChild(s);
  })();

  function ensureBadgeSlot(){
    if($(BADGE_SLOT_ID)) return $(BADGE_SLOT_ID);
    const btn=$(BTN_ID); if(!btn) return null;
    const slot=document.createElement('div'); slot.id=BADGE_SLOT_ID;
    btn.insertAdjacentElement('afterend', slot); return slot;
  }
  function placeV3Badge(){
    const slot=ensureBadgeSlot(); if(!slot) return;
    const move=()=>{ const b=document.querySelector('.grecaptcha-badge');
      if(b && slot.firstChild!==b){ slot.appendChild(b); b.style.position='static'; return true; }
      return false;
    };
    if(move()) return; let n=0; const id=setInterval(()=>{ if(move()||++n>30) clearInterval(id); },100);
  }

  // Carga/ready de v3
  async function ensureRecaptchaReady() {
    if (window.grecaptcha && grecaptcha.ready) {
      await new Promise(res => grecaptcha.ready(res));
      return;
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?render='+encodeURIComponent(SITE_KEY);
      s.async = true; s.defer = true;
      s.onload = () => {
        if (window.grecaptcha && grecaptcha.ready) {
          grecaptcha.ready(resolve);
        } else {
          reject(new Error('grecaptcha no expone ready()'));
        }
      };
      s.onerror = () => reject(new Error('No se pudo cargar api.js de reCAPTCHA'));
      document.head.appendChild(s);
    });
  }
  async function getTokenV3() {
    try {
      await ensureRecaptchaReady();
      const t = await grecaptcha.execute(SITE_KEY, { action:'submit' });
      console.log('[reCAPTCHA v3] token length:', (t||'').length);
      return t || '';
    } catch (e) {
      console.warn('[reCAPTCHA v3] indisponible:', e);
      return '';
    }
  }

  // Mailchimp bridge en paralelo (sin bloquear UX)
  function ensureMcIframe(){
    let f=document.querySelector('iframe[name="mc-submit-bridge"]');
    if(!f){ f=document.createElement('iframe'); f.name='mc-submit-bridge'; document.body.appendChild(f); }
    return f;
  }
  function submitToMailchimp(form){
    const originalTarget=form.getAttribute('target');
    try { ensureMcIframe(); form.setAttribute('target','mc-submit-bridge'); form.submit(); }
    finally { originalTarget ? form.setAttribute('target', originalTarget) : form.removeAttribute('target'); }
  }

  async function onSubmit(ev){
    ev.preventDefault();

    // Validación mínima (ajústala a lo que necesites)
    const needed = [
      'mce-FNAME', 'mce-EMAIL', 'mce-PHONE',
      'mce-ADDRESS-addr1', 'mce-ADDRESS-city', 'mce-ADDRESS-state', 'mce-ADDRESS-zip',
      'mce-EXPERIENCI', 'mce-TIENDA', 'mce-TIPOEXPERI', 'mce-INVERSION'
    ];
    let ok = true;
    needed.forEach(id => {
      const el=$(id); const v = el ? (el.value||'').trim() : '';
      if (!v) { ok=false; el && (el.style.boxShadow='0 0 4px #ef4444'); }
      else { el && (el.style.boxShadow='0 0 0 #0000'); }
    });
    if(!ok){ alert('Por favor completa los campos obligatorios.'); return; }

    // Token v3
    const token = await getTokenV3();

    // Payload para tu Netlify Function
    const payload = {
      name: val('mce-FNAME'),
      email: val('mce-EMAIL'),
      phone: val('mce-PHONE'),
      address_line1: val('mce-ADDRESS-addr1'),
      city: val('mce-ADDRESS-city'),
      state: val('mce-ADDRESS-state'),
      zip: val('mce-ADDRESS-zip'),
      country: val('mce-ADDRESS-country'), // si el select existe en tu HTML
      experiencia: val('mce-EXPERIENCI'),
      tienda: val('mce-TIENDA'),
      tipo_experiencia: val('mce-TIPOEXPERI'),
      inversion: val('mce-INVERSION'),
      recaptcha_token: token,
      _meta: { url: location.href, ua: navigator.userAgent, ts: new Date().toISOString() }
    };

    // 1) Disparo a tu función (con recaptcha_token)
    fetch(FUNCTION_ENDPOINT, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    })
    .then(async r => {
      const t = await r.text();
      if(!r.ok) throw new Error(t||'Function error');
      try { return JSON.parse(t); } catch { return { ok:true, raw:t }; }
    })
    .then(() => {
      // 2) En paralelo mando a Mailchimp (bridge)
      const form = $(FORM_ID);
      submitToMailchimp(form);
      // 3) Redirige a tu página de gracias (ajústala si quieres)
      window.location.assign('https://motos-roue.netlify.app/gracias62332227');
    })
    .catch(err => {
      console.error('[Front] function ERROR:', err);
      alert('No fue posible enviar tu información. Intenta nuevamente.');
    });
  }

  function mount(){
    const form=$(FORM_ID); if(!form) return;
    form.setAttribute('novalidate','');
    form.addEventListener('submit', onSubmit);
    ensureRecaptchaReady().then(placeV3Badge).catch(()=>{}); // mueve badge al slot
  }

  (document.readyState==='loading') ? document.addEventListener('DOMContentLoaded', mount) : mount();
})();
