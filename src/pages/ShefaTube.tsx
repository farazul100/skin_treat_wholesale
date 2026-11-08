import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Play, Youtube, X } from "lucide-react";

const ShefaTubePage = () => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: videos, isLoading } = useQuery({
    queryKey: ["shefa-videos-page"],
    queryFn: async () => {
      const { data } = await supabase
        .from("shefa_videos")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="text-center mb-8">
            <Youtube className="h-12 w-12 text-primary mx-auto mb-3" />
            <h1 className="text-3xl font-bold text-foreground">শেফা টিউব</h1>
            <p className="text-muted-foreground mt-2">আমাদের সকল ভিডিও কন্টেন্ট</p>
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">লোড হচ্ছে...</div>
          ) : !videos?.length ? (
            <div className="text-center py-10 text-muted-foreground">কোনো ভিডিও নেই</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
              {videos.map((v: any) => (
                <button
                  key={v.id}
                  onClick={() => setActiveId(v.youtube_id)}
                  className="group relative block w-full aspect-square rounded-xl overflow-hidden border-[0.5px] border-primary"
                >
                  <img
                    src={`https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`}
                    alt={v.title || "শেফা টিউব ভিডিও"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <div className="bg-primary/90 rounded-full p-3 shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="h-6 w-6 text-primary-foreground fill-current" />
                    </div>
                  </div>
                  {v.title && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-white text-xs line-clamp-2 text-left">{v.title}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      <Dialog open={!!activeId} onOpenChange={(o) => !o && setActiveId(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-slate-950 border border-white/15 shadow-2xl rounded-2xl [&>button]:hidden">
          <DialogTitle className="sr-only">শেফা টিউব ভিডিও</DialogTitle>
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-white/10">
            <span className="text-sm font-medium text-white">শেফা টিউব ভিডিও</span>
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white border-2 border-white/40 shadow-lg cursor-pointer transition-all duration-300 hover:scale-110 active:scale-95 group"
              aria-label="বন্ধ করুন"
            >
              <X className="h-4 w-4 stroke-[2.5] transition-transform duration-300 group-hover:rotate-90" />
            </button>
          </div>
          {activeId && (
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${activeId}?autoplay=1`}
                title="YouTube video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShefaTubePage;
