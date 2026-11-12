import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Image, Upload, Loader2, GripVertical, Smartphone, Monitor, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";

const AdminHeroSlides = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    image_url: "",
    mobile_image_url: "",
    link_url: "",
    title: "",
    sort_order: 0,
    is_active: true,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*");
      const map: Record<string, any> = {};
      data?.forEach((s: any) => { map[s.key || s.setting_key] = { id: s.id, value: s.value || s.setting_value }; });
      return map;
    },
  });

  const { data: slides } = useQuery({
    queryKey: ["admin-hero-slides"],
    queryFn: async () => {
      const { data } = await supabase.from("hero_slides").select("*").order("sort_order");
      return data || [];
    },
  });

  // Side promo banner state
  const [promoForm, setPromoForm] = useState({
    enabled: true,
    image_url: "",
    link_url: "",
    title: "",
    open_in_new_tab: false,
  });
  const [promoUploading, setPromoUploading] = useState(false);

  useEffect(() => {
    if (settings?.hero_promo_banner?.value) {
      try {
        const val = settings.hero_promo_banner.value;
        const parsed = typeof val === "string" ? JSON.parse(val) : val;
        if (parsed && typeof parsed === "object") {
          setPromoForm({
            enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : true,
            image_url: parsed.image_url || "",
            link_url: parsed.link_url || "",
            title: parsed.title || "",
            open_in_new_tab: Boolean(parsed.open_in_new_tab),
          });
        }
      } catch (err) {
        console.error("Failed to parse hero_promo_banner setting", err);
      }
    }
  }, [settings]);

  const savePromoMutation = useMutation({
    mutationFn: async (promoData: any) => {
      const existing = settings?.hero_promo_banner;
      if (existing) {
        const { error } = await supabase
          .from("site_settings")
          .update({ value: promoData })
          .eq("key", "hero_promo_banner");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("site_settings")
          .insert({ key: "hero_promo_banner", value: promoData });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["hero-promo-banner"] });
      toast.success("সাইড প্রোমো ব্যানার সংরক্ষণ হয়েছে");
    },
    onError: (e: any) => toast.error(e.message || "সংরক্ষণ ব্যর্থ হয়েছে"),
  });

  const uploadPromoImage = useCallback(async (file: File) => {
    setPromoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const result = await res.json();
      if (result.secure_url) {
        setPromoForm((f) => {
          const updated = { ...f, image_url: result.secure_url };
          savePromoMutation.mutate(updated);
          return updated;
        });
        toast.success("প্রোমো ব্যানার ছবি আপলোড ও সেভ হয়েছে");
      } else {
        toast.error("ছবি পাওয়া যায়নি");
      }
    } catch {
      toast.error("আপলোড ব্যর্থ হয়েছে");
    } finally {
      setPromoUploading(false);
    }
  }, [savePromoMutation]);

  const uploadImage = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const result = await res.json();
      setForm((f) => ({ ...f, image_url: result.secure_url }));
      toast.success("প্রধান ব্যানার ছবি আপলোড হয়েছে");
    } catch { toast.error("আপলোড ব্যর্থ"); }
    finally { setUploading(false); }
  }, []);

  const uploadMobileImage = useCallback(async (file: File) => {
    setUploadingMobile(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const result = await res.json();
      setForm((f) => ({ ...f, mobile_image_url: result.secure_url }));
      toast.success("মোবাইল ব্যানার ছবি আপলোড হয়েছে");
    } catch { toast.error("মোবাইল ব্যানার আপলোড ব্যর্থ"); }
    finally { setUploadingMobile(false); }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editing) {
        const { error } = await supabase.from("hero_slides").update(data).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hero_slides").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["hero-slides"] });
      toast.success(editing ? "স্লাইড আপডেট হয়েছে" : "স্লাইড যোগ হয়েছে");
      setOpen(false);
      setEditing(null);
      setForm({ image_url: "", mobile_image_url: "", link_url: "", title: "", sort_order: 0, is_active: true });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hero_slides").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["hero-slides"] });
      toast.success("স্লাইড মুছে ফেলা হয়েছে");
    },
  });

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      image_url: s.image_url,
      mobile_image_url: s.mobile_image_url || "",
      link_url: s.link_url || "",
      title: s.title || "",
      sort_order: s.sort_order || 0,
      is_active: s.is_active,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Side Promo Banner Card */}
      <div className="bg-card border rounded-2xl p-5 md:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">সাইড প্রোমো ব্যানার (ডেস্কটপ ভিউ)</h2>
              {promoForm.enabled && promoForm.image_url ? (
                <span className="bg-emerald-500/15 text-emerald-600 text-xs px-2.5 py-0.5 rounded-full font-medium">সক্রিয়</span>
              ) : (
                <span className="bg-muted text-muted-foreground text-xs px-2.5 py-0.5 rounded-full">বন্ধ</span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              ডেস্কটপ ভিউতে হিরো স্লাইডারের ডান পাশে এই ব্যানারটি দেখাবে। ফোন ভিউতে এটি প্রদর্শিত হবে না (স্বয়ংক্রিয়ভাবে বন্ধ থাকবে)।
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor="promo-toggle" className="text-sm font-medium cursor-pointer">
              {promoForm.enabled ? "চালু আছে" : "বন্ধ আছে"}
            </Label>
            <Switch
              id="promo-toggle"
              checked={promoForm.enabled}
              onCheckedChange={(v) => setPromoForm((f) => ({ ...f, enabled: v }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Left: Image Upload & Preview */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">ব্যানার ছবি *</Label>
              <span className="text-[11px] font-bold text-primary">সঠিক মাপ: 500×450 px (বা 600×550 px)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              উচ্চতা ৪৫০ px যা বাম পাশের প্রধান স্লাইডারের উচ্চতার সাথে ১০০% নিখুঁতভাবে সমান (Equal Height) থাকবে। অনুপাত ১.১:১ বা ১০:৯।
            </p>
            {promoForm.image_url ? (
              <div className="relative rounded-xl overflow-hidden border bg-muted/30 aspect-[4/3] max-h-56">
                <img
                  src={promoForm.image_url}
                  alt="Promo preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPromoForm((f) => ({ ...f, image_url: "" }))}
                  className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 shadow hover:bg-destructive/90 transition-colors"
                  title="ছবি মুছুন"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer hover:bg-secondary/40 transition-colors">
                {promoUploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-8 w-8 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground mt-2 font-medium">
                  {promoUploading ? "আপলোড হচ্ছে..." : "ছবি আপলোড করুন (বা সিলেক্ট করুন)"}
                </span>
                <span className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) uploadPromoImage(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            )}

            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">অথবা ছবির সরাসরি লিংক (Image URL)</Label>
              <Input
                value={promoForm.image_url}
                onChange={(e) => setPromoForm((f) => ({ ...f, image_url: e.target.value }))}
                placeholder="https://..."
                className="mt-1 text-xs"
              />
            </div>
          </div>

          {/* Right: Link & Title & Save */}
          <div className="space-y-4">
            <div>
              <Label>লিংক URL (ক্লিক করলে যেখানে যাবে)</Label>
              <Input
                value={promoForm.link_url}
                onChange={(e) => setPromoForm((f) => ({ ...f, link_url: e.target.value }))}
                placeholder="যেমন: /product/african-organic-wild-honey বা /category/honey"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                গ্রাহক ব্যানারে ক্লিক করলে নির্দিষ্ট পণ্য বা ক্যাটাগরিতে যাবে।
              </p>
            </div>

            <div>
              <Label>ব্যানার টাইটেল / Alt Text (ঐচ্ছিক)</Label>
              <Input
                value={promoForm.title}
                onChange={(e) => setPromoForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="যেমন: আফ্রিকান অর্গানিক ওয়াইল্ড হানি"
                className="mt-1"
              />
            </div>

            <div className="pt-2">
              <Button
                onClick={() => savePromoMutation.mutate(promoForm)}
                disabled={savePromoMutation.isPending}
                className="gap-2"
              >
                {savePromoMutation.isPending ? "সংরক্ষণ হচ্ছে..." : "প্রোমো ব্যানার সংরক্ষণ করুন"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Hero Slider List */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">প্রধান হিরো স্লাইডার ({slides?.length || 0})</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ওয়েবসাইটের হোমপেইজের প্রধান স্লাইডার ব্যানারসমূহ পরিচালনা করুন।
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setEditing(null);
              setForm({
                image_url: "",
                mobile_image_url: "",
                link_url: "",
                title: "",
                sort_order: 0,
                is_active: true,
              });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-1 shrink-0"><Plus className="h-4 w-4" /> স্লাইড যোগ</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "স্লাইড সম্পাদনা" : "নতুন স্লাইড"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Guidance Box */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-bold text-foreground flex items-center gap-1.5 text-xs sm:text-[13px]">
                  <Sparkles className="h-4 w-4 text-primary shrink-0" /> ব্যানার সাইজ ও অনুপাত গাইড (ফোন ও পিসির জন্য):
                </p>
                <div className="space-y-1 pt-1 leading-relaxed">
                  <p>• <strong>প্রোমো ব্যানার বন্ধ থাকলে (ফুল-উইডথ):</strong> <span className="text-foreground font-semibold">1920 × 600 px</span> অথবা <span className="text-foreground font-semibold">1400 × 440 px</span> (অনুপাত ৩.২ : ১)।</p>
                  <p>• <strong>সাইড প্রোমো ব্যানার চালু থাকলে:</strong> প্রধান স্লাইডার <span className="text-foreground font-semibold">1000 × 450 px</span> এবং সাইড ব্যানার <span className="text-foreground font-semibold">500 × 450 px</span> (উভয়ের উচ্চতা সমান ৪৫০ px)।</p>
                  <p>• <strong>মোবাইল ব্যানার (ঐচ্ছিক):</strong> <span className="text-foreground font-semibold">750 × 450 px</span> বা <span className="text-foreground font-semibold">800 × 500 px</span>। এটি ফাঁকা রাখলে প্রধান ব্যানারটিই মোবাইলে সম্পূর্ণ দৃশ্যমান থাকবে।</p>
                  <p>• <strong>সেফ জোন:</strong> মূল টেক্সট ও পণ্য মাঝখানের অংশে রাখুন, দুই পাশে কিছুটা ফাঁকা রাখুন যাতে কোনো ডিভাইসেই কোনো অংশ না কাটে।</p>
                </div>
              </div>

              {/* Main Desktop Banner */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 font-semibold">
                    <Monitor className="h-4 w-4 text-muted-foreground" /> প্রধান ব্যানার ছবি (পিসি / ডেস্কটপ) *
                  </Label>
                  <span className="text-[11px] font-bold text-primary">1920×600 px (বা 1400×440 px)</span>
                </div>
                {form.image_url ? (
                  <div className="relative mt-2 rounded-lg overflow-hidden border">
                    <img src={form.image_url} alt="Preview" className="w-full h-40 object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                      className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="mt-2 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:bg-secondary/50 transition-colors">
                    {uploading ? <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
                    <span className="text-sm font-medium text-foreground mt-2">{uploading ? "আপলোড হচ্ছে..." : "প্রধান ব্যানার আপলোড করুন (1920×600 px)"}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">JPG, PNG, WebP — আল্ট্রা-ওয়াইড অনুপাত ৩.২:১</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); e.target.value = ""; }} />
                  </label>
                )}
              </div>

              {/* Optional Mobile Banner */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5 font-semibold">
                    <Smartphone className="h-4 w-4 text-muted-foreground" /> মোবাইল ব্যানার ছবি (ঐচ্ছিক)
                  </Label>
                  <span className="text-[11px] font-bold text-muted-foreground">750×450 px বা 800×500 px</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                  মোবাইল স্ক্রিনে ভিন্ন বা বড় লেখার ব্যানার দেখাতে চাইলে আপলোড করুন। খালি রাখলে স্বয়ংক্রিয়ভাবে প্রধান ব্যানারটিই মোবাইলে সম্পূর্ণ দেখাবে।
                </p>
                {form.mobile_image_url ? (
                  <div className="relative mt-2 rounded-lg overflow-hidden border">
                    <img src={form.mobile_image_url} alt="Mobile Preview" className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, mobile_image_url: "" }))}
                      className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-secondary/50 transition-colors">
                    {uploadingMobile ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                    <span className="text-xs font-medium text-foreground mt-1.5">{uploadingMobile ? "আপলোড হচ্ছে..." : "মোবাইল ব্যানার আপলোড করুন (ঐচ্ছিক)"}</span>
                    <span className="text-[10px] text-muted-foreground">JPG, PNG, WebP — ফোন ভিউর জন্য উপযোগী</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadMobileImage(e.target.files[0]); e.target.value = ""; }} />
                  </label>
                )}
              </div>

              <div>
                <Label>লিংক URL (ক্লিক করলে যেখানে যাবে)</Label>
                <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="যেমন: /product/my-product বা https://..." className="mt-1" />
              </div>
              <div>
                <Label>টাইটেল (ঐচ্ছিক)</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ব্যানার শিরোনাম" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>সর্ট অর্ডার</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })} className="mt-1" />
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label>সক্রিয়</Label>
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                </div>
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.image_url}>
                {saveMutation.isPending ? "সেভ হচ্ছে..." : editing ? "আপডেট করুন" : "যোগ করুন"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {slides?.map((s: any) => (
          <div key={s.id} className="bg-card border rounded-xl overflow-hidden">
            <div className="relative">
              <img src={s.image_url} alt={s.title || "Slide"} className="w-full h-40 object-cover" />
              {!s.is_active && (
                <span className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full">নিষ্ক্রিয়</span>
              )}
            </div>
            <div className="p-3 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">{s.title || "Untitled"}</p>
                  {s.mobile_image_url && (
                    <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 flex items-center gap-1">
                      <Smartphone className="h-2.5 w-2.5" /> মোবাইল
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{s.link_url || "কোনো লিংক নেই"} • অর্ডার: {s.sort_order}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("মুছে ফেলতে চান?")) deleteMutation.mutate(s.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!slides?.length && <p className="text-center text-muted-foreground py-8">কোনো স্লাইড নেই</p>}
    </div>
  );
};

export default AdminHeroSlides;
