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
                <div key={i} className="bg-white dark:bg-card rounded-xl p-3 sm:p-4 border border-gray-200/80 animate-pulse flex flex-col items-center justify-between aspect-[3/4]">
                  <div className="flex-1 w-full bg-muted/50 rounded-lg mb-2" />
                  <div className="h-3.5 bg-muted/60 rounded w-3/4 mx-auto" />
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
                  <div className="bg-white dark:bg-card rounded-xl border border-gray-200/90 dark:border-border hover:border-primary dark:hover:border-primary hover:ring-1 hover:ring-primary p-3 sm:p-4 flex flex-col items-center justify-between aspect-[3/4] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-md cursor-pointer">
                    {/* Clean Image Container - fills upper portrait space */}
                    <div className="flex-1 w-full flex items-center justify-center p-2 overflow-hidden">
                      {cat.image || cat.image_url ? (
                        <img
                          src={cat.image || cat.image_url}
                          alt={cat.name}
                          className="max-w-full max-h-full object-contain transition-transform duration-300 ease-out group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <Layers className="h-14 w-14 text-muted-foreground/30 group-hover:text-primary transition-colors duration-200" />
                      )}
                    </div>

                    {/* Category Title at the bottom */}
                    <div className="pt-2 pb-1 text-center w-full px-1">
                      <span className="text-xs sm:text-sm text-gray-800 dark:text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-2 leading-snug font-normal block">
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

