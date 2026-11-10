import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ShoppingCart, Minus, Plus, Trash2, AlertTriangle, AlertCircle, Loader2, Gift } from "lucide-react";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const getSessionId = () => {
  let id = sessionStorage.getItem("checkout_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("checkout_session_id", id);
  }
  return id;
};

const resolveItemImage = (img?: any) => {
  if (!img) return "/placeholder.svg";
  if (typeof img === "string") {
    const trimmed = img.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed) && parsed[0]) return parsed[0];
      } catch {}
    }
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    if (trimmed.length > 0) return trimmed;
  }
  if (Array.isArray(img) && img[0]) return img[0];
  return "/placeholder.svg";
};

const Checkout = () => {
  const { items, totalPrice, clearCart, updateQuantity, removeItem } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState("dhaka");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const incompleteIdRef = useRef<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
  });

  const { data: settings } = useQuery({
    queryKey: ["site-settings-public"],
    queryFn: async () => {
      const keys = ["delivery_charge", "payment_gateway", "partial_payment_percent"];
      const map: Record<string, any> = {};
      await Promise.all(
        keys.map(async (k) => {
          const { data } = await supabase.rpc("get_public_setting", { _key: k });
          map[k] = data;
        })
      );
      return map;
    },
  });

  const { data: cartProducts, isLoading: isProductsLoading } = useQuery({
    queryKey: ["cart-products-checkout", items.map(i => i.id).join(",")],
    queryFn: async () => {
      if (items.length === 0) return [];
      const { data } = await supabase.from("products").select("id, delivery_type, delivery_inside_dhaka, delivery_outside_dhaka, delivery_nationwide, payment_requirement, is_separate_delivery").in("id", items.map(i => i.id));
      return data || [];
    },
    enabled: items.length > 0,
  });

  const globalInside = settings?.delivery_charge?.inside_dhaka ?? 60;
  const globalOutside = settings?.delivery_charge?.outside_dhaka ?? settings?.delivery_charge?.nationwide ?? 120;

  let insideCharge = Number(globalInside);
  let outsideCharge = Number(globalOutside);
  
  if (cartProducts && cartProducts.length > 0) {
    let maxBaseInside = 0;
    let maxBaseOutside = 0;
    let separateInsideTotal = 0;
    let separateOutsideTotal = 0;
    let hasBaseProducts = false;

    // Create a map from productId to its cart item quantity
    const quantityByProductId: Record<string, number> = {};
    items.forEach((item) => {
      quantityByProductId[item.id] = (quantityByProductId[item.id] || 0) + (Number(item.quantity) || 1);
    });

    cartProducts.forEach((p) => {
      let currIn = Number(globalInside);
      let currOut = Number(globalOutside);
      if (p.delivery_type === "custom") {
        currIn = Number(p.delivery_inside_dhaka ?? globalInside);
        currOut = Number(p.delivery_outside_dhaka ?? p.delivery_nationwide ?? globalOutside);
      }

      const isSeparate = p.is_separate_delivery === true || p.is_separate_delivery === 1 || p.is_separate_delivery === "1";
      const qty = quantityByProductId[p.id] || 1;

      if (isSeparate) {
        // When separate delivery is enabled, delivery charge multiplies by product quantity (e.g. 3 * 2 = 6)
        separateInsideTotal += currIn * qty;
        separateOutsideTotal += currOut * qty;
      } else {
        // When separate delivery is off, base delivery charge applies once (e.g. 3) regardless of quantity
        hasBaseProducts = true;
        if (currIn > maxBaseInside) maxBaseInside = currIn;
        if (currOut > maxBaseOutside) maxBaseOutside = currOut;
      }
    });

    insideCharge = separateInsideTotal + (hasBaseProducts ? maxBaseInside : 0);
    outsideCharge = separateOutsideTotal + (hasBaseProducts ? maxBaseOutside : 0);
  }

  const deliveryCharge = city === "dhaka" ? insideCharge : outsideCharge;

  // Multi-product payment rules evaluation:
  // If ANY product in the cart strictly requires advance payment (does not allow COD),
  // then COD is completely disabled for the entire cart!
  let canCOD = true;
  let hasFullAdvanceRequirement = false;
  let hasDeliveryAdvanceRequirement = false;
  const restrictedProducts: string[] = [];

  if (cartProducts && cartProducts.length > 0) {
    cartProducts.forEach(p => {
      const raw = p.payment_requirement ? String(p.payment_requirement).trim() : "";
      const pMethods = raw ? raw.split(",").map((s: string) => s.trim()).filter(Boolean) : ["cod"];
      
      const allowsCOD = pMethods.includes("cod");
      const allowsDelAdv = pMethods.includes("delivery_advance");
      const allowsFull = pMethods.includes("full_advance");

      // If this product does NOT allow COD:
      if (!allowsCOD) {
        canCOD = false;
        const matchingItem = items.find(i => i.id === p.id);
        if (matchingItem && !restrictedProducts.includes(matchingItem.name)) {
          restrictedProducts.push(matchingItem.name);
        }

        if (allowsFull && !allowsDelAdv) {
          hasFullAdvanceRequirement = true;
        } else {
          hasDeliveryAdvanceRequirement = true;
        }
      }
    });
  }

  // Allowed methods based on strictest constraint:
  let allowedMethods: string[] = [];
  if (canCOD) {
    // All products in cart allow COD
    allowedMethods = ["cod", "delivery_advance", "full_advance"];
  } else if (hasFullAdvanceRequirement) {
    // Strictest: At least one product strictly requires 100% advance payment
    allowedMethods = ["full_advance"];
  } else {
    // At least one product requires delivery charge in advance
    allowedMethods = ["delivery_advance", "full_advance"];
  }

  const reqFull = !canCOD && hasFullAdvanceRequirement;
  const reqAdvance = !canCOD && !reqFull;

  const grandTotal = Number(totalPrice) + Number(deliveryCharge);
  const isPaymentEnabled = typeof settings?.payment_gateway === "string" 
    ? (JSON.parse(settings.payment_gateway)?.enabled || false)
    : (settings?.payment_gateway?.enabled || false);
  let partialAmount = 0;
  if (paymentMethod === "delivery_advance") {
    partialAmount = deliveryCharge;
  } else if (paymentMethod === "full_advance" || paymentMethod === "full" || paymentMethod === "eps") {
    partialAmount = grandTotal;
  }

  // Advance payment requirement evaluation
  const requiresAdvance = !canCOD || paymentMethod === "delivery_advance" || paymentMethod === "full_advance";
  const requiredAdvanceAmount = (paymentMethod === "full_advance" || reqFull) ? grandTotal : deliveryCharge;
  const advanceTypeLabel = (paymentMethod === "full_advance" || reqFull) ? "সম্পূর্ণ মূল্য" : "ডেলিভারি চার্জ";

  useEffect(() => {
    const valid = isPaymentEnabled ? [...allowedMethods, "eps"] : allowedMethods;
    if (!valid.includes(paymentMethod)) {
      setPaymentMethod(allowedMethods[0] || "cod");
    }
  }, [allowedMethods.join(","), paymentMethod, isPaymentEnabled]);

  // Save incomplete order data
  const saveIncompleteOrder = useCallback(async (currentForm: typeof form) => {
    const sessionId = getSessionId();
    const payload = {
      session_id: sessionId,
      customer_name: currentForm.name?.trim() || null,
      customer_phone: currentForm.phone?.trim() || null,
      shipping_address: currentForm.address?.trim() || null,
      city: city === "dhaka" ? "ঢাকার ভেতর" : "ঢাকার বাইরে",
      cart_items: items.map(i => ({ 
        id: i.id, 
        name: i.name, 
        price: i.price, 
        quantity: i.quantity,
        has_gift: i.has_gift,
        gift_title: i.gift_title,
        gift_image: i.gift_image,
        gift_price: i.gift_price,
        gift_charge_enabled: i.gift_charge_enabled,
      })),
      cart_total: totalPrice,
      last_activity: new Date().toISOString(),
    };

    try {
      const storedId = incompleteIdRef.current || sessionStorage.getItem("incomplete_order_id");
      if (storedId) {
        incompleteIdRef.current = storedId;
        await supabase.from("incomplete_orders").update(payload).eq("id", storedId);
      } else {
        const { data } = await supabase.from("incomplete_orders").insert(payload).select("id").single();
        if (data?.id) {
          incompleteIdRef.current = data.id;
          sessionStorage.setItem("incomplete_order_id", data.id);
        }
      }
    } catch (err) {
      console.error("Failed to save incomplete order:", err);
    }
  }, [items, totalPrice, city]);

  // Save immediately on first load
  const initialSaveRef = useRef(false);
  useEffect(() => {
    if (items.length === 0 || initialSaveRef.current) return;
    initialSaveRef.current = true;
    saveIncompleteOrder(form);
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fast debounced save on form change (400ms instead of 1500ms)
  useEffect(() => {
    if (items.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveIncompleteOrder(form);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.name, form.phone, form.address, city, items, saveIncompleteOrder]);

  // Capture immediately if user switches tab / app or closes window
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && (form.name || form.phone || form.address)) {
        saveIncompleteOrder(form);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [form, saveIncompleteOrder]);

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopBar /><Header />
        <div className="flex-1 flex items-center justify-center flex-col gap-4 px-4 py-16">
          <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
          <h1 className="text-xl font-bold text-foreground">কার্ট খালি</h1>
          <Link to="/"><Button>কেনাকাটা করুন</Button></Link>
        </div>
        <Footer />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = form.name.trim();
    const cleanPhone = form.phone.replace(/[^\d+]/g, "").trim();
    const cleanAddress = form.address.trim();
    if (!cleanName || !cleanPhone || !cleanAddress) {
      toast.error("সকল প্রয়োজনীয় তথ্য পূরণ করুন");
      return;
    }
    if (cleanPhone.length < 11) {
      toast.error("সঠিক মোবাইল নম্বর দিন (১১ সংখ্যা)");
      return;
    }

    if (isProductsLoading) {
      toast.error("পণ্যের তথ্য যাচাই করা হচ্ছে, অনুগ্রহ করে একটু অপেক্ষা করুন...");
      return;
    }

    // Explicit check: If advance payment is required, but no payment method/gateway is enabled, block order completely
    if (requiresAdvance && !isPaymentEnabled) {
      const productInfo = restrictedProducts.length > 0 ? `কার্টের "${restrictedProducts.join(", ")}" পণ্যের` : "এই পণ্যের";
      toast.error(
        `অর্ডার করা সম্ভব নয়: ${productInfo} শর্ত অনুযায়ী অগ্রিম ${advanceTypeLabel} ৳${requiredAdvanceAmount} পরিশোধ করা বাধ্যতামূলক, কিন্তু টাকা নেওয়ার মতো কোনো অনলাইন পেমেন্ট মেথড (যেমন বিকাশ/নগদ/EPS) সক্রিয় নেই।`,
        { duration: 12000 }
      );
      return;
    }

    // Facebook Pixel - InitiateCheckout
    window.fbq?.("track", "InitiateCheckout", {
      value: grandTotal,
      currency: "BDT",
      num_items: items.length,
    });
    setLoading(true);
    try {
      const orderId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const orderPayload: any = {
        id: orderId,
        user_id: user?.id && user.id !== "admin-user" ? user.id : null,
        customer_name: cleanName,
        customer_phone: cleanPhone,
        shipping_address: cleanAddress,
        city: "বাংলাদেশ",
        subtotal: totalPrice,
        delivery_charge: deliveryCharge,
        total: grandTotal,
        partial_payment: partialAmount,
        due_amount: grandTotal - partialAmount,
        payment_method: paymentMethod,
      };

      const { data: order, error } = await supabase.from("orders").insert(orderPayload).select().single();

      if (error) throw error;

      const finalOrderId = order?.id || orderId;

      const orderItems = items.map((item) => {
        const giftExtra = (item.has_gift && item.gift_charge_enabled) ? Number(item.gift_price || 0) : 0;
        const effectivePrice = Number(item.price) + giftExtra;
        return {
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          order_id: finalOrderId,
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: effectivePrice,
          total: effectivePrice * item.quantity,
          has_gift: item.has_gift ? 1 : 0,
          gift_title: item.gift_title || null,
          gift_image: item.gift_image || null,
          gift_price: Number(item.gift_price || 0),
          gift_charge_enabled: item.gift_charge_enabled ? 1 : 0,
        };
      });

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      // Mark incomplete order as converted (non-critical)
      const convIncompleteId = incompleteIdRef.current || sessionStorage.getItem("incomplete_order_id");
      if (convIncompleteId) {
        try {
          await supabase.from("incomplete_orders").update({ is_converted: true }).eq("id", convIncompleteId);
          sessionStorage.removeItem("incomplete_order_id");
          sessionStorage.removeItem("checkout_session_id");
        } catch (e) { console.warn("incomplete update failed", e); }
      }

      // Send webhook (fire and forget, non-critical)
      try {
        if (settings?.order_webhook?.enabled && settings?.order_webhook?.url) {
          supabase.functions.invoke("order-webhook", {
            body: { order_id: finalOrderId },
          }).catch((err) => console.error("Webhook failed:", err));
        }
      } catch (e) { console.warn("webhook invoke failed", e); }

      // If customer chose online payment (EPS)
      if (paymentMethod === "eps" || ((paymentMethod === "delivery_advance" || paymentMethod === "full_advance") && isPaymentEnabled)) {
        try {
          const payRes = await fetch("/api/eps/initiate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: finalOrderId }),
          });
          const payData = await payRes.json();
          if (payRes.ok && payData.redirect_url) {
            clearCart();
            sessionStorage.removeItem("checkout_session_id");
            toast.success("পেমেন্ট গেটওয়েতে নিয়ে যাওয়া হচ্ছে...");
            window.location.href = payData.redirect_url;
            return;
          } else {
            console.error("EPS initiate error:", payData);
            if (requiresAdvance) {
              toast.error(
                `পেমেন্ট সমস্যা: ${payData.error || "পেমেন্ট গেটওয়েতে সংযোগ করা যায়নি"}। এই অর্ডারের জন্য অগ্রিম ${advanceTypeLabel} ৳${requiredAdvanceAmount} পরিশোধ বাধ্যতামূলক, তাই অর্ডারটি সম্পন্ন হয়নি।`,
                { duration: 12000 }
              );
              try { await supabase.from("orders").update({ payment_status: "failed", order_status: "cancelled" }).eq("id", finalOrderId); } catch (e) {}
              return;
            } else {
              toast.error(payData.error || "পেমেন্ট গেটওয়ে সংযোগে সমস্যা, তবে আপনার অর্ডার সফলভাবে সংরক্ষিত হয়েছে।");
              clearCart();
              sessionStorage.removeItem("checkout_session_id");
              navigate(`/order-success/${finalOrderId}?payment=failed`);
              return;
            }
          }
        } catch (payErr: any) {
          console.error("EPS initiate error:", payErr);
          if (requiresAdvance) {
            toast.error(
              `পেমেন্ট গেটওয়ে সংযোগে সমস্যা হয়েছে। অগ্রিম ${advanceTypeLabel} ৳${requiredAdvanceAmount} পরিশোধ ছাড়া অর্ডার সম্পন্ন করা সম্ভব নয়।`,
              { duration: 12000 }
            );
            try { await supabase.from("orders").update({ payment_status: "failed", order_status: "cancelled" }).eq("id", finalOrderId); } catch (e) {}
            return;
          } else {
            toast.error("পেমেন্ট গেটওয়েতে সংযোগ সমস্যা");
            clearCart();
            sessionStorage.removeItem("checkout_session_id");
            navigate(`/order-success/${finalOrderId}?payment=failed`);
            return;
          }
        }
      }

      clearCart();
      sessionStorage.removeItem("checkout_session_id");
      // Facebook Pixel - Purchase (non-critical)
      try {
        window.fbq?.("track", "Purchase", {
          value: grandTotal,
          currency: "BDT",
          content_ids: items.map((i) => i.id),
          content_type: "product",
          num_items: items.length,
        });
      } catch (e) { console.warn("fbq failed", e); }
      toast.success("অর্ডার সফল হয়েছে!");
      navigate(`/order-success/${finalOrderId}`);
    } catch (err: any) {
      let msg = err?.message || err?.error_description || err?.details || err?.hint;
      if (!msg) {
        try { msg = JSON.stringify(err); } catch { msg = "অজানা সমস্যা"; }
      }
      toast.error(`অর্ডার সমস্যা: ${msg}`, { duration: 10000 });
      console.error("Order error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar /><Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground mb-6">চেকআউট</h1>
          <form onSubmit={handleSubmit}>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Customer Info */}
                <div className="bg-card border rounded-xl p-5">
                  <h3 className="font-bold text-foreground mb-4">ডেলিভারি তথ্য</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">নাম *</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        onBlur={() => saveIncompleteOrder(form)}
                        placeholder="আপনার নাম"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">মোবাইল নম্বর *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        onBlur={() => saveIncompleteOrder(form)}
                        placeholder="01XXXXXXXXX"
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label htmlFor="address">সম্পূর্ণ ঠিকানা *</Label>
                    <Textarea
                      id="address"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      onBlur={() => saveIncompleteOrder(form)}
                      placeholder="বাসা নং, রোড, এলাকা, জেলা"
                      required
                      rows={2}
                    />
                  </div>
                </div>

                {/* Delivery Charge Info Card */}
                <div className="bg-card border rounded-xl p-5">
                  <h3 className="font-bold text-foreground mb-4">ডেলিভারি এরিয়া</h3>
                  <RadioGroup
                    value={city}
                    onValueChange={(val) => {
                      setCity(val);
                      saveIncompleteOrder(form);
                    }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-3 border rounded-lg p-3">
                      <RadioGroupItem value="dhaka" id="dhaka" />
                      <Label htmlFor="dhaka" className="cursor-pointer flex-1 flex justify-between items-center">
                        <span className="font-medium">ঢাকার ভেতর</span>
                        <span className="font-bold text-primary">৳{insideCharge}</span>
                      </Label>
                    </div>
                    <div className="flex items-center gap-3 border rounded-lg p-3">
                      <RadioGroupItem value="outside" id="outside" />
                      <Label htmlFor="outside" className="cursor-pointer flex-1 flex justify-between items-center">
                        <span className="font-medium">ঢাকার বাহিরে</span>
                        <span className="font-bold text-primary">৳{outsideCharge}</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Payment */}
                <div className="bg-card border rounded-xl p-5">
                  <h3 className="font-bold text-foreground mb-4">পেমেন্ট পদ্ধতি</h3>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                    
                    {allowedMethods.includes("cod") && (
                      <div className="flex items-center gap-3 border rounded-lg p-3">
                        <RadioGroupItem value="cod" id="cod" />
                        <Label htmlFor="cod" className="cursor-pointer flex-1">
                          <span className="text-base font-bold text-foreground">ক্যাশ অন ডেলিভারি (COD)</span>
                          <p className="text-sm text-muted-foreground mt-0.5">পণ্য হাতে পেয়ে, দেখে, বুঝে তারপরে পেমেন্ট করুন।</p>
                        </Label>
                      </div>
                    )}

                    {isPaymentEnabled && (
                      <div className="flex items-center gap-3 border rounded-lg p-3.5 bg-primary/5 border-primary/25">
                        <RadioGroupItem value="eps" id="eps" />
                        <Label htmlFor="eps" className="cursor-pointer flex-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-base font-bold text-foreground">
                              অনলাইন পেমেন্ট (EPS)
                            </span>
                            <span className="text-[11px] bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full">
                              বিকাশ • নগদ • রকেট • কার্ড
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            বিকাশ, নগদ, রকেট, ডেবিট/ক্রেডিট কার্ড বা ব্যাংকের মাধ্যমে সরাসরি সুরক্ষিত পেমেন্ট করুন।
                          </p>
                        </Label>
                      </div>
                    )}

                    {allowedMethods.includes("delivery_advance") && (
                      <div className={cn(
                        "flex items-center gap-3 border rounded-lg p-3 transition-colors",
                        !isPaymentEnabled && "border-destructive/40 bg-destructive/5"
                      )}>
                        <RadioGroupItem value="delivery_advance" id="delivery_advance" />
                        <Label htmlFor="delivery_advance" className="cursor-pointer flex-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-base font-bold text-foreground">ডেলিভারি চার্জ অ্যাডভান্স করুন</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              অগ্রিম ৳{deliveryCharge}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {isPaymentEnabled 
                              ? "বিকাশ, নগদ বা রকেটের মাধ্যমে নিরাপদে ডেলিভারি চার্জ পেমেন্ট করুন।" 
                              : "⚠️ টাকা নেওয়ার কোনো অনলাইন পেমেন্ট মেথড বা গেটওয়ে সক্রিয় নেই।"}
                          </p>
                        </Label>
                      </div>
                    )}

                    {allowedMethods.includes("full_advance") && (
                      <div className={cn(
                        "flex items-center gap-3 border rounded-lg p-3 transition-colors",
                        !isPaymentEnabled && "border-destructive/40 bg-destructive/5"
                      )}>
                        <RadioGroupItem value="full_advance" id="full_advance" />
                        <Label htmlFor="full_advance" className="cursor-pointer flex-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-base font-bold text-foreground">সম্পূর্ণ টাকা অ্যাডভান্স (প্রিপেইড)</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              অগ্রিম ৳{grandTotal}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {isPaymentEnabled 
                              ? "বিকাশ, নগদ বা রকেটের মাধ্যমে সম্পূর্ণ টাকা পেমেন্ট করুন।" 
                              : "⚠️ টাকা নেওয়ার কোনো অনলাইন পেমেন্ট মেথড বা গেটওয়ে সক্রিয় নেই।"}
                          </p>
                        </Label>
                      </div>
                    )}
                    
                  </RadioGroup>

                  {/* Prominent Advance Payment Warning Banner */}
                  {requiresAdvance && !isPaymentEnabled && (
                    <div className="bg-destructive/10 border-2 border-destructive/30 rounded-xl p-4 text-destructive space-y-2 mt-4">
                      <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
                        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                        <span>অগ্রিম পেমেন্ট মেথড অনুপস্থিত (অর্ডার সম্ভব নয়)</span>
                      </div>
                      <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                        {restrictedProducts.length > 0 ? (
                          <>কার্টের <strong className="text-foreground font-semibold">"{restrictedProducts.join(", ")}"</strong> পণ্যের শর্ত অনুযায়ী অগ্রিম <strong className="text-destructive font-bold">{advanceTypeLabel} ৳{requiredAdvanceAmount}</strong> পরিশোধ করা বাধ্যতামূলক।</>
                        ) : (
                          <>এই পণ্যের শর্ত অনুযায়ী অগ্রিম <strong className="text-destructive font-bold">{advanceTypeLabel} ৳{requiredAdvanceAmount}</strong> পরিশোধ করা বাধ্যতামূলক।</>
                        )} কিন্তু বর্তমানে সাইটে টাকা নেওয়ার মতো কোনো অনলাইন পেমেন্ট মেথড (যেমন EPS / বিকাশ / নগদ) সক্রিয় করা নেই।
                      </p>
                      <div className="bg-background/80 rounded-lg p-2.5 text-xs font-semibold border border-destructive/20 text-destructive flex items-center justify-between">
                        <span>প্রয়োজনীয় অগ্রিম পরিমাণ:</span>
                        <span className="text-sm font-bold">৳{requiredAdvanceAmount}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground pt-1">
                        (অ্যাডমিন প্যানেল &gt; সেটিংস &gt; পেমেন্ট গেটওয়ে চালু করলে গ্রাহক এই ৳{requiredAdvanceAmount} পেমেন্ট করে অর্ডার সম্পন্ন করতে পারবেন।)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-card border rounded-xl p-5 h-fit sticky top-4">
                <h3 className="font-bold text-foreground mb-4">অর্ডার সারাংশ</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {items.map((item) => {
                    const giftExtra = (item.has_gift && item.gift_charge_enabled) ? Number(item.gift_price || 0) : 0;
                    const itemUnitPrice = Number(item.price) + giftExtra;
                    const itemRowTotal = itemUnitPrice * item.quantity;

                    return (
                      <div key={item.id} className="flex flex-col gap-2 text-sm bg-secondary/20 p-2.5 rounded-lg border border-border/60">
                        <div className="flex gap-2.5 items-center">
                          <div className="w-12 h-12 rounded-md overflow-hidden bg-white border border-border/50 flex-shrink-0 flex items-center justify-center p-0.5">
                            <img
                              src={resolveItemImage(item.image)}
                              alt={item.name}
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder.svg";
                              }}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="line-clamp-1 font-medium text-foreground text-xs sm:text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              ৳{item.price}
                              {giftExtra > 0 && <span className="text-primary font-semibold"> + ৳{giftExtra} (উপহার)</span>}
                              {" "}x {item.quantity}
                            </p>
                            
                            {/* Quantity Stepper & Remove Controls */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <div className="flex items-center border border-border/80 rounded-md bg-background">
                                <button
                                  type="button"
                                  className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-l-md transition-colors cursor-pointer"
                                  onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                  title="পরিমাণ কমান"
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-7 text-center text-xs font-semibold">{item.quantity}</span>
                                <button
                                  type="button"
                                  className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-r-md transition-colors cursor-pointer"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  title="পরিমাণ বাড়ান"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>

                              <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors cursor-pointer"
                                onClick={() => removeItem(item.id)}
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <span className="font-bold text-foreground text-sm flex-shrink-0">
                            ৳{itemRowTotal}
                          </span>
                        </div>

                        {/* Gift Info Card if product has gift */}
                        {Boolean(item.has_gift && item.gift_title) && (
                          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-md p-2 flex items-center gap-2.5 mt-0.5">
                            <div className="w-9 h-9 rounded bg-white flex-shrink-0 flex items-center justify-center overflow-hidden border border-emerald-200 p-0.5 shadow-2xs">
                              {item.gift_image ? (
                                <img src={resolveItemImage(item.gift_image)} alt="" className="w-full h-full object-contain" />
                              ) : (
                                <Gift className="h-4 w-4 text-emerald-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-white bg-emerald-600 px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <Gift className="h-2.5 w-2.5" />
                                  {item.gift_charge_enabled ? "স্পেশাল গিফট" : "ফ্রি উপহার"}
                                </span>
                                <span className="text-xs font-semibold text-foreground truncate">{item.gift_title}</span>
                              </div>
                              <div className="text-[11px] mt-0.5">
                                {item.gift_charge_enabled ? (
                                  <span className="text-primary font-bold">
                                    +৳{Number(item.gift_price || 0)} (মূল্যের সাথে যোগ হয়েছে)
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-muted-foreground line-through font-medium">৳{Number(item.gift_price || 0)}</span>
                                    <span className="font-bold text-emerald-700 bg-emerald-100 px-1 rounded">৳০ (ফ্রি!)</span>
                                    <span className="text-[10px] text-muted-foreground">({Number(item.gift_price || 0)} টাকার গিফট ফ্রি পাচ্ছেন)</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t mt-4 pt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">সাবটোটাল</span><span>৳{totalPrice}</span></div>
                  {items.some(i => i.has_gift && !i.gift_charge_enabled && Number(i.gift_price) > 0) && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span className="flex items-center gap-1">
                        <Gift className="h-3.5 w-3.5" /> ফ্রি গিফট সেভিংস
                      </span>
                      <span>
                        -৳{items.reduce((s, it) => s + ((it.has_gift && !it.gift_charge_enabled ? Number(it.gift_price || 0) : 0) * it.quantity), 0)} (ফ্রি)
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between"><span className="text-muted-foreground">ডেলিভারি চার্জ</span><span>৳{deliveryCharge}</span></div>
                  {paymentMethod !== "cod" && partialAmount > 0 && paymentMethod !== "eps" && (
                    <div className="flex justify-between text-primary"><span>অ্যাডভান্স পেমেন্ট</span><span>৳{partialAmount}</span></div>
                  )}
                  {paymentMethod === "eps" && (
                    <div className="flex justify-between text-primary font-medium"><span>অনলাইন প্রিপেইড</span><span>৳{grandTotal}</span></div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-bold text-base">
                    <span>মোট</span><span className="text-primary">৳{grandTotal}</span>
                  </div>
                  {paymentMethod !== "cod" && paymentMethod !== "eps" && grandTotal > partialAmount && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>বাকি (COD)</span><span>৳{grandTotal - partialAmount}</span>
                    </div>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className={cn(
                    "w-full mt-4 text-base font-bold py-6 shadow-md transition-all",
                    requiresAdvance && !isPaymentEnabled && "bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
                  )} 
                  size="lg" 
                  disabled={loading}
                >
                  {loading 
                    ? "প্রসেস হচ্ছে..." 
                    : requiresAdvance && !isPaymentEnabled 
                    ? `অগ্রিম ৳${requiredAdvanceAmount} পেমেন্ট মেথড নেই (অর্ডার বন্ধ)`
                    : paymentMethod === "eps" 
                    ? "অনলাইনে পেমেন্ট করুন" 
                    : paymentMethod === "delivery_advance"
                    ? `ডেলিভারি চার্জ (৳${deliveryCharge}) দিয়ে অর্ডার করুন`
                    : paymentMethod === "full_advance"
                    ? `সম্পূর্ণ টাকা (৳${grandTotal}) দিয়ে অর্ডার করুন`
                    : "অর্ডার কনফার্ম করুন"}
                </Button>
                {requiresAdvance && !isPaymentEnabled && (
                  <p className="text-xs text-destructive text-center font-medium mt-2">
                    ⚠️ অগ্রিম ৳{requiredAdvanceAmount} নেওয়ার পেমেন্ট গেটওয়ে সক্রিয় না থাকায় অর্ডার কনফার্ম করা যাবে না।
                  </p>
                )}
                {!user && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    একাউন্ট আছে? <Link to="/auth" className="text-primary underline">লগইন করুন</Link>
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Checkout;
