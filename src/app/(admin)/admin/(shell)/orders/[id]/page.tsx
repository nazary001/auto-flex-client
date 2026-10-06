import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Copy, FileText, Pencil, ShoppingCart } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { Card, DateTime, DescriptionList, PageHeader, PhoneLink, Pill, StatusBadge, Timeline, type TimelineItem } from "@/components/admin/ui";
import { OrderAssignee } from "@/components/admin/orders/OrderAssignee";
import { OrderDeleteButton } from "@/components/admin/orders/OrderDeleteButton";
import { OrderStatusCard } from "@/components/admin/orders/OrderStatusCard";
import { OrderPaymentCard } from "@/components/admin/orders/OrderPaymentCard";
import { OrderDeliveryCard } from "@/components/admin/orders/OrderDeliveryCard";
import { OrderMessages } from "@/components/admin/orders/OrderMessages";
import { OrderTagsEditor } from "@/components/admin/orders/OrderTagsEditor";
import { OrderNoteComposer } from "@/components/admin/orders/OrderNoteComposer";
import { lineTotal, marginPercent } from "@/lib/admin/domain/money";
import { linesAwaitingPurchase } from "@/lib/admin/domain/order-status";
import { can } from "@/lib/admin/permissions";
import { orderEventLabel, orderSourceLabel, type BadgeTone } from "@/lib/admin/labels";
import type { OrderEvent } from "@/lib/admin/types";
import { formatPrice } from "@/lib/format";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { getOrder, listOrderEvents } from "@/lib/server/db/repos/orders";
import { refreshStaleTracking } from "@/lib/server/orders/tracking";
import { getCustomer, getCustomerByPhone } from "@/lib/server/db/repos/customers";
import { getSuppliersMap } from "@/lib/server/db/repos/suppliers";
import { listPurchaseOrdersForOrder } from "@/lib/server/db/repos/purchase-orders";
import { listUsers } from "@/lib/server/db/repos/users";
import { getSettings } from "@/lib/server/db/repos/settings";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;
    const order = await getOrder(await getDb(), id);
    return { title: order ? `Замовлення ${order.number}` : "Замовлення" };
  } catch {
    return { title: "Замовлення" };
  }
}

