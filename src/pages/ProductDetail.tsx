import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ArrowLeft, Minus, Plus, ShieldCheck, Truck, Clock, CheckCircle2, Shield, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Video, Gift } from "lucide-react";
import { useEffect, useState } from "react";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeaturedProducts from "@/components/FeaturedProducts";
import AllProducts from "@/components/AllProducts";
import { toast } from "sonner";

const extractYouTubeId = (url?: string): string | null => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
};

const ProductDetail = () => {
  const { slug } = useParams();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .eq("slug", slug!)
        .eq("is_active", true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopBar />
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopBar />
        <Header />
        <div className="flex-1 flex items-center justify-center flex-col gap-4 px-4">
          <h1 className="text-xl font-bold text-foreground">পণ্যটি পাওয়া যায়নি</h1>
          <Link to="/">
            <Button>হোমপেজে ফিরে যান</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const rawImages: unknown = product.images;
  const images = (() => {
    if (Array.isArray(rawImages)) {
      const validImages = rawImages.filter((image): image is string => typeof image === "string" && image.trim().length > 0);
      return validImages.length > 0 ? validImages : ["/placeholder.svg"];
    }

    if (typeof rawImages === "string" && rawImages.trim() !== "") {
      try {
        const parsed: unknown = JSON.parse(rawImages);
        if (Array.isArray(parsed)) {
          const validImages = parsed.filter((image): image is string => typeof image === "string" && image.trim().length > 0);
          if (validImages.length > 0) return validImages;
        }
      } catch {
        return [rawImages];
      }

      return [rawImages];
    }

    return ["/placeholder.svg"];
  })();

  const safeSelectedImage = selectedImage < images.length ? selectedImage : 0;
  const currentImage = images[safeSelectedImage] ?? images[0] ?? "/placeholder.svg";

  const handlePrevImage = () => {
    setSelectedImage((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };
  const handleNextImage = () => {
    setSelectedImage((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleAddToCart = () => {
    const finalImg = currentImage && currentImage !== "/placeholder.svg" ? currentImage : (images[0] || "/placeholder.svg");
    addItem(
      {
        id: product.id,
        name: product.name,
        price: Number(product.price),
        originalPrice: product.original_price ? Number(product.original_price) : undefined,
        image: finalImg,
        has_gift: Boolean(product.has_gift),
        gift_title: product.gift_title || "",
        gift_image: product.gift_image || "",
        gift_price: Number(product.gift_price || 0),
        gift_charge_enabled: Boolean(product.gift_charge_enabled),
      },
      quantity
    );
    toast.success(`${product.name} কার্টে যোগ হয়েছে`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-4 lg:py-6">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-4">
            <ArrowLeft className="h-4 w-4" /> হোমপেজে ফিরে যান
          </Link>

          <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-10 max-w-6xl mx-auto">
            {/* Gallery Section */}
            <div className="lg:col-span-6 w-full min-w-0">
              <div className="flex flex-col lg:flex-row gap-3 items-start justify-center">
                {/* Desktop Vertical Thumbnails (Shown only on lg and above) */}
                {images.length > 1 && (
                  <div className="hidden lg:flex flex-col items-center gap-1.5 flex-shrink-0">
                    {images.length > 3 && (
                      <button
                        type="button"
                        onClick={handlePrevImage}
                        className="h-6 w-6 rounded-full border border-border/60 bg-white hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors shadow-2xs cursor-pointer"
                        title="পূর্ববর্তী ছবি"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div className="flex flex-col gap-2 max-h-[390px] overflow-y-auto pr-0.5 no-scrollbar">
                      {images.map((img: string, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedImage(i)}
                          className={`h-16 w-16 overflow-hidden rounded-xl border-2 bg-white flex-shrink-0 transition-all cursor-pointer ${
                            safeSelectedImage === i
                              ? "border-primary shadow-xs ring-1 ring-primary/40"
                              : "border-border/60 hover:border-primary/50 opacity-80 hover:opacity-100"
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                    {images.length > 3 && (
                      <button
                        type="button"
                        onClick={handleNextImage}
                        className="h-6 w-6 rounded-full border border-border/60 bg-white hover:bg-secondary flex items-center justify-center text-muted-foreground transition-colors shadow-2xs cursor-pointer"
                        title="পরবর্তী ছবি"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Main Image Container */}
                <div className="relative w-full max-w-[420px] mx-auto lg:mx-0">
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border/70 bg-white shadow-xs flex items-center justify-center">
                    <img
                      key={currentImage}
                      src={currentImage}
                      alt={product.name}
                      loading="eager"
                      onError={(event) => {
                        event.currentTarget.src = "/placeholder.svg";
                      }}
                      className="block max-h-full max-w-full w-auto h-auto object-contain transition-transform duration-300 hover:scale-105"
                    />

                    {/* Navigation Arrows on Main Image */}
                    {images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={handlePrevImage}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 hover:bg-white text-foreground shadow-md flex items-center justify-center border border-border/40 transition-all cursor-pointer"
                          title="পূর্ববর্তী"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleNextImage}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 hover:bg-white text-foreground shadow-md flex items-center justify-center border border-border/40 transition-all cursor-pointer"
                          title="পরবর্তী"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>

                        {/* Dots Indicator */}
                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/25 backdrop-blur-xs px-2.5 py-1 rounded-full">
                          {images.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setSelectedImage(i)}
                              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                safeSelectedImage === i ? "w-4 bg-white" : "w-1.5 bg-white/50"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Mobile Horizontal Thumbnails (Only visible on mobile/tablet, preserving phone UX) */}
                  {images.length > 1 && (
                    <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 mt-3">
                      {images.map((img: string, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedImage(i)}
                          className={`h-14 w-14 overflow-hidden rounded-lg border-2 bg-card flex-shrink-0 transition-all ${
                            safeSelectedImage === i
                              ? "border-primary ring-1 ring-primary/40 shadow-xs"
                              : "border-border/60 hover:border-primary/50"
                          }`}
                        >
                          <img src={img} alt="" className="w-full h-full object-contain p-1" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Details Section */}
            <div className="lg:col-span-6 w-full min-w-0 mx-auto">
              {product.categories?.name && (
                <span className="text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
                  {product.categories.name}
                </span>
              )}
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-3 mb-2">{product.name}</h1>

              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl md:text-3xl font-bold text-primary">৳ {Number(product.price)}</span>
                {product.original_price && (
                  <span className="text-lg text-muted-foreground line-through">৳ {Number(product.original_price)}</span>
                )}
                {product.original_price && (
                  <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-md font-bold">
                    {Math.round((1 - Number(product.price) / Number(product.original_price)) * 100)}% Saved
                  </span>
                )}
              </div>

              {/* Dashed separator like reference */}
              <div className="border-b border-dashed border-border/70 my-3" />

              {product.short_description && (
                <p className="text-muted-foreground text-sm leading-relaxed mb-5">
                  {product.short_description}
                </p>
              )}

              {/* Gift Offer Box if product has gift */}
              {Boolean(product.has_gift && product.gift_title) && (
                <div className="mb-5 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-50/80 via-emerald-50/40 to-amber-50/50 p-3.5 sm:p-4 shadow-xs relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                      <Gift className="h-3.5 w-3.5" />
                      {product.gift_charge_enabled ? "স্পেশাল গিফট অফার" : "সম্পূর্ণ ফ্রি উপহার"}
                    </span>
                    <span className="text-xs font-semibold text-emerald-800">
                      এই পণ্যের সাথে উপহার অন্তর্ভুক্ত!
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white border border-emerald-200/80 p-1 flex-shrink-0 flex items-center justify-center shadow-xs overflow-hidden">
                      {product.gift_image ? (
                        <img
                          src={product.gift_image}
                          alt={product.gift_title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Gift className="h-8 w-8 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm sm:text-base text-foreground line-clamp-1">
                        {product.gift_title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {product.gift_charge_enabled ? (
                          <span className="text-xs font-bold text-primary">
                            প্যাকেজ মূল্য: +৳{Number(product.gift_price || 0)} (চেকআউটে যোগ হবে)
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground line-through">
                              মূল্য: ৳{Number(product.gift_price || 0)}
                            </span>
                            <span className="text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.2 rounded">
                              ৳০ (ফ্রি!)
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        অর্ডার করলেই মূল পণ্যের সাথে এই আকর্ষণীয় উপহারটি পাঠানো হবে।
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons (Row 1: Quantity + Add to Cart | Row 2: ORDER NOW) */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  {/* Quantity selector */}
                  <div className="flex items-center border border-border/80 rounded-lg bg-secondary/30 p-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-foreground hover:bg-background rounded-md"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center font-bold text-base text-foreground">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-foreground hover:bg-background rounded-md"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Add to Cart button */}
                  <Button
                    size="lg"
                    className="flex-1 h-11 text-base font-semibold gap-2 shadow-xs"
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="h-5 w-5" /> Add to Cart (কার্টে যোগ)
                  </Button>
                </div>

                {/* ORDER NOW button (Full width) */}
                <Link to="/checkout" className="block w-full">
                  <Button
                    size="lg"
                    className="w-full h-12 text-base font-bold uppercase tracking-wider bg-[#0f172a] hover:bg-[#1e293b] text-white shadow-sm"
                    onClick={handleAddToCart}
                  >
                    ORDER NOW
                  </Button>
                </Link>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground border-t pt-3">
                <p><span className="font-medium text-foreground">SKU:</span> {product.sku || "N/A"}</p>
                <p>
                  <span className="font-medium text-foreground">স্টক:</span>{" "}
                  {product.stock > 0 ? (
                    <span className="text-emerald-600 font-semibold">ইন স্টক ({product.stock})</span>
                  ) : (
                    <span className="text-destructive font-semibold">স্টক আউট</span>
                  )}
                </p>
              </div>

            </div>
          </div>

          {product.description && (
            <div className="mt-8 lg:mt-12 w-full max-w-full bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
              <h3 className="font-bold text-foreground mb-4 text-xl border-b pb-2 inline-block border-primary">বিস্তারিত বিবরণ</h3>
              {/<\/?[a-z][\s\S]*>/i.test(product.description) ? (
                <div 
                  className="text-muted-foreground break-words leading-relaxed text-base md:text-lg prose max-w-none prose-p:my-2 prose-headings:my-3 prose-a:text-primary prose-ul:my-2 prose-li:my-0.5"
                  dangerouslySetInnerHTML={{ __html: product.description.replace(/```(html)?/gi, '') }}
                />
              ) : (
                <div className="text-muted-foreground whitespace-pre-line break-words leading-relaxed text-base md:text-lg">
                  {product.description}
                </div>
              )}
            </div>
          )}

          {/* Product Video Section */}
          {product.video_url && (
            <div className="mt-8 lg:mt-12 w-full max-w-full bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-border/50">
              <h3 className="font-bold text-foreground mb-4 text-xl border-b pb-2 inline-flex items-center gap-2 border-primary">
                <Video className="h-5 w-5 text-primary" /> পণ্যটির ভিডিও রিভিউ
              </h3>
              <div className="max-w-3xl mx-auto rounded-xl overflow-hidden border bg-black shadow-md">
                {extractYouTubeId(product.video_url) ? (
                  <div className="aspect-video w-full">
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYouTubeId(product.video_url)}`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <video
                    src={product.video_url}
                    controls
                    className="w-full max-h-[480px] mx-auto bg-black"
                    poster={product.video_thumbnail}
                  >
                    আপনার ব্রাউজার ভিডিও সাপোর্ট করে না
                  </video>
                )}
              </div>
            </div>
          )}

          {/* Landing Page Style Sections */}
          {product.landing_page_html ? (
            <div 
              className="mt-12 w-full max-w-full"
              dangerouslySetInnerHTML={{ __html: product.landing_page_html.replace(/```(html)?/gi, '') }}
            />
          ) : (
            <div className="mt-12 space-y-12">
              {/* Why Choose Us */}
              <div className="bg-primary/5 rounded-3xl p-8 md:p-12 text-center border border-primary/10">
                <h2 className="text-2xl md:text-3xl font-bold mb-8 text-foreground">কেন আমাদের পণ্যটি সেরা?</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="bg-white p-6 rounded-2xl shadow-sm">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ShieldCheck className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">১০০% আসল পণ্য</h3>
                    <p className="text-muted-foreground text-sm">আমরা সরাসরি প্রস্তুতকারক থেকে অরিজিনাল পণ্য সংগ্রহ করি, তাই কোয়ালিটি নিয়ে কোনো আপস নেই।</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Truck className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">সুপার ফাস্ট ডেলিভারি</h3>
                    <p className="text-muted-foreground text-sm">অর্ডার করার পর যত দ্রুত সম্ভব আপনার ঠিকানায় পণ্য পৌঁছে দিতে আমরা বদ্ধপরিকর।</p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg mb-2">২৪/৭ কাস্টমার সাপোর্ট</h3>
                    <p className="text-muted-foreground text-sm">পণ্য সংক্রান্ত যেকোনো প্রয়োজনে আমাদের এক্সপার্ট টিম আপনাকে সাহায্য করতে প্রস্তুত।</p>
                  </div>
                </div>
              </div>

              {/* How to order */}
              <div className="py-8">
                <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center text-foreground">যেভাবে অর্ডার করবেন</h2>
                <div className="max-w-3xl mx-auto space-y-4">
                  <div className="flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
                    <div className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">১</div>
                    <p className="font-medium">নিচের <span className="text-primary font-bold">"এখনই কিনুন"</span> বাটনে ক্লিক করুন।</p>
                  </div>
                  <div className="flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
                    <div className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">২</div>
                    <p className="font-medium">আপনার নাম, মোবাইল নাম্বার এবং সম্পূর্ণ ঠিকানা সঠিকভাবে লিখুন।</p>
                  </div>
                  <div className="flex items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
                    <div className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0">৩</div>
                    <p className="font-medium">"অর্ডার কনফার্ম করুন" বাটনে ক্লিক করে আপনার অর্ডারটি নিশ্চিত করুন।</p>
                  </div>
                </div>
              </div>

              {/* Final CTA Banner */}
              <div className="bg-gradient-to-r from-primary/90 to-primary text-white rounded-3xl p-8 md:p-12 text-center shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-2xl md:text-4xl font-bold mb-4">আর দেরি কেন?</h2>
                  <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">স্টক ফুরিয়ে যাওয়ার আগেই আপনার প্রয়োজনীয় পণ্যটি আজই অর্ডার করুন এবং উপভোগ করুন সেরা শপিং অভিজ্ঞতা।</p>
                  <Link to="/checkout" onClick={handleAddToCart} className="inline-block bg-white text-primary font-bold text-lg px-10 py-4 rounded-full shadow-lg hover:bg-gray-50 transition-transform hover:scale-105">
                    এখনই অর্ডার করুন
                  </Link>
                  <p className="mt-4 text-sm opacity-80 flex items-center justify-center gap-2">
                    <Shield className="h-4 w-4" /> ১০০% নিরাপদ শপিং
                  </p>
                </div>
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
              </div>
            </div>
          )}
        </div>
        <FeaturedProducts />
        <AllProducts />
      </main>
      
      {/* Sticky Mobile Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-3 sm:hidden z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex items-center justify-between gap-3 animate-in slide-in-from-bottom-full duration-300">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">সর্বমোট মূল্য</span>
          <span className="font-bold text-primary text-lg">৳{Number(product.price) * quantity}</span>
        </div>
        <Link to="/checkout" className="flex-1" onClick={handleAddToCart}>
          <Button size="lg" className="w-full font-bold h-12 rounded-full shadow-md animate-pulse-slow">
            অর্ডার করুন
          </Button>
        </Link>
      </div>

      <Footer />
    </div>
  );
};

export default ProductDetail;
