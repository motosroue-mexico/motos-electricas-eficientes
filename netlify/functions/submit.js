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

    const APPS_SCRIPT_ENDPOINT = process.env.APPS_SCRIPT_ENDPOINT; // tu GAS /exec
    const RECAPTCHA_SECRET     = process.env.RECAPTCHA_SECRET;     // secret v3

    // Parse body
    const ct = String(event.headers['content-type'] || '').toLowerCase();
    let data = {};
    if (ct.includes('application/json')) {
      try { data = JSON.parse(event.body || '{}'); } catch { data = {}; }
    } else {
      data = Object.fromEntries(new URLSearchParams(event.body || ''));
    }

    // IP cliente
    const clientIp =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['x-forwarded-for'] ||
      event.headers['client-ip'] || '';

    // Verificar reCAPTCHA (si hay)
    if (RECAPTCHA_SECRET && data.recaptcha_token) {
      const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: RECAPTCHA_SECRET,
          response: data.recaptcha_token,
          remoteip: clientIp
        }),
      });
      const verify = await resp.json().catch(() => ({}));
      console.log('[submit-distribuidor] recaptcha:', { ok: verify.success, score: verify.score, host: verify.hostname });
      if (!verify.success || (typeof verify.score === 'number' && verify.score < 0.5)) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok:false, error:'reCAPTCHA failed' }),
        };
      }
    } else {
      console.warn('[submit-distribuidor] reCAPTCHA not verified (missing SECRET or token).');
    }

    // Normalización desde front o desde Mailchimp
    const name   = data.name   || data.FNAME || '';
    const email  = data.email  || data.EMAIL || '';
    const phone  = data.phone  || data.PHONE || '';

    const direccion = data.direccion || data['ADDRESS[addr1]'] || data.ADDRESS?.addr1 || '';
    const ciudad    = data.ciudad    || data['ADDRESS[city]']  || data.ADDRESS?.city  || '';
    const estado    = data.estado    || data['ADDRESS[state]'] || data.ADDRESS?.state || '';
    const cp        = data.cp        || data['ADDRESS[zip]']   || data.ADDRESS?.zip   || '';
    const pais      = data.pais      || data['ADDRESS[country]'] || data.ADDRESS?.country || '';

    const experiencia      = data.experiencia      || data.EXPERIENCI   || '';
    const tienda           = data.tienda           || data.TIENDA       || '';
    const tipo_experiencia = data.tipo_experiencia || data.TIPOEXPERI   || '';
    const inversion        = data.inversion        || data.INVERSION    || '';

    // Validación mínima (los * del HTML)
    const required = {
      name, email, phone,
      direccion, ciudad, estado, cp, pais,
      experiencia, tienda, tipo_experiencia, inversion
    };
    const missing = Object.entries(required)
      .filter(([,v]) => !String(v||'').trim())
      .map(([k]) => k);
    if (missing.length) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok:false, error:'Campos requeridos faltantes', missing }),
      };
    }

    // Mapeo a Apps Script
    const mapped = {
      name, email, phone,
      direccion, ciudad, estado, cp, pais,
      experiencia, tienda, tipo_experiencia, inversion
    };
    console.log('[submit-distribuidor] mapped:', mapped);

    // Forward a GAS
    let forwarded='skipped', gasStatus=0;
    if (APPS_SCRIPT_ENDPOINT) {
      try {
        const res = await fetch(APPS_SCRIPT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(mapped).toString(),
        });
        forwarded='sent'; gasStatus = res.status;
        const text = await res.text().catch(()=> '');
        console.log('[submit-distribuidor] GAS response:', gasStatus, (text||'').slice(0,240));
      } catch (e) {
        forwarded='failed';
        console.error('[submit-distribuidor] GAS forward error:', e);
      }
    } else {
      console.error('[submit-distribuidor] APPS_SCRIPT_ENDPOINT no configurado');
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:true, forwarded, gas_status: gasStatus }),
    };
  } catch (err) {
    console.error('[submit-distribuidor] error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:false, error:'Server error' }),
    };
  }
};
