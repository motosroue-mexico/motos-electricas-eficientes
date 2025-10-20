// netlify/functions/submit.js
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

    const APPS_SCRIPT_ENDPOINT = process.env.APPS_SCRIPT_ENDPOINT; // URL /exec
    const RECAPTCHA_SECRET                  = process.env.RECAPTCHA_SECRET;                  // v3 secret

    // Parse body
    const rawCT = String(event.headers['content-type'] || '').toLowerCase();
    let data = {};
    if (rawCT.includes('application/json')) {
      try { data = JSON.parse(event.body || '{}'); } catch { data = {}; }
    } else {
      data = Object.fromEntries(new URLSearchParams(event.body || ''));
    }

    console.log('[submit] keys:', Object.keys(data));

    // IP cliente
    const clientIp =
      event.headers['x-nf-client-connection-ip'] ||
      event.headers['x-forwarded-for'] ||
      event.headers['client-ip'] ||
      '';

    // reCAPTCHA v3
    if (RECAPTCHA_SECRET && data.recaptcha_token) {
      const vr = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: RECAPTCHA_SECRET, response: data.recaptcha_token, remoteip: clientIp }),
      });
      const verify = await vr.json().catch(() => ({}));
      console.log('[submit] recaptcha:', { success: verify.success, score: verify.score, host: verify.hostname });

      if (!verify.success || (typeof verify.score === 'number' && verify.score < 0.5)) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok:false, error:'reCAPTCHA failed' }),
        };
      }
    } else {
      console.warn('[submit] reCAPTCHA not verified (missing SECRET or token).');
    }

    // Normalización: payload del front + merge tags
    const tienda      = data.tienda      || data.MMERGE19 || '';
    const name        = data.name        || data.FNAME    || '';
    const apellido    = data.apellido    || data.LNAME    || '';
    const email       = data.email       || data.EMAIL    || '';
    const phone       = data.phone       || data.PHONE    || '';
    const ciudad      = data.ciudad      || data.CIUDAD   || '';
    const estado      = data.estado      || data.ESTADO   || '';
    const proyecto    = data.proyecto    || data.MMERGE20 || '';
    const tipoTienda  = data.tipoTienda  || data.TIPOTIENDA || '';
    const inversion   = data.inversion   || data.BIKEINVERS || '';
    const conocimiento= data.conocimiento|| data.MMERGE22 || '';
    const abrirTienda = data.abrirTienda || data.MMERGE23 || '';
    const abrirInversion = data.abrirInversion || data.MMERGE24 || '';

    // Validación mínima (según tu regla base)
    const required = { tienda, name, apellido, email, phone, ciudad, estado, proyecto };
    const missing = Object.entries(required).filter(([,v]) => !String(v||'').trim()).map(([k]) => k);
    if (missing.length) {
      console.warn('[submit] missing:', missing);
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok:false, error:'Campos requeridos faltantes', missing }),
      };
    }

    // Mapeo hacia Apps Script (ajusta nombres si tu Code.gs espera otros)
    const mapped = {
      tienda,
      name,
      apellido,
      email,
      phone,
      ciudad,
      estado,
      proyecto,
      tipoTienda,
      inversion,
      conocimiento,
      abrirTienda,
      abrirInversion
    };
    console.log('[submit] mapped:', mapped);

    // Forward a Apps Script
    let forwarded='skipped', gasStatus=0;
    if (APPS_SCRIPT_ENDPOINT) {
      try {
        const res = await fetch(APPS_SCRIPT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(mapped).toString(),
        });
        forwarded='sent'; gasStatus=res.status;
        const text = await res.text().catch(()=> '');
        console.log('[submit] GAS response:', gasStatus, (text||'').slice(0,240));
      } catch (e) {
        forwarded='failed'; console.error('[submit] GAS forward error:', e);
      }
    } else {
      console.error('[submit] APPS_SCRIPT_ENDPOINT no configurado');
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:true, forwarded, gas_status: gasStatus }),
    };
  } catch (err) {
    console.error('[submit] error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok:false, error:'Server error' }),
    };
  }
};
