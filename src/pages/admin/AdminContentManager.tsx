import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const AdminContentManager = () => {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*");
      const map: Record<string, any> = {};
      data?.forEach((s: any) => {
        let val = s.value !== undefined ? s.value : s.setting_value;
        if (typeof val === "string") {
          try { val = JSON.parse(val); } catch (_) {}
        }
        map[s.key || s.setting_key] = { id: s.id, value: val };
      });
      return map;
    },
  });

  // TopBar texts
  const [topbarTexts, setTopbarTexts] = useState<string[]>([
    "সারাদেশে ডেলিভারি চার্জ মাত্র ৳৮০",
    "১০০% খাঁটি ও প্রাকৃতিক পণ্য",
    "৭ দিনের মানি-ব্যাক গ্যারান্টি",
    "অর্ডার করতে কল করুন: ০১XXXXXXXXX",
  ]);

  const [b1Subtitle, setB1Subtitle] = useState("সীমিত সময়ের অফার");
  const [b1Title, setB1Title] = useState("৩০% ছাড়");
  const [b1Desc, setB1Desc] = useState("সকল ত্বকের যত্ন পণ্যে বিশেষ ছাড়। অফার সীমিত সময়ের জন্য।");
  const [b1Btn, setB1Btn] = useState("এখনই কিনুন");
  const [b1Link, setB1Link] = useState("/products");
  const [b2Subtitle, setB2Subtitle] = useState("নতুন সংগ্রহ");
  const [b2Title, setB2Title] = useState("চুলের যত্ন");
  const [b2Desc, setB2Desc] = useState("প্রাকৃতিক উপাদানে তৈরি চুলের যত্ন পণ্যের নতুন সংগ্রহ এসেছে।");
  const [b2Btn, setB2Btn] = useState("দেখুন");
  const [b2Link, setB2Link] = useState("/products");

  // Money back
  const [mbTitle, setMbTitle] = useState("৭ দিনের মানি-ব্যাক গ্যারান্টি");
  const [mbDesc, setMbDesc] = useState("আমাদের যেকোনো পণ্যে সন্তুষ্ট না হলে ৭ দিনের মধ্যে সম্পূর্ণ টাকা ফেরত পাবেন।");

  // Footer
  const [fBrand, setFBrand] = useState("বাংলাদেশের সেরা প্রাকৃতিক ও অর্গানিক পণ্যের অনলাইন শপ।");
  const [fPhone, setFPhone] = useState("০১XXXXXXXXX");
  const [fEmail, setFEmail] = useState("info@naturalshefa.com");
  const [fAddress, setFAddress] = useState("ঢাকা, বাংলাদেশ");
  const [fCopyright, setFCopyright] = useState("© ২০২৬ Natural Shefa। সর্বস্বত্ব সংরক্ষিত।");

  // Social media
  const [smFacebook, setSmFacebook] = useState("");
  const [smInstagram, setSmInstagram] = useState("");
  const [smYoutube, setSmYoutube] = useState("");
  const [smWhatsapp, setSmWhatsapp] = useState("");

  useEffect(() => {
    if (settings) {
      const tb = settings.topbar_texts?.value;
      if (tb?.texts) setTopbarTexts(tb.texts);
      const pb = settings.promo_banners?.value;
      if (pb) {
        setB1Subtitle(pb.banner1?.subtitle || "সীমিত সময়ের অফার");
        setB1Title(pb.banner1?.title || "৩০% ছাড়");
        setB1Desc(pb.banner1?.description || "");
        setB1Btn(pb.banner1?.button_text || "এখনই কিনুন");
        setB1Link(pb.banner1?.button_link || "/products");
        setB2Subtitle(pb.banner2?.subtitle || "নতুন সংগ্রহ");
        setB2Title(pb.banner2?.title || "চুলের যত্ন");
        setB2Desc(pb.banner2?.description || "");
        setB2Btn(pb.banner2?.button_text || "দেখুন");
        setB2Link(pb.banner2?.button_link || "/products");
      }
      const mb = settings.money_back_banner?.value;
      if (mb) {
        setMbTitle(mb.title || "");
        setMbDesc(mb.description || "");
      }
      const fc = settings.footer_content?.value;
      if (fc) {
        setFBrand(fc.brand_description || "");
        setFPhone(fc.phone || "");
        setFEmail(fc.email || "");
        setFAddress(fc.address || "");
        setFCopyright(fc.copyright || "");
      }
      const sm = settings.social_media?.value;
      if (sm) {
        setSmFacebook(sm.facebook || "");
        setSmInstagram(sm.instagram || "");
        setSmYoutube(sm.youtube || "");
        setSmWhatsapp(sm.whatsapp || "");
      }
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
      queryClient.invalidateQueries({ queryKey: ["promo-banners-content"] });
      queryClient.invalidateQueries({ queryKey: ["money-back-content"] });
      queryClient.invalidateQueries({ queryKey: ["footer-content"] });
      queryClient.invalidateQueries({ queryKey: ["topbar-content"] });
      queryClient.invalidateQueries({ queryKey: ["social-media"] });
      toast.success("কন্টেন্ট আপডেট হয়েছে");
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6 md:text-center">কন্টেন্ট ম্যানেজমেন্ট</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl md:mx-auto">

        {/* TopBar Scrolling Text */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-foreground">টপবার স্ক্রলিং টেক্সট</h3>
          {topbarTexts.map((t, i) => (
            <div key={i} className="flex gap-2">
              <Input value={t} onChange={(e) => {
                const arr = [...topbarTexts];
                arr[i] = e.target.value;
                setTopbarTexts(arr);
              }} className="flex-1" />
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                setTopbarTexts(topbarTexts.filter((_, idx) => idx !== i));
              }}>✕</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setTopbarTexts([...topbarTexts, ""])}>+ নতুন টেক্সট</Button>
          <Button variant="outline" className="w-full" onClick={() => updateMutation.mutate({
            key: "topbar_texts",
            value: { texts: topbarTexts.filter(t => t.trim()) },
          })}>
            টপবার সেভ করুন
          </Button>
        </div>

        {/* Promo Banners */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-foreground">প্রোমো ব্যানার ১ (সবুজ)</h3>
          <div><Label>সাবটাইটেল</Label><Input value={b1Subtitle} onChange={(e) => setB1Subtitle(e.target.value)} className="mt-1" /></div>
          <div><Label>টাইটেল</Label><Input value={b1Title} onChange={(e) => setB1Title(e.target.value)} className="mt-1" /></div>
          <div><Label>বিবরণ</Label><Textarea value={b1Desc} onChange={(e) => setB1Desc(e.target.value)} className="mt-1" rows={2} /></div>
          <div><Label>বাটন টেক্সট</Label><Input value={b1Btn} onChange={(e) => setB1Btn(e.target.value)} className="mt-1" /></div>
          <div><Label>বাটন লিঙ্ক</Label><Input value={b1Link} onChange={(e) => setB1Link(e.target.value)} className="mt-1" placeholder="/products" /></div>
        </div>

        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-foreground">প্রোমো ব্যানার ২ (ডার্ক)</h3>
          <div><Label>সাবটাইটেল</Label><Input value={b2Subtitle} onChange={(e) => setB2Subtitle(e.target.value)} className="mt-1" /></div>
          <div><Label>টাইটেল</Label><Input value={b2Title} onChange={(e) => setB2Title(e.target.value)} className="mt-1" /></div>
          <div><Label>বিবরণ</Label><Textarea value={b2Desc} onChange={(e) => setB2Desc(e.target.value)} className="mt-1" rows={2} /></div>
          <div><Label>বাটন টেক্সট</Label><Input value={b2Btn} onChange={(e) => setB2Btn(e.target.value)} className="mt-1" /></div>
          <div><Label>বাটন লিঙ্ক</Label><Input value={b2Link} onChange={(e) => setB2Link(e.target.value)} className="mt-1" placeholder="/products" /></div>
          <Button variant="outline" className="w-full" onClick={() => updateMutation.mutate({
            key: "promo_banners",
            value: {
              banner1: { subtitle: b1Subtitle, title: b1Title, description: b1Desc, button_text: b1Btn, button_link: b1Link },
              banner2: { subtitle: b2Subtitle, title: b2Title, description: b2Desc, button_text: b2Btn, button_link: b2Link },
            },
          })}>
            প্রোমো ব্যানার সেভ করুন
          </Button>
        </div>

        {/* Money Back */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-foreground">মানি-ব্যাক গ্যারান্টি</h3>
          <div><Label>টাইটেল</Label><Input value={mbTitle} onChange={(e) => setMbTitle(e.target.value)} className="mt-1" /></div>
          <div><Label>বিবরণ</Label><Textarea value={mbDesc} onChange={(e) => setMbDesc(e.target.value)} className="mt-1" rows={3} /></div>
          <Button variant="outline" className="w-full" onClick={() => updateMutation.mutate({
            key: "money_back_banner",
            value: { title: mbTitle, description: mbDesc },
          })}>
            সেভ করুন
          </Button>
        </div>

        {/* Footer */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-foreground">ফুটার কন্টেন্ট</h3>
          <div><Label>ব্র্যান্ড বিবরণ</Label><Textarea value={fBrand} onChange={(e) => setFBrand(e.target.value)} className="mt-1" rows={2} /></div>
          <div><Label>ফোন</Label><Input value={fPhone} onChange={(e) => setFPhone(e.target.value)} className="mt-1" /></div>
          <div><Label>ইমেইল</Label><Input value={fEmail} onChange={(e) => setFEmail(e.target.value)} className="mt-1" /></div>
          <div><Label>ঠিকানা</Label><Input value={fAddress} onChange={(e) => setFAddress(e.target.value)} className="mt-1" /></div>
          <div><Label>কপিরাইট টেক্সট</Label><Input value={fCopyright} onChange={(e) => setFCopyright(e.target.value)} className="mt-1" /></div>
          <Button variant="outline" className="w-full" onClick={() => updateMutation.mutate({
            key: "footer_content",
            value: { brand_description: fBrand, phone: fPhone, email: fEmail, address: fAddress, copyright: fCopyright },
          })}>
            ফুটার সেভ করুন
          </Button>
        </div>

        {/* Social Media */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-foreground">সোশ্যাল মিডিয়া লিঙ্ক</h3>
          <div><Label>Facebook</Label><Input value={smFacebook} onChange={(e) => setSmFacebook(e.target.value)} className="mt-1" placeholder="https://facebook.com/..." /></div>
          <div><Label>Instagram</Label><Input value={smInstagram} onChange={(e) => setSmInstagram(e.target.value)} className="mt-1" placeholder="https://instagram.com/..." /></div>
          <div><Label>YouTube</Label><Input value={smYoutube} onChange={(e) => setSmYoutube(e.target.value)} className="mt-1" placeholder="https://youtube.com/..." /></div>
          <div><Label>WhatsApp</Label><Input value={smWhatsapp} onChange={(e) => setSmWhatsapp(e.target.value)} className="mt-1" placeholder="https://wa.me/880..." /></div>
          <Button variant="outline" className="w-full" onClick={() => updateMutation.mutate({
            key: "social_media",
            value: { facebook: smFacebook, instagram: smInstagram, youtube: smYoutube, whatsapp: smWhatsapp },
          })}>
            সোশ্যাল মিডিয়া সেভ করুন
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminContentManager;
