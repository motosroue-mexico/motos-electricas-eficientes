// netlify/functions/woo-products.js
'use strict';

// ❗ Sin valores por defecto
const SITE = process.env.WOO_SITE;
const CK   = process.env.WOO_CK;
const CS   = process.env.WOO_CS;

const PER_PAGE_DEFAULT = 100;
const ACF_KEYS = ['imagen-landing', 'nombre-landing'];
const MEDIA_ACF_KEYS = new Set(['imagen-landing']);

if (!SITE || !CK || !CS) {
  // Validación estricta al cargar el módulo
  console.error('Faltan variables de entorno: WOO_SITE, WOO_CK, WOO_CS');
}

const base = SITE ? SITE.replace(/\/$/, '') : '';
const authHeader = { Authorization: 'Basic ' + Buffer.from(`${CK}:${CS}`).toString('base64') };

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function getIdFromAcfValue(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d+$/.test(s)) return Number(s);
    try { return getIdFromAcfValue(JSON.parse(s)); } catch {}
  }
  if (Array.isArray(v) && v.length) return getIdFromAcfValue(v[0]);
  if (typeof v === 'object') {
    if (typeof v.id === 'number') return v.id;
    if (typeof v.ID === 'number') return v.ID;
    if (typeof v.id === 'string' && /^\d+$/.test(v.id)) return Number(v.id);
    if (typeof v.ID === 'string' && /^\d+$/.test(v.ID)) return Number(v.ID);
  }
  return null;
}

async function fetchProductsPage({ status='publish', page=1, perPage=PER_PAGE_DEFAULT, stockStatus }) {
  const params = new URLSearchParams({ status, page: String(page), per_page: String(perPage), context: 'edit' });
  if (stockStatus) params.set('stock_status', stockStatus);

  const url = `${base}/wp-json/wc/v3/products?` + params.toString();
  const res = await fetch(url, { headers: authHeader });
  if (!res.ok) throw new Error(`WC ${res.status} - ${await res.text().catch(()=> '')}`);

  const data = await res.json();
  const totalPages = Number(res.headers.get('x-wp-totalpages') || '1');
  return { data, totalPages };
}

async function fetchAllProducts(opts) {
  let page = 1;
  const perPage = opts.perPage || PER_PAGE_DEFAULT;
  const all = [];

  const first = await fetchProductsPage({ ...opts, page, perPage });
  all.push(...first.data);
  const totalPages = first.totalPages;

  while (++page <= totalPages) {
    const { data } = await fetchProductsPage({ ...opts, page, perPage });
    all.push(...data);
  }
  return all;
}

async function fetchMediaMap(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map();
  if (unique.length === 0) return map;

  for (const idsChunk of chunk(unique, 100)) {
    const params = new URLSearchParams({ per_page: '100', include: idsChunk.join(','), _fields: 'id,source_url' });
    const url = `${base}/wp-json/wp/v2/media?` + params.toString();
    const res = await fetch(url, { headers: authHeader });
    if (!res.ok) throw new Error(`Media ${res.status} - ${await res.text().catch(()=> '')}`);
    const items = await res.json();
    for (const m of items) map.set(Number(m.id), m);
  }
  return map;
}

function shapeProduct(p, mediaMap) {
  const meta = Array.isArray(p.meta_data) ? p.meta_data : [];
  const acf = {};

  for (const key of ACF_KEYS) {
    const entry = meta.find(m => m && m.key === key);
    const raw = entry?.value ?? null;

    if (MEDIA_ACF_KEYS.has(key)) {
      const id  = getIdFromAcfValue(raw);
      const url = id && mediaMap.has(id) ? (mediaMap.get(id).source_url || null) : null;
      acf[key] = { raw, id, url };
    } else {
      acf[key] = raw;
    }
  }

  return {
    id: p.id,
    name: p.name,
    status: p.status,
    type: p.type,
    sku: p.sku,
    price: p.price,
    regular_price: p.regular_price,
    sale_price: p.sale_price,
    stock_status: p.stock_status,
    permalink: p.permalink,
    image: p.images?.[0]?.src || null,
    acf
  };
}

exports.handler = async (event) => {
  // CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  // Chequeo estricto de envs ANTES de ir a WooCommerce
  if (!SITE || !CK || !CS) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Faltan variables de entorno: WOO_SITE, WOO_CK, WOO_CS' })
    };
  }

  try {
    const q = event.queryStringParameters || {};
    const status  = q.status || 'publish';
    const stock   = q.stock_status || '';
    const perPage = Math.min(Number(q.per_page || PER_PAGE_DEFAULT), 100);
    const page    = Number(q.page || 1);
    const all     = q.all === '1' || q.all === 'true';

    const products = all
      ? await fetchAllProducts({ status, stockStatus: stock, perPage })
      : (await fetchProductsPage({ status, stockStatus: stock, perPage, page })).data;

    // Resolver URLs de ACF imagen-landing en lote
    const ids = [];
    for (const p of products) {
      const meta = Array.isArray(p.meta_data) ? p.meta_data : [];
      const e = meta.find(m => m && m.key === 'imagen-landing');
      const id = getIdFromAcfValue(e?.value);
      if (id) ids.push(id);
    }
    const mediaMap = await fetchMediaMap(ids);

    const shaped = products.map(p => shapeProduct(p, mediaMap));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(shaped)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
