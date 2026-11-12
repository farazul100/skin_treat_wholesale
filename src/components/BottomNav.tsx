import { Home, LayoutGrid, Search, ShoppingCart } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useState, type MouseEvent } from "react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const getWhatsAppHref = (value?: string) => {
  if (!value?.trim()) return "";

  const trimmedValue = value.trim();
  // Extract digits from any format (raw number, wa.me link, api.whatsapp.com link, etc.)
  const digits = trimmedValue.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
};

const openExternalLink = (event: MouseEvent<HTMLAnchorElement>, href?: string) => {
  if (!href) {
    event.preventDefault();
    return;
  }

  event.preventDefault();

  try {
    if (window.self !== window.top && window.top) {
      window.top.location.href = href;
      return;
    }
  } catch {
    // Ignore cross-origin access issues and fallback to a new tab.
  }

  window.open(href, "_blank", "noopener,noreferrer");
};

const BottomNav = () => {
  const location = useLocation();
  const { totalItems, openCart } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: whatsappValue } = useQuery({
    queryKey: ["whatsapp_number"],
    queryFn: async () => {
      // Try dedicated whatsapp_number key first, fallback to social_media
      const { data: wpData } = await supabase.rpc("get_public_setting", { _key: "whatsapp_number" });
      const wpNumber = (wpData as { number?: string } | null)?.number;
      if (wpNumber?.trim()) return wpNumber;

      const { data: smData } = await supabase.rpc("get_public_setting", { _key: "social_media" });
      return (smData as { whatsapp?: string } | null)?.whatsapp || "";
    },
  });

  const whatsappHref = getWhatsAppHref(whatsappValue);
  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-20">
          <SheetTitle className="text-center text-primary font-bold mb-4">পণ্য খুঁজুন</SheetTitle>
          <div className="relative">
            <Input placeholder="পণ্য খুঁজুন..." className="pr-10 h-12 text-base rounded-xl" autoFocus />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          </div>
        </SheetContent>
      </Sheet>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
        <div className="flex items-end justify-around px-1 h-16 relative">
          <Link to="/" className={`flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 flex-1 ${isActive("/") ? "text-primary" : "text-muted-foreground"}`}>
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          <Link to="/products" className={`flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 flex-1 ${isActive("/products") ? "text-primary" : "text-muted-foreground"}`}>
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[10px] font-medium">Category</span>
          </Link>

          <div className="flex flex-col items-center flex-1 relative">
            <button
              onClick={() => setSearchOpen(true)}
              className="absolute -top-5 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-4 border-background transition-transform active:scale-95"
            >
              <Search className="h-6 w-6" />
            </button>
            <span className="text-[10px] font-medium text-primary mt-8">Search</span>
          </div>

          <button
            type="button"
            onClick={openCart}
            className={`flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 flex-1 relative ${isActive("/cart") ? "text-primary" : "text-muted-foreground"}`}
          >
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-3 bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Cart</span>
          </button>

          <a
            href={whatsappHref || "#"}
            target={whatsappHref ? "_blank" : undefined}
            rel={whatsappHref ? "noopener noreferrer" : undefined}
            aria-disabled={!whatsappHref}
            onClick={(event) => {
              openExternalLink(event, whatsappHref);
            }}
            className={`flex flex-col items-center justify-center gap-0.5 pt-2 pb-1 flex-1 text-muted-foreground ${!whatsappHref ? "opacity-60" : ""}`}
          >
            <WhatsAppIcon className="h-5 w-5" />
            <span className="text-[10px] font-medium">WhatsApp</span>
          </a>
        </div>

        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      <div className="md:hidden h-20" />
    </>
  );
};

export default BottomNav;
