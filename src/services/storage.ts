import { Product, StoreSettings } from '../types';

export const INITIAL_WHATSAPP_NUMBER = '5581989947016';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Relógio Clássico Gold Heritage',
    category: 'Relógios',
    price: 349.9,
    image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1200&q=85',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-delicate-gold-chain-41315-large.mp4',
    description: 'Relógio elegante banhado a ouro, visor minimalista com vidro de cristal e fecho ajustável.',
    inStock: true,
  },
  {
    id: 'prod-2',
    name: 'Relógio Minimalist Silver Mesh',
    category: 'Relógios',
    price: 289.9,
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&q=85',
    description: 'Design contemporâneo em aço inoxidável prateado com pulseira em malha milanesa.',
    inStock: true,
  },
  {
    id: 'prod-3',
    name: 'Conjunto Ponto de Luz Prata 925',
    category: 'Conjuntos prata 925',
    price: 159.9,
    image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=85',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-delicate-gold-chain-41315-large.mp4',
    description: 'Clássico colar veneziana em prata de lei 925 acompanhado de par de brincos com zircônia 6mm.',
    inStock: true,
  },
  {
    id: 'prod-4',
    name: 'Conjunto Gota Esmeralda Prata 925',
    category: 'Conjuntos prata 925',
    price: 199.9,
    image: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1200&q=85',
    description: 'Gota cravejada em nano zircônia verde esmeralda com moldura microcravejada em prata legítima.',
    inStock: true,
  },
  {
    id: 'prod-5',
    name: 'Conjunto Coração Cravejado Prata 925',
    category: 'Conjuntos prata 925',
    price: 179.9,
    image: 'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?auto=format&fit=crop&w=1200&q=85',
    description: 'Romântico e radiante. Coração vazado cravejado com micro zircônias de brilho superior.',
    inStock: true,
  },
  {
    id: 'prod-kit-1',
    name: 'Kit Presente Luxo Prata 925 (Colar + Brinco + Caixa Laço)',
    category: 'Kits para presentear',
    price: 239.9,
    image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1200&q=85',
    video: 'https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-delicate-gold-chain-41315-large.mp4',
    description: 'Especial para presentear quem você ama. Acompanha caixa rígida preta acetinada, laço de fita de cetim e garantia vitalícia da Prata 925.',
    inStock: true,
  },
  {
    id: 'prod-kit-2',
    name: 'Kit Presente Amor Eterno (Conjunto Coração + Sacola WH)',
    category: 'Kits para presentear',
    price: 219.9,
    image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1200&q=85',
    description: 'Surpreenda com uma experiência completa de unboxing. Conjunto coração cravejado em prata 925 com embalagem especial WH Store.',
    inStock: true,
  },
  {
    id: 'prod-6',
    name: 'Brinco Argola Cravejada Zircônias',
    category: 'Brincos',
    price: 99.9,
    image: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=1200&q=85',
    description: 'Argola média com fecho click seguro e acabamento polido, perfeita para o dia a dia e ocasiões especiais.',
    inStock: true,
  },
  {
    id: 'prod-7',
    name: 'Brinco Solitário Zircônia 7mm Prata 925',
    category: 'Brincos',
    price: 79.9,
    image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1200&q=85',
    description: 'Par de brincos clássicos em prata 925 hipoalergênica com zircônia cúbica ultra brilhante.',
    inStock: true,
  },
  {
    id: 'prod-8',
    name: 'Brinco Ear Cuff Folhas Elegance',
    category: 'Brincos',
    price: 119.9,
    image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=85',
    description: 'Design sofisticado de folhagem moderna com zircônias navetes e banho nobre.',
    inStock: true,
  },
];

export const DEFAULT_AUTHORIZED_EMAILS: string[] = [
  'wellysondasilva92@gmail.com',
  'whstore081@gmail.com',
];

