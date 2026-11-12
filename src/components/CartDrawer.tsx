import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShoppingBag,
  ShoppingCart,
  X,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Gift,
  Tag,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const CartDrawer = () => {
  const { isCartOpen, closeCart, items, updateQuantity, removeItem, totalItems, totalPrice, getItemUnitPrice } = useCart();
  const navigate = useNavigate();
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCartOpen) {
        closeCart();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCartOpen, closeCart]);

  // Prevent background scrolling when cart drawer is open
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isCartOpen]);

  if (!isCartOpen) return null;

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (couponCode.trim()) {
      setCouponApplied(true);
    }
  };

  const handleProceedToCheckout = () => {
    closeCart();
    navigate("/checkout");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Dark backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer slide-over container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Shopping Cart Drawer"
          className="w-screen max-w-md bg-background border-l shadow-2xl flex flex-col transform transition ease-in-out duration-300 animate-in slide-in-from-right"
        >
          {/* Header (Matches Reference Image) */}
          <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-card/60 backdrop-blur-xs sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-foreground leading-tight">Shopping Cart</h2>
                <p className="text-xs text-muted-foreground">{totalItems} items</p>
              </div>
            </div>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={closeCart}
              className="rounded-full text-xs font-semibold px-4 h-8 gap-1.5 shadow-xs"
            >
              <span>Close</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Body Content */}
          {items.length === 0 ? (
            /* Empty State (Matches Reference Image) */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-24 h-24 rounded-full bg-muted/60 flex items-center justify-center mb-5 text-muted-foreground/60 shadow-inner">
                <ShoppingCart className="h-12 w-12 stroke-[1.5]" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">Your cart is empty</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Add items to get started and enjoy fast home delivery!
              </p>
              <Button
                type="button"
                onClick={() => {
                  closeCart();
                  navigate("/products");
                }}
                className="rounded-full px-6 h-10 font-medium"
              >
                কেনাকাটা শুরু করুন
              </Button>
            </div>
          ) : (
            /* Items List */
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {items.map((item) => {
                const unitPrice = getItemUnitPrice(item);
                const lineTotal = unitPrice * item.quantity;

                return (
                  <div
                    key={item.id}
                    className="flex gap-3.5 bg-card border rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition-shadow relative"
                  >
                    {/* Product Image */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted/40 border shrink-0 flex items-center justify-center">
                      <img
                        src={item.image || "/placeholder.svg"}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm text-foreground line-clamp-2 leading-snug">
                            {item.name}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors shrink-0 -mr-1 -mt-1"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="font-bold text-primary text-sm">৳{unitPrice}</span>
                          {item.originalPrice && item.originalPrice > unitPrice && (
                            <span className="text-xs text-muted-foreground line-through">
                              ৳{item.originalPrice}
                            </span>
                          )}
                        </div>

                        {/* Gift badge if present */}
                        {Boolean(item.has_gift && item.gift_title) && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-medium">
                            <Gift className="h-3 w-3 text-emerald-600 shrink-0" />
                            <span className="truncate">{item.gift_title}</span>
                            <span className="shrink-0 font-bold">
                              {item.gift_charge_enabled ? `(+৳${item.gift_price})` : "(ফ্রি)"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Quantity & Subtotal Controls */}
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/60">
                        <div className="flex items-center border rounded-lg bg-background overflow-hidden h-7">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-xs font-bold text-foreground">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <span className="text-xs font-bold text-foreground">
                          মোট: <span className="text-primary font-black">৳{lineTotal}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer (Matches Reference Image) */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 border-t bg-card/80 backdrop-blur-xs space-y-3.5 sticky bottom-0">
              {/* Coupon Accordion */}
              <div className="border-b pb-3">
                <button
                  type="button"
                  onClick={() => setCouponOpen(!couponOpen)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                    Have a coupon code? (কুপন কোড আছে?)
                  </span>
                  {couponOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {couponOpen && (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2 mt-2.5 animate-in fade-in duration-200">
                    <Input
                      placeholder="কুপন কোড দিন..."
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <Button type="submit" variant="secondary" size="sm" className="h-9 text-xs px-3 font-semibold">
                      Apply
                    </Button>
                  </form>
                )}
                {couponApplied && (
                  <p className="text-[11px] text-emerald-600 font-medium mt-1">
                    ✓ কুপন কোড চেকআউটে যাচাই করা হবে।
                  </p>
                )}
              </div>

              {/* Total Row */}
              <div className="flex items-center justify-between text-foreground">
                <span className="font-bold text-base">Total</span>
                <div className="text-right">
                  <span className="text-2xl font-black text-primary">৳ {Number(totalPrice).toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <Button
                  type="button"
                  onClick={handleProceedToCheckout}
                  className="w-full h-12 rounded-full font-bold text-base shadow-md hover:shadow-primary/30 active:scale-[0.99] transition-all gap-2"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <div className="flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      closeCart();
                      navigate("/cart");
                    }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
                  >
                    সম্পূর্ণ কার্ট পেইজ দেখুন (View Cart Page)
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default CartDrawer;
