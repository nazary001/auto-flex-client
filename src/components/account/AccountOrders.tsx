import Link from "next/link";
import { ChevronDown, CreditCard, PackageSearch, Truck } from "lucide-react";
import { deliveryLabels, paymentLabels } from "@/components/checkout/options";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { orderStatusMeta, paymentStatusMeta, type BadgeTone } from "@/lib/admin/labels";
import type { Order } from "@/lib/admin/types";
import { countUk, formatDate, formatPrice } from "@/lib/format";

/** Storefront colours for the back-office status tones */
const toneClass: Record<BadgeTone, string> = {
  blue: "bg-brand-50 text-brand-700",
  teal: "bg-teal-soft text-teal",
  violet: "bg-violet-soft text-violet",
  amber: "bg-warn-soft text-warn",
  green: "bg-ok-soft text-ok",
  slate: "bg-mist text-ink-2",
  red: "bg-danger-soft text-danger",
  rose: "bg-rose-soft text-rose",
};

/** Orders of the signed-in customer, newest first */
export function AccountOrders({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<PackageSearch aria-hidden strokeWidth={1.75} />}
        title="Замовлень поки немає"
        text="Тут з'являться замовлення, оформлені з вашим номером телефону — зі статусами та номерами відправлень."
        action={
          <Link href="/catalog" className={buttonClass()}>
            Перейти до каталогу
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid gap-4">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const status = orderStatusMeta[order.status];
  const payment = paymentStatusMeta[order.payment.status];
  const activeLines = order.lines.filter((line) => line.fulfillment !== "cancelled");
  const itemCount = activeLines.reduce((sum, line) => sum + line.qty, 0);
  const deliveryLabel = deliveryLabels[order.delivery.method as keyof typeof deliveryLabels] ?? order.delivery.method;
  const paymentLabel = paymentLabels[order.payment.method as keyof typeof paymentLabels] ?? order.payment.method;

  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line-soft p-4 sm:p-5">
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="tabular text-[15px] font-bold text-ink">{order.number}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass[status.tone]}`} title={status.hint}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-[13px] text-ink-3">
            від {formatDate(order.createdAt)} · {countUk(itemCount, ["товар", "товари", "товарів"])}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[13px] text-ink-3">Сума</p>
          <p className="tabular text-lg font-bold text-ink">{formatPrice(order.total)}</p>
        </div>
      </header>

      <div className="grid gap-3 p-4 sm:p-5">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="flex items-start gap-2 text-ink-2">
            <Truck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
            <span>
              {deliveryLabel}
              <span className="block text-ink-3">
                {order.delivery.city}, {order.delivery.address}
              </span>
              {order.delivery.trackingNumber && (
                <span className="tabular block text-ink-3">ТТН {order.delivery.trackingNumber}</span>
              )}
            </span>
          </p>
          <p className="flex items-start gap-2 text-ink-2">
            <CreditCard aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
            <span>
              {paymentLabel}
              <span className="block text-ink-3">{payment.label}</span>
            </span>
          </p>
        </div>

        <details className="group rounded-btn border border-line-soft">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-semibold text-ink">
            Склад замовлення
            <ChevronDown aria-hidden className="size-4 text-ink-3 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <ul className="divide-y divide-line-soft border-t border-line-soft">
            {order.lines.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className={line.fulfillment === "cancelled" ? "text-ink-3 line-through" : "font-medium text-ink"}>
                    {line.productId ? (
                      <Link href={`/product/${line.productId}`} className="hover:text-brand-700 hover:underline">
                        {line.name}
                      </Link>
                    ) : (
                      line.name
                    )}
                  </p>
                  {line.optionLabel && <p className="text-[13px] text-ink-3">{line.optionLabel}</p>}
                  <p className="tabular text-[13px] text-ink-3">
                    арт. {line.sku} · {line.qty} × {formatPrice(line.price)}
                  </p>
                </div>
                <span className="tabular shrink-0 font-semibold text-ink">{formatPrice(line.price * line.qty - line.discount)}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </article>
  );
}
