import { format } from "date-fns";

interface InvoiceSlipProps {
  order: any;
  logoUrl?: string;
  brandName?: string;
  brandPhone?: string;
}

const InvoiceSlip = ({ order, logoUrl, brandName = "Natural Shefa", brandPhone }: InvoiceSlipProps) => {
  const items = order.order_items || [];
  const itemCount = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);

  return (
    <div className="invoice-slip">
      {/* Header bar with brand color */}
      <div className="slip-header">
        {logoUrl ? (
          <img src={logoUrl} alt={brandName} className="slip-logo" crossOrigin="anonymous" />
        ) : (
          <span className="slip-brand">{brandName}</span>
        )}
        <span className="slip-order-no">#{order.order_number}</span>
      </div>

      {/* Customer */}
      <div className="slip-body">
        <div className="slip-row">
          <strong>{order.customer_name}</strong>
          <span className="slip-phone">{order.customer_phone}</span>
        </div>
        <div className="slip-address">
          {order.shipping_address}
          {order.area ? `, ${order.area}` : ""}, {order.city}
        </div>

        {/* Items condensed */}
        <div className="slip-items">
          {items.slice(0, 3).map((it: any, i: number) => (
            <div key={i} className="slip-item">
              <span className="slip-item-name">
                {it.product_name}
                {Boolean((it.has_gift === 1 || it.has_gift === true) && it.gift_title) && (
                  <span style={{ color: "#1b5e1e", fontWeight: "bold" }}>
                    {" "}(🎁 {it.gift_title})
                  </span>
                )}
              </span>
              <span className="slip-item-qty">×{it.quantity}</span>
            </div>
          ))}
          {items.length > 3 && (
            <div className="slip-item slip-more">+ আরও {items.length - 3}টি</div>
          )}
        </div>

        {/* Totals */}
        <div className="slip-totals">
          <div className="slip-total-row">
            <span>মোট ({itemCount}টি)</span>
            <strong>৳{Number(order.total).toFixed(0)}</strong>
          </div>
          {order.partial_payment > 0 && (
            <div className="slip-total-row slip-due">
              <span>COD বাকি</span>
              <strong>৳{Number(order.due_amount).toFixed(0)}</strong>
            </div>
          )}
          {order.payment_method === "cod" && (!order.partial_payment || order.partial_payment === 0) && (
            <div className="slip-total-row slip-due">
              <span>COD</span>
              <strong>৳{Number(order.total).toFixed(0)}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="slip-footer">
        <span>{format(new Date(order.created_at), "dd/MM/yy")}</span>
        {brandPhone && <span>{brandPhone}</span>}
      </div>
    </div>
  );
};

export default InvoiceSlip;
