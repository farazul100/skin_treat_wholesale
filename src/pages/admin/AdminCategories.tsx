import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, FolderOpen, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

const emptyCategory = { name: "", slug: "", image: "", sort_order: 0, is_active: true, show_on_home: false };

const AdminCategories = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyCategory);
  const [uploading, setUploading] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*");
      const map: Record<string, any> = {};
      data?.forEach((s: any) => { map[s.key || s.setting_key] = { id: s.id, value: s.value || s.setting_value }; });
      return map;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return data || [];
    },
  });

  const uploadImage = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const result = await res.json();
      setForm((f) => ({ ...f, image: result.secure_url }));
      toast.success("ছবি আপলোড হয়েছে");
    } catch { toast.error("আপলোড ব্যর্থ"); }
    finally { setUploading(false); }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
      const payload = { ...data, slug };
      if (editing) {
        const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["header-categories"] });
      queryClient.invalidateQueries({ queryKey: ["home-categorized-products"] });
      toast.success(editing ? "ক্যাটেগরি আপডেট হয়েছে" : "ক্যাটেগরি যোগ হয়েছে");
      setOpen(false);
      setEditing(null);
      setForm(emptyCategory);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["header-categories"] });
      queryClient.invalidateQueries({ queryKey: ["home-categorized-products"] });
      toast.success("ক্যাটেগরি মুছে ফেলা হয়েছে");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (cat: any) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      image: cat.image || "",
      sort_order: cat.sort_order || 0,
      is_active: cat.is_active !== undefined ? !!cat.is_active : true,
      show_on_home: cat.show_on_home !== undefined ? !!cat.show_on_home : false,
    });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ক্যাটেগরি ({categories?.length || 0})</h1>
          <p className="text-sm text-muted-foreground">ছবির রেকমেন্ডেড সাইজ: <strong>200×200px</strong> (1:1 স্কয়ার)</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(emptyCategory); } }}>
          <DialogTrigger asChild>
            <Button className="gap-1"><Plus className="h-4 w-4" /> ক্যাটেগরি যোগ করুন</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editing ? "ক্যাটেগরি সম্পাদনা" : "নতুন ক্যাটেগরি"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>নাম *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="যেমন: ত্বকের যত্ন" />
              </div>
              <div>
                <Label>স্লাগ</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="স্বয়ংক্রিয়" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>ছবি</Label>
                  <span className="text-[11px] font-bold text-primary">সঠিক মাপ: 400×400 px</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">১:১ স্কয়ার রেশিও (400×400 বা 500×500 px)। ট্রান্সপারেন্ট ব্যাকগ্রাউন্ড PNG বা WebP রিকমেন্ডেড।</p>
                {form.image ? (
                  <div className="relative mt-2 w-24 h-24 rounded-lg overflow-hidden border">
                    <img src={form.image} alt="Category" className="w-full h-full object-cover" />
                    <button onClick={() => setForm((f) => ({ ...f, image: "" }))} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="mt-2 flex items-center gap-2 border-2 border-dashed rounded-lg p-3 cursor-pointer hover:bg-secondary/50">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm text-muted-foreground">{uploading ? "আপলোড হচ্ছে..." : "ছবি আপলোড (400×400px)"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); e.target.value = ""; }} />
                  </label>
                )}
              </div>
              <div>
                <Label>সর্ট অর্ডার</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })} />
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <div>
                  <Label>সক্রিয়</Label>
                  <p className="text-[11px] text-muted-foreground">ক্যাটাগরি ওয়েবসাইটে সচল থাকবে</p>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <div>
                  <Label>হোম পেজে দেখান</Label>
                  <p className="text-[11px] text-muted-foreground">হোম পেজে এই ক্যাটাগরির প্রোডাক্ট স্লাইডার দেখাবে</p>
                </div>
                <Switch checked={form.show_on_home} onCheckedChange={(v) => setForm({ ...form, show_on_home: v })} />
              </div>
              <Button className="w-full mt-2" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.name}>
                {saveMutation.isPending ? "সেভ হচ্ছে..." : editing ? "আপডেট করুন" : "যোগ করুন"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {categories?.map((cat: any) => (
          <div key={cat.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
            {cat.image ? (
              <img src={cat.image} alt={cat.name} className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-foreground">{cat.name}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                <span>/{cat.slug}</span>
                <span>অর্ডার: {cat.sort_order}</span>
                {cat.show_on_home ? (
                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-semibold border border-emerald-200">
                    হোমে সচল
                  </span>
                ) : null}
                {!cat.is_active && <span className="text-destructive font-medium">নিষ্ক্রিয়</span>}
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("মুছে ফেলতে চান?")) deleteMutation.mutate(cat.id); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {categories?.length === 0 && <p className="text-center text-muted-foreground py-8">কোনো ক্যাটেগরি নেই</p>}
      </div>
    </div>
  );
};

export default AdminCategories;
