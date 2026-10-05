import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  Card,
  CopyText,
  DateTime,
  DescriptionList,
  Money,
  PageHeader,
  StatusBadge,
} from "@/components/admin/ui";
import { can } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { PO_TRANSITIONS, getPurchaseOrder } from "@/lib/server/db/repos/purchase-orders";
import { getSupplier } from "@/lib/server/db/repos/suppliers";
import { listOrdersForPurchaseOrder } from "@/lib/server/db/repos/orders";
import { formatPhone } from "@/lib/format";
import { PurchaseDetailsForm } from "@/components/admin/purchasing/PurchaseDetailsForm";
import { PurchaseStatusActions } from "@/components/admin/purchasing/PurchaseStatusActions";

export const metadata: Metadata = { title: "Закупівля" };

function supplierText(
  number: string,
  lines: { sku: string; name: string; qty: number }[],
  shipDirect: boolean,
  orders: Awaited<ReturnType<typeof listOrdersForPurchaseOrder>>,
): string {
  const body = lines.map((l) => `${l.sku} — ${l.name} × ${l.qty}`).join("\n");
  let text = `Закупівля ${number}\n\n${body}`;
  if (shipDirect && orders.length > 0) {
    text += "\n\nВідправка напряму покупцю:";
    for (const order of orders) {
      const name = `${order.customer.firstName} ${order.customer.lastName}`.trim();
      text += `\n\n${order.number}: ${name}, ${formatPhone(order.customer.phone)}\n${order.delivery.city}, ${order.delivery.address}`;
    }
  }
  return text;
}

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("purchases:read");
  const db = await getDb();
  const { id } = await params;

  const po = await getPurchaseOrder(db, id);
  if (!po) notFound();

  const [supplier, orders] = await Promise.all([getSupplier(db, po.supplierId), listOrdersForPurchaseOrder(db, po.id)]);
  const canWrite = can(user, "purchases:write");
  const transitions = PO_TRANSITIONS[po.status];
  const text = supplierText(po.number, po.lines, po.shipDirect, orders);

  return (
    <div>
      <PageHeader
        title={po.number}
        meta={<StatusBadge kind="po" value={po.status} />}
        back={{ href: "/admin/purchases", label: "До закупівель" }}
        description={
          <span>
            {supplier ? (
              <Link href={`/admin/suppliers/${supplier.id}`} className="link font-medium">
                {supplier.name}
              </Link>
            ) : (
              "Постачальник невідомий"
            )}
            {" · "}
            Створив {po.createdBy}, <DateTime iso={po.createdAt} mode="datetime" />
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="grid gap-4">
          <Card title="Позиції" padded={false}>
            <div className="adm-scroll-x">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col">Замовлення</th>
                    <th scope="col">Артикул</th>
                    <th scope="col">Назва</th>
                    <th scope="col" className="text-right">
                      К-сть
                    </th>
                    <th scope="col" className="text-right">
                      Ціна
                    </th>
                    <th scope="col" className="text-right">
                      Сума
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        <Link href={`/admin/orders/${line.orderId}`} className="link tabular text-[13px]">
                          {line.orderNumber}
                        </Link>
                      </td>
                      <td className="tabular text-ink-2">{line.sku}</td>
                      <td className="text-ink">{line.name}</td>
                      <td className="text-right tabular text-ink-2">{line.qty}</td>
                      <td className="text-right">
                        <Money value={line.cost} muted />
                      </td>
                      <td className="text-right">
                        <Money value={line.cost * line.qty} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="text-right font-medium text-ink-2">
                      Разом
                    </td>
                    <td className="text-right">
                      <Money value={po.totalCost} className="font-semibold" />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card title="Текст для постачальника" actions={<CopyText text={text} label="Скопіювати" />}>
            <pre className="tabular whitespace-pre-wrap rounded-card bg-mist-soft p-3 text-[13px] leading-5 text-ink-2">{text}</pre>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card title="Статус">
            {canWrite ? (
              <PurchaseStatusActions id={po.id} transitions={transitions} trackingNumber={po.trackingNumber} />
            ) : (
              <StatusBadge kind="po" value={po.status} />
            )}
          </Card>

          <Card title="Деталі">
            {canWrite ? (
              <PurchaseDetailsForm po={po} />
            ) : (
              <DescriptionList
                items={[
                  { label: "Номер постачальника", value: po.supplierRef ?? "—" },
                  {
                    label: "ТТН",
                    value: po.trackingNumber ? (
                      <a
                        href={`https://tracking.novaposhta.ua/#/uk/tracking?number=${encodeURIComponent(po.trackingNumber)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link inline-flex items-center gap-1 tabular"
                      >
                        {po.trackingNumber}
                        <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
                      </a>
                    ) : (
                      "—"
                    ),
                  },
                  { label: "Очікується", value: po.expectedAt ? <DateTime iso={po.expectedAt} /> : "—" },
                  { label: "Напряму покупцю", value: po.shipDirect ? "Так" : "Ні" },
                  { label: "Нотатки", value: po.notes ?? "—" },
                ]}
              />
            )}
          </Card>

          <Card title="Замовлення" padded={false}>
            <ul className="divide-y divide-line-soft">
              {orders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <div className="min-w-0">
                    <Link href={`/admin/orders/${order.id}`} className="link tabular text-sm font-medium">
                      {order.number}
                    </Link>
                    <p className="truncate text-[12.5px] text-ink-3">
                      {`${order.customer.firstName} ${order.customer.lastName}`.trim() || "—"}
                    </p>
                  </div>
                  <StatusBadge kind="order" value={order.status} size="sm" />
                </li>
              ))}
              {orders.length === 0 && <li className="px-4 py-3 text-[13px] text-ink-3 sm:px-5">Немає повʼязаних замовлень.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
