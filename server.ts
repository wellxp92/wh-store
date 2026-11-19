import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Enforce Port 3000 as required by the AI Studio environment
const PORT = Number(process.env.DEFAULT_APP_PORT) || 3000;

app.use(express.json());

const CONFIG_PATH = path.resolve(__dirname, 'supabase-config.json');

// Helper to read stored config
function getSupabaseConfig(): { url: string; anonKey: string } {
  let fileConfig = { url: '', anonKey: '' };
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      fileConfig = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[Server] Falha ao ler supabase-config.json:', e);
  }

  const url = (process.env.VITE_SUPABASE_URL || fileConfig.url || '').trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || fileConfig.anonKey || '').trim();

  return { url, anonKey };
}

// Endpoint to retrieve Supabase credentials for all devices
app.get('/api/config/supabase', (_req, res) => {
  const config = getSupabaseConfig();
  const configured = Boolean(
    config.url &&
    config.anonKey &&
    config.url.startsWith('https://') &&
    !config.url.includes('your-project-id') &&
    config.anonKey.length > 20
  );

  res.json({
    configured,
    url: config.url || '',
    anonKey: config.anonKey || '',
  });
});

// Endpoint to save Supabase credentials globally across all devices
app.post('/api/config/supabase', (req, res) => {
  const { url, anonKey } = req.body || {};

  if (!url || !anonKey) {
    return res.status(400).json({ error: 'URL e Chave Anon são obrigatórios.' });
  }

  const cleanUrl = String(url).trim();
  const cleanKey = String(anonKey).trim();

  if (!cleanUrl.startsWith('https://')) {
    return res.status(400).json({ error: 'A URL do Supabase deve começar com https://' });
  }

  try {
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify({ url: cleanUrl, anonKey: cleanKey, updated_at: new Date().toISOString() }, null, 2),
      'utf-8'
    );

    // Update in-memory process env for runtime
    process.env.VITE_SUPABASE_URL = cleanUrl;
    process.env.VITE_SUPABASE_ANON_KEY = cleanKey;

    console.log('[Server] Configurações do Supabase persistidas com sucesso em supabase-config.json');
    return res.json({
      success: true,
      message: 'Configurações do Supabase salvas globalmente para todos os dispositivos!',
      url: cleanUrl,
    });
  } catch (err: any) {
    console.error('[Server] Erro ao gravar supabase-config.json:', err);
    return res.status(500).json({ error: 'Erro ao salvar no servidor: ' + err.message });
  }
});

const SECURITY_CONFIG_PATH = path.resolve(__dirname, 'store-security.json');
const PUBLIC_SECURITY_CONFIG_PATH = path.resolve(__dirname, 'public', 'store-security.json');

function getSecurityConfig(): { adminPin: string; isConfigured: boolean; updatedAt?: string } {
  try {
    if (fs.existsSync(SECURITY_CONFIG_PATH)) {
      const raw = fs.readFileSync(SECURITY_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.adminPin === 'string') {
        return {
          adminPin: parsed.adminPin.trim(),
          isConfigured: Boolean(parsed.adminPin.trim()),
          updatedAt: parsed.updatedAt,
        };
      }
    }
  } catch (e) {
    console.warn('[Server] Falha ao ler store-security.json:', e);
  }
  return { adminPin: '', isConfigured: false };
}

// Endpoint to retrieve admin PIN config across all devices
app.get('/api/config/security', (_req, res) => {
  const config = getSecurityConfig();
  res.json(config);
});

