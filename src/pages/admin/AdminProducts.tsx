import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Search, Copy, Package, CheckSquare, Square, Upload, Video, Image, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";

const emptyProduct = {
  name: "", slug: "", description: "", short_description: "", price: 0, original_price: null as number | null,
  sku: "", stock: 0, images: [] as string[], badge: "", is_featured: false, is_bestseller: false, is_active: true, category_id: null as string | null,
  meta_title: "", meta_description: "", focus_keyword: "", video_url: "", video_thumbnail: "", sort_order: 0,
  delivery_type: "global", delivery_inside_dhaka: null as number | null, delivery_outside_dhaka: null as number | null, delivery_nationwide: null as number | null,
  is_separate_delivery: false as boolean,
  payment_requirement: "cod" as string,
  landing_page_html: "",
};

const extractYouTubeId = (url?: string): string | null => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

const AdminProducts = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyProduct);
  const [imageUrl, setImageUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive" | "featured" | "bestseller">("all");
  const [filterCategory, setFilterCategory] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("general");
  const [uploading, setUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, categories(name)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").eq("is_active", true);
      return data || [];
    },
  });

  const { data: cloudinaryConfig } = useQuery({
    queryKey: ["cloudinary-config"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("key", "cloudinary").single();
      return (data?.value || data?.setting_value) as { cloud_name?: string; upload_preset?: string } || null;
    },
  });

  const hasCloudinary = true; // Bypassed to use local uploading

  const uploadToCloudinary = useCallback(async (file: File, resourceType: "image" | "video" = "image") => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("আপলোড ব্যর্থ হয়েছে");
    return await res.json();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploads = await Promise.all(
        Array.from(files).map(async (file) => {
          const result = await uploadToCloudinary(file, "image");
          if (!result) return null;
          // It returns the server path /uploads/...
          return result.secure_url;
        })
      );
      const validUrls = uploads.filter(Boolean) as string[];
      if (validUrls.length) {
        setForm(prev => ({ ...prev, images: [...prev.images, ...validUrls] }));
        toast.success(`${validUrls.length}টি ছবি আপলোড হয়েছে`);
      }
    } catch (err: any) {
      toast.error(err.message || "ছবি আপলোড ব্যর্থ");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoUploading(true);
    try {
      const result = await uploadToCloudinary(file, "video");
      if (result) {
        const videoUrl = result.secure_url;
        const thumbnail = ""; // Thumbnail generation from video would require ffmpeg, leaving empty for now
        setForm(prev => ({ ...prev, video_url: videoUrl, video_thumbnail: thumbnail }));
        toast.success("ভিডিও আপলোড হয়েছে");
      }
    } catch (err: any) {
      toast.error(err.message || "ভিডিও আপলোড ব্যর্থ");
    } finally {
      setVideoUploading(false);
      e.target.value = "";
    }
  };

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter((p: any) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q) && !p.slug?.toLowerCase().includes(q)) return false;
      }
      if (filterStatus === "active" && !p.is_active) return false;
      if (filterStatus === "inactive" && p.is_active) return false;
      if (filterStatus === "featured" && !p.is_featured) return false;
      if (filterStatus === "bestseller" && !p.is_bestseller) return false;
      if (filterCategory && p.category_id !== filterCategory) return false;
      return true;
    });
  }, [products, searchQuery, filterStatus, filterCategory]);

  const counts = useMemo(() => {
    if (!products) return { all: 0, active: 0, inactive: 0, featured: 0, bestseller: 0 };
    return {
      all: products.length,
      active: products.filter((p: any) => p.is_active).length,
      inactive: products.filter((p: any) => !p.is_active).length,
      featured: products.filter((p: any) => p.is_featured).length,
      bestseller: products.filter((p: any) => p.is_bestseller).length,
    };
  }, [products]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^\u0980-\u09FF\w-]/g, "");
      let video_thumbnail = data.video_thumbnail;
      const ytId = extractYouTubeId(data.video_url);
      if (ytId && (!video_thumbnail || video_thumbnail.includes("youtube.com/watch") || video_thumbnail.includes("youtu.be/"))) {
        video_thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      }
      const payload = { ...data, slug, video_thumbnail };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["top-selling-products"] });
      queryClient.invalidateQueries({ queryKey: ["featured-products"] });
      queryClient.invalidateQueries({ queryKey: ["home-categorized-products"] });
      queryClient.invalidateQueries({ queryKey: ["header-category-products"] });
      toast.success(editing ? "পণ্য আপডেট হয়েছে" : "পণ্য যোগ হয়েছে");
      setOpen(false);
      setEditing(null);
      setForm(emptyProduct);
      setActiveTab("general");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["top-selling-products"] });
      toast.success("পণ্য মুছে ফেলা হয়েছে");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["top-selling-products"] });
      setSelectedIds([]);
      toast.success("নির্বাচিত পণ্য মুছে ফেলা হয়েছে");
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, is_active }: { ids: string[]; is_active: boolean }) => {
      const { error } = await supabase.from("products").update({ is_active }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["top-selling-products"] });
      setSelectedIds([]);
      toast.success("স্ট্যাটাস আপডেট হয়েছে");
    },
  });

  const openEdit = (product: any) => {
    setEditing(product);
    setForm({
      name: product.name, slug: product.slug, description: product.description || "", short_description: product.short_description || "",
      price: Number(product.price), original_price: product.original_price ? Number(product.original_price) : null,
      sku: product.sku || "", stock: product.stock, images: product.images || [], badge: product.badge || "",
      is_featured: product.is_featured === true || product.is_featured === 1 || product.is_featured === "1",
      is_bestseller: product.is_bestseller === true || product.is_bestseller === 1 || product.is_bestseller === "1",
      is_active: product.is_active === true || product.is_active === 1 || product.is_active === "1" || product.is_active === undefined,
      category_id: product.category_id,
      meta_title: product.meta_title || "", meta_description: product.meta_description || "", focus_keyword: product.focus_keyword || "",
      video_url: product.video_url || "", video_thumbnail: product.video_thumbnail || "", sort_order: product.sort_order || 0,
      delivery_type: product.delivery_type || "global",
      delivery_inside_dhaka: product.delivery_inside_dhaka,
      delivery_outside_dhaka: product.delivery_outside_dhaka,
      delivery_nationwide: product.delivery_nationwide,
      is_separate_delivery: product.is_separate_delivery === true || product.is_separate_delivery === 1 || product.is_separate_delivery === "1",
      payment_requirement: product.payment_requirement || "cod",
      landing_page_html: product.landing_page_html || "",
    });
    setActiveTab("general");
    setOpen(true);
  };

  const duplicateProduct = (product: any) => {
    setEditing(null);
    setForm({
      name: product.name + " (কপি)", slug: "", description: product.description || "", short_description: product.short_description || "",
      price: Number(product.price), original_price: product.original_price ? Number(product.original_price) : null,
      sku: "", stock: product.stock, images: product.images || [], badge: product.badge || "",
      is_featured: false, is_bestseller: false, is_active: false, category_id: product.category_id,
      meta_title: product.meta_title || "", meta_description: product.meta_description || "", focus_keyword: product.focus_keyword || "",
      video_url: product.video_url || "", video_thumbnail: product.video_thumbnail || "", sort_order: 0,
      delivery_type: product.delivery_type || "global",
      delivery_inside_dhaka: product.delivery_inside_dhaka,
      delivery_outside_dhaka: product.delivery_outside_dhaka,
      delivery_nationwide: product.delivery_nationwide,
      is_separate_delivery: product.is_separate_delivery === true || product.is_separate_delivery === 1 || product.is_separate_delivery === "1",
      payment_requirement: product.payment_requirement || "cod",
      landing_page_html: product.landing_page_html || "",
    });
    setActiveTab("general");
    setOpen(true);
  };

  const addImage = () => {
    if (imageUrl.trim()) {
      setForm({ ...form, images: [...form.images, imageUrl.trim()] });
      setImageUrl("");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredProducts.length) setSelectedIds([]);
    else setSelectedIds(filteredProducts.map((p: any) => p.id));
  };

  const seoScore = useMemo(() => {
    let score = 0;
    const keyword = form.focus_keyword.toLowerCase();
    if (form.meta_title) score += 25;
    if (form.meta_description) score += 25;
    if (form.focus_keyword) score += 10;
    if (keyword && form.meta_title.toLowerCase().includes(keyword)) score += 15;
    if (keyword && form.meta_description.toLowerCase().includes(keyword)) score += 15;
    if (keyword && form.name.toLowerCase().includes(keyword)) score += 10;
    return Math.min(score, 100);
  }, [form.meta_title, form.meta_description, form.focus_keyword, form.name]);

  const seoColor = seoScore >= 70 ? "text-green-600" : seoScore >= 40 ? "text-yellow-600" : "text-red-500";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Package className="h-6 w-6" /> পণ্যসমূহ
        </h1>
        <div className="flex items-center gap-2">
          {!hasCloudinary && (
            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">Cloudinary সেটআপ করুন</span>
          )}
          <Button onClick={() => { setEditing(null); setForm(emptyProduct); setActiveTab("general"); setOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> নতুন পণ্য
          </Button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b overflow-x-auto">
        {[
          { key: "all", label: "সব", count: counts.all },
          { key: "active", label: "সক্রিয়", count: counts.active },
          { key: "inactive", label: "নিষ্ক্রিয়", count: counts.inactive },
          { key: "featured", label: "ফিচার্ড", count: counts.featured },
          { key: "bestseller", label: "টপ সেলিং", count: counts.bestseller },
        ].map(tab => (
          <button key={tab.key}
            onClick={() => setFilterStatus(tab.key as any)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              filterStatus === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {tab.label} <span className="text-xs opacity-70">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="নাম, SKU বা স্লাগ দিয়ে খুঁজুন..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <select className="border rounded-lg px-3 py-2 text-sm bg-background min-w-[150px]"
          value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">সব ক্যাটেগরি</option>
          {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">{selectedIds.length}টি নির্বাচিত</span>
            <Button size="sm" variant="outline" onClick={() => bulkStatusMutation.mutate({ ids: selectedIds, is_active: true })}>সক্রিয়</Button>
            <Button size="sm" variant="outline" onClick={() => bulkStatusMutation.mutate({ ids: selectedIds, is_active: false })}>নিষ্ক্রিয়</Button>
            <Button size="sm" variant="destructive" onClick={() => { if (confirm(`${selectedIds.length}টি পণ্য মুছে ফেলতে চান?`)) bulkDeleteMutation.mutate(selectedIds); }}>মুছুন</Button>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10 p-3">
                  <button onClick={toggleAll}>
                    {selectedIds.length === filteredProducts.length && filteredProducts.length > 0
                      ? <CheckSquare className="h-4 w-4 text-primary" />
                      : <Square className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </th>
                <th className="p-3 text-left font-medium text-muted-foreground">ছবি</th>
                <th className="p-3 text-left font-medium text-muted-foreground">পণ্যের নাম</th>
                <th className="p-3 text-left font-medium text-muted-foreground">SKU</th>
                <th className="p-3 text-left font-medium text-muted-foreground">স্টক</th>
                <th className="p-3 text-left font-medium text-muted-foreground">দাম</th>
                <th className="p-3 text-left font-medium text-muted-foreground">ক্যাটেগরি</th>
                <th className="p-3 text-left font-medium text-muted-foreground">স্ট্যাটাস</th>
                <th className="p-3 text-left font-medium text-muted-foreground">তারিখ</th>
                <th className="p-3 text-right font-medium text-muted-foreground">একশন</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product: any) => (
                <tr key={product.id} className={`border-b hover:bg-muted/30 transition-colors ${selectedIds.includes(product.id) ? "bg-primary/5" : ""}`}>
                  <td className="p-3">
                    <button onClick={() => toggleSelect(product.id)}>
                      {selectedIds.includes(product.id)
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="relative">
                      <img src={product.images?.[0] || "/placeholder.svg"} alt="" className="w-10 h-10 rounded object-cover" />
                      {product.video_url && <Video className="absolute -bottom-1 -right-1 h-3.5 w-3.5 text-primary bg-background rounded-full p-0.5" />}
                    </div>
                  </td>
                  <td className="p-3">
                    <button onClick={() => openEdit(product)} className="font-medium text-primary hover:underline text-left">
                      {product.name}
                    </button>
                    <div className="text-xs text-muted-foreground mt-0.5">/{product.slug}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {product.is_featured && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">ফিচার্ড</Badge>}
                      {product.is_bestseller && <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0">টপ সেলিং</Badge>}
                      {product.badge && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{product.badge}</Badge>}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{product.sku || "—"}</td>
                  <td className="p-3">
                    <span className={`font-medium ${product.stock <= 0 ? "text-destructive" : product.stock <= 5 ? "text-yellow-600" : "text-foreground"}`}>
                      {product.stock <= 0 ? "স্টক নেই" : product.stock}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-foreground">৳{Number(product.price)}</div>
                    {product.original_price && <div className="text-xs text-muted-foreground line-through">৳{Number(product.original_price)}</div>}
                  </td>
                  <td className="p-3 text-muted-foreground">{product.categories?.name || "—"}</td>
                  <td className="p-3">
                    {product.is_active
                      ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">সক্রিয়</Badge>
                      : <Badge variant="secondary" className="bg-muted text-muted-foreground">ড্রাফট</Badge>}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(product.created_at).toLocaleDateString("bn-BD")}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="সম্পাদনা" onClick={() => openEdit(product)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="ডুপ্লিকেট" onClick={() => duplicateProduct(product)}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="মুছুন"
                        onClick={() => { if (confirm("মুছে ফেলতে চান?")) deleteMutation.mutate(product.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">কোনো পণ্য পাওয়া যায়নি</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t text-xs text-muted-foreground">
          মোট {filteredProducts.length}টি পণ্য {products?.length !== filteredProducts.length ? `(সর্বমোট ${products?.length})` : ""}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyProduct); setActiveTab("general"); } }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-lg">{editing ? "পণ্য সম্পাদনা" : "নতুন পণ্য যোগ করুন"}</DialogTitle>
          </DialogHeader>

          <div className="p-6 pt-4">
            {/* Product Title */}
            <div className="mb-5">
              <Input placeholder="পণ্যের নাম লিখুন" className="text-lg h-12 font-medium"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                <span>পার্মালিংক:</span>
                <Input className="h-6 text-xs px-2 py-0 w-auto flex-1 max-w-xs" placeholder="auto-generated-slug"
                  value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
                {[
                  { value: "general", label: "সাধারণ" },
                  { value: "description", label: "বিবরণ" },
                  { value: "landing", label: "ল্যান্ডিং পেজ ডিজাইন" },
                  { value: "media", label: "মিডিয়া", icon: <Image className="h-3.5 w-3.5" /> },
                  { value: "inventory", label: "ইনভেন্টরি" },
                  { value: "delivery", label: "ডেলিভারি ও পেমেন্ট" },
                  { value: "seo", label: "SEO" },
                ].map(t => (
                  <TabsTrigger key={t.value} value={t.value}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm gap-1.5">
                    {t.icon}
                    {t.label}
                    {t.value === "seo" && form.focus_keyword && (
                      <span className={`ml-1 text-[10px] font-bold ${seoColor}`}>{seoScore}%</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* General Tab */}
              <TabsContent value="general" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">দাম (৳) *</Label>
                    <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">আসল দাম (৳)</Label>
                    <Input type="number" value={form.original_price || ""} onChange={(e) => setForm({ ...form, original_price: e.target.value ? +e.target.value : null })} placeholder="ছাড়ের আগের দাম" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">ক্যাটেগরি</Label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background"
                    value={form.category_id || ""} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}>
                    <option value="">নির্বাচন করুন</option>
                    {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">ব্যাজ (ঐচ্ছিক)</Label>
                    <Input
                      value={form.badge}
                      onChange={(e) => setForm({ ...form, badge: e.target.value })}
                      placeholder="যেমন: Best Selling, নতুন, হট ডিল"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">খালি রাখলে প্রোডাক্ট কার্ডে কোনো ব্যাজ দেখাবে না</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">সর্ট অর্ডার</Label>
                    <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })} placeholder="ছোট সংখ্যা আগে দেখাবে" />
                    <p className="text-[11px] text-muted-foreground mt-1">কম মান = হোম পেইজে আগে দেখাবে</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <Label className="text-sm">ফিচার্ড পণ্য</Label>
                      <p className="text-xs text-muted-foreground">ফিচার্ড সেকশনে দেখাবে</p>
                    </div>
                    <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
                  </div>
                  <div className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <Label className="text-sm font-semibold">টপ সেলিং পণ্য</Label>
                      <p className="text-xs text-muted-foreground">হোমপেজে Top Selling Products সেকশনে দেখাবে</p>
                    </div>
                    <Switch checked={form.is_bestseller} onCheckedChange={(v) => setForm({ ...form, is_bestseller: v })} />
                  </div>
                  <div className="flex items-center justify-between border rounded-lg p-3 col-span-2">
                    <div>
                      <Label className="text-sm">পাবলিশ স্ট্যাটাস</Label>
                      <p className="text-xs text-muted-foreground">{form.is_active ? "সক্রিয়" : "ড্রাফট"}</p>
                    </div>
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  </div>
                </div>
              </TabsContent>

              {/* Description Tab */}
              <TabsContent value="description" className="space-y-4 mt-4">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">সংক্ষিপ্ত বিবরণ</Label>
                  <Textarea value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                    placeholder="পণ্যের সংক্ষিপ্ত বিবরণ লিখুন" rows={3} />
                  <p className="text-xs text-muted-foreground mt-1">{form.short_description.length}/200</p>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">বিস্তারিত বিবরণ</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="পণ্যের বিস্তারিত বিবরণ লিখুন..." rows={8} />
                </div>
              </TabsContent>

              {/* Landing Page Custom HTML Tab */}
              <TabsContent value="landing" className="space-y-4 mt-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block text-primary">কাস্টম ল্যান্ডিং পেজ ডিজাইন (HTML)</Label>
                  <p className="text-xs text-muted-foreground mb-4">এখানে HTML কোড দিয়ে প্রোডাক্ট পেজের একদম নিচে আপনার নিজস্ব ডিজাইন বসাতে পারবেন। খালি রাখলে ডিফল্ট ডিজাইন দেখাবে।</p>
                  <Textarea value={form.landing_page_html || ""} onChange={(e) => setForm({ ...form, landing_page_html: e.target.value })} 
                    placeholder="<div class='bg-primary/10 p-8'>...</div>" className="min-h-[400px] font-mono text-sm bg-slate-50" />
                </div>
              </TabsContent>

              {/* Media Tab (Images + Video) */}
              <TabsContent value="media" className="space-y-6 mt-4">
                {/* Images Section */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm flex items-center gap-2"><Image className="h-4 w-4" /> পণ্যের ছবি</h4>
                    <span className="text-[11px] font-bold text-primary">সঠিক মাপ: 800×800 বা 1000×1000 px</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">১:১ স্কয়ার অনুপাত। কম্পিউটার ও মোবাইল উভয় ডিভাইসেই পণ্য সম্পূর্ণ ও নিখুঁত দেখানোর জন্য আদর্শ সাইজ।</p>

                  {/* Upload Area */}
                  <div className="mb-3">
                    {hasCloudinary ? (
                      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                        {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                        <span className="text-sm font-medium">{uploading ? "আপলোড হচ্ছে..." : "ক্লিক করুন বা ড্র্যাগ করুন (800×800 px)"}</span>
                        <span className="text-xs text-muted-foreground">PNG, JPG, WEBP — ১:১ স্কয়ার ছবি অটো অপটিমাইজ হবে</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
                      </label>
                    ) : (
                      <div className="border-2 border-dashed rounded-lg p-6 text-center">
                        <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">ছবি আপলোড করতে <span className="text-primary font-medium">Settings → Cloudinary</span> সেটআপ করুন</p>
                        <p className="text-xs text-muted-foreground mt-1">অথবা নিচে URL দিয়ে ছবি যোগ করুন (সঠিক মাপ: 800×800 px)</p>
                      </div>
                    )}
                  </div>

                  {/* URL Input */}
                  <div className="flex gap-2 mb-3">
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="অথবা URL দিন: https://..." className="flex-1" />
                    <Button type="button" variant="outline" onClick={addImage} disabled={!imageUrl.trim()}>যোগ</Button>
                  </div>

                  {/* Image Grid / Gallery */}
                  {form.images.length > 0 ? (
                    <div className="grid grid-cols-4 gap-3">
                      {form.images.map((img, i) => (
                        <div key={i} className="relative group border rounded-lg overflow-hidden aspect-square">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            {i > 0 && (
                              <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={() => {
                                const imgs = [...form.images];
                                [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]];
                                setForm({ ...form, images: imgs });
                              }}>
                                ←
                              </Button>
                            )}
                            <Button variant="destructive" size="sm" className="h-7 w-7 p-0" onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            {i < form.images.length - 1 && (
                              <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={() => {
                                const imgs = [...form.images];
                                [imgs[i], imgs[i + 1]] = [imgs[i + 1], imgs[i]];
                                setForm({ ...form, images: imgs });
                              }}>
                                →
                              </Button>
                            )}
                          </div>
                          {i === 0 && <Badge className="absolute top-1 left-1 text-[10px]">প্রধান</Badge>}
                        </div>
                      ))}
                      {/* Add more images tile */}
                      {hasCloudinary && (
                        <label className="border-2 border-dashed rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5 text-muted-foreground" />}
                          <span className="text-[10px] text-muted-foreground mt-1">আরও ছবি</span>
                          <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
                        </label>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">এখনো কোনো ছবি যোগ করা হয়নি</p>
                  )}
                </div>

                {/* Video Section */}
                <div className="border-t pt-5">
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2"><Video className="h-4 w-4" /> পণ্যের ভিডিও</h4>

                  {hasCloudinary && (
                    <div className="mb-3">
                      <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                        {videoUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5 w-5 text-muted-foreground" />}
                        <span className="text-sm text-muted-foreground">{videoUploading ? "ভিডিও আপলোড হচ্ছে..." : "ভিডিও আপলোড করুন (Cloudinary)"}</span>
                        <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} disabled={videoUploading} />
                      </label>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">ভিডিও URL</Label>
                      <Input
                        value={form.video_url}
                        onChange={(e) => {
                          const url = e.target.value.trim();
                          const ytId = extractYouTubeId(url);
                          let thumb = form.video_thumbnail;
                          if (ytId && (!thumb || thumb.includes("youtube.com/watch") || thumb.includes("youtu.be/"))) {
                            thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
                          }
                          setForm({ ...form, video_url: url, video_thumbnail: thumb });
                        }}
                        placeholder="যেমন: https://www.youtube.com/watch?v=... বা Cloudinary ভিডিও লিংক"
                      />
                      {extractYouTubeId(form.video_url) && (
                        <p className="text-[11px] text-emerald-600 font-medium mt-1">
                          ✓ YouTube ভিডিও শনাক্ত হয়েছে (প্লেয়ার ও থাম্বনেইল স্বয়ংক্রিয়ভাবে প্রস্তুত)
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block">ভিডিও থাম্বনেইল URL (ঐচ্ছিক)</Label>
                      <Input
                        value={form.video_thumbnail}
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          const ytId = extractYouTubeId(val);
                          // If user accidentally pasted the video URL in thumbnail input, auto convert to image URL:
                          if (ytId) {
                            setForm({ ...form, video_thumbnail: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` });
                          } else {
                            setForm({ ...form, video_thumbnail: val });
                          }
                        }}
                        placeholder="YouTube হলে স্বয়ংক্রিয়ভাবে নিয়ে নেবে, অথবা ছবির URL দিন"
                      />
                      {form.video_thumbnail && (
                        <div className="mt-2 flex items-center gap-2">
                          <img
                            src={form.video_thumbnail}
                            alt="Thumbnail preview"
                            className="w-16 h-10 object-cover rounded border border-border"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <span className="text-[11px] text-muted-foreground">থাম্বনেইল প্রিভিউ</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {form.video_url && (
                    <div className="mt-4 border rounded-xl overflow-hidden bg-black shadow-sm">
                      {extractYouTubeId(form.video_url) ? (
                        <div className="aspect-video w-full">
                          <iframe
                            src={`https://www.youtube.com/embed/${extractYouTubeId(form.video_url)}`}
                            className="w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <video src={form.video_url} controls className="w-full max-h-56 bg-black" poster={form.video_thumbnail}>
                          আপনার ব্রাউজার ভিডিও সাপোর্ট করে না
                        </video>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Inventory Tab */}
              <TabsContent value="inventory" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">SKU</Label>
                    <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="NS-001" />
                  </div>
                  <div>
                    <Label className="text-xs font-medium mb-1.5 block">স্টক পরিমাণ</Label>
                    <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: +e.target.value })} />
                  </div>
                </div>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-medium text-sm mb-2">স্টক অবস্থা</h4>
                  <p className={`text-sm ${form.stock <= 0 ? "text-destructive" : form.stock <= 5 ? "text-yellow-600" : "text-green-600"}`}>
                    {form.stock <= 0 ? "স্টক নেই" : form.stock <= 5 ? `কম স্টক — মাত্র ${form.stock}টি বাকি` : `স্টকে আছে — ${form.stock}টি`}
                  </p>
                </div>
              </TabsContent>

              {/* Delivery & Payment Tab */}
              <TabsContent value="delivery" className="space-y-6 mt-4">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm border-b pb-2">পেমেন্ট নিয়ম</h4>
                  <div>
                    <Label className="text-xs font-medium mb-2 block">এই পণ্যের জন্য পেমেন্ট অপশন (একাধিক সিলেক্ট করা যাবে)</Label>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm border p-3 rounded-lg cursor-pointer hover:bg-muted/50">
                        <input type="checkbox" checked={form.payment_requirement?.split(",").map(c => c.trim()).includes("cod")} onChange={() => {
                          const current = form.payment_requirement ? form.payment_requirement.split(",").map(c => c.trim()).filter(Boolean) : [];
                          if (current.includes("cod")) {
                            setForm({ ...form, payment_requirement: current.filter(c => c !== "cod").join(",") });
                          } else {
                            setForm({ ...form, payment_requirement: [...current, "cod"].join(",") });
                          }
                        }} className="text-primary rounded" />
                        <span>ক্যাশ অন ডেলিভারি (সম্পূর্ণ টাকা ডেলিভারি ম্যানকে দিবে)</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm border p-3 rounded-lg cursor-pointer hover:bg-muted/50">
                        <input type="checkbox" checked={form.payment_requirement?.split(",").map(c => c.trim()).includes("delivery_advance")} onChange={() => {
                          const current = form.payment_requirement ? form.payment_requirement.split(",").map(c => c.trim()).filter(Boolean) : [];
                          if (current.includes("delivery_advance")) {
                            setForm({ ...form, payment_requirement: current.filter(c => c !== "delivery_advance").join(",") });
                          } else {
                            setForm({ ...form, payment_requirement: [...current, "delivery_advance"].join(",") });
                          }
                        }} className="text-primary rounded" />
                        <span>ডেলিভারি চার্জ আগে দিতে হবে (অ্যাডভান্সড)</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm border p-3 rounded-lg cursor-pointer hover:bg-muted/50">
                        <input type="checkbox" checked={form.payment_requirement?.split(",").map(c => c.trim()).includes("full_advance")} onChange={() => {
                          const current = form.payment_requirement ? form.payment_requirement.split(",").map(c => c.trim()).filter(Boolean) : [];
                          if (current.includes("full_advance")) {
                            setForm({ ...form, payment_requirement: current.filter(c => c !== "full_advance").join(",") });
                          } else {
                            setForm({ ...form, payment_requirement: [...current, "full_advance"].join(",") });
                          }
                        }} className="text-primary rounded" />
                        <span>সম্পূর্ণ টাকা আগে দিতে হবে (প্রিপেইড)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <h4 className="font-medium text-sm border-b pb-2">ডেলিভারি চার্জ</h4>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={form.delivery_type === "global"} onChange={() => setForm({ ...form, delivery_type: "global" })} />
                      <span>গ্লোবাল সেটিংস ব্যবহার করুন</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" checked={form.delivery_type === "custom"} onChange={() => setForm({ ...form, delivery_type: "custom" })} />
                      <span>এই পণ্যের জন্য আলাদা ডেলিভারি চার্জ</span>
                    </label>
                  </div>

                  {form.delivery_type === "custom" && (
                    <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/20">
                      <div>
                        <Label className="text-xs font-medium mb-1 block">সারা দেশ (৳)</Label>
                        <Input type="number" value={form.delivery_nationwide || ""} onChange={(e) => setForm({ ...form, delivery_nationwide: e.target.value ? +e.target.value : null })} placeholder="যেমন: 120" />
                      </div>
                      <div>
                        <Label className="text-xs font-medium mb-1 block">ঢাকার ভেতর (৳)</Label>
                        <Input type="number" value={form.delivery_inside_dhaka || ""} onChange={(e) => setForm({ ...form, delivery_inside_dhaka: e.target.value ? +e.target.value : null })} placeholder="যেমন: 60" />
                      </div>
                      <div>
                        <Label className="text-xs font-medium mb-1 block">ঢাকার বাহিরে (৳)</Label>
                        <Input type="number" value={form.delivery_outside_dhaka || ""} onChange={(e) => setForm({ ...form, delivery_outside_dhaka: e.target.value ? +e.target.value : null })} placeholder="যেমন: 120" />
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <label className="flex items-start gap-3 border p-3.5 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={!!form.is_separate_delivery}
                        onChange={(e) => setForm({ ...form, is_separate_delivery: e.target.checked })}
                        className="text-primary rounded h-4 w-4 mt-0.5 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium text-foreground block">
                          প্রত্যেক প্রোডাক্ট এর আলাদা ডেলিভারি চার্জ
                        </span>
                        <span className="text-xs text-muted-foreground block">
                          ইনেবল করলে কার্টে অন্য পণ্য থাকলেও বা পণ্যের পরিমাণ (কোয়ান্টিটি) বাড়লে প্রতিটির ডেলিভারি চার্জ আলাদাভাবে গুণ/যোগ হবে (যেমন: ডেলিভারি চার্জ ৩ টাকা হলে ২টি পণ্যের জন্য ৩×২=৬ টাকা)। অফ রাখলে কার্টের সর্বোচ্চ ডেলিভারি চার্জ একবারই প্রযোজ্য হবে।
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              </TabsContent>

              {/* SEO Tab */}
              <TabsContent value="seo" className="space-y-4 mt-4">
                <div className="border rounded-lg p-4 bg-muted/30 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">SEO স্কোর</h4>
                    <span className={`text-lg font-bold ${seoColor}`}>{seoScore}/100</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${seoScore >= 70 ? "bg-green-500" : seoScore >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${seoScore}%` }} />
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <p className={form.focus_keyword ? "text-green-600" : "text-muted-foreground"}>
                      {form.focus_keyword ? "✓" : "○"} ফোকাস কীওয়ার্ড সেট করা হয়েছে
                    </p>
                    <p className={form.meta_title ? "text-green-600" : "text-muted-foreground"}>
                      {form.meta_title ? "✓" : "○"} SEO টাইটেল {form.meta_title && `(${form.meta_title.length})`}
                    </p>
                    <p className={form.meta_description ? "text-green-600" : "text-muted-foreground"}>
                      {form.meta_description ? "✓" : "○"} মেটা ডেসক্রিপশন {form.meta_description && `(${form.meta_description.length})`}
                    </p>
                    {form.focus_keyword && (
                      <>
                        <p className={form.meta_title.toLowerCase().includes(form.focus_keyword.toLowerCase()) ? "text-green-600" : "text-red-500"}>
                          {form.meta_title.toLowerCase().includes(form.focus_keyword.toLowerCase()) ? "✓" : "✗"} কীওয়ার্ড SEO টাইটেলে আছে
                        </p>
                        <p className={form.meta_description.toLowerCase().includes(form.focus_keyword.toLowerCase()) ? "text-green-600" : "text-red-500"}>
                          {form.meta_description.toLowerCase().includes(form.focus_keyword.toLowerCase()) ? "✓" : "✗"} কীওয়ার্ড মেটা ডেসক্রিপশনে আছে
                        </p>
                        <p className={form.name.toLowerCase().includes(form.focus_keyword.toLowerCase()) ? "text-green-600" : "text-red-500"}>
                          {form.name.toLowerCase().includes(form.focus_keyword.toLowerCase()) ? "✓" : "✗"} কীওয়ার্ড পণ্যের নামে আছে
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium mb-1.5 block">ফোকাস কীওয়ার্ড</Label>
                  <Input value={form.focus_keyword} onChange={(e) => setForm({ ...form, focus_keyword: e.target.value })} placeholder="অর্গানিক নারকেল তেল" />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">SEO টাইটেল</Label>
                  <Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} placeholder={form.name || "SEO টাইটেল"} />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-muted-foreground">গুগলে যে টাইটেল দেখাবে</p>
                    <p className={`text-xs ${form.meta_title.length > 60 ? "text-red-500" : "text-muted-foreground"}`}>{form.meta_title.length}/60</p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">মেটা ডেসক্রিপশন</Label>
                  <Textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
                    placeholder="গুগল সার্চে যে বিবরণ দেখাবে..." rows={3} />
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-muted-foreground">সার্চ রেজাল্টের বিবরণ</p>
                    <p className={`text-xs ${form.meta_description.length > 160 ? "text-red-500" : "text-muted-foreground"}`}>{form.meta_description.length}/160</p>
                  </div>
                </div>

                {/* Google Preview */}
                <div className="border rounded-lg p-4 bg-background">
                  <h4 className="text-xs font-medium text-muted-foreground mb-3">গুগল প্রিভিউ</h4>
                  <div className="space-y-0.5">
                    <p className="text-[#1a0dab] text-lg leading-tight">{form.meta_title || form.name || "পণ্যের নাম"} — Natural Shefa</p>
                    <p className="text-[#006621] text-sm">naturalshefa.com/product/{form.slug || "product-slug"}</p>
                    <p className="text-sm text-[#545454] line-clamp-2">{form.meta_description || form.short_description || "পণ্যের বিবরণ..."}</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Save */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name || !form.price} className="min-w-[140px]">
                {saveMutation.isPending ? "সেভ হচ্ছে..." : editing ? "আপডেট করুন" : "পাবলিশ করুন"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProducts;
