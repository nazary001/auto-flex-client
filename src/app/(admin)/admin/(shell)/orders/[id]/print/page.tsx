import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/orders/PrintButton";
import { carrierLabel, deliveryMethodLabel, paymentMethodLabel, paymentStatusMeta } from "@/lib/admin/labels";
import { lineTotal } from "@/lib/admin/domain/money";
import { formatDate, formatPhone, formatPrice } from "@/lib/format";
import { site } from "@/lib/site";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { getOrder } from "@/lib/server/db/repos/orders";

export const metadata: Metadata = { title: "Друк замовлення" };

export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("orders:read");
  const db = await getDb();
  const { id } = await params;
  const order = await getOrder(db, id);
  if (!order) notFound();

  const lines = order.lines.filter((line) => line.fulfillment !== "cancelled");
  const fullName = `${order.customer.lastName} ${order.customer.firstName}`.trim();

  return (
    <div className="mx-auto max-w-3xl bg-white text-ink">
      <div className="mb-4 flex justify-end">
        <PrintButton />
      </div>

      <div className="rounded-card border border-line-soft p-6 sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line-soft pb-4">
          <div>
            <p className="text-xl font-bold">{site.name}</p>
            <p className="text-[13px] text-ink-3">{site.tagline}</p>
            <p className="mt-1 text-[12px] text-ink-3">
              {site.legal.entity} · ІПН {site.legal.taxId}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">Замовлення {order.number}</p>
            <p className="text-[13px] text-ink-3">{formatDate(order.createdAt)}</p>
          </div>
        </header>

        <section className="grid gap-6 py-4 sm:grid-cols-2">
          <div>
            <h2 className="text-[13px] font-semibold text-ink-3 uppercase">Отримувач</h2>
            <p className="mt-1 font-medium">{fullName || "—"}</p>
            <p className="tabular text-sm">{formatPhone(order.customer.phone)}</p>
            {order.customer.email && <p className="text-sm">{order.customer.email}</p>}
          </div>
          <div>
            <h2 className="text-[13px] font-semibold text-ink-3 uppercase">Доставка</h2>
            <p className="mt-1 text-sm">{deliveryMethodLabel[order.delivery.method]}</p>
            <p className="text-sm">
              {order.delivery.city}
              {order.delivery.address ? `, ${order.delivery.address}` : ""}
            </p>
            {order.delivery.carrier && <p className="text-[13px] text-ink-3">{carrierLabel[order.delivery.carrier]}</p>}
            {order.delivery.trackingNumber && <p className="tabular text-[13px]">ТТН: {order.delivery.trackingNumber}</p>}
          </div>
        </section>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-line-soft text-left text-[12px] text-ink-3 uppercase">
              <th className="py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-2 font-semibold">Артикул</th>
              <th className="py-2 pr-2 font-semibold">Назва</th>
              <th className="py-2 pr-2 text-right font-semibold">К-ть</th>
              <th className="py-2 pr-2 text-right font-semibold">Ціна</th>
              <th className="py-2 text-right font-semibold">Сума</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id} className="border-b border-line-soft align-top">
                <td className="py-2 pr-2 tabular">{index + 1}</td>
                <td className="py-2 pr-2 tabular">{line.sku}</td>
                <td className="py-2 pr-2">
                  {line.name}
                  {line.optionLabel && <span className="block text-[12px] text-ink-3">{line.optionLabel}</span>}
                </td>
                <td className="py-2 pr-2 text-right tabular">{line.qty}</td>
                <td className="py-2 pr-2 text-right tabular">{formatPrice(line.price)}</td>
                <td className="py-2 text-right tabular">{formatPrice(lineTotal(line))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-56 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-3">Сума позицій</dt>
              <dd className="tabular">{formatPrice(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-3">Знижка</dt>
                <dd className="tabular">−{formatPrice(order.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line-soft pt-1 text-base font-bold">
              <dt>Разом</dt>
              <dd className="tabular">{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-4 text-sm">
          Оплата: {paymentMethodLabel[order.payment.method]} · {paymentStatusMeta[order.payment.status].label}
        </p>

        <div className="mt-10 grid grid-cols-2 gap-10 text-sm">
          <div>
            <div className="border-b border-ink-2" />
            <p className="mt-1 text-[12px] text-ink-3">Менеджер (підпис)</p>
          </div>
          <div>
            <div className="border-b border-ink-2" />
            <p className="mt-1 text-[12px] text-ink-3">Отримувач (підпис)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
