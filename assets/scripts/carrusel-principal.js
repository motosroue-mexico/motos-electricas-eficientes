// fetch-woocommerce-products.js
// Node 18+ (usa fetch nativo). Sin librerías externas.
'use strict';

const SITE = 'https://motosroue.com.mx';
const CK   = 'ck_2bd109861940e93ea1b2df85d9cf8afa2086760c';
const CS   = 'cs_12244fca6ac5d123f455f3bb5195ddeeec2b0cde';

const PER_PAGE = 100;

// ✅ ACF que queremos traer
const ACF_KEYS        = ['imagen-landing', 'nombre-landing'];
const MEDIA_ACF_KEYS  = ['imagen-landing']; // claves que representan imágenes (ID de media)

// --- Utilidades ---
const base = SITE.replace(/\/$/, '');
const authHeader = { Authorization: 'Basic ' + Buffer.from(`${CK}:${CS}`).toString('base64') };
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function fetchAllProducts({ status = 'publish', stock = null }) {
  let page = 1;
  const all = [];

  while (true) {
    const params = new URLSearchParams({
      status,
      per_page: String(PER_PAGE),
      page: String(page),
      context: 'edit',             // necesario para incluir meta_data
      // stock_status: stock || 'instock',
      // order: 'desc', orderby: 'modified',
    });

    const url = `${base}/wp-json/wc/v3/products?` + params.toString();
    const res = await fetch(url, { headers: authHeader });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} - ${text}`);
    }

    const batch = await res.json();
    all.push(...batch);

    const totalPages = Number(res.headers.get('x-wp-totalpages') || '1');
    if (page >= totalPages || batch.length === 0) break;
    page++;
  }
  return all;
}

// Extrae un ID de media desde formatos típicos de ACF (número, string, objeto, array, JSON serializado)
function getIdFromAcfValue(v) {
  if (v == null) return null;

  if (typeof v === 'number' && Number.isFinite(v)) return v;

  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d+$/.test(s)) return Number(s); // "6275"
    try {
      const parsed = JSON.parse(s);        // '{"id":6275}' o '[{...}]'
      return getIdFromAcfValue(parsed);
    } catch { /* no es JSON */ }
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

// Trae info de media (id -> source_url) en lotes
async function fetchMediaMap(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map();
  if (unique.length === 0) return map;

  for (const idsChunk of chunk(unique, 100)) {
    const params = new URLSearchParams({
      per_page: '100',
      include: idsChunk.join(','),
      _fields: 'id,source_url'
    });
    const url = `${base}/wp-json/wp/v2/media?` + params.toString();
    const res = await fetch(url, { headers: authHeader });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Media HTTP ${res.status} - ${text}`);
    }
    const items = await res.json();
    for (const m of items) map.set(Number(m.id), m);
  }
  return map;
}

// Construye el objeto ACF por producto
function extractAcfFromMeta(product, mediaMap) {
  const out = {};
  const meta = Array.isArray(product.meta_data) ? product.meta_data : [];

  for (const key of ACF_KEYS) {
    const entry = meta.find(m => m && m.key === key);
    const raw = entry?.value ?? null;

    if (MEDIA_ACF_KEYS.includes(key)) {
      // Campo de imagen: regresamos { raw, id, url }
      const id  = getIdFromAcfValue(raw);
      const url = id && mediaMap.has(id) ? (mediaMap.get(id).source_url || null) : null;
      out[key] = { raw, id, url };
    } else {
      // Campo plano (texto, número, etc.): regresamos el valor tal cual
      // Ej: "nombre-landing": "Nombre corto"
      out[key] = raw;
    }
  }
  return out;
}

(async () => {
  try {
    console.log('Descargando productos (incluyendo meta_data de ACF)…');
    const products = await fetchAllProducts({ status: 'publish' /*, stock: 'instock'*/ });

    // Recolecta IDs de media SOLO de claves de imagen para resolver URLs
    const allMetaIds = [];
    for (const p of products) {
      const meta = Array.isArray(p.meta_data) ? p.meta_data : [];
      for (const key of MEDIA_ACF_KEYS) {
        const e = meta.find(m => m && m.key === key);
        const id = getIdFromAcfValue(e?.value);
        if (id) allMetaIds.push(id);
      }
    }
    const mediaMap = await fetchMediaMap(allMetaIds);

    // Proyección final
    const result = products.map(p => ({
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
      acf: extractAcfFromMeta(p, mediaMap), // { 'imagen-landing': {raw,id,url}, 'nombre-landing': '...' }
    }));

    // Imprime JSON (redirige a archivo si quieres: node script > products-acf.json)
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();

