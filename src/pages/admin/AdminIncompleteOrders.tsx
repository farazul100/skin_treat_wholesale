import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Clock, Phone, User, MapPin, Trash2, ShoppingCart, Download, CheckSquare, Square, ArrowRight, BarChart3, PhoneCall, Copy, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const timeAgo = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "এইমাত্র";
  if (mins < 60) return `${mins} মিনিট আগে`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ঘণ্টা আগে`;
  return `${Math.floor(hours / 24)} দিন আগে`;
};

const AdminIncompleteOrders = () => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [convertDialog, setConvertDialog] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });
  const [convertForm, setConvertForm] = useState({ name: "", phone: "", address: "", city: "" });
  const [bulkConvertDialog, setBulkConvertDialog] = useState(false);
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);

  const openConvertDialog = (order: any) => {
    setConvertForm({
      name: order.customer_name || "",
      phone: order.customer_phone || "",
      address: order.shipping_address || "",
      city: order.city || "ঢাকা",
    });
    setConvertDialog({ open: true, order });
  };

  const { data: orders } = useQuery({
    queryKey: ["admin-incomplete-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("incomplete_orders")
        .select("*")
        .eq("is_converted", false)
        .order("last_activity", { ascending: false });
      return data || [];
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (typeof supabase?.channel === "function") {
      try {
        const channel = supabase
          .channel("incomplete-orders-realtime")
          .on("postgres_changes", { event: "*", schema: "public", table: "incomplete_orders" }, () => {
            queryClient.invalidateQueries({ queryKey: ["admin-incomplete-orders"] });
            queryClient.invalidateQueries({ queryKey: ["recovery-analytics"] });
          })
          .subscribe();
        return () => {
          if (typeof supabase?.removeChannel === "function") {
            supabase.removeChannel(channel);
          }
        };
      } catch (e) {
        console.warn("Realtime channel not available, using polling:", e);
      }
    }
  }, [queryClient]);

  const convertMutation = useMutation({
    mutationFn: async ({ order, formValues }: { order: any; formValues?: typeof convertForm }) => {
      const name = formValues?.name?.trim() || order.customer_name || "সম্মানিত গ্রাহক";
      const phone = formValues?.phone?.trim() || order.customer_phone;
      const address = formValues?.address?.trim() || order.shipping_address || "ঠিকানা দেওয়া হয়নি";
      const city = formValues?.city?.trim() || order.city || "ঢাকা";

      if (!phone) {
        throw new Error("অর্ডারে রূপান্তর করার জন্য কমপক্ষে একটি মোবাইল নম্বর থাকা প্রয়োজন");
      }
      const cartItems = order.cart_items || [];
      const cartTotal = Number(order.cart_total) || 0;
      const orderId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const { data: newOrder, error } = await supabase.from("orders").insert({
        id: orderId,
        customer_name: name,
        customer_phone: phone,
        customer_email: order.customer_email || null,
        shipping_address: address,
        city: city,
        area: order.area || null,
        subtotal: cartTotal,
        delivery_charge: 60,
        total: cartTotal + 60,
        payment_method: "cod",
        notes: "ইনকমপ্লিট অর্ডার থেকে রিকভার করা হয়েছে",
      }).select().single();
      if (error) throw error;

      const finalOrderId = newOrder?.id || orderId;

      if (cartItems.length > 0) {
        const items = cartItems.map((item: any) => ({
          id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          order_id: finalOrderId,
          product_id: item.id || null,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        }));
        await supabase.from("order_items").insert(items);
      }

      await supabase.from("incomplete_orders").update({ is_converted: true }).eq("id", order.id);
      return newOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-incomplete-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["recovery-analytics"] });
      toast.success("সফলভাবে অর্ডারে রূপান্তর হয়েছে");
      setConvertDialog({ open: false, order: null });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    for (const id of ids) {
      await supabase.from("incomplete_orders").delete().eq("id", id);
    }
    setSelected(new Set());
    setBulkDeleteDialog(false);
    queryClient.invalidateQueries({ queryKey: ["admin-incomplete-orders"] });
    toast.success(`${ids.length}টি ইনকমপ্লিট অর্ডার মুছে ফেলা হয়েছে`);
  };

  const handleBulkConvert = async () => {
    const ids = Array.from(selected);
    const convertible = orders?.filter((o: any) => ids.includes(o.id) && (o.customer_phone || o.customer_name)) || [];
    let successCount = 0;
    for (const order of convertible) {
      try {
        await convertMutation.mutateAsync({ order });
        successCount++;
      } catch {}
    }
    setSelected(new Set());
    setBulkConvertDialog(false);
    toast.success(`${successCount}/${ids.length}টি অর্ডারে রূপান্তর হয়েছে`);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === (orders?.length || 0)) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders?.map((o: any) => o.id)));
    }
  };

  const exportCSV = () => {
    if (!orders?.length) return;
    const headers = ["তারিখ", "সেশন আইডি", "নাম", "ফোন", "ইমেইল", "ঠিকানা", "শহর", "এলাকা", "কার্ট মোট", "পণ্যসমূহ", "সম্পন্ন %", "প্রথম সক্রিয়", "শেষ সক্রিয়"];
    const rows = orders.map((o: any) => {
      const filled = [o.customer_name, o.customer_phone, o.customer_email, o.shipping_address].filter(Boolean).length;
      const items = (o.cart_items || []).map((i: any) => `${i.name} x${i.quantity}`).join("; ");
      return [
        new Date(o.created_at).toLocaleString("bn-BD"),
        o.session_id || "",
        o.customer_name || "",
        o.customer_phone || "",
        o.customer_email || "",
        o.shipping_address || "",
        o.city || "",
        o.area || "",
        Number(o.cart_total) || 0,
        items,
        Math.round((filled / 4) * 100) + "%",
        new Date(o.created_at).toLocaleString("bn-BD"),
        new Date(o.last_activity).toLocaleString("bn-BD"),
      ];
    });
    const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incomplete-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV ডাউনলোড হয়েছে");
  };

  const liveCount = orders?.length || 0;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">ইনকমপ্লিট অর্ডার</h1>
          {liveCount > 0 && (
            <span className="bg-warning/10 text-warning px-2.5 py-0.5 rounded-full text-sm font-bold animate-pulse">
              {liveCount} লাইভ
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/recovery-analytics">
            <Button variant="outline" size="sm" className="gap-1">
              <BarChart3 className="h-4 w-4" /> রিকভারি অ্যানালিটিক্স
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-1" onClick={exportCSV} disabled={!orders?.length}>
            <Download className="h-4 w-4" /> CSV এক্সপোর্ট
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{selected.size}টি নির্বাচিত</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setBulkConvertDialog(true)} className="gap-1">
              <ShoppingCart className="h-3.5 w-3.5" /> অর্ডারে রূপান্তর
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => setBulkDeleteDialog(true)}>
              <Trash2 className="h-3.5 w-3.5" /> মুছে ফেলুন
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>বাতিল</Button>
          </div>
        </div>
      )}

      {orders?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>কোনো ইনকমপ্লিট অর্ডার নেই</p>
        </div>
      ) : (
        <>
          {/* Select All */}
          <div className="flex items-center gap-2 mb-3">
            <Checkbox checked={selected.size === (orders?.length || 0) && liveCount > 0}
              onCheckedChange={toggleAll} />
            <span className="text-sm text-muted-foreground">সবগুলো নির্বাচন</span>
          </div>

          <div className="space-y-3">
            {orders?.map((order: any) => {
              const cartItems = order.cart_items || [];
              const filledFields = [order.customer_name, order.customer_phone, order.customer_email, order.shipping_address].filter(Boolean).length;
              const completionPercent = Math.round((filledFields / 4) * 100);
              const hasContact = Boolean(order.customer_name || order.customer_phone || order.shipping_address);
              const canConvert = Boolean(order.customer_phone || (order.customer_name && order.shipping_address));

              return (
                <div key={order.id} className={`bg-card border rounded-xl p-4 transition-colors ${selected.has(order.id) ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{timeAgo(order.last_activity)}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        completionPercent >= 50 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"
                      }`}>
                        {completionPercent}% সম্পন্ন
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {canConvert && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-primary border-primary/30 hover:bg-primary/10 text-xs font-semibold"
                          onClick={() => openConvertDialog(order)}
                        >
                          <ShoppingCart className="h-3.5 w-3.5" /> অর্ডারে রূপান্তর
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => { if (confirm("মুছে ফেলতে চান?")) supabase.from("incomplete_orders").delete().eq("id", order.id).then(() => { queryClient.invalidateQueries({ queryKey: ["admin-incomplete-orders"] }); toast.success("মুছে ফেলা হয়েছে"); }); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Customer Information Box */}
                  {hasContact ? (
                    <div className="bg-secondary/40 border rounded-lg p-3 my-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-primary flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" /> কাস্টমারের যোগাযোগ তথ্য:
                        </span>
                        {order.customer_phone && (
                          <div className="flex items-center gap-1">
                            <a
                              href={`tel:${order.customer_phone}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                              <PhoneCall className="h-3.5 w-3.5" /> কল করুন
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2 text-sm pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs min-w-[50px]">নাম:</span>
                          <span className="font-semibold text-foreground">
                            {order.customer_name || <span className="text-muted-foreground font-normal italic">দেওয়া হয়নি</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs min-w-[50px]">মোবাইল:</span>
                          {order.customer_phone ? (
                            <div className="flex items-center gap-1.5">
                              <a href={`tel:${order.customer_phone}`} className="font-bold text-primary hover:underline">
                                {order.customer_phone}
                              </a>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground text-xs p-1"
                                title="কপি করুন"
                                onClick={() => { navigator.clipboard.writeText(order.customer_phone); toast.success("নম্বর কপি হয়েছে"); }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">দেওয়া হয়নি</span>
                          )}
                        </div>
                        {order.customer_email && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs min-w-[50px]">ইমেইল:</span>
                            <span className="text-foreground">{order.customer_email}</span>
                          </div>
                        )}
                        <div className="sm:col-span-2 flex items-start gap-2">
                          <span className="text-muted-foreground text-xs min-w-[50px]">ঠিকানা:</span>
                          <span className="text-foreground">
                            {order.shipping_address || <span className="text-muted-foreground italic">দেওয়া হয়নি</span>}
                            {order.city ? ` (${order.city})` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 my-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>কাস্টমার চেকআউট পেজে এসেছিল কিন্তু নাম বা মোবাইল নম্বর টাইপ না করেই চলে গেছে (০% সম্পন্ন)।</span>
                    </div>
                  )}

                  {/* Cart Items */}
                  {cartItems.length > 0 && (
                    <div className="mt-3 pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">কার্টে {cartItems.length}টি পণ্য</p>
                      {cartItems.map((item: any, i: number) => (
                        <p key={i} className="text-sm text-foreground">{item.name} x{item.quantity} = ৳{item.price * item.quantity}</p>
                      ))}
                      <p className="text-sm font-bold text-primary mt-1">মোট: ৳{Number(order.cart_total)}</p>
                    </div>
                  )}

                  {/* Retargeting / Session Info */}
                  <div className="mt-3 pt-2 border-t bg-muted/20 -mx-4 -mb-4 px-4 py-2.5 rounded-b-xl text-xs space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground min-w-[90px]">সেশন আইডি:</span>
                      <code className="font-mono text-foreground break-all bg-background px-1.5 py-0.5 rounded border text-[11px]">
                        {order.session_id}
                      </code>
                      <button
                        type="button"
                        className="text-primary hover:underline shrink-0"
                        onClick={() => { navigator.clipboard.writeText(order.session_id); toast.success("কপি হয়েছে"); }}
                      >
                        কপি
                      </button>
                    </div>
                    <div className="flex gap-4 text-muted-foreground">
                      <span>প্রথম সক্রিয়: <strong className="text-foreground font-normal">{new Date(order.created_at).toLocaleString("bn-BD")}</strong></span>
                      <span>শেষ সক্রিয়: <strong className="text-foreground font-normal">{new Date(order.last_activity).toLocaleString("bn-BD")}</strong></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Convert Confirmation Dialog */}
      <Dialog open={convertDialog.open} onOpenChange={(v) => setConvertDialog({ open: v, order: v ? convertDialog.order : null })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ইনকমপ্লিট অর্ডার রূপান্তর করুন</DialogTitle>
            <DialogDescription>
              কাস্টমারের সাথে কথা বলে তথ্যগুলো নিশ্চিত করে সরাসরি সাধারণ অর্ডারে রূপান্তর করুন।
            </DialogDescription>
          </DialogHeader>
          {convertDialog.order && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label htmlFor="conv-name" className="text-xs">কাস্টমারের নাম *</Label>
                <Input
                  id="conv-name"
                  value={convertForm.name}
                  onChange={(e) => setConvertForm({ ...convertForm, name: e.target.value })}
                  placeholder="কাস্টমারের নাম"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="conv-phone" className="text-xs">মোবাইল নম্বর *</Label>
                <Input
                  id="conv-phone"
                  value={convertForm.phone}
                  onChange={(e) => setConvertForm({ ...convertForm, phone: e.target.value })}
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="conv-address" className="text-xs">ডেলিভারি ঠিকানা</Label>
                <Input
                  id="conv-address"
                  value={convertForm.address}
                  onChange={(e) => setConvertForm({ ...convertForm, address: e.target.value })}
                  placeholder="বাসা নং, রোড, এলাকা, জেলা"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="conv-city" className="text-xs">শহর / এরিয়া</Label>
                <Input
                  id="conv-city"
                  value={convertForm.city}
                  onChange={(e) => setConvertForm({ ...convertForm, city: e.target.value })}
                  placeholder="ঢাকা / ঢাকার বাইরে"
                />
              </div>
              <div className="bg-secondary/50 rounded-lg p-2.5 text-xs flex justify-between items-center">
                <span className="text-muted-foreground">কার্ট মোট মূল্য:</span>
                <span className="font-bold text-primary text-sm">৳{Number(convertDialog.order.cart_total)}</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConvertDialog({ open: false, order: null })}>বাতিল</Button>
            <Button
              onClick={() => convertDialog.order && convertMutation.mutate({ order: convertDialog.order, formValues: convertForm })}
              disabled={convertMutation.isPending || !convertForm.phone}
            >
              {convertMutation.isPending ? "রূপান্তর হচ্ছে..." : "কনফার্ম ও রূপান্তর করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Convert Dialog */}
      <Dialog open={bulkConvertDialog} onOpenChange={setBulkConvertDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>বাল্ক রূপান্তর</DialogTitle>
            <DialogDescription>
              {selected.size}টি ইনকমপ্লিট অর্ডার অর্ডারে রূপান্তর করা হবে। শুধু যাদের নাম, ফোন ও ঠিকানা আছে তাদেরই রূপান্তর সম্ভব।
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkConvertDialog(false)}>বাতিল</Button>
            <Button onClick={handleBulkConvert}>রূপান্তর করুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialog} onOpenChange={setBulkDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>বাল্ক ডিলিট</DialogTitle>
            <DialogDescription>
              {selected.size}টি ইনকমপ্লিট অর্ডার স্থায়ীভাবে মুছে ফেলা হবে। এটি পূর্বাবস্থায় ফেরানো যাবে না।
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkDeleteDialog(false)}>বাতিল</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>মুছে ফেলুন</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminIncompleteOrders;
