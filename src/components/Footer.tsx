import { Phone, Mail, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const defaultFooter = {
  brand_description: "বাংলাদেশের সেরা প্রাকৃতিক ও অর্গানিক পণ্যের অনলাইন শপ। ১০০% খাঁটি পণ্যের নিশ্চয়তা।",
  quick_links: [
    { label: "আমাদের সম্পর্কে", href: "/page/about" },
    { label: "সকল পণ্য", href: "/products" },
    { label: "যোগাযোগ", href: "/page/contact" },
    { label: "সকল ক্যাটাগরি", href: "/categories" },
  ],
  policy_links: [
    { label: "প্রাইভেসি পলিসি", href: "/page/privacy" },
    { label: "শর্তাবলী", href: "/page/terms" },
    { label: "রিফান্ড পলিসি", href: "/page/refund" },
    { label: "শিপিং পলিসি", href: "/page/shipping" },
  ],
  phone: "০১XXXXXXXXX",
  email: "info@naturalshefa.com",
  address: "ঢাকা, বাংলাদেশ",
  copyright: "© ২০২৬ Natural Shefa। সর্বস্বত্ব সংরক্ষিত।",
};

const Footer = () => {
  const { data: footerData } = useQuery({
    queryKey: ["footer-content"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_setting", { _key: "footer_content" });
      return (data as any) || defaultFooter;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: logoData } = useQuery({
    queryKey: ["site-logo"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_setting", { _key: "site_logo" });
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: footerLogoData } = useQuery({
    queryKey: ["footer-logo"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_setting", { _key: "footer_logo" });
      return data;
    },
    staleTime: 1000 * 60 * 10,
  });

  const rawLogoUrl = typeof logoData === "object" ? (logoData?.url || "") : (typeof logoData === "string" ? logoData : "");
  const logoUrl = (typeof rawLogoUrl === "string" && !rawLogoUrl.startsWith("[object") && rawLogoUrl.trim() !== "") ? rawLogoUrl.trim() : "";
  const invertOnWhite = typeof logoData === "object" ? Boolean(logoData?.invert_on_white) : false;

  const rawFooterLogoUrl = typeof footerLogoData === "object" ? (footerLogoData?.url || "") : (typeof footerLogoData === "string" ? footerLogoData : "");
  const footerLogoUrl = (typeof rawFooterLogoUrl === "string" && !rawFooterLogoUrl.startsWith("[object") && rawFooterLogoUrl.trim() !== "") ? rawFooterLogoUrl.trim() : "";
  const forceWhite = typeof footerLogoData === "object" ? Boolean(footerLogoData?.force_white) : false;

  const displayLogoUrl = footerLogoUrl || logoUrl;

  const getLogoStyle = () => {
    if (forceWhite) {
      return { filter: "brightness(0) invert(1)" };
    }
    if (!footerLogoUrl && invertOnWhite) {
      return { filter: "brightness(0) invert(var(--footer-invert, 1))" };
    }
    return undefined;
  };

  const { data: socialMedia } = useQuery({
    queryKey: ["social-media"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_setting", { _key: "social_media" });
      return (data as any) || {};
    },
    staleTime: 1000 * 60 * 5,
  });

  const f = footerData || defaultFooter;

  return (
    <footer
      style={{
        backgroundColor: "hsl(var(--footer-bg, var(--primary)))",
        color: "hsl(var(--footer-foreground, var(--primary-foreground)))",
      }}
      className="transition-colors duration-200"
    >
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              {displayLogoUrl ? (
                <img
                  src={displayLogoUrl}
                  alt="Logo"
                  className="h-8 md:h-10 w-auto max-w-[180px] sm:max-w-[220px] object-contain transition-all"
                  style={getLogoStyle()}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              ) : null}
            </div>
            <p className="opacity-80 text-sm leading-relaxed mb-4">{f.brand_description}</p>
            {/* Social Media Icons */}
            <div className="flex gap-3">
              {socialMedia?.facebook && (
                <a
                  href={socialMedia.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
              )}
              {socialMedia?.instagram && (
                <a
                  href={socialMedia.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
              )}
              {socialMedia?.youtube && (
                <a
                  href={socialMedia.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              )}
              {socialMedia?.whatsapp && (
                <a
                  href={socialMedia.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
              )}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-4">দ্রুত লিংক</h4>
            <ul className="space-y-2 text-sm opacity-85">
              {(f.quick_links || defaultFooter.quick_links).map((l: any, i: number) => (
                <li key={i}><a href={l.href} className="hover:opacity-100 hover:underline transition-opacity">{l.label}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">নীতিমালা</h4>
            <ul className="space-y-2 text-sm opacity-85">
              {(f.policy_links || defaultFooter.policy_links).map((l: any, i: number) => (
                <li key={i}><a href={l.href} className="hover:opacity-100 hover:underline transition-opacity">{l.label}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">যোগাযোগ</h4>
            <ul className="space-y-3 text-sm opacity-85">
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 flex-shrink-0" /><span>{f.phone}</span></li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 flex-shrink-0" /><span>{f.email}</span></li>
              <li className="flex items-start gap-2"><MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{f.address}</span></li>
            </ul>
          </div>
        </div>
      </div>
      {/* Bottom Sub-Footer: Copyright + EPS Payment Gateway Trust Banner */}
      <div className="bg-white text-gray-800 border-t border-gray-200 py-3.5">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs md:text-sm text-gray-600 text-center md:text-left order-2 md:order-1 font-medium">
            {f.copyright}
          </p>
          <div className="flex items-center justify-center order-1 md:order-2">
            <img 
              src="/eps-payment-methods.png" 
              alt="Pay with - Verified by EPS Easy Payment System" 
              className="h-10 md:h-12 w-auto object-contain max-w-full"
            />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
