import { Product } from '../types';
import { getSupabaseUrl, getSupabaseAnonKey } from './supabase';

export const PRODUCTION_STOCK_SYNC_URL = 'https://whstore.netlify.app/api/stock-sync';

export function getStockSyncEndpointUrl(): string {
  if (typeof window === 'undefined') return PRODUCTION_STOCK_SYNC_URL;
  const host = window.location.hostname || '';
  if (host.includes('whstore.netlify.app')) {
    return `${window.location.origin}/api/stock-sync`;
  }
  return PRODUCTION_STOCK_SYNC_URL;
}

export function getLocalPreviewStockSyncUrl(): string {
  if (typeof window === 'undefined') return PRODUCTION_STOCK_SYNC_URL;
  return `${window.location.origin}/api/stock-sync`;
}

export interface StockSyncTestParams {
  apiKey: string;
  productId: string;
  productName: string;
  inStock: boolean;
}

export interface StockSyncTestResponse {
  ok: boolean;
  message: string;
  details?: string;
  updatedStatus?: 'Disponível' | 'Esgotado';
}

export async function testExternalStockSync({
  apiKey,
  productId,
  productName,
  inStock,
}: StockSyncTestParams): Promise<StockSyncTestResponse> {
  const localEndpoint = getLocalPreviewStockSyncUrl();
  const payload = {
    action: inStock ? 'restock' : 'sale',
    productId,
    productName,
    inStock,
    remainingStock: inStock ? 1 : 0,
  };

  if (!apiKey) {
    return {
      ok: false,
      message: 'Nenhuma chave de integração ativa encontrada. Verifique sua senha na aba Segurança.',
    };
  }

  try {
    const res = await fetch(localEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        message: 'O endpoint /api/stock-sync respondeu em formato inesperado. Publique no Netlify para ativar a função serverless.',
      };
    }

    const data = await res.json();
    if (!res.ok || !data?.success) {
      return {
        ok: false,
        message: data?.error || `Falha na sincronização (HTTP ${res.status}).`,
        details: JSON.stringify(data, null, 2),
      };
    }

    if (data.updatedCount > 0) {
      return {
        ok: true,
        message: `Webhook respondeu com sucesso! "${productName}" foi marcado como ${inStock ? 'DISPONÍVEL' : 'ESGOTADO'} no catálogo.`,
        updatedStatus: inStock ? 'Disponível' : 'Esgotado',
        details: JSON.stringify(data, null, 2),
      };
    }

    return {
      ok: false,
      message:
        data.notFoundCount > 0
          ? `O produto "${productName}" ainda não foi localizado na tabela products do Supabase. Verifique se já foi sincronizado.`
          : 'Webhook conectado, mas o item foi ignorado.',
      details: JSON.stringify(data, null, 2),
    };
  } catch (err: any) {
    return {
      ok: false,
      message: `Não foi possível chamar o webhook local: ${err?.message || 'Erro de rede'}.`,
    };
  }
}

export function exportCatalogMappingJson(products: Product[]): void {
  const mapping = (products || []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    inStock: p.inStock !== false,
  }));
  const blob = new Blob([JSON.stringify(mapping, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerDownload(blob, 'whstore-catalogo-mapeamento.json');
}

export function exportCatalogMappingCsv(products: Product[]): void {
  const header = 'ID;Nome no Catalogo;Categoria;Preco (R$);Status Atual';
  const rows = (products || []).map((p) => {
    const safe = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;
    const price = Number(p.price || 0).toFixed(2).replace('.', ',');
    const status = p.inStock !== false ? 'Disponivel' : 'Esgotado';
    return `${safe(p.id)};${safe(p.name)};${safe(p.category)};${price};${status}`;
  });
  const csvContent = '\uFEFF' + [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, 'whstore-catalogo-mapeamento.csv');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildExternalPanelPrompt(endpointUrl: string, apiKeyDisplay: string): string {
  return `Conecte meu sistema de vendas e estoque ao meu catálogo online da WH Store para que, sempre que uma venda for registrada ou o estoque de um produto zerar (ou for reposto), o catálogo público seja atualizado automaticamente para "Esgotado" ou "Disponível".

REGRAS DE INTEGRAÇÃO:
1. Endpoint (Webhook POST): ${endpointUrl}
2. Cabeçalhos obrigatórios:
   - "Content-Type": "application/json"
   - "x-api-key": "${apiKeyDisplay}"
3. Quando registrar uma venda, editar uma venda, excluir uma venda ou ajustar manualmente o estoque de qualquer produto:
   - Calcule o estoque restante (available = comprado - vendido).
   - Se available <= 0, envie inStock: false (ou remainingStock: 0).
   - Se available > 0, envie inStock: true (ou remainingStock: available).
4. Formato do JSON enviado no body do POST:
   {
     "action": "sale",
     "productName": "NOME EXATO DO PRODUTO",
     "remainingStock": 0,
     "inStock": false
   }
   (Você também pode enviar uma lista em { "items": [ ... ] } quando a venda tiver vários itens de uma vez.)
5. Faça a chamada fetch em segundo plano com try/catch para nunca travar o registro da venda caso o cliente esteja sem internet.
6. Opcionalmente, adicione um botão "Sincronizar Estoque com Catálogo" para enviar todos os produtos zerados/disponíveis em lote usando o mesmo endpoint.`;
}

export function buildJsFetchSnippet(endpointUrl: string, apiKeyDisplay: string): string {
  return `// Chame esta função após registrar uma venda ou alterar o estoque no seu painel
async function sincronizarEstoqueComCatalogo(itensAlterados) {
  // Exemplo de item: { nome: "Brinco Argola Prata", estoqueRestante: 0 }
  const payload = {
    action: "sale",
    items: itensAlterados.map((item) => ({
      productName: item.nome,
      remainingStock: item.estoqueRestante,
      inStock: Number(item.estoqueRestante) > 0,
    })),
  };

  try {
    const resposta = await fetch("${endpointUrl}", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "${apiKeyDisplay}",
      },
      body: JSON.stringify(payload),
    });
    const dados = await resposta.json();
    console.log("Catálogo WH Store atualizado:", dados);
    return dados;
  } catch (erro) {
    console.warn("Aviso ao sincronizar estoque com catálogo:", erro);
  }
}`;
}

export function buildSupabaseRestSnippet(): string {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  return `// Opção direta via Supabase REST API (atualiza in_stock por nome ou ID)
async function marcarProdutoNoSupabase(productId, disponivel) {
  await fetch("${url}/rest/v1/products?id=eq." + encodeURIComponent(productId), {
    method: "PATCH",
    headers: {
      "apikey": "${anonKey}",
      "Authorization": "Bearer ${anonKey}",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      in_stock: Boolean(disponivel),
      updated_at: new Date().toISOString()
    })
  });
}`;
}
