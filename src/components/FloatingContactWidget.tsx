import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Phone, X, MessageCircle } from "lucide-react";

// WhatsApp SVG Icon
const WhatsAppIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// Facebook Messenger SVG Icon
const MessengerIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.35.26.57l-.06 1.77c-.03.77.77 1.29 1.45.93l1.97-1.04c.18-.1.39-.12.59-.07.84.22 1.73.34 2.65.34 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm1.09 13.06l-2.61-2.79-5.09 2.79c-.38.21-.83-.19-.66-.6l5.37-5.71c.21-.22.56-.23.78-.02l2.64 2.82 5.06-2.82c.38-.21.83.19.66.6l-5.37 5.71c-.22.24-.56.24-.78.02z" />
  </svg>
);

interface FloatingContactWidgetProps {
  className?: string;
}

const FloatingContactWidget = ({ className = "" }: FloatingContactWidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch store contact settings
  const { data: whatsappData } = useQuery({
    queryKey: ["whatsapp_number"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_setting", { _key: "whatsapp_number" });
      const num = (data as any)?.number || "";
      if (num.trim()) return num.trim();
      const { data: sm } = await supabase.rpc("get_public_setting", { _key: "social_media" });
      return (sm as any)?.whatsapp || "";
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: footerData } = useQuery({
    queryKey: ["footer-content"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_setting", { _key: "footer_content" });
      return (data as any) || {};
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: socialMedia } = useQuery({
    queryKey: ["social-media"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_setting", { _key: "social_media" });
      return (data as any) || {};
    },
    staleTime: 1000 * 60 * 10,
  });

  // Calculate links
  const rawPhone = footerData?.phone || whatsappData || "01700000000";
  const phoneHref = `tel:${rawPhone.replace(/[^\d+]/g, "")}`;

  const rawWhatsapp = whatsappData || footerData?.phone || "";
  const whatsappDigits = rawWhatsapp.replace(/\D/g, "");
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent("আসসালামু আলাইকুম, আমি আপনার শপ থেকে তথ্য জানতে চাচ্ছি।")}`
    : "#";

  const rawFacebook = socialMedia?.facebook || "";
  let messengerHref = "https://m.me";
  if (rawFacebook) {
    const cleanFb = rawFacebook.replace(/\/$/, "");
    const parts = cleanFb.split("/");
    const lastPart = parts[parts.length - 1];
    if (lastPart && !lastPart.includes("profile.php")) {
      messengerHref = `https://m.me/${lastPart}`;
    } else {
      messengerHref = rawFacebook;
    }
  }

  // Close when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative flex flex-col items-center ${className}`}>
      {/* Expanded Actions Stack (Matches Image 5) */}
      {isOpen && (
        <div className="flex flex-col items-center gap-3 mb-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* 1. Messenger Button (Blue) */}
          <a
            href={messengerHref}
            target="_blank"
            rel="noopener noreferrer"
            title="মেসেঞ্জারে চ্যাট করুন"
            className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#0084FF] text-white flex items-center justify-center shadow-lg hover:shadow-[#0084FF]/40 hover:scale-110 active:scale-95 transition-all"
          >
            <MessengerIcon className="h-6 w-6" />
          </a>

          {/* 2. WhatsApp Button (Green) */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            title="হোয়াটসঅ্যাপে মেসেজ দিন"
            className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:shadow-[#25D366]/40 hover:scale-110 active:scale-95 transition-all"
          >
            <WhatsAppIcon className="h-6 w-6" />
          </a>

          {/* 3. Phone Call Button (Emerald) */}
          <a
            href={phoneHref}
            title="সরাসরি কল করুন"
            className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#00C853] text-white flex items-center justify-center shadow-lg hover:shadow-[#00C853]/40 hover:scale-110 active:scale-95 transition-all"
          >
            <Phone className="h-5 w-5 stroke-[2.2]" />
          </a>

          {/* 4. Close 'X' Button (Vibrant Blue, matches image) */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close Contact Menu"
            title="বন্ধ করুন"
            className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-[#0070F3] text-white flex items-center justify-center shadow-lg hover:shadow-[#0070F3]/40 hover:scale-110 active:scale-95 transition-all"
          >
            <X className="h-6 w-6 stroke-[2.8]" />
          </button>
        </div>
      )}

      {/* Main Avatar Trigger Button (Matches Image 4) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open Customer Support Contact"
          title="যোগাযোগ ও কাস্টমার সাপোর্ট"
          className="relative w-12 h-12 md:w-14 md:h-14 rounded-full p-0.5 bg-gradient-to-tr from-primary to-emerald-400 shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer group"
        >
          <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-slate-100 flex items-center justify-center">
            {/* Friendly Customer Support Headset Image */}
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=140&auto=format&fit=crop&q=80"
              alt="Customer Support"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to nice SVG icon if image blocked
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <MessageCircle className="h-6 w-6 text-primary absolute hidden only:block" />
          </div>

          {/* Green Online Pulsing Indicator Dot */}
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white shadow-xs">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          </span>
        </button>
      )}
    </div>
  );
};

export default FloatingContactWidget;
