import { useLocation } from "react-router-dom";
import CartDrawer from "./CartDrawer";
import FloatingCartWidget from "./FloatingCartWidget";
import FloatingContactWidget from "./FloatingContactWidget";
import ScrollToTopButton from "./ScrollToTopButton";

const StorefrontFloatingWidgets = () => {
  const location = useLocation();

  // Do not show floating customer storefront widgets in admin area or invoice print
  const isAdminRoute =
    location.pathname.startsWith("/admin") ||
    location.pathname === "/admin-login" ||
    location.pathname === "/admin/invoice-print";

  if (isAdminRoute) return null;

  return (
    <>
      {/* 1. Slide-over Shopping Cart Drawer (Image 2) */}
      <CartDrawer />

      {/* 2. Floating Cart Trigger on Right Edge (Image 3) */}
      <FloatingCartWidget />

      {/* 3. Bottom-Right Stack: Contact Widget + Scroll-To-Top (Image 4 & 5) */}
      <div className="fixed right-4 md:right-6 bottom-20 md:bottom-6 z-40 flex flex-col items-center gap-3">
        <FloatingContactWidget />
        <ScrollToTopButton />
      </div>
    </>
  );
};

export default StorefrontFloatingWidgets;