// Initial default categories for the store (only active categories, sorted A-Z)
export const DEFAULT_STORE_CATEGORIES: string[] = [
  'Brincos',
  'Conjuntos prata 925',
  'Kits para presentear',
  'Relógios',
];

export const INITIAL_STORE_SETTINGS: StoreSettings = {
  products: INITIAL_PRODUCTS,
  whatsappNumber: INITIAL_WHATSAPP_NUMBER,
  banner: {
    subtitle: 'COLEÇÃO EXCLUSIVA & ATEMPORAL',
    title: 'Elegância e Brilho para Todos os Momentos',
    description:
      'Descubra nossa curadoria especial de joias em prata 925 legítima, relógios clássicos e acessórios finos selecionados com acabamento impecável.',
    image:
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1600&q=85',
  },
  categories: DEFAULT_STORE_CATEGORIES,
  adminPin: '209220',
  authorizedEmails: DEFAULT_AUTHORIZED_EMAILS,
  strictDeviceLimit: true,
  updatedAt: '2020-01-01T00:00:00.000Z',
};

const LOCAL_STORAGE_KEY = 'wh_store_catalog_settings_v1';
const PIN_BACKUP_KEY = 'wh_store_admin_pin_backup';

export function isAuthorizedAdminEmail(
  email: string | null | undefined,
  settings?: StoreSettings
): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();

  // Check default bootstrap administrators
  if (DEFAULT_AUTHORIZED_EMAILS.some((e) => e.toLowerCase() === cleanEmail)) {
    return true;
  }

  // Check configured authorized emails from store settings
  if (settings?.authorizedEmails && Array.isArray(settings.authorizedEmails)) {
    return settings.authorizedEmails.some(
      (e) => typeof e === 'string' && e.trim().toLowerCase() === cleanEmail
    );
  }

  return false;
}

/**
 * Fetches the global security PIN from server endpoint (/api/config/security)
 * or static CDN config (/store-security.json) for static hosting like Netlify.
 */
export async function fetchGlobalSecurityPin(): Promise<string | null> {
  // 1. Try server API route (AI Studio fullstack dev server)
  try {
    const res = await fetch('/api/config/security');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.adminPin === 'string' && data.adminPin.trim()) {
        const pin = data.adminPin.trim();
        if (typeof window !== 'undefined') {
          localStorage.setItem(PIN_BACKUP_KEY, pin);
        }
        return pin;
      }
    }
  } catch {
    // Expected on static hosting like Netlify
  }

  // 2. Try static store-security.json (Netlify CDN)
  try {
    const staticRes = await fetch('/store-security.json?t=' + Date.now());
    if (staticRes.ok) {
      const data = await staticRes.json();
      if (data && typeof data.adminPin === 'string' && data.adminPin.trim()) {
        const pin = data.adminPin.trim();
        if (typeof window !== 'undefined') {
          localStorage.setItem(PIN_BACKUP_KEY, pin);
        }
        return pin;
      }
    }
  } catch {
    // Ignore static fetch error
  }

  // 3. Check localStorage backup
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(PIN_BACKUP_KEY);
    if (local && local.trim()) return local.trim();
  }

  return null;
}

/**
 * Saves the global security PIN to the server (which auto-pushes to GitHub for Netlify)
 * and to localStorage.
 */
export async function saveGlobalSecurityPin(newPin: string): Promise<boolean> {
  const cleanPin = newPin.trim();
  if (typeof window !== 'undefined') {
    localStorage.setItem(PIN_BACKUP_KEY, cleanPin);
  }

  try {
    const res = await fetch('/api/config/security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: cleanPin }),
    });
    if (res.ok) {
      return true;
    }
  } catch (err) {
    console.warn('[Storage] Falha ao enviar PIN para o servidor:', err);
  }

  return false;
}

