import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingCart, Users, Settings, ArrowLeft, FolderOpen, AlertTriangle, Code2, Image, FileText, BookOpen, Star, Youtube, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCategoriesEnabled } from "@/hooks/useCategoriesEnabled";

class AdminErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("Admin Page Error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive space-y-3">
          <h2 className="text-lg font-bold">এই পেইজটি লোড হতে সমস্যা হয়েছে</h2>
          <p className="text-sm font-mono bg-background/80 p-3 rounded border text-foreground overflow-auto">
            {this.state.error?.message || String(this.state.error)}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            আবার চেষ্টা করুন (রিলোড)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const baseNavItems = [
  { path: "/admin", icon: LayoutDashboard, label: "ড্যাশবোর্ড" },
  { path: "/admin/hero-slides", icon: Image, label: "হিরো স্লাইড" },
  { path: "/admin/categories", icon: FolderOpen, label: "ক্যাটেগরি", requiresCategories: true },
  { path: "/admin/products", icon: Package, label: "পণ্যসমূহ" },
  { path: "/admin/orders", icon: ShoppingCart, label: "অর্ডারসমূহ" },
  { path: "/admin/incomplete-orders", icon: AlertTriangle, label: "ইনকমপ্লিট" },
  { path: "/admin/customers", icon: Users, label: "কাস্টমার" },
  { path: "/admin/content", icon: FileText, label: "কন্টেন্ট" },
  { path: "/admin/pages", icon: BookOpen, label: "পেইজ" },
  { path: "/admin/reviews", icon: Star, label: "রিভিউ" },
  { path: "/admin/shefa-tube", icon: Youtube, label: "শেফা টিউব" },
  { path: "/admin/code-snippets", icon: Code2, label: "কোড স্নিপেট" },
  { path: "/admin/settings", icon: Settings, label: "সেটিংস" },
];

const AdminLayout = () => {
  const { user, loading, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const categoriesEnabled = useCategoriesEnabled();
  const navItems = baseNavItems.filter((i: any) => !i.requiresCategories || categoriesEnabled);

  const { data: logoUrl } = useQuery({
    queryKey: ["site-logo"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*").eq("key", "site_logo").single();
      return ((data?.value || data?.setting_value) as any)?.url || "";
    },
    staleTime: 1000 * 60 * 10,
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!user || !isAdmin) return <Navigate to="/admin-login" />;

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Sidebar - Fixed */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-60 bg-card border-r flex-col z-40">
        <div className="p-4 border-b">
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-8 w-auto object-contain mb-1" />
          )}
          <p className="text-xs text-muted-foreground">অ্যাডমিন প্যানেল</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path}
              className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                location.pathname === item.path ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t space-y-1">
          <Link to="/" className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> স্টোরে ফিরে যান
          </Link>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> লগআউট
          </button>
        </div>
      </aside>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 flex justify-around py-2 overflow-x-auto">
        {navItems.map((item) => (
          <Link key={item.path} to={item.path}
            className={cn("flex flex-col items-center gap-0.5 text-xs p-1 shrink-0",
              location.pathname === item.path ? "text-primary" : "text-muted-foreground")}>
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        ))}
        <button
          onClick={() => signOut()}
          className="flex flex-col items-center gap-0.5 text-xs p-1 shrink-0 text-destructive cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
          লগআউট
        </button>
      </div>

      {/* Content - offset for fixed sidebar */}
      <main className="md:ml-60 p-4 md:p-6 pb-20 md:pb-6 min-h-screen">
        <AdminErrorBoundary>
          <Outlet />
        </AdminErrorBoundary>
      </main>
    </div>
  );
};

export default AdminLayout;
