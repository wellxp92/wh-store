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
const PORT = Number(process.env.PORT) || 3000;

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
