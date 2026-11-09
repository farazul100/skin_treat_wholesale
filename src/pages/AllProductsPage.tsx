import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

const AllProductsPage = () => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [priceRange, setPriceRange] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["all-products-page"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return data || [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories-filter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!products) return [];
    let result = [...products];

    if (search) {
      const s = search.toLowerCase();
      result = result.filter((p: any) => p.name.toLowerCase().includes(s));
    }

    if (categoryFilter !== "all") {
      result = result.filter((p: any) => p.category_id === categoryFilter);
    }

    if (priceRange !== "all") {
      const [min, max] = priceRange.split("-").map(Number);
      result = result.filter((p: any) => {
        const price = Number(p.price);
        if (max) return price >= min && price <= max;
        return price >= min;
      });
    }

    switch (sortBy) {
      case "price-low": result.sort((a: any, b: any) => Number(a.price) - Number(b.price)); break;
      case "price-high": result.sort((a: any, b: any) => Number(b.price) - Number(a.price)); break;
      case "name": result.sort((a: any, b: any) => a.name.localeCompare(b.name)); break;
      default: result.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [products, search, categoryFilter, sortBy, priceRange]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <Header />
      <main className="flex-1 bg-background">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-6">সকল পণ্য</h1>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="পণ্য খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Button variant="outline" className="sm:hidden gap-2" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal className="h-4 w-4" /> ফিল্টার
            </Button>
            <div className={`flex flex-col sm:flex-row gap-3 ${showFilters ? "flex" : "hidden sm:flex"}`}>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="ক্যাটাগরি" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সকল ক্যাটাগরি</SelectItem>
                  {categories?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="মূল্য" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সকল মূল্য</SelectItem>
                  <SelectItem value="0-500">৳০ - ৳৫০০</SelectItem>
                  <SelectItem value="500-1000">৳৫০০ - ৳১০০০</SelectItem>
                  <SelectItem value="1000-2000">৳১০০০ - ৳২০০০</SelectItem>
                  <SelectItem value="2000-99999">৳২০০০+</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="সর্ট" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">নতুন আগে</SelectItem>
                  <SelectItem value="price-low">মূল্য: কম → বেশি</SelectItem>
                  <SelectItem value="price-high">মূল্য: বেশি → কম</SelectItem>
                  <SelectItem value="name">নাম অনুসারে</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">{filtered.length}টি পণ্য পাওয়া গেছে</p>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">কোনো পণ্য পাওয়া যায়নি</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {filtered.map((p: any) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  price={Number(p.price)}
                  originalPrice={p.original_price ? Number(p.original_price) : undefined}
                  image={p.images?.[0] || "/placeholder.svg"}
                  badge={p.badge}
                  slug={p.slug}
                  categoryName={p.categories?.name}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AllProductsPage;
