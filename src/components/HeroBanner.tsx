import React from 'react';
import { ArrowDown } from 'lucide-react';
import { BannerConfig } from '../types';

interface HeroBannerProps {
  banner: BannerConfig;
  onExploreClick: () => void;
}

const DEFAULT_BANNER_IMAGE =
  'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1600&q=85';

export const HeroBanner: React.FC<HeroBannerProps> = ({ banner, onExploreClick }) => {
  const bannerImageSrc = (banner?.image && banner.image.trim()) ? banner.image : DEFAULT_BANNER_IMAGE;

  return (
    <section className="relative overflow-hidden bg-black text-white">
      {/* Background Image with Black & White overlay filter */}
      <div className="absolute inset-0 z-0">
        <img
          src={bannerImageSrc}
          alt={banner?.title || 'Banner Coleção WH Store'}
          className="w-full h-full object-cover object-center grayscale contrast-110 opacity-40 scale-102 transition-transform duration-700 ease-out"
          onError={(e) => {
            (e.target as HTMLImageElement).src = DEFAULT_BANNER_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-linear-to-r from-black/90 via-black/75 to-black/60" />
      </div>

      {/* Compact Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-10 md:py-12">
        <div className="max-w-xl">
          {/* Subtitle Pill in Pure Monochrome */}
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/10 border border-white/20 text-white text-[10px] sm:text-xs font-semibold tracking-widest uppercase mb-2.5 backdrop-blur-xs">
            <span>{banner.subtitle || 'Coleção Exclusiva'}</span>
          </div>

          {/* Title */}
          <h1 className="font-serif text-xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-snug mb-2">
            {banner.title || 'Elegância e Sofisticação'}
          </h1>

          {/* Concise Description */}
          {banner.description && (
            <p className="text-xs sm:text-sm text-neutral-300 font-light line-clamp-2 sm:line-clamp-none mb-4 max-w-md">
              {banner.description}
            </p>
          )}

          {/* Compact CTA Button */}
          <div>
            <button
              onClick={onExploreClick}
              className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full bg-white hover:bg-neutral-200 text-black font-semibold text-xs sm:text-sm tracking-wide transition-all shadow-xs active:scale-95"
            >
              <span>Ver Produtos</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
