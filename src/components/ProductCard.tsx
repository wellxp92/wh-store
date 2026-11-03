import React, { useState } from 'react';
import { Plus, Check, Heart, Share2, Play, Gift } from 'lucide-react';
import { Product } from '../types';
import { formatCurrency } from '../services/storage';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onQuickView?: (product: Product) => void;
  isFavorite: boolean;
  onToggleFavorite: (productId: string) => void;
  onShare: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onQuickView,
  isFavorite,
  onToggleFavorite,
  onShare,
}) => {
  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  const isGiftKit = product.category.toLowerCase().includes('present') || product.category.toLowerCase().includes('kit');
  const isOutOfStock = product.inStock === false;

  const DEFAULT_PRODUCT_IMAGE =
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=85';
  const productImageSrc =
    product.image && product.image.trim() ? product.image : DEFAULT_PRODUCT_IMAGE;

  return (
    <div
      onClick={() => onQuickView?.(product)}
      className="group relative flex flex-col bg-white rounded-xl sm:rounded-2xl overflow-hidden border border-neutral-200 hover:border-black transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs"
    >
      {/* Square Image Box (Compact) */}
      <div className="relative aspect-square w-full bg-neutral-100 overflow-hidden">
        <img
          src={productImageSrc}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover object-center group-hover:scale-104 transition-transform duration-300 ease-out [image-rendering:auto] ${
            isOutOfStock ? 'opacity-80 grayscale-[25%]' : ''
          }`}
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
          }}
        />

        {/* Top Badges (Esgotado, Vídeo, Fotos) */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-10 pointer-events-none">
          {isOutOfStock && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-600 text-white rounded shadow-2xs">
              ✕ Esgotado
            </span>
          )}

          {product.video && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-black/80 backdrop-blur-xs text-white rounded shadow-2xs">
              <Play className="w-2.5 h-2.5 fill-white" />
              Vídeo
            </span>
          )}

          {/* Multiple Photos indicator */}
          {product.images && product.images.length > 1 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold uppercase bg-black/70 backdrop-blur-xs text-white rounded shadow-2xs">
              {product.images.length} fotos
            </span>
          )}
        </div>

        {/* Top Right Action Buttons: Favorite + Share */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
          {/* Share Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShare(product);
            }}
            className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-neutral-700 hover:text-black flex items-center justify-center shadow-2xs border border-neutral-200/80 transition-transform active:scale-90 cursor-pointer"
            title="Compartilhar produto"
            aria-label="Compartilhar produto"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          {/* Favorite Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(product.id);
            }}
            className={`w-7 h-7 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-2xs border border-neutral-200/80 transition-all active:scale-90 cursor-pointer ${
              isFavorite ? 'text-red-600' : 'text-neutral-500 hover:text-black'
            }`}
            title={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
            aria-label="Favoritar produto"
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-red-600 text-red-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Card Content - Compact & Clean */}
      <div className="flex flex-col flex-1 p-2.5 sm:p-3 justify-between">
        <div>
          <h3 className="font-medium text-black text-xs sm:text-sm leading-snug line-clamp-2 mb-1 group-hover:underline decoration-neutral-300">
            {product.name}
          </h3>

          {/* Price & Installments (2x acima de 100, 3x acima de 200, nada abaixo de 100) */}
          <div className="mb-2 min-h-[38px] flex flex-col justify-center">
            <span className="text-sm sm:text-base font-bold text-black tracking-tight leading-tight">
              {formatCurrency(product.price)}
            </span>
            {product.price > 200 ? (
              <p className="text-[10px] sm:text-[11px] text-neutral-500 font-normal leading-tight mt-0.5">
                ou 3x de {formatCurrency(product.price / 3)} sem juros
              </p>
            ) : product.price > 100 ? (
              <p className="text-[10px] sm:text-[11px] text-neutral-500 font-normal leading-tight mt-0.5">
                ou 2x de {formatCurrency(product.price / 2)} sem juros
              </p>
            ) : null}
          </div>
        </div>

        {/* Compact Add to Cart or Esgotado Button */}
        {isOutOfStock ? (
          <button
            type="button"
            disabled
            onClick={(e) => e.stopPropagation()}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2.5 rounded-lg text-xs font-semibold bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed"
            aria-label={`${product.name} esgotado`}
          >
            <span>Esgotado</span>
          </button>
        ) : (
          <button
            onClick={handleAdd}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 cursor-pointer ${
              justAdded
                ? 'bg-black text-white'
                : 'bg-neutral-100 hover:bg-black text-black hover:text-white border border-neutral-300 hover:border-black active:scale-97'
            }`}
            aria-label={`Adicionar ${product.name} à sacola`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Adicionado</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
