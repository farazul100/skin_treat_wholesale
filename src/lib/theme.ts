// src/lib/theme.ts
// Handles dynamic theme primary color application and CSS variable generation

export const normalizeHex = (hex: string): string | null => {
  if (!hex) return null;
  let cleaned = hex.trim().replace(/^#/, "");
  if (cleaned.length === 3) {
    cleaned = cleaned.split("").map((c) => c + c).join("");
  }
  if (!/^[a-f\d]{6}$/i.test(cleaned)) return null;
  return `#${cleaned}`;
};

export const hexToHsl = (hex: string): { hsl: string; lightness: number } | null => {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const int = parseInt(normalized.slice(1), 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return {
    hsl: `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`,
    lightness: l,
  };
};

export const applyThemeColor = (hex: string) => {
  if (typeof document === "undefined") return;
  const result = hexToHsl(hex);
  if (!result) return;
  const { hsl, lightness } = result;
  const root = document.documentElement;

  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--sidebar-primary", hsl);
  root.style.setProperty("--sidebar-ring", hsl);
  root.style.setProperty("--secondary-foreground", hsl);
  root.style.setProperty("--accent-foreground", hsl);
  root.style.setProperty("--sidebar-accent-foreground", hsl);

  // Set high-contrast foreground (white on dark/medium, dark on light)
  if (lightness > 0.65) {
    root.style.setProperty("--primary-foreground", "140 60% 8%");
    root.style.setProperty("--sidebar-primary-foreground", "140 60% 8%");
  } else {
    root.style.setProperty("--primary-foreground", "0 0% 100%");
    root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
  }

  try {
    localStorage.setItem("app_theme_color", hex);
  } catch {}
};
