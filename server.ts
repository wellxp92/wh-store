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
