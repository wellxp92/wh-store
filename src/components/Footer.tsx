import React from 'react';
import { Lock, Shield, HeartHandshake, Truck } from 'lucide-react';
import { SyncState } from '../types';

interface FooterProps {
  onOpenAdmin: () => void;
  syncState: SyncState;
  whatsappNumber: string;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenAdmin,
  syncState,
  whatsappNumber,
}) => {
  const currentYear = new Date().getFullYear();

  const handleWhatsAppContact = () => {
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const message = encodeURIComponent(
      'Olá! Gostaria de falar com o atendimento da WH Store.'
    );
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
  };

  return (
    <footer className="bg-black text-neutral-300 border-t border-neutral-900">
      {/* Trust Badges in Minimal Monochrome */}
      <div className="border-b border-neutral-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
            <div className="flex items-center gap-3.5 justify-center sm:justify-start">
              <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center shrink-0 border border-neutral-800">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-xs sm:text-sm">
                  Prata 925 Legítima
                </h4>
                <p className="text-[11px] text-neutral-400 font-light">
                  Garantia de autenticidade e qualidade.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 justify-center sm:justify-start">
              <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center shrink-0 border border-neutral-800">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-xs sm:text-sm">
                  Atendimento WhatsApp
                </h4>
                <p className="text-[11px] text-neutral-400 font-light">
                  Atendimento ágil para tirar dúvidas e fechar pedidos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3.5 justify-center sm:justify-start">
              <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center shrink-0 border border-neutral-800">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-xs sm:text-sm">
                  Envio Cuidadoso
                </h4>
                <p className="text-[11px] text-neutral-400 font-light">
                  Embalagens protegidas e feitas com carinho.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-white p-0.5 border border-neutral-800 shrink-0">
              <img
                src="/assets/aistudio/45253110-c633-410d-8e28-6dd548eaa7c2_2efdc5ae.jpg"
                alt="WH Store"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="font-serif font-bold text-white tracking-widest text-base uppercase">
                WH STORE
              </span>
              <p className="text-[10px] text-neutral-400 uppercase tracking-widest">
                Joias & Acessórios
              </p>
            </div>
          </div>

          {/* Links & WhatsApp */}
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-neutral-400">
            <a href="#catalogo" className="hover:text-white transition-colors">
              Catálogo
            </a>
            <button
              onClick={handleWhatsAppContact}
              className="hover:text-white transition-colors"
            >
              Falar no WhatsApp
            </button>
            <span className="text-neutral-700 hidden sm:inline">•</span>
            {/* Sync Pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-[10px]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  syncState === 'connected'
                    ? 'bg-white'
                    : syncState === 'syncing'
                    ? 'bg-neutral-500 animate-pulse'
                    : 'bg-neutral-600'
                }`}
              />
              <span className="text-neutral-400">
                {syncState === 'connected'
                  ? 'Firestore Ativo'
                  : syncState === 'syncing'
                  ? 'Sincronizando'
                  : 'Modo Local'}
              </span>
            </div>
          </div>

          {/* Discreet Admin Lock */}
          <div>
            <button
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors"
              title="Painel Administrativo"
            >
              <Lock className="w-3 h-3 text-neutral-400" />
              <span>Lojista</span>
            </button>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-5 border-t border-neutral-900 text-center text-[11px] text-neutral-500 font-light flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {currentYear} WH Store — Joias & Acessórios. Todos os direitos reservados.</p>
          <p className="text-neutral-500">Catálogo e-commerce mobile-first</p>
        </div>
      </div>
    </footer>
  );
};
