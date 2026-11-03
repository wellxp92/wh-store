import React from 'react';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, MessageCircle, Truck } from 'lucide-react';
import { CartItem } from '../types';
import { formatCurrency } from '../services/storage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onClearCart: () => void;
  whatsappNumber: string;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onClearCart,
  whatsappNumber,
}) => {
  if (!isOpen) return null;

  const totalItemsCount = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalPrice = items.reduce(
    (acc, curr) => acc + curr.product.price * curr.quantity,
    0
  );

  const freeShippingThreshold = 200;
  const hasFreeShipping = totalPrice >= freeShippingThreshold;
  const freeShippingProgress = Math.min(100, Math.round((totalPrice / freeShippingThreshold) * 100));
  const amountToFreeShipping = Math.max(0, freeShippingThreshold - totalPrice);

  const handleCheckoutWhatsApp = () => {
    if (items.length === 0) return;

    const cleanNumber = whatsappNumber.replace(/\D/g, '');

    // Formatted WhatsApp Order Text
    let message = `*NOVO PEDIDO — WH STORE*\n_Joias & Acessórios_\n\n`;
    message += `Olá! Gostaria de finalizar meu pedido pelo catálogo com as seguintes peças:\n\n`;
    message += `──────────────────────\n*ITENS SELECIONADOS:*\n`;

    items.forEach((item, index) => {
      const subtotal = item.product.price * item.quantity;
      message += `• ${item.quantity}x ${item.product.name}\n`;
      message += `  Preço: ${formatCurrency(item.product.price)} (Subtotal: ${formatCurrency(subtotal)})\n`;
      if (item.product.category) {
        message += `  Cat: ${item.product.category}\n`;
      }
      if (index < items.length - 1) {
        message += `\n`;
      }
    });

    message += `\n──────────────────────\n`;
    message += `*Total de peças:* ${totalItemsCount} ${totalItemsCount === 1 ? 'item' : 'itens'}\n`;
    message += `*VALOR TOTAL:* ${formatCurrency(totalPrice)}\n`;
    if (hasFreeShipping) {
      message += `🚚 *FRETE GRÁTIS APLICADO (Pedido acima de R$ 200)*\n`;
    }
    message += `\nPor favor, confirme a disponibilidade e me envie a chave PIX ou link de pagamento.\nObrigado!`;

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${cleanNumber}?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-2xs transition-opacity duration-200"
      />

      {/* Drawer Panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-neutral-200">
          {/* Drawer Header */}
          <div className="px-5 py-4 bg-white border-b border-neutral-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-black text-base">
                  Sua Sacola
                </h2>
                <p className="text-[11px] text-neutral-500">
                  {totalItemsCount} {totalItemsCount === 1 ? 'peça' : 'peças'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-neutral-500 hover:text-black hover:bg-neutral-100 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Fechar sacola"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Free Shipping Dynamic Progress Bar */}
          {items.length > 0 && (
            <div className="px-5 py-2.5 bg-neutral-50 border-b border-neutral-200 text-xs">
              <div className="flex items-center justify-between text-[11px] font-medium text-black mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  {hasFreeShipping ? (
                    <strong className="text-black">Parabéns! Você ganhou Frete Grátis! 🎉</strong>
                  ) : (
                    <span>Faltam <strong>{formatCurrency(amountToFreeShipping)}</strong> para <strong>Frete Grátis</strong></span>
                  )}
                </span>
                <span className="font-mono text-neutral-500">{freeShippingProgress}%</span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-black h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${freeShippingProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto px-5 py-3 divide-y divide-neutral-100">
            {items.length > 0 ? (
              items.map((item) => (
                <div key={item.product.id} className="py-3 flex gap-3 items-center">
                  {/* Thumbnail */}
                  <img
                    src={(item.product.image && item.product.image.trim()) ? item.product.image : 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=300&q=80'}
                    alt={item.product.name}
                    className="w-16 h-16 rounded-lg object-cover border border-neutral-200 bg-neutral-100 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=300&q=80';
                    }}
                  />

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] uppercase font-semibold text-neutral-500 tracking-wider">
                      {item.product.category}
                    </span>
                    <h4 className="text-xs sm:text-sm font-medium text-black truncate">
                      {item.product.name}
                    </h4>
                    <p className="text-xs sm:text-sm font-bold text-black mt-0.5">
                      {formatCurrency(item.product.price)}
                    </p>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <div className="flex items-center border border-neutral-300 rounded-lg bg-neutral-50 overflow-hidden">
                        <button
                          onClick={() =>
                            onUpdateQuantity(item.product.id, item.quantity - 1)
                          }
                          className="px-2 py-1 text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                          title="Diminuir quantidade"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 py-0.5 text-xs font-semibold text-black min-w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            onUpdateQuantity(item.product.id, item.quantity + 1)
                          }
                          className="px-2 py-1 text-black hover:bg-neutral-200 transition-colors cursor-pointer"
                          title="Aumentar quantidade"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => onUpdateQuantity(item.product.id, 0)}
                        className="text-neutral-400 hover:text-black p-1 transition-colors cursor-pointer"
                        title="Remover produto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <div className="w-12 h-12 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center mb-3">
                  <ShoppingBag className="w-6 h-6 stroke-1" />
                </div>
                <h3 className="font-serif font-medium text-black text-base mb-1">
                  Sua sacola está vazia
                </h3>
                <p className="text-xs text-neutral-500 max-w-xs mb-4 font-light">
                  Explore nosso catálogo e selecione as joias ou kits desejados.
                </p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-full text-xs font-semibold bg-black text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Ver Catálogo
                </button>
              </div>
            )}
          </div>

          {/* Drawer Footer (NO installments info) */}
          {items.length > 0 && (
            <div className="p-5 bg-neutral-50 border-t border-neutral-200">
              <div className="space-y-1.5 mb-4 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Quantidade de peças</span>
                  <span className="font-medium text-black">{totalItemsCount}</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-neutral-200">
                  <span className="font-serif font-bold text-black text-sm sm:text-base">
                    Total
                  </span>
                  <span className="text-xl sm:text-2xl font-extrabold text-black tracking-tight">
                    {formatCurrency(totalPrice)}
                  </span>
                </div>
                {hasFreeShipping && (
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold pt-1">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Frete Grátis aplicado ao seu pedido!</span>
                  </div>
                )}
              </div>

              {/* Finalize Button */}
              <button
                onClick={handleCheckoutWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white font-semibold text-xs sm:text-sm tracking-wide shadow-xs transition-all active:scale-98 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Finalizar no WhatsApp</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </button>

              <div className="flex items-center justify-between mt-2.5 text-[10px] text-neutral-400">
                <span>Atendimento direto pelo WhatsApp</span>
                <button
                  onClick={onClearCart}
                  className="hover:text-black underline transition-colors cursor-pointer"
                >
                  Esvaziar sacola
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
