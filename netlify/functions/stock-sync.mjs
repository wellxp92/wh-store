const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mtgthmajyipmyufvnjag.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mfyL4T2qtgt3TQKo2P51yQ_g-s3SfIE';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(payload),
  };
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bconj\.?\b/g, 'conjunto')
    .replace(/\bcorr\.?\b/g, 'corrente')
    .replace(/\bpuls\.?\b/g, 'pulseira')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveInStock(item, rootAction) {
  if (typeof item.inStock === 'boolean') return item.inStock;
  if (typeof item.in_stock === 'boolean') return item.in_stock;
  if (typeof item.soldOut === 'boolean') return !item.soldOut;
  if (typeof item.sold_out === 'boolean') return !item.sold_out;
  if (typeof item.esgotado === 'boolean') return !item.esgotado;

  if (typeof item.status === 'string') {
    const st = normalizeText(item.status);
    if (['esgotado', 'out of stock', 'sold out', 'indisponivel', 'zerado', '0'].includes(st)) {
      return false;
    }
    if (['disponivel', 'in stock', 'available', 'ativo', 'ok'].includes(st)) {
      return true;
    }
  }

  const remaining =
    item.remainingStock ??
    item.remaining_stock ??
    item.stock ??
    item.available ??
    item.av ??
    item.estoque ??
    item.quantidade ??
    item.qty;

  if (remaining !== undefined && remaining !== null && remaining !== '') {
    const num = Number(remaining);
    if (!Number.isNaN(num)) {
      return num > 0;
    }
  }

  const bought = item.q ?? item.bought ?? item.comprado;
  const sold = item.sold ?? item.vendido;
  if (bought !== undefined && sold !== undefined) {
    const diff = Number(bought) - Number(sold);
    if (!Number.isNaN(diff)) {
      return diff > 0;
    }
  }

  const action = normalizeText(item.action || item.evento || rootAction || '');
  if (['sale', 'venda', 'sold', 'baixa'].includes(action)) {
    return false;
  }

  return null;
}

function findMatchingProduct(item, products) {
  const rawId = String(
    item.productId || item.product_id || item.catalogId || item.id || item.produtoId || ''
  ).trim();
  if (rawId) {
    const byId = products.find((p) => p.id === rawId);
    if (byId) return byId;
  }

  const rawName = String(
    item.productName || item.product_name || item.name || item.produto || item.p || item.title || ''
  ).trim();
  if (!rawName) return null;

  const targetNorm = normalizeText(rawName);
  if (!targetNorm) return null;

  const exact = products.find((p) => normalizeText(p.name) === targetNorm);
  if (exact) return exact;

  const partialMatches = products.filter((p) => {
    const pNorm = normalizeText(p.name);
    return pNorm.includes(targetNorm) || targetNorm.includes(pNorm);
  });

  if (partialMatches.length === 1) {
    return partialMatches[0];
  }

  return null;
}

async function fetchStorePin() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/store_settings?id=eq.main_settings&select=admin_pin&limit=1`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!res.ok) return '';
    const rows = await res.json();
    if (Array.isArray(rows) && rows[0]?.admin_pin) {
      return String(rows[0].admin_pin).trim();
    }
  } catch {
    // ignore
  }
  return '';
}

async function authorizeRequest(event, parsedBody) {
  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const authHeader = headers.authorization || '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const query = event.queryStringParameters || {};

  const providedToken = String(
    headers['x-api-key'] ||
      bearerToken ||
      query.token ||
      query.apiKey ||
      parsedBody?.token ||
      parsedBody?.apiKey ||
      parsedBody?.api_key ||
      parsedBody?.pin ||
      ''
  ).trim();

  if (!providedToken) return false;

  const envToken = (process.env.WH_STOCK_SYNC_TOKEN || '').trim();
  if (envToken && providedToken === envToken) {
    return true;
  }

  const storePin = await fetchStorePin();
  if (storePin && storePin !== '1234' && providedToken === storePin) {
    return true;
  }

  return false;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  let parsedBody = null;
  if (event.body) {
    try {
      parsedBody = JSON.parse(event.body);
    } catch {
      return jsonResponse(400, {
        success: false,
        error: 'Corpo da requisição inválido. Envie um JSON válido.',
      });
    }
  }

  const authorized = await authorizeRequest(event, parsedBody);
  if (!authorized) {
    return jsonResponse(401, {
      success: false,
      error: 'Acesso não autorizado. Informe a chave de integração válida no cabeçalho x-api-key.',
    });
  }

  try {
    // Load current catalog products from Supabase
    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,category_name,price,in_stock&order=name.asc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      return jsonResponse(502, {
        success: false,
        error: `Falha ao consultar produtos no banco de dados: ${errText}`,
      });
    }

    const products = await listRes.json();

    if (event.httpMethod === 'GET') {
      return jsonResponse(200, {
        success: true,
        total: products.length,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category_name,
          price: Number(p.price),
          inStock: p.in_stock !== false,
        })),
      });
    }

    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, {
        success: false,
        error: 'Método não suportado. Utilize GET ou POST.',
      });
    }

    const rootAction = parsedBody?.action || parsedBody?.evento || '';
    const items = Array.isArray(parsedBody)
      ? parsedBody
      : Array.isArray(parsedBody?.items)
      ? parsedBody.items
      : parsedBody
      ? [parsedBody]
      : [];

    if (items.length === 0) {
      return jsonResponse(400, {
        success: false,
        error: 'Nenhum item enviado para atualização de estoque.',
      });
    }

    const updated = [];
    const notFound = [];
    const ignored = [];

    for (const item of items) {
      const match = findMatchingProduct(item, products);
      if (!match) {
        notFound.push({
          productId: item.productId || item.id || null,
          productName: item.productName || item.name || item.produto || item.p || null,
        });
        continue;
      }

      const nextInStock = resolveInStock(item, rootAction);
      if (nextInStock === null) {
        ignored.push({
          id: match.id,
          name: match.name,
          reason: 'Não foi possível determinar se o item está esgotado ou disponível.',
        });
        continue;
      }

      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(match.id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            in_stock: nextInStock,
            updated_at: new Date().toISOString(),
          }),
        }
      );

      if (!patchRes.ok) {
        const errBody = await patchRes.text();
        ignored.push({
          id: match.id,
          name: match.name,
          reason: `Erro ao atualizar no banco: ${errBody}`,
        });
        continue;
      }

      updated.push({
        id: match.id,
        name: match.name,
        inStock: nextInStock,
        status: nextInStock ? 'Disponível' : 'Esgotado',
      });
    }

    return jsonResponse(200, {
      success: true,
      updatedCount: updated.length,
      notFoundCount: notFound.length,
      updated,
      notFound,
      ignored,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    return jsonResponse(500, {
      success: false,
      error: err?.message || 'Erro interno ao sincronizar estoque.',
    });
  }
};
