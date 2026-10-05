import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhoneOff, Plus, ScrollText, UserCheck } from "lucide-react";
import {
  Card,
  DataTable,
  DateTime,
  DescriptionList,
  KpiTile,
  Money,
  PageHeader,
  PhoneLink,
  Pill,
  StatusBadge,
} from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/Button";
import { AccountCard } from "@/components/admin/customers/AccountCard";
import { CustomerForm } from "@/components/admin/customers/CustomerForm";
import { CustomerNotes } from "@/components/admin/customers/CustomerNotes";
import { can } from "@/lib/admin/permissions";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/lib/admin/types";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { getAccountByCustomerId } from "@/lib/server/db/repos/accounts";
import { getCustomer } from "@/lib/server/db/repos/customers";
import { listOrdersByCustomer } from "@/lib/server/db/repos/orders";
import { listRequestsByPhone } from "@/lib/server/db/repos/requests";
import { requestKindLabel } from "@/lib/admin/labels";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const db = await getDb();
  const customer = await getCustomer(db, id);
  const name = customer ? `${customer.firstName} ${customer.lastName}`.trim() || customer.phone : "Клієнт";
  return { title: name };
}

function linesSummary(order: Order): string {
  const [first, ...rest] = order.lines;
  if (!first) return "—";
  return rest.length ? `${first.name} +${rest.length}` : first.name;
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("customers:read");
  const db = await getDb();
  const { id } = await params;

  const customer = await getCustomer(db, id);
  if (!customer) notFound();

  const [orders, requests, account] = await Promise.all([
    listOrdersByCustomer(db, id),
    listRequestsByPhone(db, customer.phone),
    getAccountByCustomerId(db, id),
  ]);

  const canWrite = can(user, "customers:write");
  const canOrder = can(user, "orders:write");
  const name = `${customer.firstName} ${customer.lastName}`.trim() || customer.phone;
  const average = customer.ordersCount > 0 ? Math.round(customer.totalSpent / customer.ordersCount) : 0;

  const orderColumns = [
    { key: "number", header: "№", render: (o: Order) => <span className="tabular">{o.number}</span> },
    { key: "date", header: "Дата", hideBelow: "sm" as const, render: (o: Order) => <DateTime iso={o.createdAt} /> },
    { key: "lines", header: "Склад", hideBelow: "md" as const, render: (o: Order) => <span className="text-ink-2">{linesSummary(o)}</span> },
    { key: "total", header: "Сума", align: "right" as const, render: (o: Order) => <Money value={o.total} /> },
    {
      key: "payment",
      header: "Оплата",
      hideBelow: "lg" as const,
      render: (o: Order) => <StatusBadge kind="payment" value={o.payment.status} size="sm" />,
    },
    { key: "status", header: "Статус", render: (o: Order) => <StatusBadge kind="order" value={o.status} size="sm" /> },
  ];

  const orderMobileCard = (o: Order) => (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="tabular font-semibold text-ink">{o.number}</span>
        <Money value={o.total} className="text-sm font-semibold" />
      </div>
      <div className="mt-1.5 text-[13px] text-ink-2">{linesSummary(o)}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge kind="order" value={o.status} size="sm" />
        <StatusBadge kind="payment" value={o.payment.status} size="sm" />
        <DateTime iso={o.createdAt} className="text-[12.5px] text-ink-3" />
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={name}
        back={{ href: "/admin/customers", label: "До клієнтів" }}
        meta={
          <span className="flex flex-wrap items-center gap-1.5">
            {account && (
              <Pill tone="green" size="sm">
                <UserCheck aria-hidden className="size-3" strokeWidth={2} /> Акаунт на сайті
              </Pill>
            )}
            {customer.doNotCall && (
              <Pill tone="red" size="sm">
                <PhoneOff aria-hidden className="size-3" strokeWidth={2} /> Не телефонувати
              </Pill>
            )}
            {customer.tags.map((tag) => (
              <Pill key={tag} tone="neutral" size="sm" withDot={false}>
                {tag}
              </Pill>
            ))}
          </span>
        }
        actions={
          <>
            <PhoneLink phone={customer.phone} />
            {canOrder && (
              <Link href={`/admin/orders/new?customer=${customer.id}`} className={buttonClass({ size: "sm" })}>
                <Plus aria-hidden className="size-4" strokeWidth={2} />
                Нове замовлення
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Замовлень" value={customer.ordersCount} />
        <KpiTile label="Витрачено" value={formatPrice(customer.totalSpent)} />
        <KpiTile label="Середній чек" value={formatPrice(average)} />
        <KpiTile
          label="Останнє замовлення"
          value={customer.lastOrderAt ? <DateTime iso={customer.lastOrderAt} /> : "—"}
          hint={customer.firstOrderAt ? <>Перше: <DateTime iso={customer.firstOrderAt} /></> : undefined}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-4">
          <Card
            title="Замовлення"
            description={customer.ordersCount > 0 ? `Всього: ${customer.ordersCount}` : undefined}
            padded={orders.length === 0}
          >
            {orders.length === 0 ? (
              <p className="text-sm text-ink-3">Ще немає замовлень.</p>
            ) : (
              <DataTable
                columns={orderColumns}
                rows={orders}
                rowKey={(o) => o.id}
                rowHref={(o) => `/admin/orders/${o.id}`}
                mobileCard={orderMobileCard}
                caption={`Замовлення клієнта ${name}`}
              />
            )}
          </Card>

          <Card title="Заявки" padded={false}>
            {requests.length === 0 ? (
              <p className="px-4 py-4 text-sm text-ink-3 sm:px-5">Немає заявок від цього клієнта.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {requests.map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/admin/requests?focus=${request.id}`}
                      className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-mist-soft sm:px-5"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <Pill tone="neutral" size="sm">
                          {requestKindLabel[request.kind]}
                        </Pill>
                        <StatusBadge kind="request" value={request.status} size="sm" />
                        <DateTime iso={request.createdAt} mode="relative" className="text-[12.5px] text-ink-3" />
                      </span>
                      {request.comment && <span className="line-clamp-2 text-sm text-ink-2">{request.comment}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid gap-4">
          <Card title="Профіль">
            {canWrite ? (
              <CustomerForm mode="edit" customer={customer} />
            ) : (
              <DescriptionList
                items={[
                  { label: "Імʼя", value: name },
                  { label: "Телефон", value: <PhoneLink phone={customer.phone} /> },
                  { label: "Email", value: customer.email ?? "—" },
                  { label: "Місто", value: customer.city ?? "—" },
                  { label: "Теги", value: customer.tags.join(", ") || "—" },
                ]}
              />
            )}
          </Card>

          <AccountCard
            customerId={customer.id}
            canWrite={canWrite}
            account={
              account
                ? {
                    email: account.email,
                    phone: account.phone,
                    status: account.status,
                    createdAt: account.createdAt,
                    lastLoginAt: account.lastLoginAt,
                  }
                : null
            }
          />

          <Card title="Нотатки">
            {canWrite ? (
              <CustomerNotes id={customer.id} notes={customer.notes} />
            ) : (
              <p className="text-sm whitespace-pre-line text-ink-2">{customer.notes || "—"}</p>
            )}
          </Card>

          <Link
            href={`/admin/audit?entity=customer&entityId=${customer.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 transition-colors hover:text-brand-700"
          >
            <ScrollText aria-hidden className="size-4" strokeWidth={1.75} />
            Журнал змін
          </Link>
        </div>
      </div>
    </div>
  );
}