export function getLocalStoreSettings(): StoreSettings {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const backupPin = localStorage.getItem(PIN_BACKUP_KEY);
    if (!raw) {
      return {
        ...INITIAL_STORE_SETTINGS,
        adminPin: (backupPin && backupPin !== '1234') ? backupPin : '209220',
      };
    }
    const parsed = JSON.parse(raw);
    const validParsedPin = parsed.adminPin && parsed.adminPin.trim() !== '1234' ? parsed.adminPin.trim() : null;
    const validBackupPin = backupPin && backupPin.trim() !== '1234' ? backupPin.trim() : null;
    const resolvedPin = validParsedPin || validBackupPin || '209220';
    const resolvedEmails =
      Array.isArray(parsed.authorizedEmails) && parsed.authorizedEmails.length > 0
        ? parsed.authorizedEmails
        : DEFAULT_AUTHORIZED_EMAILS;

    const resolvedCategories =
      Array.isArray(parsed.categories) && parsed.categories.length > 0
        ? parsed.categories.map((c: string) => String(c).trim()).filter(Boolean)
        : DEFAULT_STORE_CATEGORIES;

    return {
      products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : INITIAL_PRODUCTS,
      whatsappNumber: parsed.whatsappNumber || INITIAL_WHATSAPP_NUMBER,
      banner: parsed.banner || INITIAL_STORE_SETTINGS.banner,
      categories: resolvedCategories.length > 0 ? resolvedCategories : DEFAULT_STORE_CATEGORIES,
      adminPin: resolvedPin,
      strictDeviceLimit: parsed.strictDeviceLimit !== false,
      authorizedEmails: resolvedEmails,
      updatedAt: parsed.updatedAt || '2020-01-01T00:00:00.000Z',
      updatedBy: parsed.updatedBy,
    };
  } catch (err) {
    console.warn('Erro ao ler configurações do LocalStorage:', err);
    return INITIAL_STORE_SETTINGS;
  }
}

import {
  saveStoreSettingsToIndexedDB,
  loadStoreSettingsFromIndexedDB,
} from './indexedDb';

export { loadStoreSettingsFromIndexedDB };

/**
 * Strips heavy Base64 data URLs from products and banners for lightweight localStorage storage,
 * while preserving all IDs, names, prices, categories, stock, descriptions, and HTTPS URLs.
 * High-definition Base64 images are preserved safely in IndexedDB and Firestore without quota limits.
 */
export function sanitizeSettingsForLocalStorage(settings: StoreSettings): StoreSettings {
  const sanitizeUrl = (url: string | undefined): string => {
    if (!url || typeof url !== 'string') return '';
    // Strip raw base64 data URLs from localStorage copy if they are larger than 2KB
    if ((url.startsWith('data:image/') || url.startsWith('data:video/')) && url.length > 2048) {
      return '';
    }
    return url;
  };

  const cleanProducts = Array.isArray(settings.products)
    ? settings.products.map((p) => {
        const cleanMain = sanitizeUrl(p.image);
        const cleanGallery = Array.isArray(p.images)
          ? p.images.map(sanitizeUrl).filter(Boolean)
          : (cleanMain ? [cleanMain] : []);

        return {
          ...p,
          image: cleanMain || (cleanGallery[0] || ''),
          images: cleanGallery.length > 0 ? cleanGallery : (cleanMain ? [cleanMain] : []),
          video: p.video ? sanitizeUrl(p.video) : undefined,
        };
      })
    : [];

  const cleanBanner = settings.banner
    ? {
        ...settings.banner,
        image: sanitizeUrl(settings.banner.image),
      }
    : settings.banner;

  return {
    ...settings,
    banner: cleanBanner,
    products: cleanProducts,
  };
}

