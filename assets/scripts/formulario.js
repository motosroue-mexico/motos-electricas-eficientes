(() => {
  // === CONFIG ===
  const SITE_KEY  = '6LccHIsqAAAAAAb2LiEEl4pkrdk9S8EJ7l4FQrs4'; // reCAPTCHA v3 pública
  const FORM_ID   = 'mc-embedded-subscribe-form';
  const BTN_ID    = 'mc-embedded-subscribe';
  const BADGE_SLOT_ID = 'recaptcha-badge-slot';
  const FUNCTION_ENDPOINT = '/api/submit'; // tu función Netlify
  const STATUS_ID = 'form-status';
  const THANK_YOU_URL = '/gracias62332227'; // tu página de gracias

  const $  = id => document.getElementById(id);
  const val = id => ($(id)?.value || '').trim();

  // ========== Estilos mínimos ==========
  (function injectStyles(){
    if (document.getElementById('recaptcha-v3-styles')) return;
    const s=document.createElement('style'); s.id='recaptcha-v3-styles';
    s.textContent = `
      iframe[name="mc-submit-bridge"]{display:none;width:0;height:0;border:0}
      #${BADGE_SLOT_ID}{margin-top:.5rem}
      #${BADGE_SLOT_ID} .grecaptcha-badge{
        position:static!important; right:auto!important; bottom:auto!important; box-shadow:none!important; transform:none!important;
      }
      .field-error{display:block;margin-top:.25rem;font-size:.8rem;color:#ef4444}
      .is-invalid{box-shadow:0 0 0 2px rgba(239,68,68,.35)!important;border-color:#ef4444!important}
      .form-status{margin-top:.5rem;font-size:.9rem;opacity:.85}
      .is-sending{opacity:.7;pointer-events:none}
    `;
    document.head.appendChild(s);
  })();

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
  function setStatus(msg){ ensureStatusSlot().textContent = msg || ''; }

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

  // ======= Validaciones =======
  const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  const RE_PHONE = /^[0-9+\-\s()]{8,}$/;
  const RE_ZIP   = /^[0-9A-Za-z\- ]{4,10}$/;
  const RE_TEXT  = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9.,\-#/\s]{2,}$/;

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

  // ====== reCAPTCHA v3 ======
  async function ensureRecaptchaReady() {
    if (window.grecaptcha && grecaptcha.ready) {
      await new Promise(res => grecaptcha.ready(res)); return;
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?render='+encodeURIComponent(SITE_KEY);
      s.async = true; s.defer = true;
      s.onload = () => (window.grecaptcha && grecaptcha.ready) ? grecaptcha.ready(resolve) : reject(new Error('grecaptcha no expone ready()'));
      s.onerror = () => reject(new Error('No se pudo cargar api.js de reCAPTCHA'));
      document.head.appendChild(s);
    });
  }
  async function getTokenV3() {
    try { await ensureRecaptchaReady(); return await grecaptcha.execute(SITE_KEY, { action:'submit' }); }
    catch { return ''; }
  }

  // ====== Mailchimp: fetch no-cors + fallback iframe ======
  function ensureMcIframe(){
    let f=document.querySelector('iframe[name="mc-submit-bridge"]');
    if(!f){ f=document.createElement('iframe'); f.name='mc-submit-bridge'; f.style.display='none'; document.body.appendChild(f); }
    return f;
  }
  function submitMailchimpViaIframe(form){
    return new Promise((resolve)=>{
      const iframe = ensureMcIframe();
      const onload = () => { iframe.removeEventListener('load', onload); resolve('loaded'); };
      iframe.addEventListener('load', onload);
      const originalTarget=form.getAttribute('target');
      try { form.setAttribute('target','mc-submit-bridge'); form.submit(); }
      finally {
        setTimeout(()=>{ originalTarget ? form.setAttribute('target', originalTarget) : form.removeAttribute('target'); }, 50);
        setTimeout(()=>{ iframe.removeEventListener('load', onload); resolve('timeout'); }, 1500);
      }
    });
  }
  async function submitMailchimp(form){
    // 1) Intento con fetch no-cors (como tu código que funcionaba)
    try {
      const fd = new FormData(form); // incluye TODOS los campos/hidden exactos del embed
      await fetch(form.action, { method:'POST', body: fd, mode:'no-cors' });
      // No se puede leer la respuesta en no-cors, pero el POST se envía.
      return 'nocors';
    } catch (e) {
      // 2) Fallback: iframe + submit tradicional
      return await submitMailchimpViaIframe(form);
    }
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

    // Payload (llaves en español para tu backend)
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

    // 1) Google (tu backend → GAS)
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
      // 2) Mailchimp (desde el navegador)
      const form = $(FORM_ID);
      await submitMailchimp(form);

      // 3) Redirigir a gracias
      window.location.assign(THANK_YOU_URL);
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

