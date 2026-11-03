import React from 'react';
import { ShoppingBag, MessageCircle, RefreshCw, Heart, Truck } from 'lucide-react';
import { SyncState } from '../types';

interface HeaderProps {
  cartCount: number;
  favoritesCount: number;
  onOpenCart: () => void;
  onOpenFavorites: () => void;
  whatsappNumber: string;
  syncState: SyncState;
  onTriggerSync?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount,
  favoritesCount,
  onOpenCart,
  onOpenFavorites,
  whatsappNumber,
  syncState,
  onTriggerSync,
}) => {
  const handleWhatsAppContact = () => {
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const message = encodeURIComponent(
      'Olá! Gostaria de tirar algumas dúvidas sobre as joias e acessórios da WH Store.'
    );
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
  };

  return (
    <div className="sticky top-0 z-40">
      {/* Free Shipping Announcement Bar */}
      <div className="bg-black text-white text-[11px] sm:text-xs py-1.5 px-3 text-center tracking-wide font-medium flex items-center justify-center gap-2 border-b border-neutral-800">
        <Truck className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
        <span>
          FRETE GRÁTIS para compras acima de <strong className="font-bold underline decoration-white/50">R$ 200,00</strong>
        </span>
      </div>

      {/* Main Navigation Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-neutral-200 shadow-2xs transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Official WH Store Brand Logo & Typography */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden bg-white border border-neutral-200 shadow-2xs shrink-0 flex items-center justify-center">
                <img
                  src="/assets/aistudio/45253110-c633-410d-8e28-6dd548eaa7c2_2efdc5ae.jpg"
                  alt="WH Store Logo"
                  className="w-full h-full object-contain p-0.5"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-serif text-lg sm:text-xl font-extrabold tracking-widest text-black uppercase leading-tight">
                  WH STORE
                </span>
                <span className="text-[10px] sm:text-xs font-normal tracking-[0.2em] uppercase text-neutral-500">
                  Joias & Acessórios
                </span>
              </div>
            </div>

            {/* Actions & Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              {/* Sync Status Badge (Desktop & Tablet) */}
              <div
                onClick={onTriggerSync}
                title={
                  syncState === 'supabase_connected'
                    ? 'Conectado ao Supabase PostgreSQL'
                    : syncState === 'supabase_syncing'
                    ? 'Sincronizando com Supabase...'
                    : syncState === 'connected'
                    ? 'Conectado ao Cloud DB'
                    : syncState === 'syncing'
                    ? 'Sincronizando...'
                    : 'Modo Local (Cache Seguro)'
                }
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700 border border-neutral-200 cursor-pointer hover:bg-neutral-200/80 transition-colors"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    syncState === 'supabase_connected'
                      ? 'bg-emerald-600'
                      : syncState === 'connected'
                      ? 'bg-black'
                      : syncState === 'supabase_syncing' || syncState === 'syncing'
                      ? 'bg-neutral-500 animate-pulse'
                      : 'bg-neutral-400'
                  }`}
                />
                <span className="text-[11px] font-mono">
                  {syncState === 'supabase_connected'
                    ? 'Supabase'
                    : syncState === 'supabase_syncing'
                    ? 'Sync...'
                    : syncState === 'connected'
                    ? 'Online'
                    : syncState === 'syncing'
                    ? 'Sync...'
                    : 'Local'}
                </span>
                {onTriggerSync && (
                  <RefreshCw
                    className={`w-3 h-3 ml-0.5 text-neutral-500 ${
                      syncState === 'syncing' ? 'animate-spin' : ''
                    }`}
                  />
                )}
              </div>

              {/* Wishlist / Favoritos Button */}
              <button
                onClick={onOpenFavorites}
                className="relative flex items-center justify-center p-2 sm:px-3 sm:py-2 rounded-full text-neutral-700 hover:text-black hover:bg-neutral-100 border border-transparent hover:border-neutral-200 transition-all cursor-pointer"
                title="Ver produtos favoritos"
                aria-label="Ver produtos favoritos"
              >
                <Heart className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${favoritesCount > 0 ? 'fill-black text-black' : ''}`} />
                <span className="hidden sm:inline text-xs ml-1.5 font-medium">Favoritos</span>
                {favoritesCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 sm:static sm:ml-1.5 bg-neutral-900 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center leading-tight">
                    {favoritesCount}
                  </span>
                )}
              </button>

              {/* WhatsApp Contact Button */}
              <button
                onClick={handleWhatsAppContact}
                className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-black border border-neutral-300 text-xs sm:text-sm font-medium tracking-wide transition-all active:scale-95 cursor-pointer"
                title="Falar no WhatsApp"
                aria-label="Atendimento pelo WhatsApp"
              >
                <MessageCircle className="w-4 h-4 text-black" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>

              {/* Shopping Cart Button */}
              <button
                onClick={onOpenCart}
                className="relative flex items-center justify-center p-2.5 sm:px-4 sm:py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs sm:text-sm font-medium tracking-wide shadow-xs transition-all active:scale-95 cursor-pointer"
                aria-label="Abrir sacola de compras"
              >
                <ShoppingBag className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Sacola</span>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 sm:static sm:ml-1.5 bg-white text-black border border-black text-[10px] sm:text-xs font-bold px-1.5 py-0.2 rounded-full min-w-4.5 text-center leading-tight shadow-xs">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
};
