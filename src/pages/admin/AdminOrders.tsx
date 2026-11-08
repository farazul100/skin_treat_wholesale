import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ArchiveRestore, Archive, Search, Eye, X, Truck, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const statusOptions = [
  { value: "pending", label: "পেন্ডিং", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "confirmed", label: "কনফার্মড", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "processing", label: "প্রসেসিং", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "shipped", label: "শিপড", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { value: "delivered", label: "ডেলিভারড", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "cancelled", label: "বাতিল", color: "bg-red-100 text-red-800 border-red-200" },
];

const paymentStatusOptions = [
  { value: "pending", label: "পেন্ডিং", color: "bg-yellow-100 text-yellow-800" },
  { value: "paid", label: "পেইড", color: "bg-green-100 text-green-800" },
  { value: "partial", label: "আংশিক", color: "bg-orange-100 text-orange-800" },
  { value: "refunded", label: "রিফান্ড", color: "bg-red-100 text-red-800" },
];

const emptyOrder = {
  customer_name: "", customer_phone: "", customer_email: "", shipping_address: "", city: "ঢাকা", area: "",
  subtotal: 0, delivery_charge: 0, total: 0, payment_method: "cod", notes: "",
  items: [{ product_name: "", quantity: 1, price: 0 }],
};

const AdminOrders = () => {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<any>(null);
  const [newOrder, setNewOrder] = useState({ ...emptyOrder });
  const [sendingCourier, setSendingCourier] = useState<string | null>(null);
  const [courierStatuses, setCourierStatuses] = useState<Record<string, any>>({});

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("all");
  const [filterCity, setFilterCity] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Steadfast settings
  const { data: steadfastConfig } = useQuery({
    queryKey: ["steadfast-config"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("key", "steadfast").single();
      return (data?.value || data?.setting_value) as { api_key?: string; secret_key?: string } | null;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-orders", showTrash],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("is_trashed", showTrash)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o: any) => {
      if (filterStatus !== "all" && o.order_status !== filterStatus) return false;
      if (filterPayment !== "all" && o.payment_status !== filterPayment) return false;
      if (filterPaymentMethod !== "all" && o.payment_method !== filterPaymentMethod) return false;
      if (filterCity !== "all") {
        const isDhaka = o.city === "ঢাকা";
        if (filterCity === "dhaka" && !isDhaka) return false;
        if (filterCity === "outside" && isDhaka) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = o.order_number?.toLowerCase().includes(q) ||
          o.customer_name?.toLowerCase().includes(q) ||
          o.customer_phone?.includes(q) ||
          o.customer_email?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterDateFrom && new Date(o.created_at) < new Date(filterDateFrom)) return false;
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59);
        if (new Date(o.created_at) > to) return false;
      }
      return true;
    });
  }, [orders, searchQuery, filterStatus, filterPayment, filterPaymentMethod, filterCity, filterDateFrom, filterDateTo]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await supabase.from("orders").update({ [field]: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("আপডেট হয়েছে");
    },
  });

  const trashMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("orders").update({ is_trashed: !showTrash }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelectedIds([]);
      toast.success(showTrash ? "রিস্টোর হয়েছে" : "ট্র্যাশে সরানো হয়েছে");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("order_items").delete().in("order_id", ids);
      if (error) throw error;
      const { error: e2 } = await supabase.from("orders").delete().in("id", ids);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setSelectedIds([]);
      toast.success("স্থায়ীভাবে মুছে ফেলা হয়েছে");
    },
  });

  const addOrderMutation = useMutation({
    mutationFn: async () => {
      const subtotal = newOrder.items.reduce((s, i) => s + i.price * i.quantity, 0);
      const total = subtotal + Number(newOrder.delivery_charge);
      const orderId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const { data: order, error } = await supabase.from("orders").insert({
        id: orderId,
        customer_name: newOrder.customer_name,
        customer_phone: newOrder.customer_phone,
        customer_email: newOrder.customer_email || null,
        shipping_address: newOrder.shipping_address,
        city: newOrder.city,
        area: newOrder.area || null,
        subtotal,
        delivery_charge: Number(newOrder.delivery_charge),
        total,
        due_amount: total,
        payment_method: newOrder.payment_method,
        notes: newOrder.notes || null,
      }).select().single();
      if (error) throw error;
      const finalOrderId = order?.id || orderId;
      const orderItems = newOrder.items.filter(i => i.product_name).map(i => ({
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        order_id: finalOrderId,
        product_name: i.product_name,
        quantity: i.quantity,
        price: i.price,
        total: i.price * i.quantity,
      }));
      if (orderItems.length > 0) {
        await supabase.from("order_items").insert(orderItems);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      setAddOpen(false);
      setNewOrder({ ...emptyOrder });
      toast.success("অর্ডার তৈরি হয়েছে");
    },
    onError: () => toast.error("অর্ডার তৈরিতে সমস্যা হয়েছে"),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };
  const allSelected = filteredOrders.length > 0 && selectedIds.length === filteredOrders.length;
  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : filteredOrders.map((o: any) => o.id));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const items = [...newOrder.items];
    items[index] = { ...items[index], [field]: value };
    setNewOrder({ ...newOrder, items });
  };

  const getStatusBadge = (status: string, options: typeof statusOptions) => {
    const opt = options.find(o => o.value === status);
    return <Badge variant="outline" className={`text-xs font-medium ${opt?.color || ""}`}>{opt?.label || status}</Badge>;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterPayment("all");
    setFilterPaymentMethod("all");
    setFilterCity("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasFilters = searchQuery || filterStatus !== "all" || filterPayment !== "all" || filterPaymentMethod !== "all" || filterCity !== "all" || filterDateFrom || filterDateTo;

  // Send to Steadfast
  const sendToSteadfast = async (order: any) => {
    if (!steadfastConfig?.api_key || !steadfastConfig?.secret_key) {
      toast.error("Steadfast API Key সেটিংসে কনফিগার করুন");
      return;
    }
    setSendingCourier(order.id);
    try {
      const res = await fetch("https://portal.steadfast.com.bd/api/v1/create_order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": steadfastConfig.api_key,
          "Secret-Key": steadfastConfig.secret_key,
        },
        body: JSON.stringify({
          invoice: order.order_number,
          recipient_name: order.customer_name,
          recipient_phone: order.customer_phone,
          recipient_address: `${order.shipping_address}${order.area ? ", " + order.area : ""}, ${order.city}`,
          cod_amount: Number(order.due_amount) || Number(order.total),
          note: order.notes || "",
        }),
      });
      const result = await res.json();
      if (result.status === 200) {
        await supabase.from("orders").update({
          notes: `${order.notes || ""}\n[Steadfast] CID: ${result.consignment?.consignment_id}, Tracking: ${result.consignment?.tracking_code}`.trim(),
        }).eq("id", order.id);
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
        toast.success(`কুরিয়ারে পাঠানো হয়েছে! CID: ${result.consignment?.consignment_id}`);
      } else {
        toast.error(result.message || "Steadfast এ পাঠাতে সমস্যা হয়েছে");
      }
    } catch (err) {
      toast.error("নেটওয়ার্ক সমস্যা, আবার চেষ্টা করুন");
    } finally {
      setSendingCourier(null);
    }
  };

  // Fetch Steadfast delivery status for an order
  const fetchCourierStatus = async (order: any) => {
    if (!steadfastConfig?.api_key || !steadfastConfig?.secret_key) return;
    const cidMatch = order.notes?.match(/\[Steadfast\] CID: (\w+)/);
    if (!cidMatch) return;
    const cid = cidMatch[1];
    if (courierStatuses[order.id]) return; // already fetched
    try {
      const res = await fetch(`https://portal.steadfast.com.bd/api/v1/status_by_cid/${cid}`, {
        headers: {
          "Api-Key": steadfastConfig.api_key,
          "Secret-Key": steadfastConfig.secret_key,
        },
      });
      const result = await res.json();
      if (result.status === 200) {
        setCourierStatuses(prev => ({ ...prev, [order.id]: result.delivery_status }));
      }
    } catch {}
  };

  // Status counts
  const statusCounts = useMemo(() => {
    if (!orders) return {};
    const counts: Record<string, number> = { all: orders.length };
    orders.forEach((o: any) => {
      counts[o.order_status] = (counts[o.order_status] || 0) + 1;
    });
    return counts;
  }, [orders]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-foreground">
          {showTrash ? "ট্র্যাশ" : "অর্ডারসমূহ"}
        </h1>
        <div className="flex gap-2">
          <Button variant={showTrash ? "default" : "outline"} size="sm" onClick={() => { setShowTrash(!showTrash); setSelectedIds([]); }}>
            <Archive className="h-4 w-4 mr-1" /> {showTrash ? "অর্ডার দেখুন" : "ট্র্যাশ"}
          </Button>
          {!showTrash && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> অর্ডার যোগ করুন</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>ম্যানুয়াল অর্ডার</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>নাম *</Label><Input value={newOrder.customer_name} onChange={(e) => setNewOrder({ ...newOrder, customer_name: e.target.value })} /></div>
                    <div><Label>ফোন *</Label><Input value={newOrder.customer_phone} onChange={(e) => setNewOrder({ ...newOrder, customer_phone: e.target.value })} /></div>
                  </div>
                  <div><Label>ইমেইল</Label><Input value={newOrder.customer_email} onChange={(e) => setNewOrder({ ...newOrder, customer_email: e.target.value })} /></div>
                  <div><Label>ঠিকানা *</Label><Input value={newOrder.shipping_address} onChange={(e) => setNewOrder({ ...newOrder, shipping_address: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>শহর</Label><Input value={newOrder.city} onChange={(e) => setNewOrder({ ...newOrder, city: e.target.value })} /></div>
                    <div><Label>এলাকা</Label><Input value={newOrder.area} onChange={(e) => setNewOrder({ ...newOrder, area: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>পেমেন্ট</Label>
                      <Select value={newOrder.payment_method} onValueChange={(v) => setNewOrder({ ...newOrder, payment_method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cod">COD</SelectItem>
                          <SelectItem value="partial">আংশিক</SelectItem>
                          <SelectItem value="online">অনলাইন</SelectItem>
                          <SelectItem value="eps">EPS অনলাইন</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>ডেলিভারি চার্জ</Label><Input type="number" value={newOrder.delivery_charge} onChange={(e) => setNewOrder({ ...newOrder, delivery_charge: +e.target.value })} /></div>
                  </div>
                  <div>
                    <Label className="mb-2 block">পণ্যসমূহ</Label>
                    {newOrder.items.map((item, i) => (
                      <div key={i} className="grid grid-cols-[1fr_60px_80px_32px] gap-2 mb-2 items-end">
                        <Input placeholder="পণ্যের নাম" value={item.product_name} onChange={(e) => updateItem(i, "product_name", e.target.value)} />
                        <Input type="number" placeholder="সংখ্যা" value={item.quantity} onChange={(e) => updateItem(i, "quantity", +e.target.value)} />
                        <Input type="number" placeholder="দাম" value={item.price} onChange={(e) => updateItem(i, "price", +e.target.value)} />
                        {newOrder.items.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setNewOrder({ ...newOrder, items: newOrder.items.filter((_, idx) => idx !== i) })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setNewOrder({ ...newOrder, items: [...newOrder.items, { product_name: "", quantity: 1, price: 0 }] })}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> পণ্য যোগ
                    </Button>
                  </div>
                  <div><Label>নোট</Label><Textarea value={newOrder.notes} onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })} rows={2} /></div>
                  <div className="bg-secondary/50 rounded-lg p-3 text-sm">
                    <p>সাবটোটাল: ৳{newOrder.items.reduce((s, i) => s + i.price * i.quantity, 0)}</p>
                    <p>ডেলিভারি: ৳{newOrder.delivery_charge}</p>
                    <p className="font-bold">মোট: ৳{newOrder.items.reduce((s, i) => s + i.price * i.quantity, 0) + Number(newOrder.delivery_charge)}</p>
                  </div>
                  <Button className="w-full" onClick={() => addOrderMutation.mutate()} disabled={!newOrder.customer_name || !newOrder.customer_phone || !newOrder.shipping_address || addOrderMutation.isPending}>
                    অর্ডার তৈরি করুন
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Status tabs */}
      {!showTrash && (
        <div className="flex flex-wrap gap-1 mb-4 border-b pb-3">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${filterStatus === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
          >
            সব ({statusCounts.all || 0})
          </button>
          {statusOptions.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(filterStatus === s.value ? "all" : s.value)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${filterStatus === s.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
            >
              {s.label} ({statusCounts[s.value] || 0})
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      {!showTrash && (
        <div className="bg-card border rounded-xl p-3 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="অর্ডার নম্বর, নাম, ফোন দিয়ে খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="min-w-[120px]">
              <Label className="text-xs text-muted-foreground">পেমেন্ট স্ট্যাটাস</Label>
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব</SelectItem>
                  {paymentStatusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[120px]">
              <Label className="text-xs text-muted-foreground">পেমেন্ট মেথড</Label>
              <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব</SelectItem>
                  <SelectItem value="cod">COD</SelectItem>
                  <SelectItem value="partial">আংশিক</SelectItem>
                  <SelectItem value="online">অনলাইন</SelectItem>
                  <SelectItem value="eps">EPS অনলাইন</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[120px]">
              <Label className="text-xs text-muted-foreground">শহর</Label>
              <Select value={filterCity} onValueChange={setFilterCity}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সব</SelectItem>
                  <SelectItem value="dhaka">ঢাকা</SelectItem>
                  <SelectItem value="outside">ঢাকার বাইরে</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[130px]">
              <Label className="text-xs text-muted-foreground">তারিখ থেকে</Label>
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="min-w-[130px]">
              <Label className="text-xs text-muted-foreground">তারিখ পর্যন্ত</Label>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-9 text-xs" />
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                <X className="h-3.5 w-3.5 mr-1" /> ফিল্টার মুছুন
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{selectedIds.length}টি সিলেক্টেড</span>
          <div className="flex gap-2">
            {!showTrash && (
              <Select onValueChange={(v) => {
                selectedIds.forEach(id => updateMutation.mutate({ id, field: "order_status", value: v }));
                setSelectedIds([]);
              }}>
                <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue placeholder="স্ট্যাটাস পরিবর্তন" /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="outline" onClick={() => trashMutation.mutate(selectedIds)}>
              {showTrash ? <><ArchiveRestore className="h-3.5 w-3.5 mr-1" /> রিস্টোর</> : <><Archive className="h-3.5 w-3.5 mr-1" /> ট্র্যাশে সরান</>}
            </Button>
            {!showTrash && (
              <Button size="sm" variant="outline" onClick={() => window.open(`/admin/invoice-print?ids=${selectedIds.join(",")}`, "_blank")}>
                <Printer className="h-3.5 w-3.5 mr-1" /> ইনভয়েস প্রিন্ট ({selectedIds.length})
              </Button>
            )}
            {showTrash && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive"><Trash2 className="h-3.5 w-3.5 mr-1" /> স্থায়ীভাবে মুছুন</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>নিশ্চিত করুন</AlertDialogTitle>
                    <AlertDialogDescription>{selectedIds.length}টি অর্ডার স্থায়ীভাবে মুছে ফেলা হবে।</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>বাতিল</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(selectedIds)}>মুছে ফেলুন</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-muted-foreground mb-2">
        {filteredOrders.length}টি অর্ডার দেখাচ্ছে {hasFilters ? `(মোট ${orders?.length || 0})` : ""}
      </p>

      {/* Orders table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/40">
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="text-xs font-semibold">অর্ডার</TableHead>
                <TableHead className="text-xs font-semibold">তারিখ</TableHead>
                <TableHead className="text-xs font-semibold">কাস্টমার</TableHead>
                <TableHead className="text-xs font-semibold">স্ট্যাটাস</TableHead>
                <TableHead className="text-xs font-semibold">পেমেন্ট</TableHead>
                <TableHead className="text-xs font-semibold text-right">মোট</TableHead>
                <TableHead className="text-xs font-semibold">কুরিয়ার</TableHead>
                <TableHead className="text-xs font-semibold">রেশিও</TableHead>
                <TableHead className="text-xs font-semibold text-center">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order: any) => (
                <TableRow key={order.id} className={`hover:bg-secondary/20 ${selectedIds.includes(order.id) ? "bg-primary/5" : ""}`}>
                  <TableCell>
                    <Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                  </TableCell>
                  <TableCell>
                    <button onClick={() => setViewOrder(order)} className="text-primary font-semibold text-sm hover:underline">
                      {order.order_number}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {order.order_items?.length || 0}টি পণ্য
                    </p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(order.created_at), "dd/MM/yyyy")}
                    <br />
                    <span className="text-[10px]">{format(new Date(order.created_at), "hh:mm a")}</span>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                    {order.city && <p className="text-xs text-muted-foreground">{order.city}</p>}
                  </TableCell>
                  <TableCell>
                    {!showTrash ? (
                      <Select value={order.order_status} onValueChange={(v) => updateMutation.mutate({ id: order.id, field: "order_status", value: v })}>
                        <SelectTrigger className="h-7 text-xs w-[110px] border-0 p-0">
                          {getStatusBadge(order.order_status, statusOptions)}
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      getStatusBadge(order.order_status, statusOptions)
                    )}
                  </TableCell>
                  <TableCell>
                    {!showTrash ? (
                      <Select value={order.payment_status} onValueChange={(v) => updateMutation.mutate({ id: order.id, field: "payment_status", value: v })}>
                        <SelectTrigger className="h-7 text-xs w-[100px] border-0 p-0">
                          {getStatusBadge(order.payment_status, paymentStatusOptions)}
                        </SelectTrigger>
                        <SelectContent>
                          {paymentStatusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      getStatusBadge(order.payment_status, paymentStatusOptions)
                    )}
                    {order.payment_method && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                        {order.payment_method === "eps" ? "⚡ EPS অনলাইন" : order.payment_method === "cod" ? "ক্যাশ অন ডেলিভারি" : order.payment_method}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="font-bold text-sm">৳{Number(order.total)}</p>
                    {Number(order.due_amount) > 0 && (
                      <p className="text-[10px] text-destructive">বাকি: ৳{Number(order.due_amount)}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const cidMatch = order.notes?.match(/\[Steadfast\] CID: (\w+)/);
                      if (cidMatch) {
                        return (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                            <Truck className="h-3 w-3 mr-1" /> {cidMatch[1]}
                          </Badge>
                        );
                      }
                      return (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={sendingCourier === order.id}
                          onClick={() => sendToSteadfast(order)}
                        >
                          {sendingCourier === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Truck className="h-3 w-3 mr-1" /> পাঠান</>}
                        </Button>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const cidMatch = order.notes?.match(/\[Steadfast\] CID: (\w+)/);
                      if (!cidMatch) return <span className="text-xs text-muted-foreground">—</span>;
                      const status = courierStatuses[order.id];
                      if (!status) {
                        fetchCourierStatus(order);
                        return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
                      }
                      const total = 1;
                      const success = status === "delivered" ? 1 : 0;
                      const cancel = status === "cancelled" ? 1 : 0;
                      const pending = total - success - cancel;
                      const percent = Math.round((success / total) * 100);
                      return (
                        <div className="text-[10px] space-y-0.5 min-w-[90px]">
                          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
                          </div>
                          <p className="flex items-center gap-1">
                            <span className="text-muted-foreground">Total:</span> <span className="font-semibold">{total}</span>
                            <span className="text-emerald-600 ml-1">Success:</span> <span className="font-semibold">{success}</span>
                          </p>
                          <p>
                            <span className="text-destructive">Cancel:</span> <span className="font-semibold">{cancel}</span>
                            {pending > 0 && <span className="text-muted-foreground ml-2">Pending: {pending}</span>}
                          </p>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewOrder(order)} title="ভিউ">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {!showTrash && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(`/admin/invoice-print?ids=${order.id}`, "_blank")}
                          title="ইনভয়েস প্রিন্ট"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => trashMutation.mutate([order.id])} title={showTrash ? "রিস্টোর" : "ট্র্যাশ"}>
                        {showTrash ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredOrders.length === 0 && (
            <p className="text-center text-muted-foreground py-12 text-sm">{showTrash ? "ট্র্যাশ খালি" : "কোনো অর্ডার পাওয়া যায়নি"}</p>
          )}
        </div>
      </div>

      {/* Order detail modal */}
      <Dialog open={!!viewOrder} onOpenChange={(v) => !v && setViewOrder(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>অর্ডার: {viewOrder?.order_number}</DialogTitle></DialogHeader>
          {viewOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">কাস্টমার</p>
                  <p className="font-medium">{viewOrder.customer_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">ফোন</p>
                  <p className="font-medium">{viewOrder.customer_phone}</p>
                </div>
                {viewOrder.customer_email && (
                  <div>
                    <p className="text-muted-foreground text-xs">ইমেইল</p>
                    <p className="font-medium">{viewOrder.customer_email}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">শহর</p>
                  <p className="font-medium">{viewOrder.city}</p>
                </div>
              </div>
              <div className="text-sm">
                <p className="text-muted-foreground text-xs">ঠিকানা</p>
                <p>{viewOrder.shipping_address}{viewOrder.area ? `, ${viewOrder.area}` : ""}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm bg-muted/40 p-2.5 rounded-lg border">
                <div>
                  <p className="text-muted-foreground text-xs">পেমেন্ট মেথড</p>
                  <p className="font-medium text-xs">
                    {viewOrder.payment_method === 'eps' ? '⚡ EPS অনলাইন গেটওয়ে' : viewOrder.payment_method === 'cod' ? 'ক্যাশ অন ডেলিভারি (COD)' : (viewOrder.payment_method || 'COD')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">ট্রানজেকশন আইডি</p>
                  <p className="font-mono text-xs text-primary font-semibold">
                    {viewOrder.transaction_id || 'প্রযোজ্য নয়'}
                  </p>
                </div>
              </div>
              {viewOrder.notes && (
                <div className="text-sm">
                  <p className="text-muted-foreground text-xs">নোট</p>
                  <p>{viewOrder.notes}</p>
                </div>
              )}

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/40">
                      <TableHead className="text-xs">পণ্য</TableHead>
                      <TableHead className="text-xs text-center">সংখ্যা</TableHead>
                      <TableHead className="text-xs text-right">দাম</TableHead>
                      <TableHead className="text-xs text-right">মোট</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewOrder.order_items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.product_name}</TableCell>
                        <TableCell className="text-sm text-center">{item.quantity}</TableCell>
                        <TableCell className="text-sm text-right">৳{Number(item.price)}</TableCell>
                        <TableCell className="text-sm text-right font-medium">৳{Number(item.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-secondary/30 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>সাবটোটাল</span><span>৳{Number(viewOrder.subtotal)}</span></div>
                <div className="flex justify-between"><span>ডেলিভারি</span><span>৳{Number(viewOrder.delivery_charge)}</span></div>
                {Number(viewOrder.discount) > 0 && <div className="flex justify-between"><span>ডিসকাউন্ট</span><span>-৳{Number(viewOrder.discount)}</span></div>}
                <div className="flex justify-between font-bold border-t pt-1"><span>মোট</span><span>৳{Number(viewOrder.total)}</span></div>
                {Number(viewOrder.partial_payment) > 0 && <div className="flex justify-between text-xs"><span>আংশিক পেমেন্ট</span><span>৳{Number(viewOrder.partial_payment)}</span></div>}
                {Number(viewOrder.due_amount) > 0 && <div className="flex justify-between text-destructive text-xs"><span>বাকি</span><span>৳{Number(viewOrder.due_amount)}</span></div>}
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs">অর্ডার স্ট্যাটাস</Label>
                  <Select value={viewOrder.order_status} onValueChange={(v) => { updateMutation.mutate({ id: viewOrder.id, field: "order_status", value: v }); setViewOrder({ ...viewOrder, order_status: v }); }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs">পেমেন্ট স্ট্যাটাস</Label>
                  <Select value={viewOrder.payment_status} onValueChange={(v) => { updateMutation.mutate({ id: viewOrder.id, field: "payment_status", value: v }); setViewOrder({ ...viewOrder, payment_status: v }); }}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {paymentStatusOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
