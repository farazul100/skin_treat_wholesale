import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Layers, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const AllCategoriesPage = () => {
  const { data: categories, isLoading } = useQuery({
    queryKey: ["all-categories-page"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["all-products-for-categories-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, category_id")
        .eq("is_active", true);
      return data || [];
    },
  });

  const getProductCount = (categoryId: string) => {
    if (!products) return 0;
    return products.filter((p: any) => p.category_id === categoryId).length;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />
      <Header />

      <main className="flex-1 py-6 md:py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Loading State */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card rounded-2xl p-4 border animate-pulse space-y-3">
                  <div className="w-full aspect-square bg-muted rounded-xl" />
                  <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
                  <div className="h-3 bg-muted rounded w-1/2 mx-auto" />
                </div>
              ))}
            </div>
          ) : !categories || categories.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-2xl border max-w-md mx-auto p-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="text-lg font-semibold text-foreground">কোনো ক্যাটাগরি পাওয়া যায়নি</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                বর্তমানে কোনো সক্রিয় ক্যাটাগরি যুক্ত করা নেই।
              </p>
              <Link to="/products">
                <Button>সকল পণ্য দেখুন</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
              {categories.map((cat: any) => {
                const count = getProductCount(cat.id);
                return (
                  <Link
                    key={cat.id}
                    to={`/category/${cat.slug}`}
                    className="group block"
                  >
                    <div className="bg-card rounded-2xl border border-border/60 hover:border-primary/50 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1.5 flex flex-col h-full">
                      {/* Image container */}
                      <div className="w-full aspect-square bg-secondary/30 flex items-center justify-center overflow-hidden p-3 relative">
                        {cat.image || cat.image_url ? (
                          <img
                            src={cat.image || cat.image_url}
                            alt={cat.name}
                            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <Layers className="h-12 w-12 text-primary/40 group-hover:text-primary transition-colors" />
                        )}
                        <span className="absolute top-2 right-2 text-[10px] font-bold bg-background/90 text-foreground px-2 py-0.5 rounded-full shadow-xs border">
                          {count}টি পণ্য
                        </span>
                      </div>

                      {/* Info container */}
                      <div className="p-3 sm:p-4 text-center flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {cat.name}
                          </h3>
                          {cat.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {cat.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                          <span>পণ্য দেখুন</span>
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AllCategoriesPage;

