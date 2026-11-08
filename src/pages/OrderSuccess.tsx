import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, Package, Loader2 } from "lucide-react";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import InvoicePDF from "@/components/InvoicePDF";
import { useRef, useState } from "react";
import { toast } from "sonner";

const OrderSuccess = () => {
  const { orderId } = useParams();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: branding } = useQuery({
    queryKey: ["invoice-branding"],
    queryFn: async () => {
      const [logoRes, footerRes] = await Promise.all([
        supabase.rpc("get_public_setting", { _key: "site_logo" }),
        supabase.rpc("get_public_setting", { _key: "footer_content" }),
      ]);
      return {
        logoUrl: (logoRes.data as any)?.url || "",
        phone: (footerRes.data as any)?.phone || "",
        email: (footerRes.data as any)?.email || "",
        address: (footerRes.data as any)?.address || "",
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  const handleDownloadInvoice = async () => {
    if (!order || !invoiceRef.current) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Invoice-${order.order_number}.pdf`);
      toast.success("ইনভয়েস ডাউনলোড হয়েছে");
    } catch (e) {
      console.error(e);
      toast.error("ইনভয়েস ডাউনলোড ব্যর্থ হয়েছে");
    } finally {
      setDownloading(false);
    }
  };

  const paymentParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("payment") : null;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar /><Header />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">অর্ডার সফল হয়েছে!</h1>
          <p className="text-muted-foreground mb-4">আপনার অর্ডারটি সফলভাবে প্লেস হয়েছে।</p>

          {paymentParam === "success" && (
            <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl p-3.5 mb-4 text-green-800 dark:text-green-300 text-sm font-medium">
              ✓ আলহামদুলিল্লাহ! আপনার অনলাইন পেমেন্ট (EPS) সফলভাবে সম্পন্ন হয়েছে।
            </div>
          )}
          {paymentParam === "failed" && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 mb-4 text-amber-800 dark:text-amber-300 text-xs sm:text-sm text-left">
              অনলাইন পেমেন্ট সম্পন্ন হয়নি। {order?.payment_method === "cod" ? "আপনার অর্ডারটি ক্যাশ অন ডেলিভারি (পেন্ডিং) হিসেবে গ্রহণ করা হয়েছে। ডেলিভারির সময় মূল্য পরিশোধ করতে পারবেন।" : "অগ্রিম পেমেন্ট প্রক্রিয়া অসম্পূর্ণ রয়েছে।"}
            </div>
          )}
          {paymentParam === "cancelled" && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 mb-4 text-amber-800 dark:text-amber-300 text-xs sm:text-sm text-left">
              পেমেন্ট বাতিল করা হয়েছে। {order?.payment_method === "cod" ? "আপনার অর্ডারটি ক্যাশ অন ডেলিভারি হিসেবে সংরক্ষিত রয়েছে।" : "অগ্রিম পেমেন্ট ছাড়া অর্ডারটি প্রসেস করা হবে না।"}
            </div>
          )}

          {order && (
            <div className="bg-card border rounded-xl p-5 text-left mt-2 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">অর্ডার নম্বর</span>
                <span className="font-bold text-primary">{order.order_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">মোট</span>
                <span className="font-bold">৳{Number(order.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">পেমেন্ট মেথড</span>
                <span className="font-medium">
                  {order.payment_method === "cod" 
                    ? "ক্যাশ অন ডেলিভারি" 
                    : order.payment_method === "eps" 
                    ? "অনলাইন পেমেন্ট (EPS)" 
                    : order.payment_method === "delivery_advance"
                    ? "ডেলিভারি চার্জ অ্যাডভান্স"
                    : order.payment_method === "full_advance"
                    ? "সম্পূর্ণ টাকা অ্যাডভান্স"
                    : "অনলাইন পেমেন্ট"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">পেমেন্ট স্ট্যাটাস</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  order.payment_status === "paid"
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-warning/10 text-warning"
                }`}>
                  {order.payment_status === "paid" ? "পরিশোধিত (Paid)" : "বকেয়া (Pending)"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">অর্ডার স্ট্যাটাস</span>
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-medium">
                  {order.order_status === "confirmed" ? "কনফার্মড" : "পেন্ডিং"}
                </span>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2 mt-6">
            <Button variant="outline" className="gap-2" onClick={handleDownloadInvoice} disabled={!order || downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? "তৈরি হচ্ছে..." : "ইনভয়েস PDF ডাউনলোড"}
            </Button>
            <Link to="/shefa-tube">
              <Button variant="outline" className="gap-2 w-full">
                <Package className="h-4 w-4" /> শেফা টিউব দেখুন
              </Button>
            </Link>
            <Link to="/"><Button className="w-full">হোমপেজে ফিরে যান</Button></Link>
          </div>
        </div>
      </main>
      <Footer />

      {/* Off-screen invoice for PDF rendering */}
      {order && (
        <div style={{ position: "fixed", left: "-99999px", top: 0, pointerEvents: "none" }} aria-hidden>
          <div ref={invoiceRef}>
            <InvoicePDF
              order={order}
              logoUrl={branding?.logoUrl}
              brandPhone={branding?.phone}
              brandEmail={branding?.email}
              brandAddress={branding?.address}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderSuccess;