export function saveLocalStoreSettings(settings: StoreSettings): void {
  // 1. Asynchronously persist full-fidelity catalog (including 1800px photos) in IndexedDB
  // IndexedDB has gigabytes of storage capacity, eliminating 5MB quota errors completely
  saveStoreSettingsToIndexedDB(settings).catch((err) => {
    console.warn('[Storage] Aviso ao persistir dados no IndexedDB:', err);
  });

  // 2. Persist critical settings to dedicated keys
  try {
    if (settings.adminPin) {
      localStorage.setItem(PIN_BACKUP_KEY, settings.adminPin);
    }
  } catch {
    // Ignore key storage errors
  }

  // 3. Persist catalog settings to LocalStorage with automatic QuotaExceededError protection
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  } catch (err: any) {
    // When localStorage 5MB quota is exceeded, save sanitized lightweight structure
    try {
      const sanitized = sanitizeSettingsForLocalStorage(settings);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
      console.info(
        '[Storage] Catálogo completo com fotos HD salvo com sucesso no IndexedDB. LocalStorage mantido sincronizado com versão compacta.'
      );
    } catch {
      // LocalStorage is completely full; IndexedDB remains our reliable primary store
      console.info('[Storage] LocalStorage com capacidade esgotada. Catálogo preservado no IndexedDB.');
    }
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function calculateInstallments(price: number): string | null {
  if (price > 200) {
    const val = price / 3;
    return `ou 3x de ${formatCurrency(val)} sem juros`;
  }
  if (price > 100) {
    const val = price / 2;
    return `ou 2x de ${formatCurrency(val)} sem juros`;
  }
  return null;
}

export type DescriptionTone = 'detalhado' | 'presente' | 'luxo' | 'comercial';

export function generateSmartDescription(
  name: string,
  category: string,
  price?: number,
  tone: DescriptionTone = 'detalhado'
): string {
  const n = (name || '').trim();
  const nLower = n.toLowerCase();
  const cLower = (category || '').toLowerCase();

  // Keyword extraction for realistic personalization
  const isCoracao = nLower.includes('coração') || nLower.includes('coracao') || nLower.includes('heart');
  const isGota = nLower.includes('gota') || nLower.includes('drop');
  const isPontoDeLuz = nLower.includes('ponto de luz') || nLower.includes('solitário') || nLower.includes('solitario');
  const isTrevo = nLower.includes('trevo') || nLower.includes('clover');
  const isPerola = nLower.includes('pérola') || nLower.includes('perola') || nLower.includes('pearl');
  const isEsmeralda = nLower.includes('esmeralda') || nLower.includes('verde');
  const isSafira = nLower.includes('safira') || nLower.includes('azul');
  const isRose = nLower.includes('rosé') || nLower.includes('rose');
  const isDourado = nLower.includes('dourado') || nLower.includes('gold') || nLower.includes('ouro');
  const isMasculino = nLower.includes('masculino') || nLower.includes('men') || nLower.includes('homem') || nLower.includes('grumet');
  const isArgola = nLower.includes('argola') || nLower.includes('hoop');
  const isRiviera = nLower.includes('riviera') || nLower.includes('cravejada');

  // Identify stone highlight
  let pedraHighlight = 'microzircônias cúbicas 5A com lapidação brilhante de 57 facetas e refração luminosa';
  if (isCoracao) pedraHighlight = 'zircônia nobre em lapidação coração facetada com reflexos intensos';
  else if (isGota) pedraHighlight = 'cristal em formato gota com lapidação nobre e reflexão de alta pureza';
  else if (isPontoDeLuz) pedraHighlight = 'zircônia solitária lapidação brilhante com garra reforçada para captação máxima de luz';
  else if (isPerola) pedraHighlight = 'pérola de brilho acetinado com superfície lisa e acabamento iridescente';
  else if (isEsmeralda) pedraHighlight = 'zircônia em tonalidade verde esmeralda com cravação pavê cintilante';
  else if (isSafira) pedraHighlight = 'zircônia em tonalidade azul safira royal com acabamento lapidado';
  else if (isTrevo) pedraHighlight = 'design trevo de 4 folhas trabalhado com bordas peroladas e centro lapidado';

  // Tone: Foco em Presente
  if (tone === 'presente' || cLower.includes('kit') || nLower.includes('kit') || nLower.includes('presente')) {
    return [
      `🎁 Destaque da Curadoria: O ${n || 'Kit Especial'} foi pensado minuciosamente para criar um momento inesquecível de encanto e emoção.`,
      '',
      `• Design & Significado: Peça com acabamento nobre, harmonizando elegância atemporal e brilho sofisticado através de ${pedraHighlight}.`,
      `• Autenticidade & Qualidade: Confeccionada em autêntica Prata 925 legítima de lei maciça, hipoalergênica (livre de níquel) e com polimento espelhado premium.`,
      `• Experiência de Unboxing WH Store: Acompanha estojo rígido forrado em veludo, laço em fita acetinada, flanela mágica de polimento e certificado de garantia permanente da autenticidade da prata.`,
      '',
      `✓ Revisado e embalado individualmente à mão pela equipe WH Store antes de cada envio.`,
    ].join('\n');
  }

  // Watches: Specialized specs
  if (cLower.includes('relógio') || nLower.includes('relógio') || nLower.includes('watch')) {
    const pulseiraDesc = isMasculino || nLower.includes('aço')
      ? 'pulseira em elos maciços de aço com fecho deployant borboleta e trava dupla de segurança'
      : 'pulseira anatômica com ajuste milimétrico e acabamento polido de alto brilho';

    return [
      `⌚ ${n || 'Relógio de Alto Padrão'}: Criado para quem busca presença, precisão e distinção no pulso.`,
      '',
      `• Maquinário: Movimento analógico Quartz de alta precisão com ponteiros alinhados e marcadores em alto relevo.`,
      `• Caixa & Visor: Construção sólida em Aço Nobre Inoxidável 316L (resistente a oxidação e suor) com vidro de cristal mineral temperado resistente a riscos diários.`,
      `• Pulseira & Conforto: ${pulseiraDesc}.`,
      `• Apresentação: Acompanha estojo protetor almofadado oficial WH Store e manual de cuidados.`,
      '',
      `✓ Inspecionado e ajustado manualmente por nossos especialistas antes do envio.`,
    ].join('\n');
  }

  // Conjuntos: Specific tailored dual piece breakdown
  if (cLower.includes('conjunto') || nLower.includes('conjunto')) {
    return [
      `✨ ${n || 'Conjunto Elegante em Prata 925'}: Uma composição harmoniosa projetada para iluminar o visual com requinte.`,
      '',
      `• Colar: Corrente veneziana de 45cm com extensor adicional de 5cm para ajuste de altura no colo, fecho tipo lagosta maciço com gravação 925. Pingente principal trabalhado com ${pedraHighlight}.`,
      `• Brincos: Par combinando perfeitamente com a corrente, tarraxas reforçadas anatômicas que garantem sustentação e conforto sem apertar a orelha.`,
      `• Metal Nobre: Prata 925 de Lei com camada de brilho espelhado que protege contra oxidação precoce. Hipoalergênico e níquel-free.`,
      `• Acessórios Inclusos: Embalagem aveludada oficial WH Store pronta para presentear, flanela especial para limpeza e certificado de autenticidade vitalícia do metal.`,
      '',
      `✓ Cada par e pingente passa por curadoria artesanal rigorosa de cravação.`,
    ].join('\n');
  }

  // Brincos
  if (cLower.includes('brinco') || nLower.includes('brinco') || isArgola) {
    const fechoBrinco = isArgola
      ? 'Fecho articulado com sistema click audível de alta pressão e segurança'
      : 'Tarraxa modelo borboleta anatômica reforçada que mantém a peça firme e centralizada na orelha';

    return [
      `💎 ${n || 'Brinco em Prata 925 Legítima'}: O equilíbrio ideal entre leveza, conforto e brilho diário.`,
      '',
      `• Detalhes da Joia: Estrutura em Prata 925 maciça com cravação impecável em ${pedraHighlight}.`,
      `• Conforto & Ergonomia: ${fechoBrinco}. Pinos maciços hipoalergênicos que não causam alergias nem irritações mesmo com uso prolongado.`,
      `• Acabamento: Polimento óptico espelhado que realça a luminosidade natural da prata de lei.`,
      `• Cuidados & Envio: Acompanha saquinho aveludado protetor WH Store, certificado de garantia da prata e flanela mágica de brilho.`,
      '',
      `✓ Verificado manualmente em bancada antes do envio para assegurar fecho perfeito e brilho impecável.`,
    ].join('\n');
  }

  // Colares & Correntes
  if (cLower.includes('colar') || cLower.includes('corrente') || nLower.includes('colar') || nLower.includes('corrente')) {
    const malha = nLower.includes('grumet')
      ? 'Malha Grumet encorpada com elos soldados e acabamento chanfrado'
      : nLower.includes('fita')
      ? 'Malha Fita maleável com efeito espelho contínuo de alta fluidez'
      : 'Malha Veneziana fina e delicada com elos calibrados e caimento suave';

    return [
      `📿 ${n || 'Colar em Prata 925 Maciça'}: O clássico indispensável para valorizar o colo com sofisticação.`,
      '',
      `• Estrutura da Corrente: ${malha}. Medida confortável de 40 a 45cm com extensor de segurança e fecho modelo mola/lagosta reforçado.`,
      `• Detalhes & Gemas: ${pedraHighlight}. Polimento superior que reflete a luz com intensidade em qualquer ângulo.`,
      `• Garantia & Material: 100% Prata 925 de Lei legítima com garantia permanente do teor da prata e composição hipoalergênica.`,
      `• Incluso: Embalagem oficial acolchoada WH Store e flanela mágica de manutenção.`,
      '',
      `✓ Conferido manualmente elo por elo para garantir resistência e acabamento uniforme.`,
    ].join('\n');
  }

  // Pulseiras & Braceletes
  if (cLower.includes('pulseira') || cLower.includes('bracelete') || nLower.includes('pulseira')) {
    const detalhePulseira = isRiviera
      ? 'Design Riviera flexível com zircônias cravadas em garras individuais e trava dupla lateral de segurança'
      : 'Elos calibrados com gravação oficial do teor da Prata 925 e fecho reforçado de alta durabilidade';

    return [
      `✨ ${n || 'Pulseira em Prata 925'}: Elegância e movimento para destacar qualquer produção.`,
      '',
      `• Confeccionada em Prata 925 legítima com acabamento nobre e toque aveludado na pele.`,
      `• Estrutura: ${detalhePulseira}.`,
      `• Brilho & Destaque: Realce em ${pedraHighlight}, perfeita tanto para uso individual quanto para composições em mix de pulseiras.`,
      `• Embalagem: Acompanha estojo WH Store para presente e certificado de garantia permanente da prata.`,
      '',
      `✓ Peça inspecionada manualmente para assegurar fecho firme e resistência máxima.`,
    ].join('\n');
  }

  // Default refined handcrafted template
  return [
    `💎 ${n || 'Joia Exclusiva WH Store'}: Sofisticação atemporal e acabamento premium para marcar momentos especiais.`,
    '',
    `• Matéria-Prima: Confeccionada com metais nobres de alta pureza (Prata 925 de Lei legítima), garantindo durabilidade eterna da cor e resistência superior.`,
    `• Lapidação & Detalhes: Trabalho cuidadoso em ${pedraHighlight}, conferindo brilho radiante com refração de luz impecável.`,
    `• Hipoalergênica: 100% livre de níquel ou chumbo, desenvolvida para não agredir peles sensíveis.`,
    `• Experiência WH Store: Acompanha embalagem exclusiva para presente, certificado de garantia da autenticidade e flanela especial de polimento.`,
    '',
    `✓ Curadoria manual: Inspecionada e aprovada peça a peça por nossa equipe antes do envio.`,
  ].join('\n');
}

