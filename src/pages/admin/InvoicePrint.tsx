import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import InvoiceSlip from "@/components/InvoiceSlip";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const PER_PAGE = 20;

const InvoicePrint = () => {
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get("ids") || "";
  const ids = useMemo(() => idsParam.split(",").filter(Boolean), [idsParam]);

  const { data: settings } = useQuery({
    queryKey: ["invoice-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*");
      const map: Record<string, any> = {};
      data?.forEach((s: any) => {
        let val = s.value !== undefined ? s.value : s.setting_value;
        if (typeof val === "string") {
          try { val = JSON.parse(val); } catch (_) {}
        }
        map[s.key || s.setting_key] = val;
      });
      return map;
    },
  });

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ["invoice-orders", ids],
    queryFn: async () => {
      if (ids.length === 0) return [];
      // Verify admin session first
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        throw new Error("লগইন প্রয়োজন। দয়া করে এডমিন প্যানেলে লগইন করুন।");
      }
      const { data, error: qErr } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (qErr) {
        console.error("Invoice query error:", qErr);
        throw qErr;
      }
      return data || [];
    },
    enabled: ids.length > 0,
    retry: 1,
  });

  const logoUrl = settings?.site_logo?.url;
  const brandPhone = settings?.footer_content?.phone;

  // Auto-trigger print after render
  useEffect(() => {
    if (orders && orders.length > 0) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [orders]);

  // Split orders into pages of 20
  const pages = useMemo(() => {
    if (!orders) return [];
    const result: any[][] = [];
    for (let i = 0; i < orders.length; i += PER_PAGE) {
      result.push(orders.slice(i, i + PER_PAGE));
    }
    return result;
  }, [orders]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 text-center">
        <p className="text-destructive font-semibold">ইনভয়েস লোড করা যায়নি</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        <Button onClick={() => window.location.href = "/admin-login"} size="sm">
          এডমিন লগইন
        </Button>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 p-6 text-center">
        <p className="text-muted-foreground">কোনো অর্ডার পাওয়া যায়নি</p>
        <p className="text-xs text-muted-foreground">
          নিশ্চিত করুন আপনি এডমিন হিসাবে লগইন আছেন এবং সঠিক অর্ডার সিলেক্ট করেছেন।
        </p>
        <Button onClick={() => window.location.href = "/admin/orders"} size="sm" variant="outline">
          অর্ডার পেজে ফিরে যান
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        @media screen {
          .invoice-print-root {
            background: hsl(var(--muted));
            min-height: 100vh;
            padding: 24px 0;
          }
          .invoice-page {
            background: white;
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            padding: 8mm;
            box-sizing: border-box;
          }
          .no-print { display: flex; }
        }
        @media print {
          body { background: white !important; margin: 0 !important; }
          .invoice-print-root { background: white !important; padding: 0 !important; }
          .invoice-page {
            width: 100%;
            min-height: auto;
            margin: 0;
            padding: 0;
            box-shadow: none;
            page-break-after: always;
          }
          .invoice-page:last-child { page-break-after: auto; }
          .no-print { display: none !important; }
        }
        .invoice-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: repeat(5, 1fr);
          gap: 3mm;
          width: 100%;
          height: 100%;
        }
        .invoice-slip {
          border: 1px solid #1b5e1e;
          border-radius: 4px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          font-family: 'Hind Siliguri', sans-serif;
          font-size: 9px;
          background: white;
          color: #111;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .slip-header {
          background: linear-gradient(135deg, #1b5e1e 0%, #2e7d32 100%);
          color: white;
          padding: 4px 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4px;
        }
        .slip-logo {
          height: 18px;
          width: auto;
          max-width: 60px;
          object-fit: contain;
          background: white;
          border-radius: 2px;
          padding: 1px 3px;
        }
        .slip-brand {
          font-weight: 700;
          font-size: 10px;
          letter-spacing: 0.3px;
        }
        .slip-order-no {
          font-size: 8.5px;
          font-weight: 600;
          background: rgba(255,255,255,0.2);
          padding: 1px 5px;
          border-radius: 8px;
          white-space: nowrap;
        }
        .slip-body {
          padding: 5px 6px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .slip-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 4px;
          font-size: 9.5px;
        }
        .slip-row strong {
          color: #1b5e1e;
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }
        .slip-phone {
          font-weight: 600;
          color: #333;
          white-space: nowrap;
          font-size: 9px;
        }
        .slip-address {
          font-size: 8.5px;
          color: #555;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .slip-items {
          border-top: 1px dashed #ccc;
          border-bottom: 1px dashed #ccc;
          padding: 3px 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
          font-size: 8.5px;
        }
        .slip-item {
          display: flex;
          justify-content: space-between;
          gap: 6px;
        }
        .slip-item-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }
        .slip-item-qty {
          color: #1b5e1e;
          font-weight: 600;
        }
        .slip-more {
          color: #888;
          font-style: italic;
        }
        .slip-totals {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .slip-total-row {
          display: flex;
          justify-content: space-between;
          font-size: 9.5px;
        }
        .slip-total-row strong {
          color: #1b5e1e;
        }
        .slip-due strong {
          color: #d84315;
          background: #fff3e0;
          padding: 0 4px;
          border-radius: 3px;
        }
        .slip-footer {
          background: #f5f5f5;
          padding: 3px 6px;
          font-size: 8px;
          color: #666;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #e0e0e0;
        }
      `}</style>

      <div className="invoice-print-root">
        {/* Print toolbar - hidden in print */}
        <div className="no-print sticky top-0 z-10 bg-card border-b shadow-sm py-3 px-4 mb-4 flex items-center justify-center gap-3">
          <span className="text-sm text-muted-foreground">
            মোট {orders.length}টি ইনভয়েস ({pages.length}টি A4 পেজ)
          </span>
          <Button onClick={() => window.print()} size="sm">
            <Printer className="h-4 w-4 mr-1" /> প্রিন্ট করুন
          </Button>
        </div>

        {pages.map((pageOrders, pageIdx) => (
          <div key={pageIdx} className="invoice-page">
            <div className="invoice-grid">
              {pageOrders.map((order: any) => (
                <InvoiceSlip
                  key={order.id}
                  order={order}
                  logoUrl={logoUrl}
                  brandPhone={brandPhone}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default InvoicePrint;
