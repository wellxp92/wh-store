import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  ArrowLeft,
  ShoppingBag,
  MessageCircle,
  Heart,
  Share2,
  Play,
  Sparkles,
  ArrowUpDown,
  Gift,
  Check,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Product } from '../types';
import { ProductCard } from './ProductCard';
import { formatCurrency } from '../services/storage';

interface ProductCatalogProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  whatsappNumber: string;
  favorites: string[];
  onToggleFavorite: (productId: string) => void;
  showOnlyFavorites?: boolean;
  onClearFavoritesFilter?: () => void;
}

export const isConjuntoProduct = (product?: Product | null): boolean => {
  if (!product) return false;
  const category = (product.category || '').toLowerCase();
  const name = (product.name || '').toLowerCase();
  return (
    category.includes('conjunto') ||
    category.includes('kit') ||
    name.includes('conjunto') ||
    name.includes('kit')
  );
};

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  onAddToCart,
  whatsappNumber,
  favorites,
  onToggleFavorite,
  showOnlyFavorites = false,
  onClearFavoritesFilter,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [activeMediaTab, setActiveMediaTab] = useState<'image' | 'video'>('image');
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [imageFit, setImageFit] = useState<'cover' | 'contain'>('cover');

  // Dynamic photos for quick view
  const activePhotos = useMemo(() => {
    if (!quickViewProduct) return [];
    const list: string[] = [];
    if (quickViewProduct.images && quickViewProduct.images.length > 0) {
      list.push(...quickViewProduct.images);
    } else if (quickViewProduct.image) {
      list.push(quickViewProduct.image);
    }
    if (quickViewProduct.image && !list.includes(quickViewProduct.image)) {
      list.unshift(quickViewProduct.image);
    }
    return list.filter(Boolean);
  }, [quickViewProduct]);

  // Price Filter state
  const [priceRange, setPriceRange] = useState<string>('all'); // 'all', 'under100', '100to200', 'over200'
  const [priceSort, setPriceSort] = useState<string>('default'); // 'default', 'asc', 'desc'

  // Toast feedback for sharing
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [completingStyleAdded, setCompletingStyleAdded] = useState<string | null>(null);

  // Fechar modal e limpar o parâmetro do produto na URL sem recarregar a página
  const handleCloseQuickView = useCallback(() => {
    setQuickViewProduct(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('produto') || url.searchParams.has('p') || url.searchParams.has('id')) {
        url.searchParams.delete('produto');
        url.searchParams.delete('p');
        url.searchParams.delete('id');
      }
      if (url.hash.startsWith('#produto-')) {
        url.hash = '';
      }
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  }, []);

  // Fechar modal ao pressionar ESC
  React.useEffect(() => {
    if (!quickViewProduct) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseQuickView();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickViewProduct, handleCloseQuickView]);

  // Deep-linking: Quando o link compartilhado contém ?produto=ID ou #produto-ID, abre automaticamente o produto
  useEffect(() => {
    if (!products || products.length === 0 || typeof window === 'undefined') return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const rawParam =
        urlParams.get('produto') ||
        urlParams.get('p') ||
        urlParams.get('id');

      const hashParam = window.location.hash.startsWith('#produto-')
        ? window.location.hash.replace('#produto-', '')
        : null;

      const targetId = rawParam || hashParam;

      if (targetId) {
        const found = products.find(
          (p) =>
            p.id === targetId ||
            p.id.toLowerCase() === targetId.toLowerCase() ||
            p.name.toLowerCase().replace(/\s+/g, '-') === targetId.toLowerCase()
        );

        if (found) {
          // Garante que o card esteja visível na listagem
          setSelectedCategory('Todos');
          setSearchTerm('');
          setPriceRange('all');

          // Abre os detalhes completos do produto instantaneamente
          const isConjunto = isConjuntoProduct(found);
          setQuickViewProduct(found);
          setSelectedPhotoIndex(0);
          setActiveMediaTab('image');
          setImageFit(isConjunto ? 'contain' : 'cover');

          // Rola suavemente até o card do produto na vitrine e aplica destaque visual
          setTimeout(() => {
            const cardEl = document.getElementById(`produto-${found.id}`);
            if (cardEl) {
              cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              cardEl.classList.add('ring-2', 'ring-amber-600', 'ring-offset-2');
              setTimeout(() => {
                cardEl.classList.remove('ring-2', 'ring-amber-600', 'ring-offset-2');
              }, 4500);
            }
          }, 350);
        }
      }
    } catch (err) {
      console.warn('Erro ao processar link direto do produto:', err);
    }
  }, [products]);

  // Dynamic categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });

    const list = Array.from(set);
    // Organiza estritamente em ordem alfabética (A-Z)
    const sorted = list.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

    return ['Todos', ...sorted];
  }, [products]);

  // Mobile & Desktop draggable category bar logic
  const categoriesScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftStartRef = useRef(0);
  const hasDraggedRef = useRef(false);

  const checkCategoriesScroll = useCallback(() => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  }, []);

  useEffect(() => {
    checkCategoriesScroll();
    const el = categoriesScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkCategoriesScroll, { passive: true });
    window.addEventListener('resize', checkCategoriesScroll);
    return () => {
      el.removeEventListener('scroll', checkCategoriesScroll);
      window.removeEventListener('resize', checkCategoriesScroll);
    };
  }, [categories, checkCategoriesScroll]);

  const scrollCategories = (direction: 'left' | 'right') => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -220 : 220;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const handleCategoryMouseDown = (e: React.MouseEvent) => {
    const el = categoriesScrollRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftStartRef.current = el.scrollLeft;
  };

  const handleCategoryMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const el = categoriesScrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    if (Math.abs(walk) > 4) {
      hasDraggedRef.current = true;
    }
    el.scrollLeft = scrollLeftStartRef.current - walk;
  };

  const handleCategoryMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    let list = products.filter((prod) => {
      // Favorite filter
      if (showOnlyFavorites && !favorites.includes(prod.id)) {
        return false;
      }

      // Category filter
      const matchCat =
        selectedCategory === 'Todos' ||
        prod.category.toLowerCase() === selectedCategory.toLowerCase();

      // Search keyword filter
      const matchSearch =
        !searchTerm.trim() ||
        prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        prod.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prod.description && prod.description.toLowerCase().includes(searchTerm.toLowerCase()));

      // Price range filter
      let matchPrice = true;
      if (priceRange === 'under100') {
        matchPrice = prod.price < 100;
      } else if (priceRange === '100to200') {
        matchPrice = prod.price >= 100 && prod.price <= 200;
      } else if (priceRange === 'over200') {
        matchPrice = prod.price > 200;
      }

      return matchCat && matchSearch && matchPrice;
    });

    // Price sorting
    if (priceSort === 'asc') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (priceSort === 'desc') {
      list = [...list].sort((a, b) => b.price - a.price);
    }

    return list;
  }, [products, selectedCategory, searchTerm, priceRange, priceSort, showOnlyFavorites, favorites]);

  // Complementary suggestions for "Complete seu estilo"
  const complementaryProducts = useMemo(() => {
    if (!quickViewProduct) return [];
    const currentId = quickViewProduct.id;
    const cat = quickViewProduct.category.toLowerCase();

    // Determine target complementary categories
    let targetCats: string[] = [];
    if (cat.includes('colar') || cat.includes('conjunto')) {
      targetCats = ['brincos', 'relógios', 'pulseiras'];
    } else if (cat.includes('brinco')) {
      targetCats = ['conjuntos prata 925', 'colares', 'relógios'];
    } else if (cat.includes('relógio')) {
      targetCats = ['pulseiras', 'brincos', 'conjuntos prata 925'];
    } else {
      targetCats = ['brincos', 'relógios', 'conjuntos prata 925'];
    }

    const matches = products.filter(
      (p) =>
        p.id !== currentId &&
        p.inStock !== false &&
        targetCats.some((tc) => p.category.toLowerCase().includes(tc))
    );

    // Fallback if no exact category match
    if (matches.length === 0) {
      return products.filter((p) => p.id !== currentId && p.inStock !== false).slice(0, 3);
    }

    return matches.slice(0, 3);
  }, [quickViewProduct, products]);

  // Share product function with deep-link redirection directly to this specific product
  const handleShareProduct = async (product: Product) => {
    // Monta a URL direta do produto mantendo protocolo e domínio
    let directUrl = '';
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('produto', product.id);
      url.hash = `produto-${product.id}`;
      directUrl = url.toString();
    }

    const shareTitle = `${product.name} | WH Store`;
    const shareText = `Confira ${product.name} (${formatCurrency(product.price)}) na WH Store Joias & Acessórios! Veja fotos, vídeo e detalhes no link:`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `${shareText}\n${directUrl}`,
          url: directUrl,
        });
        setShareToast(`Link direto de "${product.name}" compartilhado com sucesso!`);
        setTimeout(() => setShareToast(null), 3000);
        return;
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Share error:', err);
        } else {
          return;
        }
      }
    }

    // Fallback: Copy direct product link to clipboard
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareText}\n${directUrl}`);
        setShareToast(`Link direto de "${product.name}" copiado com sucesso!`);
        setTimeout(() => setShareToast(null), 3500);
      }
    } catch {
      setShareToast('Não foi possível copiar o link.');
      setTimeout(() => setShareToast(null), 3000);
    }
  };

  const handleAskAboutProduct = (product: Product) => {
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const isOut = product.inStock === false;
    const message = encodeURIComponent(
      isOut
        ? `Olá! Vi na vitrine da WH Store que a joia "${product.name}" (${formatCurrency(product.price)}) está esgotada no momento. Gostaria de saber quando haverá reposição ou se é possível encomendar!`
        : `Olá! Tenho interesse na joia "${product.name}" (${formatCurrency(product.price)}). Poderia me passar mais detalhes e disponibilidade?`
    );
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
  };

  const handleOpenQuickView = (product: Product) => {
    const isConjunto = isConjuntoProduct(product);
    setQuickViewProduct(product);
    setSelectedPhotoIndex(0);
    setActiveMediaTab('image');
    // Conjuntos iniciam em modo ajustado (contain) para que o conjunto completo não seja cortado
    setImageFit(isConjunto ? 'contain' : 'cover');

    // Sincroniza a URL com o produto aberto para facilitar se o cliente copiar o link da barra de endereço
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('produto', product.id);
      window.history.replaceState({ productId: product.id }, '', url.toString());
    }
  };

  return (
    <section id="catalogo" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-12">
      {/* Toast Notification */}
      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 bg-black text-white text-xs px-4 py-2.5 rounded-full shadow-lg border border-neutral-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          {shareToast}
        </div>
      )}

      {/* Catalog Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div>
          {showOnlyFavorites ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-semibold tracking-widest uppercase text-black flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 fill-red-600 text-red-600" />
                Seus Produtos Favoritos
              </span>
              <button
                onClick={onClearFavoritesFilter}
                className="text-xs text-neutral-500 hover:text-black underline cursor-pointer"
              >
                (Ver catálogo completo)
              </button>
            </div>
          ) : (
            <span className="text-[10px] sm:text-xs font-semibold tracking-widest uppercase text-neutral-500">
              Catálogo WH Store
            </span>
          )}
          <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-black tracking-tight">
            {showOnlyFavorites ? 'Lista de Desejos' : 'Nossas Joias & Acessórios'}
          </h2>
        </div>

        {/* Counter */}
        <div className="text-[11px] sm:text-xs font-medium text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full self-start sm:self-auto border border-neutral-200">
          <span className="font-bold text-black">{filteredProducts.length}</span>{' '}
          {filteredProducts.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 mb-5 pb-3 border-b border-neutral-200">
        {/* Row 1: Category Pills with drag/swipe and navigation arrows */}
        <div className="relative group/catbar w-full">
          {/* Left Arrow Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 shadow-md border border-neutral-200 text-black flex items-center justify-center hover:bg-neutral-100 transition-all cursor-pointer"
              aria-label="Ver categorias anteriores"
              title="Ver categorias anteriores"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Left Fade gradient */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white via-white/80 to-transparent pointer-events-none z-10" />
          )}

          {/* Draggable Category Pills Container */}
          <div
            ref={categoriesScrollRef}
            onMouseDown={handleCategoryMouseDown}
            onMouseMove={handleCategoryMouseMove}
            onMouseUp={handleCategoryMouseUp}
            onMouseLeave={handleCategoryMouseUp}
            className="w-full overflow-x-auto whitespace-nowrap scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex items-center gap-1.5 sm:gap-2 pb-1.5 pt-0.5 cursor-grab active:cursor-grabbing select-none scroll-smooth touch-pan-x"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {categories.map((category) => {
              const isSelected =
                selectedCategory.toLowerCase() === category.toLowerCase() && !showOnlyFavorites;
              const isKit = category.toLowerCase().includes('kit');
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    if (hasDraggedRef.current) return;
                    setSelectedCategory(category);
                    onClearFavoritesFilter?.();
                  }}
                  className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-black text-white shadow-2xs'
                      : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300'
                  }`}
                >
                  {isKit && <Gift className="w-3 h-3 text-amber-500" />}
                  <span>{category}</span>
                </button>
              );
            })}
          </div>

          {/* Right Fade gradient */}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white via-white/80 to-transparent pointer-events-none z-10" />
          )}

          {/* Right Arrow Button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 shadow-md border border-neutral-200 text-black flex items-center justify-center hover:bg-neutral-100 transition-all cursor-pointer"
              aria-label="Ver mais categorias"
              title="Ver mais categorias"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mobile Swipe Hint when there are more categories to scroll */}
        {canScrollRight && (
          <div className="sm:hidden flex items-center justify-end pr-1 -mt-1">
            <span className="text-[10px] text-neutral-400 font-medium flex items-center gap-1">
              Deslize para ver mais categorias →
            </span>
          </div>
        )}

        {/* Row 2: Search Input & Price Filters */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center justify-between">
          {/* Price Range Filter Pills (also with smooth invisible scrollbar) */}
          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x py-1">
            <span className="text-[11px] text-neutral-400 font-medium shrink-0 hidden sm:inline">
              Preço:
            </span>
            <button
              onClick={() => setPriceRange('all')}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                priceRange === 'all'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setPriceRange('under100')}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                priceRange === 'under100'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Até R$ 100
            </button>
            <button
              onClick={() => setPriceRange('100to200')}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                priceRange === '100to200'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              R$ 100 a R$ 200
            </button>
            <button
              onClick={() => setPriceRange('over200')}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                priceRange === 'over200'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              Acima de R$ 200 (Frete Grátis)
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Sort Dropdown */}
            <div className="relative shrink-0">
              <select
                value={priceSort}
                onChange={(e) => setPriceSort(e.target.value)}
                className="appearance-none bg-white border border-neutral-300 text-neutral-700 text-xs py-1.5 pl-3 pr-7 rounded-full focus:outline-none focus:border-black cursor-pointer"
              >
                <option value="default">Ordenar</option>
                <option value="asc">Menor Preço</option>
                <option value="desc">Maior Preço</option>
              </select>
              <ArrowUpDown className="w-3 h-3 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar joia ou kit..."
                className="w-full pl-8.5 pr-8 py-1.5 text-xs sm:text-sm bg-white border border-neutral-300 rounded-full focus:outline-none focus:ring-1 focus:ring-black focus:border-black transition-all placeholder:text-neutral-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid: 2 COLUMNS ON MOBILE */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-4 md:gap-5">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
              onQuickView={handleOpenQuickView}
              isFavorite={favorites.includes(product.id)}
              onToggleFavorite={onToggleFavorite}
              onShare={handleShareProduct}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 px-4 bg-neutral-50 rounded-2xl border border-dashed border-neutral-300">
          <div className="w-10 h-10 mx-auto rounded-full bg-neutral-200 flex items-center justify-center text-neutral-600 mb-2">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <h3 className="font-medium text-neutral-900 text-sm mb-1">
            Nenhuma joia encontrada
          </h3>
          <p className="text-xs text-neutral-500 max-w-xs mx-auto mb-3">
            {showOnlyFavorites
              ? 'Você ainda não favoritou nenhuma peça. Clique no coração das joias para salvá-las aqui.'
              : 'Tente alterar os filtros de preço ou buscar por outro termo.'}
          </p>
          <button
            onClick={() => {
              setSelectedCategory('Todos');
              setSearchTerm('');
              setPriceRange('all');
              setPriceSort('default');
              onClearFavoritesFilter?.();
            }}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-black text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Limpar Filtros
          </button>
        </div>
      )}

      {/* Quick View Modal with Video Showcase & "Complete seu estilo" */}
      {quickViewProduct && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseQuickView();
          }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        >
          <div className="relative bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-neutral-200/80 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Clean Navigation Header with "Voltar" - No "X" buttons */}
            <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur-md border-b border-neutral-100">
              <button
                type="button"
                onClick={handleCloseQuickView}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 active:scale-95 transition-all cursor-pointer shadow-2xs"
                title="Voltar ao catálogo"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao catálogo</span>
              </button>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400 truncate max-w-[200px]">
                {quickViewProduct.category}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2">
              {/* Media Display Area (Photo or Video Player) - Preenchimento nítido e elegante sem bordas em branco */}
              <div className="relative w-full aspect-square sm:aspect-auto sm:h-full sm:min-h-[420px] flex items-center justify-center overflow-hidden border-b sm:border-b-0 sm:border-r border-neutral-100 bg-neutral-100 p-0 group/media">
                {activeMediaTab === 'video' && quickViewProduct.video ? (
                  <video
                    src={quickViewProduct.video}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover bg-black block"
                  />
                ) : (
                  <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
                    {(() => {
                      const isConjunto = isConjuntoProduct(quickViewProduct);
                      const currentPhoto =
                        (activePhotos[selectedPhotoIndex] && activePhotos[selectedPhotoIndex].trim()) ||
                        (quickViewProduct.image && quickViewProduct.image.trim()) ||
                        'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=85';

                      return (
                        <>
                          <img
                            src={currentPhoto}
                            alt={quickViewProduct.name}
                            decoding="async"
                            onClick={() => {
                              if (isConjunto) {
                                setImageFit((prev) => (prev === 'cover' ? 'contain' : 'cover'));
                              }
                            }}
                            className={`w-full h-full transition-all duration-300 block select-none [image-rendering:auto] ${
                              isConjunto
                                ? imageFit === 'cover'
                                  ? 'object-cover object-center cursor-zoom-in'
                                  : 'object-contain p-2 cursor-zoom-out'
                                : 'object-cover object-center'
                            }`}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=85';
                            }}
                          />

                          {/* Botão de ajuste exclusivo para Conjuntos e Kits que precisam de enquadramento sem cortes */}
                          {isConjunto && (
                            <button
                              type="button"
                              onClick={() => setImageFit((prev) => (prev === 'cover' ? 'contain' : 'cover'))}
                              className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-black/75 hover:bg-black text-white backdrop-blur-md shadow-md transition-all active:scale-95 cursor-pointer"
                              title={imageFit === 'cover' ? 'Ver conjunto completo (ajustar)' : 'Aproximar imagem (preencher)'}
                            >
                              {imageFit === 'cover' ? (
                                <>
                                  <Minimize2 className="w-3.5 h-3.5" />
                                  <span>Ajustar</span>
                                </>
                              ) : (
                                <>
                                  <Maximize2 className="w-3.5 h-3.5" />
                                  <span>Preencher</span>
                                </>
                              )}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Media Switcher: Multi-photo thumbnails (up to 4) + Video Button */}
                {(activePhotos.length > 1 || quickViewProduct.video) && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 p-1 rounded-full bg-white/95 backdrop-blur-md shadow-md border border-neutral-200/90 max-w-[92%] overflow-x-auto scrollbar-none">
                    {activePhotos.filter((p) => Boolean(p && p.trim())).map((photo, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedPhotoIndex(idx);
                          setActiveMediaTab('image');
                        }}
                        className={`relative w-8 h-8 rounded-full overflow-hidden border-2 transition-transform cursor-pointer shrink-0 ${
                          activeMediaTab === 'image' && selectedPhotoIndex === idx
                            ? 'border-black scale-105 shadow-xs'
                            : 'border-neutral-200 opacity-70 hover:opacity-100'
                        }`}
                        title={`Ver foto ${idx + 1}`}
                      >
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}

                    {quickViewProduct.video && (
                      <button
                        type="button"
                        onClick={() => setActiveMediaTab('video')}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors cursor-pointer shrink-0 ${
                          activeMediaTab === 'video'
                            ? 'bg-black text-white shadow-xs'
                            : 'text-neutral-700 hover:text-black bg-neutral-100 hover:bg-neutral-200'
                        }`}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Vídeo</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">
                        {quickViewProduct.category}
                      </span>
                      {quickViewProduct.inStock === false && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
                          ✕ Esgotado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleShareProduct(quickViewProduct)}
                        className="p-1 text-neutral-400 hover:text-black transition-colors cursor-pointer"
                        title="Compartilhar"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(quickViewProduct.id)}
                        className="p-1 transition-colors cursor-pointer"
                        title="Favoritar"
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            favorites.includes(quickViewProduct.id)
                              ? 'fill-red-600 text-red-600'
                              : 'text-neutral-400 hover:text-black'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-serif text-lg sm:text-xl font-bold text-black mt-0.5 mb-2 leading-tight">
                    {quickViewProduct.name}
                  </h3>

                  <div className="mb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-black">
                        {formatCurrency(quickViewProduct.price)}
                      </span>
                      {quickViewProduct.price >= 200 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-100 text-black border border-neutral-300">
                          Frete Grátis
                        </span>
                      )}
                    </div>
                    {/* Regra de parcelamento estrita: 3x acima de 200, 2x acima de 100, nada abaixo */}
                    {quickViewProduct.price > 200 ? (
                      <p className="text-xs text-neutral-500 font-normal mt-0.5">
                        ou 3x de {formatCurrency(quickViewProduct.price / 3)} sem juros
                      </p>
                    ) : quickViewProduct.price > 100 ? (
                      <p className="text-xs text-neutral-500 font-normal mt-0.5">
                        ou 2x de {formatCurrency(quickViewProduct.price / 2)} sem juros
                      </p>
                    ) : null}
                  </div>

                  {quickViewProduct.description && (
                    <div className="mb-4 p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 max-h-48 overflow-y-auto scrollbar-thin">
                      <p className="text-xs text-neutral-700 font-light leading-relaxed whitespace-pre-line">
                        {quickViewProduct.description}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-3 border-t border-neutral-100">
                  {quickViewProduct.inStock === false ? (
                    <>
                      <div className="w-full py-2.5 px-4 rounded-xl text-center text-xs sm:text-sm font-semibold bg-stone-100 text-stone-500 border border-stone-200">
                        ✕ Item Esgotado no Momento
                      </div>
                      <button
                        onClick={() => handleAskAboutProduct(quickViewProduct)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span>Consultar Previsão de Reposição no WhatsApp</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          onAddToCart(quickViewProduct);
                          handleCloseQuickView();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-black hover:bg-neutral-800 text-white shadow-xs transition-colors cursor-pointer"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        Adicionar à Sacola
                      </button>

                      <button
                        onClick={() => handleAskAboutProduct(quickViewProduct)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-medium text-black bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Dúvidas no WhatsApp
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* SEÇÃO "COMPLETE SEU ESTILO" */}
            {complementaryProducts.length > 0 && (
              <div className="p-4 sm:p-5 bg-neutral-50 border-t border-neutral-200">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                  <h4 className="font-serif font-bold text-xs sm:text-sm text-black tracking-wide">
                    Complete seu estilo
                  </h4>
                  <span className="text-[10px] text-neutral-500">
                    — Sugestões que combinam perfeitamente
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {complementaryProducts.map((comp) => {
                    const isAdded = completingStyleAdded === comp.id;
                    return (
                      <div
                        key={comp.id}
                        className="bg-white p-2 rounded-xl border border-neutral-200 flex flex-col justify-between"
                      >
                        <div className="flex gap-2 items-center mb-1.5">
                          <img
                            src={(comp.image && comp.image.trim()) ? comp.image : 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=300&q=80'}
                            alt={comp.name}
                            className="w-11 h-11 object-cover rounded-lg border border-neutral-200 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=300&q=80';
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium text-black truncate">
                              {comp.name}
                            </p>
                            <p className="text-xs font-bold text-black">
                              {formatCurrency(comp.price)}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onAddToCart(comp);
                            setCompletingStyleAdded(comp.id);
                            setTimeout(() => setCompletingStyleAdded(null), 1200);
                          }}
                          className={`w-full py-1 px-2 rounded-lg text-[10px] font-semibold transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                            isAdded
                              ? 'bg-black text-white'
                              : 'bg-neutral-100 hover:bg-black text-black hover:text-white border border-neutral-300'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3 h-3" />
                              Adicionado!
                            </>
                          ) : (
                            '+ Adicionar à Sacola'
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
