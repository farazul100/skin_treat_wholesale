import { format } from "date-fns";

interface InvoicePDFProps {
  order: any;
  logoUrl?: string;
  brandName?: string;
  brandPhone?: string;
  brandAddress?: string;
  brandEmail?: string;
}

/**
 * Printable invoice card. Render off-screen and convert to PDF via html2canvas + jsPDF.
 * Uses inline styles so html2canvas captures it identically regardless of app theme.
 */
const InvoicePDF = ({
  order,
  logoUrl,
  brandName = "Sunnahly",
  brandPhone,
  brandAddress,
  brandEmail,
}: InvoicePDFProps) => {
  const cleanBrandName = brandName === "Natural Shefa" ? "Sunnahly" : (brandName || "Sunnahly");
  const items = order.order_items || [];
  const subtotal = Number(order.subtotal || 0);
  const delivery = Number(order.delivery_charge || 0);
  const discount = Number(order.discount || 0);
  const total = Number(order.total || 0);
  const partial = Number(order.partial_payment || 0);
  const due = Number(order.due_amount || 0);

  const PRIMARY = "#1b5e1e";
  const PRIMARY_LIGHT = "#e8f5e9";
  const BORDER = "#e5e7eb";
  const MUTED = "#6b7280";
  const TEXT = "#111827";

  return (
    <div
      style={{
        width: "794px", // A4 width @ 96 DPI
        minHeight: "1123px",
        background: "#fff",
        color: TEXT,
        fontFamily: "'Hind Siliguri', system-ui, sans-serif",
        padding: "40px",
        boxSizing: "border-box",
        fontSize: "13px",
        lineHeight: 1.5,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingBottom: "20px",
          borderBottom: `3px solid ${PRIMARY}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={cleanBrandName}
              crossOrigin="anonymous"
              style={{ height: "60px", width: "auto", objectFit: "contain" }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  background: PRIMARY,
                  color: "#fff",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  fontWeight: 700,
                }}
              >
                {(cleanBrandName || "S").charAt(0).toUpperCase()}
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: PRIMARY }}>
                {cleanBrandName}
              </div>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "26px",
              fontWeight: 700,
              color: PRIMARY,
              letterSpacing: "1px",
            }}
          >
            INVOICE
          </div>
          <div style={{ fontSize: "12px", color: MUTED, marginTop: "4px" }}>
            ইনভয়েস
          </div>
        </div>
      </div>

      {/* Meta */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "20px",
          marginTop: "24px",
        }}
      >
        <div
          style={{
            flex: 1,
            background: PRIMARY_LIGHT,
            padding: "14px 16px",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "4px",
            }}
          >
            অর্ডার নম্বর
          </div>
          <div style={{ fontWeight: 700, fontSize: "15px", color: PRIMARY }}>
            {order.order_number}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: PRIMARY_LIGHT,
            padding: "14px 16px",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "4px",
            }}
          >
            অর্ডারের তারিখ
          </div>
          <div style={{ fontWeight: 700, fontSize: "15px" }}>
            {format(new Date(order.created_at), "dd MMM, yyyy")}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            background: PRIMARY_LIGHT,
            padding: "14px 16px",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: MUTED,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: "4px",
            }}
          >
            পেমেন্ট মেথড
          </div>
          <div style={{ fontWeight: 700, fontSize: "15px" }}>
            {order.payment_method === "cod"
              ? "ক্যাশ অন ডেলিভারি"
              : "আংশিক অনলাইন"}
          </div>
        </div>
      </div>

      {/* Bill To */}
      <div style={{ marginTop: "26px" }}>
        <div
          style={{
            fontSize: "12px",
            color: MUTED,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "8px",
            fontWeight: 600,
          }}
        >
          বিল প্রাপক
        </div>
        <div
          style={{
            border: `1px solid ${BORDER}`,
            borderRadius: "8px",
            padding: "14px 16px",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>
            {order.customer_name}
          </div>
          <div style={{ color: MUTED, fontSize: "13px" }}>
            📞 {order.customer_phone}
            {order.customer_email ? ` · ✉️ ${order.customer_email}` : ""}
          </div>
          <div style={{ color: MUTED, fontSize: "13px", marginTop: "4px" }}>
            📍 {order.shipping_address}
            {order.area ? `, ${order.area}` : ""}, {order.city}
          </div>
        </div>
      </div>

      {/* Items table */}
      <div style={{ marginTop: "26px" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "13px",
          }}
        >
          <thead>
            <tr style={{ background: PRIMARY, color: "#fff" }}>
              <th
                style={{
                  padding: "12px 14px",
                  textAlign: "left",
                  fontWeight: 600,
                  borderTopLeftRadius: "8px",
                }}
              >
                পণ্য
              </th>
              <th
                style={{
                  padding: "12px 14px",
                  textAlign: "center",
                  fontWeight: 600,
                  width: "80px",
                }}
              >
                পরিমাণ
              </th>
              <th
                style={{
                  padding: "12px 14px",
                  textAlign: "right",
                  fontWeight: 600,
                  width: "110px",
                }}
              >
                দাম
              </th>
              <th
                style={{
                  padding: "12px 14px",
                  textAlign: "right",
                  fontWeight: 600,
                  width: "110px",
                  borderTopRightRadius: "8px",
                }}
              >
                মোট
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i: number) => (
              <tr
                key={i}
                style={{
                  borderBottom: `1px solid ${BORDER}`,
                  background: i % 2 === 0 ? "#fff" : "#fafafa",
                }}
              >
                <td style={{ padding: "12px 14px" }}>{it.product_name}</td>
                <td style={{ padding: "12px 14px", textAlign: "center" }}>
                  {it.quantity}
                </td>
                <td style={{ padding: "12px 14px", textAlign: "right" }}>
                  ৳{Number(it.price).toFixed(0)}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                >
                  ৳{Number(it.total).toFixed(0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
        <div style={{ width: "320px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              fontSize: "13px",
            }}
          >
            <span style={{ color: MUTED }}>সাবটোটাল</span>
            <span style={{ fontWeight: 600 }}>৳{subtotal.toFixed(0)}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 0",
              fontSize: "13px",
            }}
          >
            <span style={{ color: MUTED }}>ডেলিভারি চার্জ</span>
            <span style={{ fontWeight: 600 }}>৳{delivery.toFixed(0)}</span>
          </div>
          {discount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: MUTED }}>ডিসকাউন্ট</span>
              <span style={{ fontWeight: 600, color: "#dc2626" }}>
                -৳{discount.toFixed(0)}
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 14px",
              fontSize: "16px",
              fontWeight: 700,
              background: PRIMARY,
              color: "#fff",
              borderRadius: "8px",
              marginTop: "8px",
            }}
          >
            <span>সর্বমোট</span>
            <span>৳{total.toFixed(0)}</span>
          </div>
          {partial > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  fontSize: "13px",
                  marginTop: "4px",
                }}
              >
                <span style={{ color: MUTED }}>অগ্রিম পরিশোধিত</span>
                <span style={{ fontWeight: 600, color: PRIMARY }}>
                  ৳{partial.toFixed(0)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  fontSize: "14px",
                  fontWeight: 700,
                  background: "#fef3c7",
                  color: "#92400e",
                  borderRadius: "8px",
                  marginTop: "4px",
                }}
              >
                <span>ডেলিভারিতে দেয়</span>
                <span>৳{due.toFixed(0)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Thank you note */}
      <div
        style={{
          marginTop: "40px",
          padding: "20px",
          background: PRIMARY_LIGHT,
          borderRadius: "8px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "16px", fontWeight: 700, color: PRIMARY }}>
          ধন্যবাদ আপনার অর্ডারের জন্য! 🌿
        </div>
        <div style={{ fontSize: "12px", color: MUTED, marginTop: "6px" }}>
          আমাদের সাথে কেনাকাটা করার জন্য আন্তরিক ধন্যবাদ। যেকোনো প্রয়োজনে যোগাযোগ করুন।
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          bottom: "30px",
          left: "40px",
          right: "40px",
          paddingTop: "16px",
          borderTop: `1px solid ${BORDER}`,
          display: "flex",
          justifyContent: "space-between",
          fontSize: "11px",
          color: MUTED,
        }}
      >
        <div>
          {brandPhone && <div>📞 {brandPhone}</div>}
          {brandEmail && <div>✉️ {brandEmail}</div>}
          {brandAddress && <div>📍 {brandAddress}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600 }}>{cleanBrandName}</div>
          <div>{typeof window !== "undefined" ? window.location.host : "sunnahly.com"}</div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePDF;
