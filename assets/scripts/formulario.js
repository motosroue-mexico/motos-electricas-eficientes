(() => {
  // ====== CONSTANTES ======
  const SITE_KEY  = '6Le6GosqAAAAADBQ0Bkd1y31sOdQKKRt9NRZhbTN'; // v3 pública
  const FORM_ID   = 'mc-embedded-subscribe-form';
  const BTN_ID    = 'mc-embedded-subscribe';
  const STATUS_ID = 'form-status';
  const THANK_YOU_URL = 'https://roue-ebikes.netlify.app/thank-you62306338';
  const MC_IFRAME_NAME = 'mc-submit-bridge';
  const BADGE_SLOT_ID  = 'recaptcha-badge-slot';

  const $  = id => document.getElementById(id);
  const val = id => ($(id)?.value || '').trim();

  // ====== Helpers UI ======
  function injectStyles(){
    if (document.getElementById('leadform-styles')) return;
    const s=document.createElement('style'); s.id='leadform-styles';
    s.textContent=`
      .lf-row{display:flex;align-items:center;gap:.6rem;margin-top:.75rem;font-size:.875rem}
      .lf-hidden{display:none}
      .lf-ring{width:22px;height:22px;border-radius:50%;display:inline-block;
        --c1:#e5e7eb;--c2:currentColor;background:
        conic-gradient(from 0turn,var(--c2) 0.0turn 0.25turn,transparent 0.25turn) content-box,
        conic-gradient(var(--c1),var(--c1)) border-box;
        -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 0) content-box,none;
        mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 0) content-box,none;
        padding:3px;animation:lf-rotate 1s linear infinite}
      @keyframes lf-rotate{to{transform:rotate(360deg)}}
      .lf-ok,.lf-x{display:inline-flex;align-items:center;justify-content:center}
      .lf-success{color:#22c55e}.lf-error{color:#ef4444}
      iframe[name="${MC_IFRAME_NAME}"]{display:none;width:0;height:0;border:0}
      #${BADGE_SLOT_ID}{margin-top:.5rem}
      #${BADGE_SLOT_ID} .grecaptcha-badge{position:static!important;right:auto!important;bottom:auto!important;box-shadow:none!important}
      .select-disabled{pointer-events:none;opacity:.85}
    `;
    document.head.appendChild(s);
  }
  function ensureStatusEl(){
    injectStyles();
    let el=$(STATUS_ID);
    if(!el){
      el=document.createElement('div');
      el.id=STATUS_ID; el.setAttribute('aria-live','polite');
      el.className='lf-row lf-hidden';
      el.innerHTML=`<span class="lf-ring" hidden></span><span></span>`;
      $(FORM_ID)?.appendChild(el);
    }
    return el;
  }
  function setStatus(msg,type='info'){
    const el=ensureStatusEl(); el.classList.remove('lf-hidden');
    const spinner=el.children[0], text=el.children[1];
    spinner.hidden = type!=='loading';
    el.classList.remove('lf-success','lf-error');
    if(type==='success') el.classList.add('lf-success');
    if(type==='error')   el.classList.add('lf-error');
    text.textContent=msg||'';
  }
  function setBtnLoading(on){
    const btn=$(BTN_ID); if(!btn) return;
    if(on){
      btn.dataset._txt=btn.value || btn.innerText || 'Enviar';
      if('value' in btn) btn.value='Enviando…'; else btn.innerText='Enviando…';
      btn.disabled=true; btn.setAttribute('aria-busy','true');
    }else{
      const t=btn.dataset._txt || 'Suscribirme';
      if('value' in btn) btn.value=t; else btn.innerText=t;
      btn.disabled=false; btn.removeAttribute('aria-busy');
    }
  }

  // ====== Validación ======
  const rxEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const rxPhone=/^[0-9\s()+-]{7,20}$/;
  function markField(el, ok){
    if(!el) return;
    el.style.borderWidth='1px'; el.style.borderStyle='solid'; el.style.transition='border-color .3s, box-shadow .3s';
    if(ok===false){el.style.borderColor='#ef4444'; el.style.boxShadow='0 0 4px #ef4444';}
    else if(ok===true){el.style.borderColor='#22c55e'; el.style.boxShadow='0 0 4px #22c55e';}
    else { el.style.borderColor=''; el.style.boxShadow='';}
  }
  function requireAndMark(id, predicate = v => !!v){
    const el=$(id); const v=val(id);
    const ok = predicate(v);
    markField(el, ok); return ok;
  }

  // ====== Lógica condicional (tus funciones, integradas) ======
  function tienesTienda(){
    const ramaSi1  = $('RamaSi1');
    const ramaNo1  = $('RamaNo1');
    const select   = $('mce-MMERGE19');
    if(!select) return;
    if(select.value === 'Si'){
      ramaSi1 && (ramaSi1.style.display='flex');
      select.classList.add('select-disabled');
    } else if(select.value === 'No'){
      ramaNo1 && (ramaNo1.style.display='flex');
      select.classList.add('select-disabled');
    }
  }
  function tipoTiendaFuncion(){
    const ramaSi2 = $('RamaSi2');
    const sel = $('mce-TIPOTIENDA');
    if(!sel || !ramaSi2) return;
    ramaSi2.style.display = sel.value !== '' ? 'flex' : 'none';
  }
  function conocimientoFuncion(){
    const ramaNo2 = $('RamaNo2');
    const sel = $('mce-MMERGE22');
    if(!sel || !ramaNo2) return;
    if(sel.value !== ''){
      ramaNo2.style.display = 'flex';
      sel.classList.add('select-disabled');
    }else{
      ramaNo2.style.display = 'none';
      sel.classList.add('select-disabled');
    }
  }
  function abrirTiendaFuncion(){
    const ramaNo3 = $('RamaNo3');
    const sel = $('mce-MMERGE23');
    if(!sel) return;
    if(sel.value === 'Si'){
      ramaNo3 && (ramaNo3.style.display='flex');
      sel.classList.add('select-disabled');
    } else {
      alert('¡Gracias por tener interés en invertir con nosotros, lamentablemente para esta inversión es indispensable contar con Tienda Online!');
      location.reload();
    }
  }
  const preguntasArchivo = $('preguntasArchivo');
  const botonesEnvio     = $('botonesEnvio');
  function inversionRama2Funcion(){
    const sel = $('mce-MMERGE24');
    if(!sel) return;
    if(sel.value === 'A partir de $250,000'){
      preguntasArchivo && (preguntasArchivo.style.display='flex');
      botonesEnvio && (botonesEnvio.style.display='flex');
      sel.classList.add('select-disabled');
    } else {
      alert('Agradecemos tu interés en invertir con nosotros. Sin embargo, esta inversión requiere un monto mínimo de $250,000.');
      location.reload();
    }
  }
  function inversionRama1Funcion(){
    const inv = $('mce-BIKEINVERS');
    const tipo= $('mce-TIPOTIENDA');
    if(!inv || !tipo) return;
    if(inv.value !== ''){
      inv.classList.add('select-disabled');
      tipo.classList.add('select-disabled');
      preguntasArchivo && (preguntasArchivo.style.display='flex');
      botonesEnvio && (botonesEnvio.style.display='flex');
    } else {
      preguntasArchivo && (preguntasArchivo.style.display='none');
      botonesEnvio && (botonesEnvio.style.display='none');
    }
  }

  // ====== Mailchimp bridge (paralelo) ======
  function ensureMcIframe(){
    let f=document.querySelector(`iframe[name="${MC_IFRAME_NAME}"]`);
    if(!f){f=document.createElement('iframe'); f.name=MC_IFRAME_NAME; document.body.appendChild(f);}
    return f;
  }
  function submitToMailchimp(form){
    const originalTarget=form.getAttribute('target');
    try{ ensureMcIframe(); form.setAttribute('target', MC_IFRAME_NAME); form.submit(); }
    finally{ originalTarget ? form.setAttribute('target',originalTarget) : form.removeAttribute('target'); }
  }

  // ====== reCAPTCHA v3 ======
  function ensureBadgeSlot(){
    if($(BADGE_SLOT_ID)) return $(BADGE_SLOT_ID);
    const btn=$(BTN_ID); if(!btn) return null;
    const slot=document.createElement('div'); slot.id=BADGE_SLOT_ID;
    btn.insertAdjacentElement('afterend',slot); return slot;
  }
  function placeV3Badge(){
    const slot=ensureBadgeSlot(); if(!slot) return;
    const move=()=>{ const b=document.querySelector('.grecaptcha-badge');
      if(b && slot.firstChild!==b){ slot.appendChild(b); b.style.position='static'; b.style.right='auto'; b.style.bottom='auto'; return true; }
      return false; };
    if(move()) return; let n=0; const id=setInterval(()=>{ if(move()||++n>30) clearInterval(id); },100);
  }
  function ensureRecaptcha(){
    return new Promise((resolve)=>{
      if(window.grecaptcha && grecaptcha.ready) return resolve();
      const s=document.createElement('script');
      s.src='https://www.google.com/recaptcha/api.js?render='+encodeURIComponent(SITE_KEY);
      s.async=true; s.defer=true; s.onload=resolve; document.head.appendChild(s);
    });
  }

  // ====== Envío (incluye tu validación con ramas) ======
  function handleSubmitForm(token, ev){
    ev && ev.preventDefault();

    // Campos base
    const tienda      = val('mce-MMERGE19');   // Si / No
    const name        = val('mce-FNAME');
    const apellido    = val('mce-LNAME');
    const email       = val('mce-EMAIL');
    const phone       = val('mce-PHONE');
    const ciudad      = val('mce-CIUDAD');
    const estado      = val('mce-ESTADO');
    const proyecto    = val('mce-MMERGE20');

    // Validación base (como pediste)
    let ok = true;
    ok &= requireAndMark('mce-MMERGE19');
    ok &= requireAndMark('mce-FNAME');
    ok &= requireAndMark('mce-LNAME');
    ok &= requireAndMark('mce-EMAIL', v => rxEmail.test(v));
    ok &= requireAndMark('mce-PHONE', v => rxPhone.test(v));
    ok &= requireAndMark('mce-CIUDAD');
    ok &= requireAndMark('mce-ESTADO');
    ok &= requireAndMark('mce-MMERGE20');

    if(!ok){
      alert('Por favor completa los campos obligatorios.');
      setStatus('Hay errores en el formulario.','error');
      setBtnLoading(false);
      return;
    }

    // Variables de rama
    const tipoTienda     = val('mce-TIPOTIENDA');   // si "Si"
    const inversion      = val('mce-BIKEINVERS');   // si "Si"
    const conocimiento   = val('mce-MMERGE22');     // si "No"
    const abrirTienda    = val('mce-MMERGE23');     // si "No"
    const abrirInversion = val('mce-MMERGE24');     // si "No" && abrirTienda="Si"

    // Validaciones de rama (siguiendo tus reglas/alerts)
    if(tienda === 'Si'){
      if(!tipoTienda || !inversion){
        alert('Completa el tipo de tienda y el monto de inversión.');
        setStatus('Faltan datos de la rama "Sí".','error'); setBtnLoading(false); return;
      }
    } else if(tienda === 'No'){
      if(!conocimiento){
        alert('Completa tu nivel de conocimiento.');
        setStatus('Faltan datos de conocimiento.','error'); setBtnLoading(false); return;
      }
      if(abrirTienda !== 'Si'){
        alert('¡Gracias por tu interés! Para esta inversión es indispensable contar con Tienda Online.');
        location.reload(); return;
      }
      if(abrirInversion !== 'A partir de $250,000'){
        alert('Esta inversión requiere un monto mínimo de $250,000.');
        location.reload(); return;
      }
    }

    // Construir payload (enviamos todo lo útil)
    const payload = {
      tienda, name, apellido, email, phone, ciudad, estado, proyecto,
      tipoTienda, inversion, conocimiento, abrirTienda, abrirInversion,
      recaptcha_token: token,
      _meta: { origen: location.href, agente: navigator.userAgent, marcaDeTiempo: new Date().toISOString() }
    };

    // Enviar al backend (usa redirect /api/submit -> function submit)
    fetch('/api/submit', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    .then(async r => { if(!r.ok) throw new Error(await r.text().catch(()=> 'Function error')); return r.json().catch(()=> ({})); })
    .then(() => {
      setStatus('¡Enviado correctamente! Redirigiendo…','success');
      submitToMailchimp($(FORM_ID));
      setTimeout(()=>{ window.location.assign(THANK_YOU_URL); }, 700);
    })
    .catch(err => {
      console.error('[submit] function ERROR:', err);
      alert('No fue posible enviar tu información. Intenta nuevamente.');
      setStatus('Ocurrió un error al enviar.','error');
      setBtnLoading(false);
    });
  }

  function onSubmit(ev){
    ev.preventDefault();
    setBtnLoading(true);
    setStatus('Enviando datos…','loading');
    ensureRecaptcha().then(()=>{
      if(!window.grecaptcha || !grecaptcha.ready){
        console.warn('[reCAPTCHA] no disponible; enviando sin token');
        handleSubmitForm('', ev);
        return;
      }
      grecaptcha.ready(()=>{
        grecaptcha.execute(SITE_KEY, { action:'submit' })
          .then(token => handleSubmitForm(token, ev))
          .catch(e => { console.error('[reCAPTCHA] error:', e); handleSubmitForm('', ev); });
      });
    });
  }

  // ====== Montaje + wire de tus funciones a los selects ======
  function mount(){
    const form=$(FORM_ID); if(!form) return;
    ensureStatusEl(); ensureMcIframe(); ensureBadgeSlot();
    form.setAttribute('novalidate','');
    form.addEventListener('submit', onSubmit);

    // Hooks de cambios según tus IDs
    $('mce-MMERGE19')?.addEventListener('change', tienesTienda);
    $('mce-TIPOTIENDA')?.addEventListener('change', tipoTiendaFuncion);
    $('mce-MMERGE22')?.addEventListener('change', conocimientoFuncion);
    $('mce-MMERGE23')?.addEventListener('change', abrirTiendaFuncion);
    $('mce-MMERGE24')?.addEventListener('change', inversionRama2Funcion);
    $('mce-BIKEINVERS')?.addEventListener('change', inversionRama1Funcion);

    // Recaptcha badge
    if(window.grecaptcha && grecaptcha.ready) grecaptcha.ready(placeV3Badge); else placeV3Badge();

    console.log('[Front] listo (ramas Sí/No, v3, Mailchimp bridge)');
  }
  (document.readyState==='loading') ? document.addEventListener('DOMContentLoaded', mount) : mount();
})();
