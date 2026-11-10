import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { ShoppingCart, Flame, Zap, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

const TopSellingProducts = () => {
  const { addItem } = useCart();
  const navigate = useNavigate();

  const { data: products } = useQuery({
    queryKey: ["top-selling-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      const list = data || [];
      return list.filter(
        (p: any) => p.is_bestseller === true || p.is_bestseller === 1 || p.is_bestseller === "1"
      );
    },
  });

  const getProductImage = (prod: any) => {
    if (Array.isArray(prod?.images) && prod.images[0]) return prod.images[0];
    if (typeof prod?.images === "string") {
      try {
        const parsed = JSON.parse(prod.images);
        if (Array.isArray(parsed) && parsed[0]) return parsed[0];
      } catch {
        if (prod.images.startsWith("http") || prod.images.startsWith("/")) return prod.images;
      }
    }
    return "/placeholder.svg";
  };

  const handleAddToCart = (e: React.MouseEvent, p: any) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      originalPrice: p.original_price ? Number(p.original_price) : undefined,
      image: getProductImage(p),
      has_gift: Boolean(p.has_gift),
      gift_title: p.gift_title || "",
      gift_image: p.gift_image || "",
      gift_price: Number(p.gift_price || 0),
      gift_charge_enabled: Boolean(p.gift_charge_enabled),
    });
    toast.success(`${p.name} কার্টে যোগ হয়েছে`);
  };

  const handleBuyNow = (e: React.MouseEvent, p: any) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: p.id,
      name: p.name,
      price: Number(p.price),
      originalPrice: p.original_price ? Number(p.original_price) : undefined,
      image: getProductImage(p),
      has_gift: Boolean(p.has_gift),
      gift_title: p.gift_title || "",
      gift_image: p.gift_image || "",
      gift_price: Number(p.gift_price || 0),
      gift_charge_enabled: Boolean(p.gift_charge_enabled),
    });
    navigate("/checkout");
  };

  if (!products || products.length === 0) return null;

  return (
    <section className="py-8 md:py-12 bg-background">
      <div className="container mx-auto px-4 max-w-[1536px]">
        {/* Section Heading matching reference */}
        <div className="text-center mb-6 md:mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Top Selling Products
          </h2>
          <div className="h-1 w-16 bg-primary rounded-full mx-auto mt-2" />
        </div>

        {/* 2 cards per row on both Desktop & Mobile matching reference */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          {products.map((product: any) => {
            const prodImg = getProductImage(product);
            const price = Number(product.price);
            const originalPrice = product.original_price ? Number(product.original_price) : null;
            const discountAmount = originalPrice && originalPrice > price ? originalPrice - price : 0;

            return (
              <Link
                key={product.id}
                to={`/product/${product.slug}`}
                className="group bg-white rounded-xl md:rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-2.5 sm:p-4 md:p-6 lg:p-7 md:min-h-[250px] lg:min-h-[270px] flex flex-col md:flex-row md:items-center gap-3 sm:gap-4 md:gap-6 lg:gap-7 relative overflow-hidden text-left"
              >
                {/* Badge from Admin - only shown if badge is set */}
                {Boolean(product.badge && product.badge.trim()) && (
                  <span className="absolute top-2 right-2 md:top-3 md:right-3 bg-red-600 text-white text-[9px] sm:text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-2.5 md:py-1 rounded-full flex items-center gap-1 shadow-xs tracking-wide z-10">
                    <Flame className="h-3 w-3 md:h-3.5 md:w-3.5 fill-amber-300 text-amber-300 shrink-0" />
                    <span>{product.badge}</span>
                  </span>
                )}

                {/* Product Image - compact on mobile, larger & taller on desktop */}
                <div className="w-full aspect-square md:w-48 md:h-48 lg:w-56 lg:h-56 bg-slate-50/70 rounded-lg md:rounded-xl overflow-hidden shrink-0 flex items-center justify-center p-2 md:p-3 border border-slate-100 relative">
                  <img
                    src={prodImg}
                    alt={product.name}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {Boolean(product.has_gift && product.gift_title) && (
                    <span className="absolute bottom-2 left-2 bg-emerald-600 text-white text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1 z-10">
                      <Gift className="h-2.5 w-2.5" />
                      <span>{product.gift_charge_enabled ? "গিফট অফার" : "ফ্রি গিফট"}</span>
                    </span>
                  )}
                </div>

                {/* Product Details */}
                <div className="flex-1 min-w-0 flex flex-col justify-between md:justify-center md:py-1">
                  <div>
                    <h3 className="font-semibold text-xs sm:text-sm md:text-base lg:text-lg text-slate-900 group-hover:text-primary transition-colors line-clamp-2 mb-1.5 md:mb-2.5 min-h-[2rem] md:min-h-0 leading-snug">
                      {product.name}
                    </h3>

                    {/* Price row & Savings Badge in Brand Theme */}
                    <div className="flex items-center gap-1.5 md:gap-2.5 flex-wrap mb-2.5 md:mb-4">
                      <span className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-primary">
                        ৳{price.toLocaleString("en-US")}
                      </span>
                      {originalPrice && originalPrice > price && (
                        <span className="text-xs md:text-sm text-slate-400 line-through">
                          ৳{originalPrice.toLocaleString("en-US")}
                        </span>
                      )}
                      {discountAmount > 0 && (
                        <span className="text-[9px] md:text-xs font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 md:px-2 md:py-0.5 rounded-full border border-emerald-200/80">
                          Save ৳{discountAmount.toLocaleString("en-US")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Buttons: Brand colors, stacked on mobile, side-by-side on desktop */}
                  <div className="flex flex-col sm:flex-col md:flex-row items-stretch md:items-center gap-1.5 md:gap-2.5 mt-auto pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full md:flex-1 h-8 md:h-10 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-medium text-xs md:text-sm rounded-md transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                      onClick={(e) => handleAddToCart(e, product)}
                    >
                      <ShoppingCart className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                      <span className="truncate">Add To Cart</span>
                    </Button>

                    <Button
                      type="button"
                      className="w-full md:flex-1 h-8 md:h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs md:text-sm rounded-md transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98]"
                      onClick={(e) => handleBuyNow(e, product)}
                    >
                      <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 fill-current" />
                      <span className="truncate">Buy now</span>
                    </Button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TopSellingProducts;
