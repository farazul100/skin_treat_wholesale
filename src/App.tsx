import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { FacebookPixelProvider } from "@/contexts/FacebookPixelContext";
import Index from "./pages/Index";
import ProductDetail from "./pages/ProductDetail";
import AllProductsPage from "./pages/AllProductsPage";
import AllCategoriesPage from "./pages/AllCategoriesPage";
import CategoryProducts from "./pages/CategoryProducts";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import OrderSuccess from "./pages/OrderSuccess";
import ShefaTubePage from "./pages/ShefaTube";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminIncompleteOrders from "./pages/admin/AdminIncompleteOrders";
import RecoveryAnalytics from "./pages/admin/RecoveryAnalytics";
import AdminCodeSnippets from "./pages/admin/AdminCodeSnippets";
import AdminHeroSlides from "./pages/admin/AdminHeroSlides";
import AdminContentManager from "./pages/admin/AdminContentManager";
import AdminPages from "./pages/admin/AdminPages";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminShefaTube from "./pages/admin/AdminShefaTube";
import InvoicePrint from "./pages/admin/InvoicePrint";
import PolicyPage from "./pages/PolicyPage";
import CodeSnippetInjector from "./components/CodeSnippetInjector";
import BottomNav from "./components/BottomNav";
import FaviconManager from "./components/FaviconManager";
import StorefrontFloatingWidgets from "./components/StorefrontFloatingWidgets";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes fresh
      gcTime: 1000 * 60 * 30, // 30 minutes cache
      refetchOnWindowFocus: false, // Prevent continuous refetching on window focus
      refetchOnMount: false, // Use cached data immediately if available
      retry: 1,
    },
  },
});

import { useCategoriesEnabled } from "./hooks/useCategoriesEnabled";

const AppRoutes = () => {
  const categoriesEnabled = useCategoriesEnabled();
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/products" element={<AllProductsPage />} />
      <Route path="/categories" element={<AllCategoriesPage />} />
      {categoriesEnabled && <Route path="/category/:slug" element={<CategoryProducts />} />}
      <Route path="/product/:slug" element={<ProductDetail />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/order-success/:orderId" element={<OrderSuccess />} />
      <Route path="/shefa-tube" element={<ShefaTubePage />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/page/:slug" element={<PolicyPage />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/admin/invoice-print" element={<InvoicePrint />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        {categoriesEnabled && <Route path="categories" element={<AdminCategories />} />}
        <Route path="products" element={<AdminProducts />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="incomplete-orders" element={<AdminIncompleteOrders />} />
        <Route path="recovery-analytics" element={<RecoveryAnalytics />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="code-snippets" element={<AdminCodeSnippets />} />
        <Route path="hero-slides" element={<AdminHeroSlides />} />
        <Route path="content" element={<AdminContentManager />} />
        <Route path="pages" element={<AdminPages />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="shefa-tube" element={<AdminShefaTube />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <FacebookPixelProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
          <BrowserRouter>
            <CodeSnippetInjector />
            <FaviconManager />
            <AppRoutes />
            <StorefrontFloatingWidgets />
            <BottomNav />
          </BrowserRouter>
          </TooltipProvider>
        </CartProvider>
      </FacebookPixelProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
