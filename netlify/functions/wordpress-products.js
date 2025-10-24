// netlify/functions/wordpress-products.js
// WooCommerce + ACF
// - Devuelve productos publicados
// - Normaliza ACF a llaves con guiones: "imagen-landing", "nombre-landing"
// - Si la imagen ACF viene como ID numérico, la resuelve a URL
// - Expone fallback en p.image = image0 para tus frontends
// REQUIERE env vars: WOO_SITE, WOO_CK, WOO_CS

const json = (status, data, origin = '*') => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=60, s-maxage=300',
  },
  body: JSON.stringify(data),
});

exports.handler = async (event) => {
  const ORIGIN = event?.headers?.origin || '*';

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': ORIGIN,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  try {
    const site = (process.env.WOO_SITE || '').replace(/\/$/, '');
    const ck = process.env.WOO_CK;
    const cs = process.env.WOO_CS;
    if (!site || !ck || !cs) {
      return json(500, { ok:false, error:'Faltan WOO_SITE, WOO_CK o WOO_CS' }, ORIGIN);
    }

    // 1) Productos publicados (campos mínimos que usas en front)
    const url = new URL(`${site}/wp-json/wc/v3/products`);
    url.searchParams.set('status', 'publish');
    url.searchParams.set('per_page', '50');
    url.searchParams.set('_fields', [
      'id','name','permalink','price','regular_price','sale_price','images','meta_data','status'
    ].join(','));
    url.searchParams.set('consumer_key', ck);
    url.searchParams.set('consumer_secret', cs);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const txt = await res.text().catch(()=>'');
      return json(res.status, { ok:false, error:'Woo error', detalle:txt }, ORIGIN);
    }
    const list = await res.json();

    // Helpers
    const isHttp = s => typeof s === 'string' && /^https?:\/\//i.test(s);

    async function resolveMediaIdToUrl(id) {
      try {
        const num = Number(id);
        if (!Number.isFinite(num)) return null;
        const r = await fetch(`${site}/wp-json/wp/v2/media/${num}`);
        if (!r.ok) return null;
        const m = await r.json();
        return m?.source_url || null;
      } catch { return null; }
    }

    async function getAcf(productId) {
      try {
        const r = await fetch(`${site}/wp-json/acf/v3/product/${productId}`);
        if (!r.ok) return null;
        const j = await r.json();
        return j?.acf || null;
      } catch { return null; }
    }

    // 2) Enriquecer con ACF normalizado y fallback de imagen
    const out = await Promise.all(list.map(async (p) => {
      const image0 = p?.images?.[0]?.src || '';
      let acf = await getAcf(p.id);

      // Normaliza distintos nombres que puedas tener en WP
      // imagen-landing / imagen_landing / imagenLanding
      const imgCandidates = [
        acf?.['imagen-landing'],
        acf?.['imagen_landing'],
        acf?.imagenLanding
      ];
      let acfImg = imgCandidates.find(v => !!v);

      // nombre-landing / nombre_landing / nombreLanding
      const nameCandidates = [
        acf?.['nombre-landing'],
        acf?.['nombre_landing'],
        acf?.nombreLanding
      ];
      const acfName = nameCandidates.find(v => !!v);

      // Resolver imagen ACF segun su forma
      let imgUrl = '';
      if (isHttp(acfImg)) {
        imgUrl = acfImg; // string URL
      } else if (acfImg && typeof acfImg === 'object' && isHttp(acfImg.url)) {
        imgUrl = acfImg.url; // objeto { url, sizes? }
      } else if (typeof acfImg === 'number' || (typeof acfImg === 'string' && /^\d+$/.test(acfImg))) {
        const resolved = await resolveMediaIdToUrl(acfImg);
        if (isHttp(resolved)) imgUrl = resolved;
      }

      // Arma el objeto ACF con las llaves que esperan tus frontends
      const acfOut = {};
      if (imgUrl) acfOut['imagen-landing'] = imgUrl;
      if (acfName) acfOut['nombre-landing'] = String(acfName);

      // Mantén cualquier otro campo existente
      if (acf && typeof acf === 'object') {
        // No sobrescribas nuestras llaves normalizadas
        delete acf['imagen-landing']; delete acf['imagen_landing']; delete acf.imagenLanding;
        delete acf['nombre-landing']; delete acf['nombre_landing']; delete acf.nombreLanding;
        Object.assign(acfOut, acfOut, acf); // las nuestras prevalecen
      }

      // Fallback que tus front ya usan: p.image
      const merged = {
        ...p,
        image: image0 || '',         // para /assets/scripts/* que usan p.image
        acf: (Object.keys(acfOut).length ? acfOut : undefined),
      };

      return merged;
    }));

    return json(200, out, ORIGIN);
  } catch (e) {
    return json(500, { ok:false, error: e?.message || 'Unknown error' });
  }
};
