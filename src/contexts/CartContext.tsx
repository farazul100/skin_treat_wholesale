import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  getItemUnitPrice: (item: CartItem) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("cart");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const getItemUnitPrice = (item: CartItem) => {
    const base = Number(item.price) || 0;
    const giftExtra = (item.has_gift && item.gift_charge_enabled) ? Number(item.gift_price || 0) : 0;
    return base + giftExtra;
  };

  const addItem = (item: Omit<CartItem, "quantity">, qty = 1) => {
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

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + getItemUnitPrice(i) * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, getItemUnitPrice }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};