// Endpoint to save admin PIN globally and auto-sync to GitHub & Netlify
app.post('/api/config/security', (req, res) => {
  const { pin } = req.body || {};
  if (!pin || typeof pin !== 'string' || pin.trim().length < 4) {
    return res.status(400).json({ error: 'A senha do lojista deve ter no mínimo 4 caracteres.' });
  }

  const cleanPin = pin.trim();
  const payload = {
    adminPin: cleanPin,
    isConfigured: true,
    updatedAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(SECURITY_CONFIG_PATH, JSON.stringify(payload, null, 2), 'utf-8');

    const publicDir = path.resolve(__dirname, 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.writeFileSync(PUBLIC_SECURITY_CONFIG_PATH, JSON.stringify(payload, null, 2), 'utf-8');

    // Executa commit e push para o GitHub em segundo plano para o Netlify atualizar automaticamente
    import('child_process').then(({ exec }) => {
      exec(
        'git add store-security.json public/store-security.json && git commit -m "chore: atualizar senha do lojista e sincronizar no Netlify" && git push origin main',
        (err, _stdout, stderr) => {
          if (err) {
            console.warn('[Git Auto-sync] Aviso ao sincronizar com GitHub:', stderr || err.message);
          } else {
            console.log('[Git Auto-sync] Nova senha enviada ao GitHub! Netlify atualizará em instantes.');
          }
        }
      );
    });

    console.log('[Server] Nova senha administrativa do lojista salva globalmente.');
    return res.json({
      success: true,
      message: 'Nova senha gravada globalmente! Sincronização com GitHub e Netlify iniciada.',
      adminPin: cleanPin,
    });
  } catch (err: any) {
    console.error('[Server] Erro ao salvar store-security.json:', err);
    return res.status(500).json({ error: 'Erro ao gravar arquivo de segurança: ' + err.message });
  }
});

// ============================================================================
// Webhook / API Universal de Sincronização de Estoque (/api/stock-sync)
// ============================================================================
const FALLBACK_SUPABASE_URL = 'https://mtgthmajyipmyufvnjag.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_mfyL4T2qtgt3TQKo2P51yQ_g-s3SfIE';

function getResolvedSupabaseConfig(): { url: string; anonKey: string } {
  const cfg = getSupabaseConfig();
  return {
    url: cfg.url || FALLBACK_SUPABASE_URL,
    anonKey: cfg.anonKey || FALLBACK_SUPABASE_ANON_KEY,
  };
}

function normalizeSyncText(value: unknown): string {
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

function tokenSyncSignature(value: unknown): string {
  const words = normalizeSyncText(value)
    .split(/\s+/)
    .filter((w) => w.length > 0 && !['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com'].includes(w));
  return Array.from(new Set(words)).sort().join(' ');
}

function resolveSyncInStock(item: Record<string, any>, rootAction?: string): boolean | null {
  if (typeof item.inStock === 'boolean') return item.inStock;
  if (typeof item.in_stock === 'boolean') return item.in_stock;
  if (typeof item.inStock === 'string') {
    if (item.inStock.toLowerCase() === 'true') return true;
    if (item.inStock.toLowerCase() === 'false') return false;
  }
  if (typeof item.soldOut === 'boolean') return !item.soldOut;
  if (typeof item.sold_out === 'boolean') return !item.sold_out;
  if (typeof item.esgotado === 'boolean') return !item.esgotado;

  if (typeof item.status === 'string') {
    const st = normalizeSyncText(item.status);
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

  const action = normalizeSyncText(item.action || item.evento || rootAction || '');
  if (['sale', 'venda', 'sold', 'baixa'].includes(action)) {
    return false;
  }

  return null;
}

function findMatchingSyncProduct(item: Record<string, any>, products: any[]): any | null {
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

  const targetNorm = normalizeSyncText(rawName);
  if (!targetNorm) return null;

  const exact = products.find((p) => normalizeSyncText(p.name) === targetNorm);
  if (exact) return exact;

  const targetSig = tokenSyncSignature(rawName);
  if (targetSig) {
    const sigMatches = products.filter((p) => tokenSyncSignature(p.name) === targetSig);
    if (sigMatches.length === 1) {
      return sigMatches[0];
    }
  }

  const partialMatches = products.filter((p) => {
    const pNorm = normalizeSyncText(p.name);
    return pNorm.includes(targetNorm) || targetNorm.includes(pNorm);
  });

  if (partialMatches.length === 1) {
    return partialMatches[0];
  }

  return null;
}

async function fetchStorePinFromSupabase(url: string, anonKey: string): Promise<string> {
  try {
    const res = await fetch(
      `${url}/rest/v1/store_settings?id=eq.main_settings&select=admin_pin&limit=1`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
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

async function bulkPatchSyncProductsInStock(
  url: string,
  anonKey: string,
  ids: string[],
  inStockValue: boolean
): Promise<{ ok: boolean; error?: string }> {
  if (!ids || ids.length === 0) return { ok: true };
  const chunkSize = 75;
  const nowIso = new Date().toISOString();

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const inList = chunk.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',');
    const patchRes = await fetch(
      `${url}/rest/v1/products?id=in.(${encodeURIComponent(inList)})`,
      {
        method: 'PATCH',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          in_stock: inStockValue,
          updated_at: nowIso,
        }),
      }
    );

    if (!patchRes.ok) {
      const errBody = await patchRes.text();
      return { ok: false, error: errBody };
    }
  }

  return { ok: true };
}

async function authorizeStockSyncRequest(req: express.Request): Promise<boolean> {
  const authHeader = String(req.headers.authorization || '');
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const query = req.query || {};
  const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as Record<string, any>;

  const providedToken = String(
    req.headers['x-api-key'] ||
      bearerToken ||
      query.token ||
      query.apiKey ||
      body.token ||
      body.apiKey ||
      body.api_key ||
      body.pin ||
      ''
  ).trim();

  if (!providedToken) return false;

  const envToken = (process.env.WH_STOCK_SYNC_TOKEN || '').trim();
  if (envToken && providedToken === envToken) {
    return true;
  }

  const localSec = getSecurityConfig();
  if (localSec.adminPin && localSec.adminPin !== '1234' && providedToken === localSec.adminPin) {
    return true;
  }

  const { url, anonKey } = getResolvedSupabaseConfig();
  const storePin = await fetchStorePinFromSupabase(url, anonKey);
  if (storePin && storePin !== '1234' && providedToken === storePin) {
    return true;
  }

  return false;
}

function setStockSyncCorsHeaders(res: express.Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-api-key, Accept, X-Requested-With, Cache-Control'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

app.options('/api/stock-sync', (_req, res) => {
  setStockSyncCorsHeaders(res);
  res.status(204).send('');
});

app.get('/api/stock-sync', async (req, res) => {
  setStockSyncCorsHeaders(res);
  const authorized = await authorizeStockSyncRequest(req);
  if (!authorized) {
    return res.status(401).json({
      success: false,
      error: 'Acesso não autorizado. Informe a chave de integração válida no cabeçalho x-api-key.',
    });
  }

  try {
    const { url, anonKey } = getResolvedSupabaseConfig();
    const listRes = await fetch(
      `${url}/rest/v1/products?select=id,name,category_name,price,in_stock,updated_at&order=name.asc`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      return res.status(502).json({
        success: false,
        error: `Falha ao consultar produtos no banco de dados: ${errText}`,
      });
    }

    const products = await listRes.json();
    return res.status(200).json({
      success: true,
      total: products.length,
      products: products.map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category_name,
        price: Number(p.price),
        inStock: p.in_stock !== false,
        updatedAt: p.updated_at || null,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Erro interno ao consultar catálogo.',
    });
  }
});

app.post('/api/stock-sync', async (req, res) => {
  setStockSyncCorsHeaders(res);
  const authorized = await authorizeStockSyncRequest(req);
  if (!authorized) {
    return res.status(401).json({
      success: false,
      error: 'Acesso não autorizado. Informe a chave de integração válida no cabeçalho x-api-key.',
    });
  }

  try {
    const { url, anonKey } = getResolvedSupabaseConfig();
    const listRes = await fetch(
      `${url}/rest/v1/products?select=id,name,category_name,price,in_stock,updated_at&order=name.asc`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      return res.status(502).json({
        success: false,
        error: `Falha ao consultar produtos no banco de dados: ${errText}`,
      });
    }

    const products = await listRes.json();
    const parsedBody = req.body;
    const rootAction =
      parsedBody && !Array.isArray(parsedBody) ? parsedBody.action || parsedBody.evento || '' : '';
    const items = Array.isArray(parsedBody)
      ? parsedBody
      : Array.isArray(parsedBody?.items)
      ? parsedBody.items
      : parsedBody && typeof parsedBody === 'object'
      ? [parsedBody]
      : [];

    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum item enviado para atualização de estoque.',
      });
    }

    const updated: any[] = [];
    const notFound: any[] = [];
    const ignored: any[] = [];
    const idsToMarkTrue: string[] = [];
    const idsToMarkFalse: string[] = [];
    const seenIds = new Map<string, { match: any; nextInStock: boolean }>();

    for (const item of items) {
      const match = findMatchingSyncProduct(item, products);
      if (!match) {
        notFound.push({
          productId: item.productId || item.id || null,
          productName: item.productName || item.name || item.produto || item.p || null,
        });
        continue;
      }

      const nextInStock = resolveSyncInStock(item, rootAction);
      if (nextInStock === null) {
        ignored.push({
          id: match.id,
          name: match.name,
          reason: 'Não foi possível determinar se o item está esgotado ou disponível.',
        });
        continue;
      }

      seenIds.set(match.id, { match, nextInStock });
    }

    for (const { match, nextInStock } of seenIds.values()) {
      const currentInStock = match.in_stock !== false;
      const changed = currentInStock !== nextInStock;
      if (changed) {
        if (nextInStock) {
          idsToMarkTrue.push(match.id);
        } else {
          idsToMarkFalse.push(match.id);
        }
      }
      updated.push({
        id: match.id,
        name: match.name,
        inStock: nextInStock,
        status: nextInStock ? 'Disponível' : 'Esgotado',
        changed,
      });
    }

    const [trueRes, falseRes] = await Promise.all([
      bulkPatchSyncProductsInStock(url, anonKey, idsToMarkTrue, true),
      bulkPatchSyncProductsInStock(url, anonKey, idsToMarkFalse, false),
    ]);

    if (!trueRes.ok || !falseRes.ok) {
      return res.status(502).json({
        success: false,
        error: `Erro ao atualizar produtos no banco: ${trueRes.error || falseRes.error}`,
      });
    }

    return res.status(200).json({
      success: true,
      updatedCount: updated.length,
      changedCount: idsToMarkTrue.length + idsToMarkFalse.length,
      notFoundCount: notFound.length,
      updated,
      notFound,
      ignored,
      syncedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Erro interno ao sincronizar estoque.',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[WH Store] Servidor ativo em http://0.0.0.0:${PORT}`);
  });
}

startServer();
