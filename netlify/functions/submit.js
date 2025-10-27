/* eslint-disable no-console */
const crypto = require('crypto');

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

    // === Mailchimp embebido (SIN env vars) ===
    const MC_FORM_ACTION = 'https://rouebikes.us14.list-manage.com/subscribe/post?u=d61f6f82d65397ef994986f0c&id=69d60f1db1&f_id=004196e0f0';
    // Honeypot del form embebido:
    const MC_HONEYPOT    = 'b_d61f6f82d65397ef994986f0c_69d60f1db1';
    // Tag numérica del form embebido:
    const MC_TAGS_VALUE  = '12496916';

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

    // reCAPTCHA v3 (si configuraste secreto)
    if (RECAPTCHA_SECRET) {
      const tok = data.recaptcha_token || '';
      if (!tok) {
        console.warn('[submit] sin recaptcha_token (se intentará continuar)');
      } else {
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
      }
    }

    // Normaliza campos (preferencia español)
    const payload = {
      name:    data.name  || data.FNAME  || '',
      email:   data.email || data.EMAIL  || '',
      phone:   data.phone || data.PHONE  || '',
      direccion:        data.direccion        || data.address_line1     || data['ADDRESS[addr1]']  || '',
      ciudad:           data.ciudad           || data.city               || data['ADDRESS[city]']   || '',
      estado:           data.estado           || data.state              || data['ADDRESS[state]']  || '',
      zip:              data.zip              || data['ADDRESS[zip]']    || '',
      country:          data.country          || data['ADDRESS[country]']|| '',
      experiencia:      data.experiencia      || data.EXPERIENCI         || '',
      tienda:           data.tienda           || data.TIENDA             || '',
      tipoExperiencia:  data.tipoExperiencia  || data.tipo_experiencia   || data.TIPOEXPERI || '',
      inversion:        data.inversion        || data.INVERSION          || '',
      _meta:            data._meta || null,
      clientIp,
    };

    // Validación mínima
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

    // ---- 1) Forward a Google Apps Script (opcional) ----
    let forwarded='skipped', gas_status=0;
    if (APPS_SCRIPT_ENDPOINT) {
      const forwardData = {
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
        address_line1: payload.direccion, // alias legacy
        city: payload.ciudad,
        state: payload.estado,
        tipo_experiencia: payload.tipoExperiencia,
        clientIp: payload.clientIp,
        _meta: payload._meta ? JSON.stringify(payload._meta) : ''
      };
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

    // ---- 2) Forward DIRECTO al formulario embebido de Mailchimp ----
    // Enviamos exactamente los nombres que espera el embed:
    const mcBody = new URLSearchParams({
      EMAIL: payload.email,
      FNAME: payload.name,
      PHONE: payload.phone,
      'ADDRESS[addr1]': payload.direccion,
      'ADDRESS[city]' : payload.ciudad,
      'ADDRESS[state]': payload.estado,
      'ADDRESS[zip]'  : payload.zip,
      'ADDRESS[country]': payload.country,
      EXPERIENCI: payload.experiencia,
      TIENDA: payload.tienda,
      TIPOEXPERI: payload.tipoExperiencia,
      INVERSION: payload.inversion,
      tags: MC_TAGS_VALUE,
      [MC_HONEYPOT]: '' // honeypot vacío
    }).toString();

    let mc_status=0, mc_ok=false;
    try {
      const res = await fetch(MC_FORM_ACTION, {
        method:'POST',
        headers: {
          'Content-Type':'application/x-www-form-urlencoded',
          // Algunos endpoints responden distinto con/ sin Referer:
          'Referer': 'https://rouebikes.us14.list-manage.com/',
          'User-Agent': 'NetlifyFunction/1.0'
        },
        body: mcBody
      });
      mc_status = res.status;
      const html = await res.text().catch(()=> '');
      // Heurística básica: si Mailchimp devuelve página con "success" o sin error obvio
      mc_ok = mc_status >= 200 && mc_status < 400;
      console.log('[MC FORM]', mc_status, html.slice(0,200));
    } catch (e) {
      console.error('[MC FORM error]', e);
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type':'application/json' },
      body: JSON.stringify({ ok:true, forwarded, gas_status, mc_form: { ok: mc_ok, status: mc_status } }),
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
