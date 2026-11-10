import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const HeroBanner = () => {
  const [current, setCurrent] = useState(0);

  const { data: slides, isLoading: slidesLoading } = useQuery({
    queryKey: ["hero-slides"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hero_slides")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      return data || [];
    },
  });

  const { data: promoSetting, isLoading: promoLoading } = useQuery({
    queryKey: ["hero-promo-banner"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .eq("key", "hero_promo_banner")
        .single();
      const raw = data?.value || data?.setting_value;
      if (!raw) return null;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    },
  });

  const total = slides?.length || 0;

  const goTo = useCallback((idx: number) => {
    setCurrent(idx);
  }, []);

  const next = useCallback(() => {
    if (total > 0) setCurrent((c) => (c + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    if (total > 0) setCurrent((c) => (c - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => {
      setCurrent((c) => (c + 1) % total);
    }, 5000);
    return () => clearInterval(t);
  }, [total]);

  if (slidesLoading || promoLoading) {
    return (
      <section className="bg-background py-0 md:py-3">
        <div className="w-full md:container mx-auto px-0 md:px-4 max-w-[1536px]">
          <div className="w-full bg-muted animate-pulse rounded-none aspect-[2.1/1] max-h-[420px]" />
        </div>
      </section>
    );
  }

  if (!total) {
    return null;
  }

  const hasPromo = Boolean(promoSetting?.enabled && promoSetting?.image_url);

  return (
    <section className="bg-background py-0 md:py-3">
      <div className="w-full md:container mx-auto px-0 md:px-4 max-w-[1536px]">
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-4 items-stretch">
          {/* Main Hero Slider */}
          <div
            className={`w-full ${
              hasPromo ? "lg:w-[67%]" : "w-full"
            } relative rounded-none overflow-hidden bg-muted/40`}
          >
            <div
              className={`relative w-full ${
                hasPromo
                  ? "aspect-[16/9] sm:aspect-[2/1] lg:aspect-[2.35/1] max-h-[360px] md:max-h-[400px] lg:max-h-[440px]"
                  : "aspect-[16/8] md:aspect-[1400/440] max-h-[360px] md:max-h-[420px]"
              }`}
            >
              {slides!.map((s, i) => {
                const isCurrent = i === current;
                const imgElement = (
                  <img
                    src={s.image_url}
                    alt={s.title || "Banner"}
                    className="w-full h-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                );

                return (
                  <div
                    key={s.id}
                    className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                      isCurrent
                        ? "opacity-100 z-[1] pointer-events-auto"
                        : "opacity-0 z-0 pointer-events-none"
                    }`}
                  >
                    {s.link_url ? (
                      s.link_url.startsWith("http") ? (
                        <a
                          href={s.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full h-full"
                        >
                          {imgElement}
                        </a>
                      ) : (
                        <Link to={s.link_url} className="block w-full h-full">
                          {imgElement}
                        </Link>
                      )
                    ) : (
                      imgElement
                    )}
                  </div>
                );
              })}

              {/* Navigation arrows */}
              {total > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      prev();
                    }}
                    className="absolute left-2.5 md:left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-amber-600 shadow-md rounded-full p-1.5 md:p-2 transition-all hover:scale-105 z-10"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      next();
                    }}
                    className="absolute right-2.5 md:right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-amber-600 shadow-md rounded-full p-1.5 md:p-2 transition-all hover:scale-105 z-10"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
                  </button>
                </>
              )}

              {/* Pagination Dots (Bottom-Left as in reference design) */}
              {total > 1 && (
                <div className="absolute bottom-3 md:bottom-4 left-4 md:left-6 flex items-center gap-1.5 z-10">
                  {slides!.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        goTo(i);
                      }}
                      aria-label={`Slide ${i + 1}`}
                      className={`rounded-full transition-all duration-300 ${
                        i === current
                          ? "w-2.5 h-2.5 md:w-3 md:h-3 bg-amber-600 ring-2 ring-white/90"
                          : "w-2 h-2 md:w-2.5 md:h-2.5 bg-white/80 hover:bg-white"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Side Promo Banner (Desktop Only, hidden on mobile) */}
          {hasPromo && (
            <div className="hidden lg:block lg:w-[33%] shrink-0">
              <div className="relative w-full h-full rounded-none overflow-hidden bg-muted/40 group">
                {promoSetting.link_url ? (
                  promoSetting.link_url.startsWith("http") ? (
                    <a
                      href={promoSetting.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full h-full"
                    >
                      <img
                        src={promoSetting.image_url}
                        alt={promoSetting.title || "Promo Banner"}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </a>
                  ) : (
                    <Link to={promoSetting.link_url} className="block w-full h-full">
                      <img
                        src={promoSetting.image_url}
                        alt={promoSetting.title || "Promo Banner"}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </Link>
                  )
                ) : (
                  <img
                    src={promoSetting.image_url}
                    alt={promoSetting.title || "Promo Banner"}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
