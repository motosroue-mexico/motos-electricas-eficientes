(() => {
  // === CONFIG ===
  const SITE_KEY  = '6LccHIsqAAAAAAb2LiEEl4pkrdk9S8EJ7l4FQrs4';
  const FORM_ID   = 'mc-embedded-subscribe-form';
  const BTN_ID    = 'mc-embedded-subscribe';
  const BADGE_SLOT_ID = 'recaptcha-badge-slot';
  const FUNCTION_ENDPOINT = '/api/submit';
  const STATUS_ID = 'form-status';

  const $  = id => document.getElementById(id);
  const val = id => ($(id)?.value || '').trim();

  function ensureAfter(el){ return el?.parentElement || el; }
  function setError(id, msg){
    const el = $(id); if(!el) return;
    el.classList.add('is-invalid');
    let s = document.getElementById('err-'+id);
    if(!s){
      s = document.createElement('small');
      s.id = 'err-'+id;
      s.className = 'field-error';
      ensureAfter(el).appendChild(s);
    }
    s.textContent = msg || 'Campo obligatorio.';
  }
  function clearError(id){
    const el = $(id); if(!el) return;
    el.classList.remove('is-invalid');
    const s = document.getElementById('err-'+id);
    if(s) s.remove();
  }
  function clearErrors(ids){ ids.forEach(clearError); }

  function ensureStatusSlot(){
    let s = $(STATUS_ID);
    if(!s){
      s = document.createElement('p');
      s.id = STATUS_ID;
      s.className = 'form-status';
      const btn=$(BTN_ID);
      btn?.insertAdjacentElement('afterend', s);
    }
    return s;
  }
  function setStatus(msg){
    const s = ensureStatusSlot();
    s.textContent = msg || '';
  }

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
      .field-error{display:block;margin-top:.25rem;font-size:.8rem;color:#ef4444}
      .is-invalid{box-shadow:0 0 0 2px rgba(239,68,68,.35)!important;border-color:#ef4444!important}
      .form-status{margin-top:.5rem;font-size:.9rem;opacity:.85}
      .is-sending{opacity:.7;pointer-events:none}
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

  // === Mailchimp bridge con confirmación ===
  function ensureMcIframe(){
    let f=document.querySelector('iframe[name="mc-submit-bridge"]');
    if(!f){
      f=document.createElement('iframe');
      f.name='mc-submit-bridge';
      f.style.display='none';
      document.body.appendChild(f);
    }
    return f;
  }

  // DEVUELVE una Promesa que se resuelve en load o por timeout
  function submitToMailchimp(form){
    return new Promise((resolve) => {
      const iframe = ensureMcIframe();

      // Limpia listeners previos
      const handler = () => {
        iframe.removeEventListener('load', handler);
        resolve('loaded');
      };
      iframe.addEventListener('load', handler);

      // Fallback por si no dispara load
      const fallback = setTimeout(() => {
        iframe.removeEventListener('load', handler);
        resolve('timeout');
      }, 1200); // 1.2s suele ser suficiente

      // Enviar
      const originalTarget=form.getAttribute('target');
      try {
        form.setAttribute('target','mc-submit-bridge');
        form.submit();
      } finally {
        // Deja un microtask antes de restaurar para no interferir
        setTimeout(() => {
          originalTarget ? form.setAttribute('target', originalTarget) : form.removeAttribute('target');
          clearTimeout(fallback);
        }, 50);
      }
    });
  }

  // ======= Validaciones =======
  const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  const RE_PHONE = /^[0-9+\-\s()]{8,}$/;
  const RE_ZIP   = /^[0-9A-Za-z\- ]{4,10}$/;
  const RE_TEXT  = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.,\-#/\s]{2,}$/;

  function validateAll(){
    const needed = [
      'mce-FNAME', 'mce-EMAIL', 'mce-PHONE',
      'mce-ADDRESS-addr1', 'mce-ADDRESS-city', 'mce-ADDRESS-state', 'mce-ADDRESS-zip',
      'mce-EXPERIENCI', 'mce-TIENDA', 'mce-TIPOEXPERI', 'mce-INVERSION'
    ];
    clearErrors(needed);
    let ok = true;

    const rules = [
      { id:'mce-FNAME',        test: v => v.length >= 2,                          msg:'Escribe tu nombre completo.' },
      { id:'mce-EMAIL',        test: v => RE_EMAIL.test(v),                       msg:'Correo inválido.' },
      { id:'mce-PHONE',        test: v => RE_PHONE.test(v),                       msg:'Teléfono inválido (mín. 8 dígitos).' },
      { id:'mce-ADDRESS-addr1',test: v => RE_TEXT.test(v) && v.length >= 5,      msg:'Dirección incompleta.' },
      { id:'mce-ADDRESS-city', test: v => RE_TEXT.test(v),                        msg:'Ciudad inválida.' },
      { id:'mce-ADDRESS-state',test: v => RE_TEXT.test(v),                        msg:'Estado inválido.' },
      { id:'mce-ADDRESS-zip',  test: v => RE_ZIP.test(v),                         msg:'Código postal inválido.' },
      { id:'mce-ADDRESS-country', test: v => ($( 'mce-ADDRESS-country') ? v.length>0 : true), msg:'Selecciona país.' },
      { id:'mce-EXPERIENCI',   test: v => v.length > 0,                           msg:'Selecciona tu experiencia.' },
      { id:'mce-TIENDA',       test: v => v.length > 0,                           msg:'Indica si tienes tienda.' },
      { id:'mce-TIPOEXPERI',   test: v => v.length > 0,                           msg:'Selecciona el tipo de experiencia.' },
      { id:'mce-INVERSION',    test: v => v.length > 0,                           msg:'Selecciona tu inversión estimada.' },
    ];

    for (const r of rules){
      const v = val(r.id);
      if(!r.test(v)){ setError(r.id, r.msg); ok = false; }
    }
    if(!ok){
      needed.forEach(id => {
        const el=$(id);
        const v = el ? (el.value||'').trim() : '';
        if(!v) setError(id, 'Campo obligatorio.');
      });
    }
    return ok;
  }

  async function onSubmit(ev){
    ev.preventDefault();

    if(!validateAll()){
      alert('Por favor corrige los campos marcados en rojo e intenta nuevamente.');
      return;
    }

    const btn = $(BTN_ID);
    btn?.classList.add('is-sending');
    btn?.setAttribute('aria-busy','true');
    setStatus('Enviando…');

    const token = await getTokenV3();

    const payload = {
      name: val('mce-FNAME'),
      email: val('mce-EMAIL'),
      phone: val('mce-PHONE'),
      direccion: val('mce-ADDRESS-addr1'),
      ciudad: val('mce-ADDRESS-city'),
      estado: val('mce-ADDRESS-state'),
      zip: val('mce-ADDRESS-zip'),
      country: val('mce-ADDRESS-country'),
      experiencia: val('mce-EXPERIENCI'),
      tienda: val('mce-TIENDA'),
      tipoExperiencia: val('mce-TIPOEXPERI'),
      inversion: val('mce-INVERSION'),
      recaptcha_token: token,
      _meta: { url: location.href, ua: navigator.userAgent, ts: new Date().toISOString() }
    };

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
    .then(async () => {
      // 1) Enviar a Mailchimp y ESPERAR confirmación/timeout
      const form = $(FORM_ID);
      await submitToMailchimp(form);

      // 2) Redirigir a gracias (ya con MC disparado)
      window.location.assign('/gracias62332227');
    })
    .catch(err => {
      console.error('[Front] function ERROR:', err);
      alert('No fue posible enviar tu información. Intenta nuevamente.');
      setStatus('Ocurrió un error. Por favor intenta de nuevo.');
      btn?.classList.remove('is-sending');
      btn?.removeAttribute('aria-busy');
    });
  }

  function mount(){
    const form=$(FORM_ID); if(!form) return;
    form.setAttribute('novalidate','');
    form.addEventListener('submit', onSubmit);
    ensureRecaptchaReady().then(placeV3Badge).catch(()=>{});
  }

  (document.readyState==='loading') ? document.addEventListener('DOMContentLoaded', mount) : mount();
})();