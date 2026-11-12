import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const pages = [
  { key: "page_privacy", label: "প্রাইভেসি পলিসি" },
  { key: "page_terms", label: "শর্তাবলী" },
  { key: "page_refund", label: "রিফান্ড পলিসি" },
  { key: "page_shipping", label: "শিপিং পলিসি" },
  { key: "page_about", label: "আমাদের সম্পর্কে" },
  { key: "page_contact", label: "যোগাযোগ" },
];

const AdminPages = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(pages[0].key);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [bodies, setBodies] = useState<Record<string, string>>({});

  const { data: settings } = useQuery({
    queryKey: ["admin-pages"],
    queryFn: async () => {
      const keys = pages.map(p => p.key);
      const { data } = await supabase.from("site_settings").select("*").in("key", keys);
      const map: Record<string, any> = {};
      data?.forEach((s: any) => {
        let val = s.value !== undefined ? s.value : s.setting_value;
        if (typeof val === "string") {
          try { val = JSON.parse(val); } catch (_) {}
        }
        map[s.key || s.setting_key] = val;
      });
      return map;
    },
  });

  useEffect(() => {
    if (settings) {
      const t: Record<string, string> = {};
      const b: Record<string, string> = {};
      pages.forEach(p => {
        t[p.key] = settings[p.key]?.title || p.label;
        b[p.key] = settings[p.key]?.body || "";
      });
      setTitles(t);
      setBodies(b);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      const value = { title: titles[key] || "", body: bodies[key] || "" };
      const { data: existing } = await supabase.from("site_settings").select("*").eq("key", key).single();
      if (existing) {
        const { error } = await supabase.from("site_settings").update({ value }).eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert({ key, value });
        if (error) throw error;
      }
    },
    onSuccess: (_, key) => {
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      queryClient.invalidateQueries({ queryKey: ["policy-page"] });
      toast.success("পেইজ সেভ হয়েছে");
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6 md:text-center">পেইজ ম্যানেজমেন্ট</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-3xl md:mx-auto">
        <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
          {pages.map(p => (
            <TabsTrigger key={p.key} value={p.key} className="text-xs">{p.label}</TabsTrigger>
          ))}
        </TabsList>
        {pages.map(p => (
          <TabsContent key={p.key} value={p.key}>
            <div className="bg-card border rounded-xl p-5 space-y-4">
              <div><Label>পেইজ টাইটেল</Label><Input value={titles[p.key] || ""} onChange={e => setTitles({ ...titles, [p.key]: e.target.value })} className="mt-1" /></div>
              <div><Label>পেইজ কন্টেন্ট</Label><Textarea value={bodies[p.key] || ""} onChange={e => setBodies({ ...bodies, [p.key]: e.target.value })} className="mt-1" rows={12} /></div>
              <Button variant="outline" className="w-full" onClick={() => saveMutation.mutate(p.key)} disabled={saveMutation.isPending}>
                সেভ করুন
              </Button>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminPages;
