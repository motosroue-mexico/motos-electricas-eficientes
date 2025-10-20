/* eslint-disable no-console */
exports.handler = async (event) => {
  // CORS / preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      },
      body: '',
    };
  }

  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Method Not Allowed' };
    }

    const APPS_SCRIPT_ENDPOINT = process.env.APPS_SCRIPT_ENDPOINT; // tu Google Apps Script /exec
    const RECAPTCHA_SECRET     = process.env.RECAPTCHA_SECRET;     // tu secreto v3

    // Parse body
    const ct = String(event.headers['content-type'] || '').toLowerCase();
    let data = {};
    if (ct.includes('application/json')) {
      try { data = JSON.parse(event.body || '{}'); } catch { data = {}; }
    } else {
      data = Object.fromEntries(new URLSearchParams(event.body || ''));
    }

    // IP (opcional)
    const clientIp =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['x-forwarded-for'] ||
      event.headers['client-ip'] || '';

    // reCAPTCHA v3
    if (RECAPTCHA_SECRET) {
      const tok = data.recaptcha_token || '';
      if (!tok) console.warn('[submit] sin recaptcha_token (se intentará continuar)');
      else {
        const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method:'POST',
          headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: tok, remoteip: clientIp })
        });
        const verify = await resp.json().catch(()=> ({}));
        console.log('[recaptcha verify]', verify);
        if (!verify.success) {
          return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
            body: JSON.stringify({ ok:false, error:'reCAPTCHA failed', verify }),
          };
        }
        // Si quieres forzar score, usa esto luego de probar:
        // if (typeof verify.score === 'number' && verify.score < 0.5) { ... }
      }
    }

    // Normaliza campos
    const payload = {
      name:            data.name            || data.FNAME           || '',
      email:           data.email           || data.EMAIL           || '',
      phone:           data.phone           || data.PHONE           || '',
      address_line1:   data.address_line1   || data['ADDRESS[addr1]'] || '',
      city:            data.city            || data['ADDRESS[city]']  || '',
      state:           data.state           || data['ADDRESS[state]'] || '',
      zip:             data.zip             || data['ADDRESS[zip]']   || '',
      country:         data.country         || data['ADDRESS[country]'] || '',
      experiencia:     data.experiencia     || data.EXPERIENCI      || '',
      tienda:          data.tienda          || data.TIENDA          || '',
      tipo_experiencia:data.tipo_experiencia|| data.TIPOEXPERI      || '',
      inversion:       data.inversion       || data.INVERSION       || ''
    };

    // Validación mínima
    const required = ['name','email','phone','address_line1','city','state','zip','experiencia','tienda','tipo_experiencia','inversion'];
    const missing = required.filter(k => !String(payload[k]||'').trim());
    if (missing.length) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok:false, error:'Campos requeridos faltantes', missing }),
      };
    }

    // Enviar a Google Apps Script (opcional)
    let forwarded='skipped', gas_status=0;
    if (APPS_SCRIPT_ENDPOINT) {
      try {
        const res = await fetch(APPS_SCRIPT_ENDPOINT, {
          method:'POST',
          headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
          body: new URLSearchParams(payload).toString()
        });
        forwarded='sent'; gas_status = res.status;
        const txt = await res.text().catch(()=> '');
        console.log('[GAS]', gas_status, txt.slice(0,240));
      } catch (e) {
        forwarded='failed'; console.error('[GAS error]', e);
      }
    } else {
      console.warn('[submit] APPS_SCRIPT_ENDPOINT no configurado (se responde OK igualmente)');
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type':'application/json' },
      body: JSON.stringify({ ok:true, forwarded, gas_status }),
    };
  } catch (err) {
    console.error('[submit] error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type':'application/json' },
      body: JSON.stringify({ ok:false, error:'Server error' }),
    };
  }
};
