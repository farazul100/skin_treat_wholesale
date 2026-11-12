import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ProductCard from "./ProductCard";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

interface CategorySliderItemProps {
  category: any;
  products: any[];
}

const CategorySliderItem = ({ category, products }: CategorySliderItemProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Calculate number of dots based on total products (groups of ~3-5 or pages)
  const totalDots = Math.min(Math.max(Math.ceil(products.length / 3), 1), 5);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < maxScroll - 10);

    if (maxScroll > 0) {
      const progress = el.scrollLeft / maxScroll;
      const dotIdx = Math.min(Math.round(progress * (totalDots - 1)), totalDots - 1);
      setActiveDot(dotIdx);
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [products.length, totalDots]);

  const scrollByAmount = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const scrollToDot = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const target = (index / (totalDots - 1)) * maxScroll;
    el.scrollTo({ left: target, behavior: "smooth" });
    setActiveDot(index);
  };

  return (
    <section className="py-6 md:py-9 border-b border-border/40 last:border-b-0">
      <div className="container mx-auto px-4 max-w-[1536px]">
        {/* Category Header with centered title & accent line */}
        <div className="relative mb-5 md:mb-7 flex flex-col items-center justify-center text-center">
          <div className="inline-flex flex-col items-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-medium text-foreground tracking-normal">
              {category.name}
            </h2>
            {/* Orange/Amber accent line underneath category title */}
            <div className="h-1 w-14 bg-amber-500 rounded-full mt-2 mx-auto" />
          </div>

          <Link
            to={`/category/${category.slug}`}
            className="mt-2.5 sm:mt-0 sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 text-xs sm:text-sm font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 group transition-colors tracking-wide"
          >
            <span>VIEW ALL ITEMS</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Products Horizontal Slider */}
        <div className="relative group/slider sm:px-10 md:px-12">
          {/* Left Arrow Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollByAmount("left")}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white text-slate-800 shadow-md border border-slate-200 items-center justify-center hover:bg-slate-50 hover:scale-110 transition-all cursor-pointer"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* Right Arrow Button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollByAmount("right")}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white text-slate-800 shadow-md border border-slate-200 items-center justify-center hover:bg-slate-50 hover:scale-110 transition-all cursor-pointer"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Slider track */}
          <div
            ref={scrollRef}
            className="flex gap-3.5 sm:gap-4 md:gap-5 overflow-x-auto scroll-smooth py-2 px-0.5 no-scrollbar snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {products.map((p: any) => (
              <div
                key={p.id}
                className="w-[160px] sm:w-[200px] md:w-[230px] lg:w-[250px] shrink-0 snap-start"
              >
                <ProductCard
                  id={p.id}
                  name={p.name}
                  price={Number(p.price)}
                  originalPrice={p.original_price ? Number(p.original_price) : undefined}
                  image={p.images?.[0] || "/placeholder.svg"}
                  badge={p.badge}
                  slug={p.slug}
                  categoryName={category.name}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Carousel Pagination Dots matching reference image */}
        {totalDots > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {Array.from({ length: totalDots }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => scrollToDot(idx)}
                className={`transition-all duration-200 rounded-full ${
                  activeDot === idx
                    ? "w-5 h-2 bg-amber-500"
                    : "w-2 h-2 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

const HomeCategorySections = () => {
  // Fetch active categories
  const { data: categories } = useQuery({
    queryKey: ["home-categorized-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      
      // Filter for categories flagged for home display
      return (data || []).filter(
        (c: any) => c.show_on_home === true || c.show_on_home === 1 || c.show_on_home === "1"
      );
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch active products (shared key for request deduplication)
  const { data: allProducts } = useQuery({
    queryKey: ["storefront-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  if (!categories || categories.length === 0 || !allProducts) {
    return null;
  }

  // Group products by category
  const categoriesWithProducts = categories
    .map((cat: any) => {
      const catProducts = allProducts.filter((p: any) => p.category_id === cat.id);
      return {
        category: cat,
        products: catProducts,
      };
    })
    .filter((item) => item.products.length > 0);

  if (categoriesWithProducts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {categoriesWithProducts.map(({ category, products }) => (
        <CategorySliderItem
          key={category.id}
          category={category}
          products={products}
        />
      ))}
    </div>
  );
};

export default HomeCategorySections;
