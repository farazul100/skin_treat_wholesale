import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  quantity: number;
  has_gift?: boolean;
  gift_title?: string;
  gift_image?: string;
  gift_price?: number;
  gift_charge_enabled?: boolean;
}

export interface AppliedCoupon {
  code: string;
  discountType: "fixed" | "percentage";
  discountValue: number;
  discountAmount: number;
  productId?: string;
  minSpend?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, qty?: number, openDrawer?: boolean) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  getItemUnitPrice: (item: CartItem) => number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  appliedCoupon: AppliedCoupon | null;
  applyCoupon: (code: string) => Promise<{ success: boolean; message: string; discount?: number }>;
  removeCoupon: () => void;
  discountAmount: number;
  finalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(() => {
    try {
      const saved = localStorage.getItem("applied_coupon");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);
  const toggleCart = () => setIsCartOpen((prev) => !prev);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const getItemUnitPrice = (item: CartItem) => {
    const base = Number(item.price) || 0;
    const giftExtra = (item.has_gift && item.gift_charge_enabled) ? Number(item.gift_price || 0) : 0;
    return base + giftExtra;
  };

  const addItem = (item: Omit<CartItem, "quantity">, qty = 1, openDrawer = true) => {
    const safeQty = Math.max(1, qty);
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => i.id === item.id ? { 
          ...i, 
          quantity: i.quantity + safeQty,
          image: item.image || i.image,
          has_gift: item.has_gift !== undefined ? item.has_gift : i.has_gift,
          gift_title: item.gift_title || i.gift_title,
          gift_image: item.gift_image || i.gift_image,
          gift_price: item.gift_price !== undefined ? item.gift_price : i.gift_price,
          gift_charge_enabled: item.gift_charge_enabled !== undefined ? item.gift_charge_enabled : i.gift_charge_enabled,
        } : i);
      }
      return [...prev, { ...item, quantity: safeQty }];
    });
    if (openDrawer) {
      setIsCartOpen(true);
    }
    // Facebook Pixel AddToCart
    const effectivePrice = getItemUnitPrice({ ...item, quantity: safeQty } as CartItem);
    window.fbq?.("track", "AddToCart", {
      content_name: item.name,
      content_ids: [item.id],
      content_type: "product",
      value: effectivePrice,
      currency: "BDT",
    });
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity } : i));
  };

  const clearCart = () => {
    setItems([]);
    setAppliedCoupon(null);
    localStorage.removeItem("applied_coupon");
  };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + getItemUnitPrice(i) * i.quantity, 0);

  const discountAmount = useMemo(() => {
    if (!appliedCoupon || totalPrice <= 0) return 0;
    if (appliedCoupon.minSpend && totalPrice < appliedCoupon.minSpend) return 0;
    if (appliedCoupon.discountType === "percentage") {
      return Math.round(totalPrice * (appliedCoupon.discountValue / 100));
    }
    return Math.min(appliedCoupon.discountValue, totalPrice);
  }, [appliedCoupon, totalPrice]);

  const finalPrice = Math.max(0, totalPrice - discountAmount);

  const applyCoupon = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      return { success: false, message: "দয়া করে একটি কুপন কোড লিখুন" };
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, coupon_enabled, coupon_code, coupon_discount_type, coupon_discount_value, coupon_min_spend, coupon_expiry_date")
        .eq("coupon_enabled", true);

      if (error) throw error;

      const matched = data?.find(
        (p: any) => p.coupon_code && p.coupon_code.trim().toUpperCase() === code
      );

      if (!matched) {
        return { success: false, message: "অবৈধ কুপন কোড। সঠিক কোডটি পুনরায় চেক করুন।" };
      }

      // Check expiry date
      if (matched.coupon_expiry_date) {
        const expiry = new Date(matched.coupon_expiry_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expiry.getTime() < today.getTime()) {
          return { success: false, message: "এই কুপন কোডটির মেয়াদ শেষ হয়ে গেছে।" };
        }
      }

      // Check min spend
      const minSpend = Number(matched.coupon_min_spend || 0);
      if (minSpend > 0 && totalPrice < minSpend) {
        return {
          success: false,
          message: `এই কুপনটির জন্য সর্বনিম্ন ৳${minSpend.toLocaleString()} টাকার অর্ডার প্রয়োজন।`,
        };
      }

      const discType = (matched.coupon_discount_type || "fixed") as "fixed" | "percentage";
      const discVal = Number(matched.coupon_discount_value || 0);
      let calculatedDiscount = 0;
      if (discType === "percentage") {
        calculatedDiscount = Math.round(totalPrice * (discVal / 100));
      } else {
        calculatedDiscount = Math.min(discVal, totalPrice);
      }

      const couponObj: AppliedCoupon = {
        code,
        discountType: discType,
        discountValue: discVal,
        discountAmount: calculatedDiscount,
        productId: matched.id,
        minSpend,
      };

      setAppliedCoupon(couponObj);
      localStorage.setItem("applied_coupon", JSON.stringify(couponObj));

      return {
        success: true,
        message: `কুপন '${code}' সফলভাবে যুক্ত হয়েছে! ৳${calculatedDiscount.toLocaleString()} ছাড় পেয়েছেন।`,
        discount: calculatedDiscount,
      };
    } catch (err: any) {
      return { success: false, message: err.message || "কুপন যাচাই ব্যর্থ হয়েছে" };
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    localStorage.removeItem("applied_coupon");
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        getItemUnitPrice,
        isCartOpen,
        openCart,
        closeCart,
        toggleCart,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        discountAmount,
        finalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};
