(() => {
  // ====== CONSTANTES ======
  const SITE_KEY  = '6LccHIsqAAAAAAb2LiEEl4pkrdk9S8EJ7l4FQrs4'; // v3 pública
  const FORM_ID   = 'mc-embedded-subscribe-form';
  const BTN_ID    = 'mc-embedded-subscribe';
  const STATUS_ID = 'form-status';
  const THANK_YOU_URL = 'https://motos-roue.netlify.app/gracias62332227';
  const MC_IFRAME_NAME = 'mc-submit-bridge';
  const BADGE_SLOT_ID  = 'recaptcha-badge-slot';

  const $  = id => document.getElementById(id);
  const val = id => ($(id)?.value || '').trim();

  // ====== ESTILOS / STATUS ======
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
      .lf-success{color:#22c55e}.lf-error{color:#ef4444}
      iframe[name="${MC_IFRAME_NAME}"]{display:none;width:0;height:0;border:0}
      #${BADGE_SLOT_ID}{margin-top:.5rem}
      #${BADGE_SLOT_ID} .grecaptcha-badge{position:static!important;right:auto!important;bottom:auto!important;box-shadow:none!important}
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
      const t=btn.dataset._txt || btn.value || btn.innerText || 'Enviar';
      if('value' in btn) btn.value=t; else btn.innerText=t;
      btn.disabled=false; btn.removeAttribute('aria-busy');
    }
  }

  // ====== VALIDACIÓN ======
  const rxEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const rxPhone=/^[0-9\s()+-]{7,20}$/;
  function mark(el, ok){
    if(!el) return;
    el.style.outline = ok ? '1px solid #22c55e' : '1px solid #ef4444';
  }
  function ok(id, predicate = v => !!v){
    const el=$(id); const v=val(id);
    const good = predicate(v); mark(el, good); return good;
  }

  // ====== Mailchimp bridge (evitar navegación) ======
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

  // ====== Captcha ======
  async function getToken(){
    if(!(window.grecaptcha && grecaptcha.ready)) return '';
    return new Promise(resolve=>{
      grecaptcha.ready(()=> {
        grecaptcha.execute(SITE_KEY, {action:'submit'})
          .then(resolve)
          .catch(()=> resolve(''));
      });
    });
  }

  // ====== Construcción y validación ======
  function buildPayload(token){
    return {
      name:   val('mce-FNAME'),
      email:  val('mce-EMAIL'),
      phone:  val('mce-PHONE'),

      direccion: val('mce-ADDRESS-addr1'),
      ciudad:    val('mce-ADDRESS-city'),
      estado:    val('mce-ADDRESS-state'),
      cp:        val('mce-ADDRESS-zip'),
      pais:      val('mce-ADDRESS-country'),

      experiencia:      val('mce-EXPERIENCI'),
      tienda:           val('mce-TIENDA'),
      tipo_experiencia: val('mce-TIPOEXPERI'),
      inversion:        val('mce-INVERSION'),

      recaptcha_token: token,
      _meta: { origen: location.href, agente: navigator.userAgent, marcaDeTiempo: new Date().toISOString() }
    };
  }

  function validate(){
    let good = true;
    good &= ok('mce-FNAME');
    good &= ok('mce-EMAIL', v=>rxEmail.test(v));
    good &= ok('mce-PHONE', v=>rxPhone.test(v));

    good &= ok('mce-ADDRESS-addr1');
    good &= ok('mce-ADDRESS-city');
    good &= ok('mce-ADDRESS-state');
    good &= ok('mce-ADDRESS-zip');
    good &= ok('mce-ADDRESS-country', v=>!!v);

    good &= ok('mce-EXPERIENCI', v=>!!v);
    good &= ok('mce-TIENDA');
    good &= ok('mce-TIPOEXPERI');
    good &= ok('mce-INVERSION', v=>!!v);

    return !!good;
  }

  async function doSubmit(ev){
    ev && ev.preventDefault();
    if(!validate()){
      alert('Por favor completa los campos requeridos.');
      setStatus('Hay errores en el formulario.','error');
      return;
    }

    setBtnLoading(true);
    setStatus('Enviando datos…','loading');

    const token   = await getToken();
    const payload = buildPayload(token);

    fetch('/api/submit-distribuidor', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    })
    .then(async r => {
      const txt = await r.text().catch(()=> '');
      if(!r.ok) throw new Error(txt || 'Function error');
      try { return JSON.parse(txt); } catch { return {}; }
    })
    .then(() => {
      setStatus('¡Enviado correctamente! Redirigiendo…','success');
      submitToMailchimp($(FORM_ID));              // paralelamente a Mailchimp
      setTimeout(()=>{ location.assign(THANK_YOU_URL); }, 700);
    })
    .catch(err => {
      console.error('[submit-distribuidor] ERROR:', err);
      alert('No fue posible enviar tu información. Intenta nuevamente.');
      setStatus('Ocurrió un error al enviar.','error');
    })
    .finally(()=> setBtnLoading(false));
  }

  // Montaje
  function mount(){
    const form=$(FORM_ID); if(!form) return;
    ensureStatusEl();
    form.setAttribute('novalidate','');
    form.addEventListener('submit', doSubmit);
  }
  (document.readyState==='loading') ? document.addEventListener('DOMContentLoaded', mount) : mount();
})();
