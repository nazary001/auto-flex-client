import Link from "next/link";
import { Check, ChevronDown, CreditCard, ExternalLink, PackageSearch, Truck } from "lucide-react";
import { TrackingNumber } from "@/components/account/TrackingNumber";
import { deliveryLabels, paymentLabels } from "@/components/checkout/options";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { orderStatusMeta, paymentStatusMeta, type BadgeTone } from "@/lib/admin/labels";
import type { Order } from "@/lib/admin/types";
import { countUk, formatDate, formatPrice } from "@/lib/format";
import { carrierTrackingUrl, formatNpDate, trackingStage } from "@/lib/server/nova-poshta";

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

        <ShipmentPanel order={order} />

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

// ── parcel panel ────────────────────────────────────────────

type ShipmentStage = "ordered" | "label" | "shipped" | "awaiting_pickup" | "delivered" | "returning";

/** What the buyer should see: the carrier's word first, the order status as the fallback */
function shipmentStage(order: Order): ShipmentStage {
  if (order.status === "delivered" || order.status === "completed") return "delivered";
  if (order.status === "returned") return "returning";
  const stage = trackingStage(order.delivery.tracking?.statusCode);
  if (stage === "delivered" || stage === "awaiting_pickup" || stage === "returning" || stage === "label") return stage;
  if (stage === "in_transit" || order.status === "in_transit") return "shipped";
  return "ordered";
}

const stageMeta: Record<ShipmentStage, { tone: string; title: string; step: number }> = {
  ordered: { tone: "bg-mist text-ink-2", title: "Номер відправлення отримано", step: 0 },
  label: { tone: "bg-mist text-ink-2", title: "Накладну створено, посилка ще не передана перевізнику", step: 0 },
  shipped: { tone: "bg-brand-50 text-brand-700", title: "Посилка в дорозі", step: 1 },
  awaiting_pickup: { tone: "bg-warn-soft text-warn", title: "Посилка чекає на вас у відділенні", step: 2 },
  delivered: { tone: "bg-ok-soft text-ok", title: "Посилку отримано", step: 3 },
  returning: { tone: "bg-danger-soft text-danger", title: "Посилка повертається відправнику", step: 1 },
};

function relativeUk(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "щойно";
  if (minutes < 60) return `${minutes} хв тому`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} год тому`;
  return formatDate(iso);
}

/** Carrier, parcel number, live status and a four-step progress line — only once a tracking number exists */
function ShipmentPanel({ order }: { order: Order }) {
  const ttn = order.delivery.trackingNumber;
  if (!ttn) return null;

  const carrier = order.delivery.carrier ?? (order.delivery.method === "ukrposhta" ? "ukrposhta" : "nova_poshta");
  const carrierName = carrier === "nova_poshta" ? "Нова Пошта" : carrier === "ukrposhta" ? "Укрпошта" : "Перевізник";
  const tracking = order.delivery.tracking;
  const stage = shipmentStage(order);
  const meta = stageMeta[stage];
  const shippedAt = order.shippedAt ?? order.delivery.shippedAt;
  const receivedText = order.delivery.deliveredAt ? formatDate(order.delivery.deliveredAt) : formatNpDate(tracking?.receivedAt);
  const scheduled = formatNpDate(tracking?.scheduledDeliveryDate);

  let detail: string | undefined;
  if (stage === "awaiting_pickup") detail = tracking?.warehouse ?? `${order.delivery.city}, ${order.delivery.address}`;
  else if (stage === "delivered") detail = receivedText ? `Отримано ${receivedText}` : tracking?.status;
  else if (stage === "shipped") {
    detail =
      [tracking?.status, scheduled ? `Орієнтовна дата доставки: ${scheduled}` : undefined].filter(Boolean).join(" · ") || undefined;
  } else if (stage === "returning") detail = tracking?.status;
  else if (stage === "ordered") {
    detail = carrier === "nova_poshta" ? "Статус з'явиться, щойно перевізник прийме посилку" : "Статус посилки дивіться на сайті перевізника";
  }

  const steps = [
    { label: "Оформлено", note: formatDate(order.createdAt) },
    { label: "Відправлено", note: shippedAt ? formatDate(shippedAt) : undefined },
    { label: "У відділенні", note: stage === "awaiting_pickup" ? tracking?.warehouse : undefined },
    { label: "Отримано", note: stage === "delivered" ? receivedText : undefined },
  ];

  return (
    <section aria-label="Відправлення" className="rounded-btn border border-line-soft p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
          <Truck aria-hidden className="size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
          <span className="font-medium">{carrierName}</span>
          <span className="text-ink-3">· ТТН</span>
          <TrackingNumber value={ttn} />
        </p>
        <a
          href={carrierTrackingUrl(carrier, ttn)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          Відстежити
          <ExternalLink aria-hidden className="size-3.5" strokeWidth={2} />
        </a>
      </div>

      <div className={`mt-3 rounded-btn px-3 py-2 ${meta.tone}`}>
        <p className="text-sm font-semibold">{meta.title}</p>
        {detail && <p className="mt-0.5 text-[13px] opacity-90">{detail}</p>}
      </div>

      <ol className="mt-4 grid grid-cols-4">
        {steps.map((step, index) => {
          const done = index < meta.step;
          const current = index === meta.step;
          const reached = done || current;
          return (
            <li key={step.label} className="relative text-center">
              {index > 0 && (
                <span
                  aria-hidden
                  className={`absolute top-3 right-1/2 left-[-50%] h-0.5 ${reached ? "bg-brand-700" : "bg-line-soft"}`}
                />
              )}
              <span
                className={`relative z-10 mx-auto grid size-6 place-content-center rounded-full border-2 text-[11px] font-bold ${
                  reached ? "border-brand-700 bg-brand-700 text-white" : "border-line-soft bg-white text-ink-3"
                }`}
              >
                {done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span className={`mt-1.5 block text-[12px] leading-tight font-semibold ${current ? "text-ink" : reached ? "text-ink-2" : "text-ink-3"}`}>
                {step.label}
              </span>
              {step.note && <span className="mt-0.5 block text-[11px] leading-tight text-ink-3">{step.note}</span>}
            </li>
          );
        })}
      </ol>

      {tracking?.checkedAt && (
        <p className="mt-3 text-[12px] text-ink-3">Статус перевізника оновлено {relativeUk(tracking.checkedAt)}</p>
      )}
    </section>
  );
}
