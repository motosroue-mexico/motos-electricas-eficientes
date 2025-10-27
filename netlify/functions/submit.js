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
        // Si quieres forzar score, descomenta:
        // if (typeof verify.score === 'number' && verify.score < 0.5) {
        //   return { statusCode: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        //            body: JSON.stringify({ ok:false, error:'Low reCAPTCHA score', score: verify.score }) };
        // }
      }
    }

    // Normaliza campos (preferencia: llaves en español)
    const payload = {
      name:    data.name  || data.FNAME  || '',
      email:   data.email || data.EMAIL  || '',
      phone:   data.phone || data.PHONE  || '',

      // Nuevas llaves en español con alias legacy
      direccion:        data.direccion        || data.address_line1     || data['ADDRESS[addr1]']  || '',
      ciudad:           data.ciudad           || data.city               || data['ADDRESS[city]']   || '',
      estado:           data.estado           || data.state              || data['ADDRESS[state]']  || '',
      zip:              data.zip              || data['ADDRESS[zip]']    || '',
      country:          data.country          || data['ADDRESS[country]']|| '',

      experiencia:      data.experiencia      || data.EXPERIENCI         || '',
      tienda:           data.tienda           || data.TIENDA             || '',
      tipoExperiencia:  data.tipoExperiencia  || data.tipo_experiencia   || data.TIPOEXPERI || '',
      inversion:        data.inversion        || data.INVERSION          || '',

      // Metadatos (si llegan)
      _meta:            data._meta || null,
      clientIp,
    };

    // Validación mínima con las llaves en español
    const required = [
      'name','email','phone',
      'direccion','ciudad','estado','zip',
      'experiencia','tienda','tipoExperiencia','inversion'
    ];
    const missing = required.filter(k => !String(payload[k]||'').trim());
    if (missing.length) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok:false, error:'Campos requeridos faltantes', missing }),
      };
    }

    // Datos a reenviar a Google Apps Script:
    // Incluimos tanto las llaves nuevas (español) como alias legacy por compatibilidad.
    const forwardData = {
      // Nuevas
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      direccion: payload.direccion,
      ciudad: payload.ciudad,
      estado: payload.estado,
      zip: payload.zip,
      country: payload.country,
      experiencia: payload.experiencia,
      tienda: payload.tienda,
      tipoExperiencia: payload.tipoExperiencia,
      inversion: payload.inversion,

      // Alias legacy que tu GAS podría estar esperando
      address_line1: payload.direccion,
      city: payload.ciudad,
      state: payload.estado,
      tipo_experiencia: payload.tipoExperiencia,

      // Extras útiles
      clientIp: payload.clientIp,
      _meta: payload._meta ? JSON.stringify(payload._meta) : ''
    };

    // Enviar a Google Apps Script (opcional)
    let forwarded='skipped', gas_status=0;
    if (APPS_SCRIPT_ENDPOINT) {
      try {
        const res = await fetch(APPS_SCRIPT_ENDPOINT, {
          method:'POST',
          headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
          body: new URLSearchParams(forwardData).toString()
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
