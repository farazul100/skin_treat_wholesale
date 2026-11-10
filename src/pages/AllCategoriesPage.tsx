import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Layers, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

const toBengaliNumber = (num: number) => {
  return num.toString().replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
};

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar />
      <Header />

      <main className="flex-1 py-6 sm:py-8">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header section matching Darun style */}
          <div className="mb-5 sm:mb-7">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              সকল ক্যাটাগরি
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {toBengaliNumber(categories?.length || 0)}টি ক্যাটাগরি
            </p>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="bg-card rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-border/50 animate-pulse space-y-3">
                  <div className="w-full aspect-square bg-muted rounded-lg" />
                  <div className="h-3.5 bg-muted rounded w-3/4 mx-auto" />
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
              {categories.map((cat: any) => (
                <Link
                  key={cat.id}
                  to={`/category/${cat.slug}`}
                  className="group block h-full"
                >
                  <div className="bg-card rounded-xl sm:rounded-2xl border-2 border-border/60 hover:border-primary p-3 sm:p-4 flex flex-col items-center justify-between h-full transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg hover:shadow-primary/10 cursor-pointer">
                    {/* Image with zoom animation */}
                    <div className="w-full aspect-square flex items-center justify-center p-2 sm:p-3 overflow-hidden rounded-lg bg-secondary/10">
                      {cat.image || cat.image_url ? (
                        <img
                          src={cat.image || cat.image_url}
                          alt={cat.name}
                          className="w-full h-full object-contain transition-transform duration-300 ease-out group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <Layers className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40 group-hover:text-primary transition-colors duration-300" />
                      )}
                    </div>

                    {/* Category Title */}
                    <div className="mt-2.5 sm:mt-3 text-center w-full px-1">
                      <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-2 leading-tight block">
                        {cat.name}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AllCategoriesPage;

