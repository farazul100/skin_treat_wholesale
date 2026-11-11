import { useState } from "react";
import { Search, ShoppingCart, User, Menu, X, ChevronDown, ArrowRight, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { label: "হোম", href: "/" },
  { label: "সকল পণ্য", href: "/products" },
  { label: "সকল ক্যাটাগরি", href: "/categories" },
];

const Header = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const { totalItems } = useCart();
  const { user } = useAuth();

  const { data: logoUrl } = useQuery({
    queryKey: ["site-logo"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_setting", { _key: "site_logo" });
      return (data as any)?.url || "";
    },
    staleTime: 1000 * 60 * 10,
  });

  // Categories ordered by created_at ascending (oldest/first created first)
  const { data: categories } = useQuery({
    queryKey: ["header-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Active products query for category hover dropdown
  const { data: allProducts } = useQuery({
    queryKey: ["header-category-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, slug, price, original_price, images, category_id, is_active")
        .eq("is_active", true);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const getProductImage = (prod: any) => {
    if (Array.isArray(prod?.images) && prod.images[0]) return prod.images[0];
    if (typeof prod?.images === "string") {
      try {
        const parsed = JSON.parse(prod.images);
        if (Array.isArray(parsed) && parsed[0]) return parsed[0];
      } catch {
        if (prod.images.startsWith("http") || prod.images.startsWith("/")) return prod.images;
      }
    }
    return "/placeholder.svg";
  };

  return (
    <header className="sticky top-0 z-50 bg-background border-b-0 md:border-b shadow-none md:shadow-sm">
      <div className="container mx-auto px-4 max-w-[1536px]">
        {/* Mobile Layout */}
        <div className="flex md:hidden items-center justify-between h-16">
          {/* Left: Mobile menu */}
          <div className="flex items-center w-10 shrink-0">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetTitle className="text-lg font-bold text-primary">মেনু</SheetTitle>
                <nav className="mt-6 flex flex-col gap-1">
                  {navItems.map((item) => (
                    <Link key={item.href} to={item.href} className="px-3 py-3 rounded-md text-foreground hover:bg-accent transition-colors font-medium">
                      {item.label}
                    </Link>
                  ))}
                  {user ? (
                    <Link to="/dashboard" className="px-3 py-3 rounded-md text-foreground hover:bg-accent transition-colors font-medium">আমার একাউন্ট</Link>
                  ) : (
                    <Link to="/auth" className="px-3 py-3 rounded-md text-foreground hover:bg-accent transition-colors font-medium">লগইন / সাইনআপ</Link>
                  )}

                  {/* Mobile Drawer Categories */}
                  {categories && categories.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="px-3 text-xs font-semibold text-primary uppercase tracking-wider mb-2">ক্যাটাগরি সমূহ</p>
                      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                        {categories.map((cat: any) => (
                          <Link
                            key={cat.id}
                            to={`/category/${cat.slug}`}
                            className="px-3 py-2 rounded-md text-sm text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-between"
                          >
                            <span>{cat.name}</span>
                            <ChevronDown className="h-3.5 w-3.5 -rotate-90 opacity-40" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* Center: Logo */}
          <div className="flex-1 flex items-center justify-center px-2 min-w-0">
            <Link to="/" className="flex items-center justify-center">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-8 sm:h-9 max-h-10 w-auto max-w-[160px] sm:max-w-[200px] object-contain"
                />
              )}
            </Link>
          </div>

          {/* Right: User icon */}
          <div className="flex items-center justify-end w-10 shrink-0">
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Desktop Layout - Logo left, Nav center, Icons right */}
        <div className="hidden md:flex items-center justify-between h-20">
          {/* Left: Logo */}
          <Link to="/" className="flex items-center shrink-0 py-2">
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo"
                className="h-10 md:h-11 lg:h-13 max-h-14 w-auto max-w-[180px] md:max-w-[210px] lg:max-w-[250px] object-contain transition-all"
              />
            )}
          </Link>

          {/* Center: Nav links */}
          <nav className="flex items-center gap-1 lg:gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="px-3 lg:px-5 py-2 rounded-md text-sm lg:text-base font-medium text-foreground hover:text-primary hover:bg-accent transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right: Icons */}
          <div className="flex items-center gap-1 lg:gap-2 shrink-0">
            <Button variant="ghost" size="icon" className="h-10 w-10 md:h-11 md:w-11" onClick={() => setSearchOpen(!searchOpen)}>
              <Search className="h-5 w-5 md:h-6 md:w-6" />
            </Button>
            <Link to="/cart">
              <Button variant="ghost" size="icon" className="relative h-10 w-10 md:h-11 md:w-11">
                <ShoppingCart className="h-5 w-5 md:h-6 md:w-6" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </Button>
            </Link>
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button variant="ghost" size="icon" className="h-10 w-10 md:h-11 md:w-11">
                <User className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            </Link>
          </div>
        </div>

        {searchOpen && (
          <div className="pb-4 md:max-w-lg md:mx-auto">
            <div className="relative">
              <Input placeholder="পণ্য খুঁজুন..." className="pr-10" />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Categories Bar Below Header */}
      {categories && categories.length > 0 && (
        <div className="bg-primary text-primary-foreground border-t border-primary-foreground/15 shadow-none md:shadow-xs relative transition-colors duration-200">
          <div className="container mx-auto px-4 max-w-[1536px]">
            <nav
              aria-label="Category Navigation"
              className="flex items-center gap-5 sm:gap-7 md:gap-8 overflow-x-auto md:overflow-visible whitespace-nowrap py-1.5 md:py-2 text-xs sm:text-sm font-semibold tracking-wide no-scrollbar"
            >
              {categories.map((cat: any, idx: number) => {
                const catProducts = (allProducts || []).filter(
                  (p: any) => p.category_id === cat.id
                );
                const isRightAligned = idx >= Math.max(categories.length - 2, 2);

                return (
                  <div key={cat.id} className="relative group/cat shrink-0 py-1">
                    <Link
                      to={`/category/${cat.slug}`}
                      className="inline-flex items-center shrink-0 text-primary-foreground/90 hover:text-primary-foreground transition-colors py-1 group-hover/cat:text-amber-300"
                    >
                      <span>{cat.name}</span>
                      <ChevronDown className="h-3.5 w-3.5 ml-1 text-primary-foreground/70 group-hover/cat:text-amber-300 group-hover/cat:rotate-180 transition-all duration-200" />
                    </Link>

                    {/* Desktop Hover Dropdown Menu */}
                    <div
                      className={`hidden md:block absolute top-full ${
                        isRightAligned ? "right-0" : "left-0"
                      } pt-2 z-50 invisible opacity-0 translate-y-1 pointer-events-none group-hover/cat:visible group-hover/cat:opacity-100 group-hover/cat:translate-y-0 group-hover/cat:pointer-events-auto transition-all duration-200 ease-out`}
                    >
                      <div className="w-[340px] sm:w-[380px] bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200/90 overflow-hidden text-left whitespace-normal">
                        {/* Dropdown Header */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{cat.name}</span>
                            <span className="text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                              {catProducts.length}টি পণ্য
                            </span>
                          </div>
                          <Link
                            to={`/category/${cat.slug}`}
                            className="text-xs font-semibold text-primary hover:text-primary/80 hover:underline flex items-center gap-0.5"
                          >
                            <span>সবগুলো</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>

                        {/* Products List */}
                        <div className="p-2.5 max-h-[340px] overflow-y-auto divide-y divide-slate-100">
                          {catProducts.length > 0 ? (
                            <>
                              {catProducts.slice(0, 5).map((prod: any) => {
                                const prodImg = getProductImage(prod);
                                return (
                                  <Link
                                    key={prod.id}
                                    to={`/product/${prod.slug}`}
                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors group/item"
                                  >
                                    <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200/70 overflow-hidden shrink-0 flex items-center justify-center">
                                      <img
                                        src={prodImg}
                                        alt={prod.name}
                                        className="w-full h-full object-cover group-hover/item:scale-105 transition-transform duration-200"
                                        loading="lazy"
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-xs font-semibold text-slate-800 truncate group-hover/item:text-primary transition-colors">
                                        {prod.name}
                                      </h4>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs font-bold text-primary">
                                          ৳{Number(prod.price)}
                                        </span>
                                        {prod.original_price && Number(prod.original_price) > Number(prod.price) && (
                                          <span className="text-[10px] text-slate-400 line-through">
                                            ৳{Number(prod.original_price)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover/item:text-primary group-hover/item:translate-x-0.5 transition-all shrink-0" />
                                  </Link>
                                );
                              })}

                              {catProducts.length > 5 && (
                                <div className="pt-2.5 pb-1 text-center">
                                  <Link
                                    to={`/category/${cat.slug}`}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline py-1"
                                  >
                                    <span>আরও {catProducts.length - 5}টি পণ্য দেখুন</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </Link>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="py-6 px-4 text-center">
                              <Package className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                              <p className="text-xs text-slate-500 font-medium">এই ক্যাটাগরিতে এখনো পণ্য যুক্ত করা হয়নি</p>
                              <Link
                                to={`/category/${cat.slug}`}
                                className="inline-block mt-2 text-xs font-semibold text-primary hover:underline"
                              >
                                ক্যাটাগরি পেজ দেখুন →
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