const eventTone: Partial<Record<OrderEvent["type"], BadgeTone>> = {
  created: "blue",
  status_changed: "violet",
  payment_changed: "green",
  delivery_changed: "amber",
  po_created: "violet",
  po_updated: "amber",
  tracking_checked: "teal",
  call: "teal",
  notify_failed: "red",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("orders:read");
  const db = await getDb();
  const { id } = await params;
  const stored = await getOrder(db, id);
  if (!stored) notFound();
  // A parcel on its way: ask the carrier again when the last check is older than 15 minutes
  const order = (await refreshStaleTracking(db, [stored], { limit: 1, timeoutMs: 5000 }))[0] ?? stored;

  const canWrite = can(user, "orders:write");
  const [events, customer, suppliers, users, settings, pos] = await Promise.all([
    listOrderEvents(db, id),
    order.customer.customerId ? getCustomer(db, order.customer.customerId) : getCustomerByPhone(db, order.customer.phone),
    getSuppliersMap(db),
    listUsers(db),
    getSettings(db),
    listPurchaseOrdersForOrder(db, id),
  ]);

  const poById = new Map(pos.map((po) => [po.id, po]));
  const awaiting = linesAwaitingPurchase(order.lines).length;
  const pct = marginPercent(order);
  const fullName = `${order.customer.lastName} ${order.customer.firstName}`.trim() || "Без імені";

  const timelineItems: TimelineItem[] = events.map((event) => ({
    id: event.id,
    at: event.at,
    title: orderEventLabel[event.type],
    text: event.text,
    actor: event.actorName,
    tone: eventTone[event.type] ?? "neutral",
  }));

  return (
    <div>
      <PageHeader
        back={{ href: "/admin/orders", label: "До замовлень" }}
        title={order.number}
        meta={
          <>
            <StatusBadge kind="order" value={order.status} />
            <Pill tone="neutral">{orderSourceLabel[order.source]}</Pill>
            <span className="text-[13px] text-ink-3">
              <DateTime iso={order.createdAt} mode="datetime" />
            </span>
          </>
        }
        actions={
          <>
            <OrderAssignee
              id={order.id}
              assigneeId={order.assigneeId}
              users={users.map((u) => ({ id: u.id, name: u.name }))}
              canWrite={canWrite}
            />
            {canWrite && (
              <Link href={`/admin/orders/${order.id}/edit`} className={buttonClass({ variant: "secondary", size: "sm" })}>
                <Pencil aria-hidden className="size-4" strokeWidth={1.75} />
                Редагувати
              </Link>
            )}
            <Link href={`/admin/orders/${order.id}/print`} className={buttonClass({ variant: "secondary", size: "sm" })}>
              <FileText aria-hidden className="size-4" strokeWidth={1.75} />
              Друк
            </Link>
            {canWrite && (
              <Link href={`/admin/orders/new?duplicate=${order.id}`} className={buttonClass({ variant: "ghost", size: "sm" })}>
                <Copy aria-hidden className="size-4" strokeWidth={1.75} />
                Дублювати
              </Link>
            )}
            {can(user, "orders:delete") && <OrderDeleteButton id={order.id} number={order.number} />}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left column — the work */}
        <div className="space-y-4">
          <Card
            title="Позиції"
            padded={false}
            actions={
              canWrite && awaiting > 0 ? (
                <Link href={`/admin/purchases/new?order=${order.id}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
                  <ShoppingCart aria-hidden className="size-4" strokeWidth={1.75} />
                  Створити закупівлю
                </Link>
              ) : undefined
            }
          >
            <div className="adm-scroll-x">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col">Артикул / назва</th>
                    <th scope="col" className="text-right">К-ть</th>
                    <th scope="col" className="text-right">Ціна</th>
                    <th scope="col" className="text-right">Сума</th>
                    <th scope="col">Собівартість</th>
                    <th scope="col">Виконання</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => {
                    const po = line.purchaseOrderId ? poById.get(line.purchaseOrderId) : undefined;
                    const supplierName = line.supplierId ? suppliers.get(line.supplierId)?.name : undefined;
                    return (
                      <tr key={line.id}>
                        <td>
                          <span className="tabular block text-[12.5px] text-ink-3">{line.sku}</span>
                          <span className="block text-ink">
                            {line.productId ? (
                              <Link href={`/admin/products/${line.productId}`} className="link">
                                {line.name}
                              </Link>
                            ) : (
                              line.name
                            )}
                          </span>
                          {line.optionLabel && <span className="block text-[12.5px] text-ink-3">{line.optionLabel}</span>}
                          {line.note && <span className="block text-[12.5px] text-ink-3">{line.note}</span>}
                        </td>
                        <td className="text-right tabular">{line.qty}</td>
                        <td className="text-right tabular">
                          {formatPrice(line.price)}
                          {line.discount > 0 && <span className="block text-[12px] text-ink-3">−{formatPrice(line.discount)}</span>}
                        </td>
                        <td className="text-right tabular font-medium">{formatPrice(lineTotal(line))}</td>
                        <td>
                          {typeof line.costPrice === "number" ? (
                            <span className="tabular text-[13px] text-ink-2">{formatPrice(line.costPrice)}</span>
                          ) : (
                            <span className="text-[13px] text-ink-3">—</span>
                          )}
                          {supplierName && <span className="block text-[12.5px] text-ink-3">{supplierName}</span>}
                          {po && (
                            <Link href={`/admin/purchases/${po.id}`} className="link block text-[12.5px]">
                              {po.number}
                            </Link>
                          )}
                        </td>
                        <td>
                          <StatusBadge kind="fulfillment" value={line.fulfillment} size="sm" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line-soft px-4 py-3 sm:px-5">
              <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between gap-6">
                  <dt className="text-ink-3">Сума позицій</dt>
                  <dd className="tabular text-ink">{formatPrice(order.subtotal)}</dd>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between gap-6">
                    <dt className="text-ink-3">Знижка</dt>
                    <dd className="tabular text-danger">−{formatPrice(order.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-6 border-t border-line-soft pt-1.5">
                  <dt className="font-semibold text-ink">Разом</dt>
                  <dd className="tabular font-semibold text-ink">{formatPrice(order.total)}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-ink-3">Собівартість</dt>
                  <dd className="tabular text-ink-2">{order.marginKnown ? formatPrice(order.costTotal) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-ink-3">Маржа</dt>
                  <dd className={pct !== null && pct < settings.orders.lowMarginPercent ? "tabular text-danger" : "tabular text-ink-2"}>
                    {order.marginKnown ? `${formatPrice(order.margin)}${pct !== null ? ` · ${pct}%` : ""}` : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>

          {(order.comment || order.vehicle) && (
            <Card title="Коментар покупця">
              {order.comment && <p className="text-sm text-ink-2">{order.comment}</p>}
              {order.vehicle && (
                <p className="mt-2 text-[13px] text-ink-3">
                  Авто / VIN: <span className="text-ink-2">{order.vehicle}</span>
                </p>
              )}
            </Card>
          )}

          <Card title="Історія">
            {canWrite && <OrderNoteComposer id={order.id} />}
            <div className={canWrite ? "mt-4" : undefined}>
              {timelineItems.length > 0 ? (
                <Timeline items={timelineItems} order="desc" />
              ) : (
                <p className="text-sm text-ink-3">Поки немає подій.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Right column — facts & actions */}
        <div className="space-y-4">
          <OrderStatusCard order={order} canWrite={canWrite} />

          <OrderPaymentCard order={order} canWrite={canWrite} />

          <OrderDeliveryCard order={order} canWrite={canWrite} />

          <Card title="Покупець">
            <DescriptionList
              items={[
                {
                  label: "Імʼя",
                  value: customer ? (
                    <Link href={`/admin/customers/${customer.id}`} className="link">
                      {fullName}
                    </Link>
                  ) : (
                    fullName
                  ),
                },
                { label: "Телефон", value: <PhoneLink phone={order.customer.phone} /> },
                ...(order.customer.email ? [{ label: "E-mail", value: order.customer.email }] : []),
                ...(customer
                  ? [
                      { label: "Замовлень", value: <span className="tabular">{customer.ordersCount}</span> },
                      { label: "На суму", value: <span className="tabular">{formatPrice(customer.totalSpent)}</span> },
                    ]
                  : []),
              ]}
            />
            {(order.doNotCall || (customer?.tags.length ?? 0) > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {order.doNotCall && <Pill tone="amber" size="sm">Не телефонувати</Pill>}
                {customer?.tags.map((tag) => (
                  <Pill key={tag} tone="neutral" size="sm">
                    {tag}
                  </Pill>
                ))}
              </div>
            )}
            {customer && (
              <Link
                href={`/admin/orders?view=all&q=${encodeURIComponent(order.customer.phone)}`}
                className="link mt-3 inline-block text-[13px]"
              >
                Усі замовлення клієнта
              </Link>
            )}
          </Card>

          <OrderMessages order={order} templates={settings.templates} canWrite={canWrite} />

          <Card title="Мітки">
            <OrderTagsEditor id={order.id} tags={order.tags} canWrite={canWrite} />
          </Card>

          <Link
            href={`/admin/audit?entity=order&entityId=${order.id}`}
            className="block px-1 text-[13px] font-medium text-ink-3 transition-colors hover:text-brand-700"
          >
            Журнал змін цього замовлення →
          </Link>
        </div>
      </div>
    </div>
  );
}
