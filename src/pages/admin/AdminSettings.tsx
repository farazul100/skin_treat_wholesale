import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Copy, ExternalLink, ShieldCheck, Eye, EyeOff, CreditCard, RefreshCw } from "lucide-react";

const FaviconUpload = ({ settings, updateMutation }: { settings: any; updateMutation: any }) => {
  const [faviconUrl, setFaviconUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (settings?.site_favicon) setFaviconUrl(settings.site_favicon.value?.url || "");
  }, [settings]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const result = await res.json();
      setFaviconUrl(result.secure_url);
      updateMutation.mutate({ key: "site_favicon", value: { url: result.secure_url } });
    } catch { toast.error("ফেভিকন আপলোড ব্যর্থ"); }
    finally { setUploading(false); }
  };

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-foreground">ফেভিকন (Favicon)</h3>
        <span className="text-[11px] font-bold text-primary">সঠিক মাপ: 64×64 বা 128×128 px</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">১:১ স্কয়ার রেশিও (PNG, ICO, বা SVG)। ব্রাউজার ট্যাবে ওয়েবসাইটের আইকন হিসেবে নিখুঁত দেখাবে।</p>
      <div className="flex items-center gap-4">
        {faviconUrl ? (
          <div className="relative group">
            <img src={faviconUrl} alt="Favicon" className="h-10 w-10 object-contain border rounded-lg p-1" />
            <button onClick={() => { setFaviconUrl(""); updateMutation.mutate({ key: "site_favicon", value: { url: "" } }); }}
              className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="h-10 w-10 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
            <Upload className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1">
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild disabled={uploading}>
              <span>{uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> আপলোড হচ্ছে...</> : "ফেভিকন আপলোড"}</span>
            </Button>
            <input type="file" accept="image/png,image/x-icon,image/svg+xml" className="hidden" onChange={(e) => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = ""; }} />
          </label>
          <p className="text-xs text-muted-foreground mt-1">সঠিক সাইজ: 64×64 px বা 128×128 px (PNG, ICO, বা SVG)।</p>
        </div>
      </div>
    </div>
  );
};

const SocialShareBannerUpload = ({ settings, updateMutation }: { settings: any; updateMutation: any }) => {
  const [ogUrl, setOgUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (settings?.og_banner) setOgUrl(settings.og_banner.value?.url || "");
    else if (settings?.social_share_banner) setOgUrl(settings.social_share_banner.value?.url || "");
  }, [settings]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const result = await res.json();
      setOgUrl(result.secure_url);
      updateMutation.mutate({ key: "og_banner", value: { url: result.secure_url } });
      toast.success("সোশ্যাল শেয়ার ব্যানার আপডেট হয়েছে");
    } catch {
      toast.error("ব্যানার আপলোড ব্যর্থ");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-foreground">সোশ্যাল শেয়ার প্রিভিউ ব্যানার (WhatsApp, Telegram, Facebook)</h3>
        <span className="text-[11px] font-bold text-primary">সঠিক মাপ: 1200×630 px</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        অনুপাত ১.৯১:১ (JPG বা PNG)। ফেসবুক, টেলিগ্রাম বা হোয়াটসঅ্যাপে লিংক শেয়ার করলে এই ব্যানারটি সম্পূর্ণ দেখাবে। খালি রাখলে হোমপেইজের সক্রিয় স্লাইডারটি স্বয়ংক্রিয়ভাবে দেখাবে।
      </p>
      <div className="space-y-4">
        {ogUrl ? (
          <div className="relative group max-w-md">
            <img src={ogUrl} alt="Social Share Banner" className="w-full h-36 object-cover rounded-lg border shadow-sm" />
            <button
              onClick={() => { setOgUrl(""); updateMutation.mutate({ key: "og_banner", value: { url: "" } }); }}
              className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              title="মুছে ফেলুন"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="border-2 border-dashed rounded-lg p-5 text-center text-muted-foreground max-w-md bg-muted/20">
            <Upload className="h-6 w-6 mx-auto mb-1 opacity-60" />
            <p className="text-xs">কোনো কাস্টম ব্যানার আপলোড নেই — হোমপেইজের সক্রিয় স্লাইডার ব্যানারটি স্বয়ংক্রিয়ভাবে প্রিভিউ হবে।</p>
          </div>
        )}
        <div>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild disabled={uploading}>
              <span>{uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> আপলোড হচ্ছে...</> : "কাস্টম শেয়ার ব্যানার আপলোড করুন (1200×630 px)"}</span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = ""; }} />
          </label>
          <p className="text-xs text-muted-foreground mt-1">সঠিক রেজোলিউশন: ১২০০ × ৬৩০ পিক্সেল (অনুপাত ১.৯১:১, JPG বা PNG)।</p>
        </div>
      </div>
    </div>
  );
};

