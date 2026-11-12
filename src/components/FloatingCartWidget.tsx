import { useCart } from "@/contexts/CartContext";
import { ShoppingBag } from "lucide-react";

interface FloatingCartWidgetProps {
  className?: string;
}

const FloatingCartWidget = ({ className = "" }: FloatingCartWidgetProps) => {
  const { totalItems, totalPrice, openCart, isCartOpen } = useCart();

  if (isCartOpen) return null;

  return (
    <aside
      aria-label="Floating Shopping Cart"
      onClick={openCart}
      className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 cursor-pointer select-none group transition-all duration-300 hover:-translate-x-1 active:scale-95 ${className}`}
      title="শপিং কার্ট খুলুন"
    >
      <div className="flex flex-col rounded-l-2xl overflow-hidden shadow-[0_8px_25px_rgba(0,0,0,0.18)] border-l-2 border-t-2 border-b-2 border-primary/20 backdrop-blur-xs">
        {/* Top Part: Theme Primary Background */}
        <div className="bg-primary text-primary-foreground px-3.5 py-2.5 flex flex-col items-center justify-center min-w-[76px] transition-colors group-hover:brightness-105">
          <div className="relative">
            <ShoppingBag className="h-5 w-5 stroke-[2.2] mb-0.5 group-hover:scale-110 transition-transform" />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-white text-primary text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                {totalItems}
              </span>
            )}
          </div>
          <span className="text-[11px] font-bold tracking-tight whitespace-nowrap mt-0.5">
            {totalItems} Items
          </span>
        </div>

        {/* Bottom Part: White Background with Total Price */}
        <div className="bg-white dark:bg-slate-900 text-primary px-3 py-1.5 flex items-center justify-center font-black text-xs sm:text-sm tracking-tight border-t border-primary/10">
          <span>৳ {Number(totalPrice).toLocaleString()}</span>
        </div>
      </div>
    </aside>
  );
};

export default FloatingCartWidget;
