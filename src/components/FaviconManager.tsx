import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyThemeColor } from "@/lib/theme";

const FaviconManager = () => {
  // Apply cached theme color immediately to avoid flash of default color
  useEffect(() => {
    try {
      const cached = localStorage.getItem("app_theme_color");
      const cachedFooter = localStorage.getItem("app_footer_color");
      if (cached || cachedFooter) applyThemeColor(cached || "", cachedFooter || "");
    } catch {}
  }, []);

  const { data: faviconUrl } = useQuery({
    queryKey: ["site-favicon"],
    queryFn: async () => {
      try {
        const { data: rpcData } = await supabase.rpc("get_public_setting", { _key: "site_favicon" });
        if (rpcData && (rpcData as any)?.url) return (rpcData as any).url;
      } catch {}
      const { data } = await supabase.from("site_settings").select("*").eq("key", "site_favicon").single();
      return (data?.value || (data as any)?.setting_value)?.url || "";
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: siteTitle } = useQuery({
    queryKey: ["site-title"],
    queryFn: async () => {
      try {
        const { data: rpcData } = await supabase.rpc("get_public_setting", { _key: "site_title" });
        if (rpcData && (rpcData as any)?.title) return (rpcData as any).title;
      } catch {}
      const { data } = await supabase.from("site_settings").select("*").eq("key", "site_title").single();
      return (data?.value || (data as any)?.setting_value)?.title || "";
    },
    staleTime: 1000 * 60 * 10,
  });

  const { data: themeColorData } = useQuery({
    queryKey: ["theme-color"],
    queryFn: async () => {
      try {
        const { data: rpcData } = await supabase.rpc("get_public_setting", { _key: "theme_color" });
        if (rpcData) {
          if (typeof rpcData === "string") return { primary_hex: rpcData, footer_hex: rpcData };
          return {
            primary_hex: (rpcData as any)?.primary_hex || "",
            footer_hex: (rpcData as any)?.footer_hex || (rpcData as any)?.primary_hex || "",
          };
        }
      } catch {}
      const { data } = await supabase.from("site_settings").select("*").eq("key", "theme_color").single();
      const val = data?.value || (data as any)?.setting_value;
      if (typeof val === "string") return { primary_hex: val, footer_hex: val };
      return {
        primary_hex: val?.primary_hex || "",
        footer_hex: val?.footer_hex || val?.primary_hex || "",
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (!faviconUrl) return;
    // Remove all existing favicons
    document.querySelectorAll("link[rel*='icon']").forEach((el) => el.remove());

    // Create new favicon link
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = faviconUrl;
    if (faviconUrl.endsWith(".svg")) link.type = "image/svg+xml";
    else if (faviconUrl.endsWith(".webp")) link.type = "image/webp";
    else if (faviconUrl.endsWith(".ico")) link.type = "image/x-icon";
    else link.type = "image/png"; // fallback
    document.head.appendChild(link);
  }, [faviconUrl]);

  useEffect(() => {
    if (!siteTitle) return;
    document.title = siteTitle;
    // Update OG title meta as well
    const ogTitle = document.querySelector("meta[property='og:title']") as HTMLMetaElement | null;
    if (ogTitle) ogTitle.content = siteTitle;
  }, [siteTitle]);

  useEffect(() => {
    if (themeColorData?.primary_hex) {
      applyThemeColor(themeColorData.primary_hex, themeColorData.footer_hex);
    }
  }, [themeColorData]);

  return null;
};

export default FaviconManager;