const ChangeAdminPassword = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("নতুন পাসওয়ার্ড দুটি মিলছে না");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে");
      }
      toast.success(data.message || "পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border rounded-xl p-5">
      <h3 className="font-bold text-foreground mb-1">অ্যাডমিন পাসওয়ার্ড পরিবর্তন</h3>
      <p className="text-sm text-muted-foreground mb-4">প্যানেলের নিরাপত্তা নিশ্চিত করতে শক্তিশালী পাসওয়ার্ড ব্যবহার করুন</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label>বর্তমান পাসওয়ার্ড</Label>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="বর্তমান পাসওয়ার্ড দিন"
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label>নতুন পাসওয়ার্ড</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="কমপক্ষে ৬ অক্ষরের নতুন পাসওয়ার্ড"
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label>নতুন পাসওয়ার্ড নিশ্চিত করুন</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="নতুন পাসওয়ার্ডটি পুনরায় লিখুন"
            required
            className="mt-1"
          />
        </div>
        <Button type="submit" variant="outline" className="mt-2" disabled={loading}>
          {loading ? "পরিবর্তন হচ্ছে..." : "পাসওয়ার্ড আপডেট করুন"}
        </Button>
      </form>
    </div>
  );
};

const MetaCatalogFeedCard = () => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "rogjosgrwrlblpslmocr";
  const base = `https://${projectId}.supabase.co/functions/v1/meta-catalog-feed`;
  const csvUrl = `${base}?format=csv`;
  const xmlUrl = `${base}?format=xml`;

  const copy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} URL কপি হয়েছে`);
    } catch {
      toast.error("কপি করতে সমস্যা হয়েছে");
    }
  };

  return (
    <div className="bg-card border rounded-xl p-5">
      <h3 className="font-bold text-foreground mb-1">Meta Catalog Feed</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Facebook/Instagram Catalog Ads (Advantage+ / Multi-product) চালানোর জন্য নিচের URL টি Meta Commerce Manager-এ Data Feed হিসেবে দিন। সব active প্রোডাক্ট অটোমেটিক যুক্ত হবে।
      </p>

      <div className="space-y-3">
        <div>
          <Label>CSV Feed URL (Recommended)</Label>
          <div className="flex gap-2 mt-1">
            <Input value={csvUrl} readOnly className="flex-1 text-xs font-mono" onFocus={(e) => e.target.select()} />
            <Button type="button" variant="outline" size="icon" onClick={() => copy(csvUrl, "CSV")} title="কপি">
              <Copy className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" asChild title="ব্রাউজারে দেখুন">
              <a href={csvUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          </div>
        </div>

        <div>
          <Label>XML Feed URL (Google Shopping format)</Label>
          <div className="flex gap-2 mt-1">
            <Input value={xmlUrl} readOnly className="flex-1 text-xs font-mono" onFocus={(e) => e.target.select()} />
            <Button type="button" variant="outline" size="icon" onClick={() => copy(xmlUrl, "XML")} title="কপি">
              <Copy className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" asChild title="ব্রাউজারে দেখুন">
              <a href={xmlUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          </div>
        </div>

        <div className="bg-secondary/40 rounded-lg p-3 text-xs text-muted-foreground space-y-1.5">
          <p className="font-semibold text-foreground">কীভাবে ব্যবহার করবেন:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li><a href="https://business.facebook.com/commerce" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta Commerce Manager</a> খুলুন → Catalog → Data Sources</li>
            <li><strong>Add Items → Use Bulk Upload → Scheduled Feed</strong> সিলেক্ট করুন</li>
            <li>উপরের <strong>CSV URL</strong> পেস্ট করুন (auth লাগবে না — public)</li>
            <li>Schedule: Daily সিলেক্ট করুন → Currency: BDT → Save</li>
            <li>Catalog তৈরি হলে Ads Manager-এ Catalog Sales / Advantage+ Catalog campaign চালু করুন</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

const AdminSettings = () => {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*");
      const map: Record<string, any> = {};
      data?.forEach((s: any) => { map[s.key || s.setting_key] = { id: s.id, value: s.value || s.setting_value }; });
      return map;
    },
  });

  const [paymentEnabled, setPaymentEnabled] = useState(false);
  // EPS Payment Gateway state
  const [epsEnabled, setEpsEnabled] = useState(false);
  const [epsMode, setEpsMode] = useState<"sandbox" | "live">("sandbox");
  const [epsUsername, setEpsUsername] = useState("");
  const [epsPassword, setEpsPassword] = useState("");
  const [epsHashKey, setEpsHashKey] = useState("");
  const [epsMerchantId, setEpsMerchantId] = useState("");
  const [epsStoreId, setEpsStoreId] = useState("");
  const [epsApiUrl, setEpsApiUrl] = useState("https://pgapi.eps.com.bd");
  const [showPassword, setShowPassword] = useState(false);
  const [showHashKey, setShowHashKey] = useState(false);
  const [epsTesting, setEpsTesting] = useState(false);

  const [insideDhaka, setInsideDhaka] = useState(60);
  const [outsideDhaka, setOutsideDhaka] = useState(120);
  const [pixelEnabled, setPixelEnabled] = useState(false);
  const [pixelId, setPixelId] = useState("");
  const [pixelToken, setPixelToken] = useState("");
  const [pixelTestCode, setPixelTestCode] = useState("");
  const [cloudName, setCloudName] = useState("");
  const [uploadPreset, setUploadPreset] = useState("");
  const [steadfastApiKey, setSteadfastApiKey] = useState("");
  const [steadfastSecretKey, setSteadfastSecretKey] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [categoriesEnabled, setCategoriesEnabled] = useState(false);
  const [catDesktopCols, setCatDesktopCols] = useState(6);
  const [catMobileCols, setCatMobileCols] = useState(3);
  const [catTitle, setCatTitle] = useState("Featured Categories");
  const [siteTitle, setSiteTitle] = useState("");
  const [themeColor, setThemeColor] = useState("#1f7a2e");

  useEffect(() => {
    if (settings) {
      const pg = settings.payment_gateway?.value;
      if (pg) {
        setEpsEnabled(pg.enabled || false);
        setPaymentEnabled(pg.enabled || false);
        setEpsMode(pg.mode || "sandbox");
        setEpsUsername(pg.username || "");
        setEpsPassword(pg.password || "");
        setEpsHashKey(pg.hash_key || "");
        setEpsMerchantId(pg.merchant_id || "");
        setEpsStoreId(pg.store_id || "");
        setEpsApiUrl(pg.api_url || "https://pgapi.eps.com.bd");
      }
      setInsideDhaka(settings.delivery_charge?.value?.inside_dhaka || 60);
      setOutsideDhaka(settings.delivery_charge?.value?.outside_dhaka || 120);
      setPixelEnabled(settings.facebook_pixel?.value?.enabled || false);
      setPixelId(settings.facebook_pixel?.value?.pixel_id || "");
      setPixelToken(settings.facebook_pixel?.value?.access_token || "");
      setPixelTestCode(settings.facebook_pixel?.value?.test_event_code || "");
      setCloudName(settings.cloudinary?.value?.cloud_name || "");
      setUploadPreset(settings.cloudinary?.value?.upload_preset || "");
      setSteadfastApiKey(settings.steadfast?.value?.api_key || "");
      setSteadfastSecretKey(settings.steadfast?.value?.secret_key || "");
      setLogoUrl(settings.site_logo?.value?.url || "");
      setWhatsappNumber(settings.whatsapp_number?.value?.number || "");
      setWebhookUrl(settings.order_webhook?.value?.url || "");
      setWebhookSecret(settings.order_webhook?.value?.secret_key || "");
      setWebhookEnabled(settings.order_webhook?.value?.enabled || false);
      setCategoriesEnabled(settings.categories_enabled?.value?.enabled || false);
      setCatDesktopCols(settings.category_grid?.value?.desktop || 6);
      setCatMobileCols(settings.category_grid?.value?.mobile || 3);
      setCatTitle(settings.category_grid?.value?.title || "Featured Categories");
      setSiteTitle(settings.site_title?.value?.title || "");
      setThemeColor(settings.theme_color?.value?.primary_hex || "#1f7a2e");
    }
  }, [settings]);

  const handleSaveEps = (overrideEnabled?: boolean) => {
    const isEn = typeof overrideEnabled === "boolean" ? overrideEnabled : epsEnabled;
    updateMutation.mutate({
      key: "payment_gateway",
      value: {
        enabled: isEn,
        provider: "eps",
        mode: epsMode,
        username: epsUsername.trim(),
        password: epsPassword.trim(),
        hash_key: epsHashKey.trim(),
        merchant_id: epsMerchantId.trim(),
        store_id: epsStoreId.trim(),
        api_url: epsApiUrl.trim() || "https://pgapi.eps.com.bd",
      },
    });
  };

  const handleTestEpsConnection = async () => {
    if (!epsUsername || !epsPassword || !epsHashKey) {
      toast.error("User Name, Password এবং Hash Key পূরণ করুন");
      return;
    }
    setEpsTesting(true);
    try {
      const res = await fetch("/api/eps/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: epsUsername.trim(),
          password: epsPassword.trim(),
          hash_key: epsHashKey.trim(),
          api_url: epsApiUrl.trim() || "https://pgapi.eps.com.bd",
          mode: epsMode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("EPS কানেকশন সফল! টোকেন সফলভাবে জেনারেট হয়েছে।");
      } else {
        toast.error(`কানেকশন ব্যর্থ: ${data.error || "অথেনটিকেশন ব্যর্থ"}`);
      }
    } catch (err: any) {
      toast.error(`কানেকশন ত্রুটি: ${err.message}`);
    } finally {
      setEpsTesting(false);
    }
  };

  const uploadLogo = useCallback(async (file: File) => {
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const result = await res.json();
      const url = result.secure_url;
      setLogoUrl(url);
      updateMutation.mutate({ key: "site_logo", value: { url } });
    } catch {
      toast.error("লোগো আপলোড ব্যর্থ");
    } finally {
      setLogoUploading(false);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const existing = settings?.[key];
      if (existing) {
        const { error } = await supabase.from("site_settings").update({ value }).eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert({ key, value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast.success("সেটিংস আপডেট হয়েছে");
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6 md:text-center">সেটিংস</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl md:mx-auto">
        {/* Col 1 */}
        <div className="space-y-6">
          {/* Site Logo */}
          <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-foreground">সাইট লোগো</h3>
              <span className="text-[11px] font-bold text-primary">সঠিক মাপ: 300×80 px</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">হরাইজন্টাল রেশিও (300×80 বা 250×60 px)। ট্রান্সপারেন্ট ব্যাকগ্রাউন্ড PNG বা SVG রিকমেন্ডেড।</p>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative group">
                  <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain border rounded-lg p-1" />
                  <button
                    onClick={() => { setLogoUrl(""); updateMutation.mutate({ key: "site_logo", value: { url: "" } }); }}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="h-16 w-16 border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                  <Upload className="h-5 w-5" />
                </div>
              )}
              <div className="flex-1">
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={logoUploading}>
                    <span>
                      {logoUploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> আপলোড হচ্ছে...</> : "লোগো আপলোড করুন (300×80 px)"}
                    </span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadLogo(e.target.files[0]); e.target.value = ""; }} />
                </label>
                <p className="text-xs text-muted-foreground mt-1">সঠিক রেজোলিউশন: 300×80 px (ট্রান্সপারেন্ট PNG বা SVG)।</p>
              </div>
            </div>
          </div>

          {/* Favicon */}
          <FaviconUpload settings={settings} updateMutation={updateMutation} />

          {/* Social Share / OG Preview Banner */}
          <SocialShareBannerUpload settings={settings} updateMutation={updateMutation} />

          {/* Site Title & Store Name */}
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-bold text-foreground mb-1">স্টোর নাম ও সাইট টাইটেল</h3>
            <p className="text-sm text-muted-foreground mb-4">ব্রাউজার ট্যাব, অ্যাডমিন লগইন পেজ ও বিভিন্ন জায়গায় এই নাম প্রদর্শিত হবে</p>
            <div className="space-y-3">
              <div>
                <Label>স্টোর / ওয়েবসাইটের নাম</Label>
                <Input placeholder="যেমন: Natural Shefa বা Sunnahly" value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} className="mt-1" />
              </div>
              <Button variant="outline" onClick={() => updateMutation.mutate({ key: "site_title", value: { title: siteTitle } })}>
                সেভ করুন
              </Button>
            </div>
          </div>

          {/* Theme Primary Color */}
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-bold text-foreground mb-1">থিম কালার</h3>
            <p className="text-sm text-muted-foreground mb-4">ওয়েবসাইটের প্রাইমারি কালার এডিট করুন (বাটন, লিংক, হাইলাইট)</p>
            <div className="space-y-3">
              <div>
                <Label>প্রাইমারি কালার</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="h-10 w-16 rounded-md border border-input cursor-pointer bg-background"
                  />
                  <Input
                    placeholder="#1f7a2e"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">HEX কোড দিন (যেমন: #1f7a2e)। সেভ করার পর পরিবর্তন তৎক্ষণাৎ দেখা যাবে।</p>
              </div>
              <Button variant="outline" onClick={() => updateMutation.mutate({ key: "theme_color", value: { primary_hex: themeColor } })}>
                সেভ করুন
              </Button>
            </div>
          </div>

          {/* Categories Toggle */}
          <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground">ক্যাটাগরি ফিচার</h3>
                <p className="text-sm text-muted-foreground">ওয়েবসাইটে ক্যাটাগরি সেকশন, ক্যাটাগরি পেইজ ও অ্যাডমিন মেনু চালু/বন্ধ করুন</p>
              </div>
              <Switch checked={categoriesEnabled}
                onCheckedChange={(v) => {
                  setCategoriesEnabled(v);
                  updateMutation.mutate({ key: "categories_enabled", value: { enabled: v } });
                }} />
            </div>
            {categoriesEnabled && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div>
                  <Label>ক্যাটাগরি সেকশন শিরোনাম (Title)</Label>
                  <Input
                    value={catTitle}
                    onChange={(e) => setCatTitle(e.target.value)}
                    placeholder="Featured Categories"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>ডেস্কটপে প্রতি লাইনে ক্যাটাগরি</Label>
                  <Input type="number" value={catDesktopCols} onChange={(e) => setCatDesktopCols(+e.target.value)} className="mt-1" min={1} max={12} />
                </div>
                <div>
                  <Label>মোবাইলে প্রতি লাইনে ক্যাটাগরি</Label>
                  <Input type="number" value={catMobileCols} onChange={(e) => setCatMobileCols(+e.target.value)} className="mt-1" min={1} max={6} />
                </div>
                <Button variant="outline" onClick={() => updateMutation.mutate({
                  key: "category_grid",
                  value: { desktop: catDesktopCols, mobile: catMobileCols, title: catTitle }
                })}>
                  সেভ করুন
                </Button>
              </div>
            )}
          </div>
          {/* Delivery Charge */}
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-bold text-foreground mb-1">ডেলিভারি চার্জ</h3>
            <p className="text-sm text-muted-foreground mb-4">সারা দেশের জন্য একই ডেলিভারি চার্জ প্রযোজ্য হবে</p>
            <div>
              <Label>সারা দেশ (৳)</Label>
              <Input type="number" value={insideDhaka} onChange={(e) => { setInsideDhaka(+e.target.value); setOutsideDhaka(+e.target.value); }} />
            </div>
            <Button variant="outline" className="mt-3" onClick={() => updateMutation.mutate({ key: "delivery_charge", value: { inside_dhaka: insideDhaka, outside_dhaka: insideDhaka, nationwide: insideDhaka } })}>
              সেভ করুন
            </Button>
          </div>

          {/* Admin Password Change */}
          <ChangeAdminPassword />

          {/* Cloudinary */}
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-bold text-foreground mb-1">Cloudinary (ছবি ও ভিডিও)</h3>
            <p className="text-sm text-muted-foreground mb-4">ছবি অটো-অপটিমাইজ ও রিসাইজ হবে</p>
            <div className="space-y-3">
              <div>
                <Label>Cloud Name</Label>
                <Input placeholder="যেমন: my-cloud" value={cloudName} onChange={(e) => setCloudName(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Upload Preset (Unsigned)</Label>
                <Input placeholder="যেমন: ml_default" value={uploadPreset} onChange={(e) => setUploadPreset(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Cloudinary Dashboard → Settings → Upload → Upload Presets → Unsigned preset তৈরি করুন</p>
              </div>
              <Button variant="outline" onClick={() => updateMutation.mutate({
                key: "cloudinary",
                value: { cloud_name: cloudName, upload_preset: uploadPreset },
              })}>
                সেভ করুন
              </Button>
            </div>
          </div>
        </div>

        {/* Col 2 */}
        <div className="space-y-6">
          {/* EPS Payment Gateway */}
          <div className="bg-card border rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-foreground text-base">পেমেন্ট গেটওয়ে (EPS)</h3>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    epsEnabled 
                      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" 
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {epsEnabled ? "চালু আছে" : "বন্ধ"}
                  </span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    epsMode === "live" 
                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" 
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}>
                    {epsMode === "live" ? "Live Mode" : "Sandbox Mode"}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Easy Payment System (বিকাশ, নগদ, রকেট, ভিসা/মাস্টারকার্ড ও ব্যাংক পেমেন্ট)
                </p>
              </div>
              <Switch
                checked={epsEnabled}
                onCheckedChange={(v) => {
                  setEpsEnabled(v);
                  handleSaveEps(v);
                }}
              />
            </div>

            {/* Mode Selector (Sandbox vs Live) */}
            <div className="p-3 bg-secondary/30 rounded-lg border border-border/50">
              <Label className="text-xs font-semibold text-foreground">পরিবেশ মোড (Environment Mode)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setEpsMode("sandbox")}
                  className={`py-2 px-3 rounded-md text-xs font-medium border text-center transition-all cursor-pointer ${
                    epsMode === "sandbox"
                      ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                      : "bg-background text-muted-foreground border-border hover:bg-secondary/50"
                  }`}
                >
                  🧪 স্যান্ডবক্স / টেস্ট মোড (Sandbox)
                </button>
                <button
                  type="button"
                  onClick={() => setEpsMode("live")}
                  className={`py-2 px-3 rounded-md text-xs font-medium border text-center transition-all cursor-pointer ${
                    epsMode === "live"
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-background text-muted-foreground border-border hover:bg-secondary/50"
                  }`}
                >
                  🚀 লাইভ মোড (Live Production)
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {epsMode === "sandbox"
                  ? "স্যান্ডবক্স মোডে টেস্ট ক্রেডেনশিয়াল দিয়ে ডেমো পেমেন্ট পরীক্ষা করতে পারবেন।"
                  : "লাইভ মোডে কাস্টমারদের আসল পেমেন্ট প্রসেস হবে। EPS থেকে প্রাপ্ত লাইভ ক্রেডেনশিয়াল দিন।"}
              </p>
            </div>

            {/* Credentials Fields */}
            <div className="space-y-3 pt-1">
              <div>
                <Label className="text-xs">User Name *</Label>
                <Input
                  placeholder="EPS User Name (যেমন: dt_merchant@eps.com.bd)"
                  value={epsUsername}
                  onChange={(e) => setEpsUsername(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Password *</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="EPS Password"
                    value={epsPassword}
                    onChange={(e) => setEpsPassword(e.target.value)}
                    className="font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-xs">Hash Key (Secret Key) *</Label>
                <div className="relative mt-1">
                  <Input
                    type={showHashKey ? "text" : "password"}
                    placeholder="SFNLQHJlY2lwZXdhbGEjYTc3Zi..."
                    value={epsHashKey}
                    onChange={(e) => setEpsHashKey(e.target.value)}
                    className="font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowHashKey(!showHashKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    {showHashKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  EPS হতে প্রদত্ত HMAC-SHA512 সিক্রেট হ্যাশ-কি।
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Merchant ID *</Label>
                  <Input
                    placeholder="094980ee-XXX-XXX-XXX"
                    value={epsMerchantId}
                    onChange={(e) => setEpsMerchantId(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Store ID *</Label>
                  <Input
                    placeholder="35b518f6-XXXX-XXXX"
                    value={epsStoreId}
                    onChange={(e) => setEpsStoreId(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">API Endpoint URL (ঐচ্ছিক)</Label>
                <Input
                  placeholder="https://pgapi.eps.com.bd"
                  value={epsApiUrl}
                  onChange={(e) => setEpsApiUrl(e.target.value)}
                  className="mt-1 font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  ডিফল্ট: https://pgapi.eps.com.bd (স্যান্ডবক্স বা আলাদা এন্ডপয়েন্ট থাকলে পরিবর্তন করতে পারেন)
                </p>
              </div>



              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestEpsConnection}
                  disabled={epsTesting}
                  className="gap-1.5"
                >
                  {epsTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                  টেস্ট কানেকশন
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSaveEps()}
                >
                  ক্রেডেনশিয়াল সেভ করুন
                </Button>
              </div>
            </div>
          </div>

          {/* Facebook Pixel */}
          <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground">Facebook Pixel</h3>
                <p className="text-sm text-muted-foreground">কাস্টমার ট্র্যাকিং চালু/বন্ধ করুন</p>
              </div>
              <Switch checked={pixelEnabled}
                onCheckedChange={(v) => {
                  setPixelEnabled(v);
                  updateMutation.mutate({
                    key: "facebook_pixel",
                    value: { enabled: v, pixel_id: pixelId, access_token: pixelToken, test_event_code: pixelTestCode },
                  });
                }} />
            </div>
            <div className="space-y-3">
              <div>
                <Label>Pixel ID</Label>
                <Input placeholder="যেমন: 123456789012345" value={pixelId} onChange={(e) => setPixelId(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Access Token (Conversions API)</Label>
                <Input placeholder="আপনার Access Token দিন" value={pixelToken} onChange={(e) => setPixelToken(e.target.value)} className="mt-1" type="password" />
              </div>
              <div>
                <Label>Test Event Code</Label>
                <Input placeholder="যেমন: TEST12345" value={pixelTestCode} onChange={(e) => setPixelTestCode(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  Events Manager → Test Events ট্যাব থেকে কোড নিন। সেট থাকলে সকল ইভেন্ট টেস্ট মোডে পাঠানো হবে। লাইভে যাওয়ার সময় খালি রাখুন।
                </p>
              </div>
              <Button variant="outline" onClick={() => updateMutation.mutate({
                key: "facebook_pixel",
                value: { enabled: pixelEnabled, pixel_id: pixelId, access_token: pixelToken, test_event_code: pixelTestCode },
              })}>
                সেভ করুন
              </Button>
            </div>
          </div>

          {/* Steadfast Courier */}
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-bold text-foreground mb-1">Steadfast Courier</h3>
            <p className="text-sm text-muted-foreground mb-4">এক ক্লিকে অর্ডার কুরিয়ারে পাঠান</p>
            <div className="space-y-3">
              <div>
                <Label>API Key</Label>
                <Input placeholder="আপনার Steadfast API Key" value={steadfastApiKey} onChange={(e) => setSteadfastApiKey(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Secret Key</Label>
                <Input placeholder="আপনার Steadfast Secret Key" value={steadfastSecretKey} onChange={(e) => setSteadfastSecretKey(e.target.value)} className="mt-1" type="password" />
              </div>
              <p className="text-xs text-muted-foreground">Steadfast Dashboard → API Settings থেকে কী নিন</p>
              <Button variant="outline" onClick={() => updateMutation.mutate({
                key: "steadfast",
                value: { api_key: steadfastApiKey, secret_key: steadfastSecretKey },
              })}>
                সেভ করুন
              </Button>
            </div>
          </div>

          {/* WhatsApp Number */}
          <div className="bg-card border rounded-xl p-5">
            <h3 className="font-bold text-foreground mb-1">WhatsApp নম্বর</h3>
            <p className="text-sm text-muted-foreground mb-4">Bottom Navigation বারে WhatsApp বাটনে এই নম্বর ব্যবহার হবে</p>
            <div className="space-y-3">
              <div>
                <Label>WhatsApp নম্বর</Label>
                <Input placeholder="যেমন: 8801XXXXXXXXX" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">দেশের কোডসহ দিন (যেমন: 8801712345678)</p>
              </div>
              <Button variant="outline" onClick={() => updateMutation.mutate({
                key: "whatsapp_number",
                value: { number: whatsappNumber },
              })}>
                সেভ করুন
              </Button>
            </div>
           </div>

          {/* Order Webhook */}
          <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground">অর্ডার Webhook</h3>
                <p className="text-sm text-muted-foreground">নতুন অর্ডার হলে আপনার সার্ভারে ডাটা পাঠাবে</p>
              </div>
              <Switch checked={webhookEnabled}
                onCheckedChange={(v) => {
                  setWebhookEnabled(v);
                  updateMutation.mutate({ key: "order_webhook", value: { enabled: v, url: webhookUrl, secret_key: webhookSecret } });
                }} />
            </div>
            <div className="space-y-3">
              <div>
                <Label>Webhook URL *</Label>
                <Input placeholder="https://yourdomain.com/api/receive-order.php" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">আপনার PHP endpoint URL যেখানে অর্ডার ডাটা POST হবে</p>
              </div>
              <div>
                <Label>Secret Key (ঐচ্ছিক)</Label>
                <Input placeholder="আপনার সিক্রেট কী" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} className="mt-1" type="password" />
                <p className="text-xs text-muted-foreground mt-1">X-Webhook-Secret হেডারে পাঠানো হবে — আপনার সার্ভারে ভেরিফাই করুন</p>
              </div>
              <Button variant="outline" onClick={() => updateMutation.mutate({
                key: "order_webhook",
                value: { enabled: webhookEnabled, url: webhookUrl, secret_key: webhookSecret },
              })}>
                সেভ করুন
              </Button>
            </div>
          </div>

          {/* Meta Catalog Feed */}
          <MetaCatalogFeedCard />
        </div>
      </div>
    </div>
  );
};


export default AdminSettings;
