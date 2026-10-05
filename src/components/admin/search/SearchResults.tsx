import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { formatPhone } from "@/lib/format";
import { requestKindLabel } from "@/lib/admin/labels";
import type { Customer, CustomerRequest, Order } from "@/lib/admin/types";
import { Card, DataTable, DateTime, Money, StatusBadge, type Column } from "@/components/admin/ui";
import type { ProductHit, PurchaseOrderHit, SearchData } from "@/lib/admin/queries/search";

/* Renders the non-empty sections of a global-search result. Each row links to the record. */

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <Card
      title={
        <>
          {title} <span className="tabular ml-1 text-[13px] font-normal text-ink-3">{count}</span>
        </>
      }
      padded={false}
    >
      {children}
    </Card>
  );
}

const orderColumns: Column<Order>[] = [
  {
    key: "number",
    header: "Замовлення",
    render: (o) => (
      <div>
        <span className="tabular">{o.number}</span>
        <span className="block text-[12px] text-ink-3">
          <DateTime iso={o.createdAt} />
        </span>
      </div>
    ),
  },
  {
    key: "customer",
    header: "Клієнт",
    hideBelow: "sm",
    render: (o) => (
      <div className="min-w-0">
        <span className="block truncate">{`${o.customer.lastName} ${o.customer.firstName}`.trim() || "—"}</span>
        <span className="tabular block text-[12px] text-ink-3">{formatPhone(o.customer.phone)}</span>
      </div>
    ),
  },
  { key: "total", header: "Сума", align: "right", render: (o) => <Money value={o.total} /> },
  { key: "status", header: "Статус", align: "right", render: (o) => <StatusBadge kind="order" value={o.status} /> },
];

const customerColumns: Column<Customer>[] = [
  { key: "name", header: "Клієнт", render: (c) => `${c.lastName} ${c.firstName}`.trim() || "—" },
  { key: "phone", header: "Телефон", hideBelow: "sm", render: (c) => <span className="tabular">{formatPhone(c.phone)}</span> },
  { key: "orders", header: "Замовлень", align: "right", render: (c) => c.ordersCount },
  { key: "spent", header: "Сума", align: "right", render: (c) => <Money value={c.totalSpent} muted /> },
];

const productColumns: Column<ProductHit>[] = [
  {
    key: "name",
    header: "Товар",
    render: (p) => (
      <div className="min-w-0">
        <span className="block truncate">{p.name}</span>
        <span className="tabular block text-[12px] text-ink-3">{p.sku}</span>
      </div>
    ),
  },
  { key: "brand", header: "Бренд", hideBelow: "md", render: (p) => p.brand ?? "—" },
  { key: "price", header: "Ціна", align: "right", render: (p) => <Money value={p.price} /> },
  {
    key: "site",
    header: "",
    align: "right",
    width: "3rem",
    render: (p) => (
      <a
        href={`/product/${p.slug}`}
        target="_blank"
        rel="noreferrer"
        title="Відкрити на сайті"
        className="link relative z-10 inline-flex"
      >
        <ExternalLink aria-hidden className="size-4" strokeWidth={1.75} />
        <span className="sr-only">Відкрити на сайті</span>
      </a>
    ),
  },
];

const requestColumns: Column<CustomerRequest>[] = [
  {
    key: "who",
    header: "Заявка",
    render: (r) => (
      <div className="min-w-0">
        <span className="block truncate">{r.name || formatPhone(r.phone)}</span>
        {r.name && <span className="tabular block text-[12px] text-ink-3">{formatPhone(r.phone)}</span>}
      </div>
    ),
  },
  { key: "kind", header: "Тип", hideBelow: "sm", render: (r) => requestKindLabel[r.kind] },
  { key: "status", header: "Статус", align: "right", render: (r) => <StatusBadge kind="request" value={r.status} /> },
];

const purchaseColumns: Column<PurchaseOrderHit>[] = [
  {
    key: "number",
    header: "Закупівля",
    render: ({ po, supplierName }) => (
      <div className="min-w-0">
        <span className="tabular block">{po.number}</span>
        {supplierName && <span className="block truncate text-[12px] text-ink-3">{supplierName}</span>}
      </div>
    ),
  },
  { key: "lines", header: "Позицій", hideBelow: "sm", align: "right", render: ({ po }) => po.lines.length },
  { key: "status", header: "Статус", align: "right", render: ({ po }) => <StatusBadge kind="po" value={po.status} /> },
  { key: "total", header: "Сума", align: "right", render: ({ po }) => <Money value={po.totalCost} muted /> },
];

export function SearchResults({ data }: { data: SearchData }) {
  return (
    <div className="grid gap-4">
      {data.orders.length > 0 && (
        <Section title="Замовлення" count={data.orders.length}>
          <DataTable
            columns={orderColumns}
            rows={data.orders}
            rowKey={(o) => o.id}
            rowHref={(o) => `/admin/orders/${o.id}`}
            caption="Знайдені замовлення"
          />
        </Section>
      )}

      {data.customers.length > 0 && (
        <Section title="Клієнти" count={data.customers.length}>
          <DataTable
            columns={customerColumns}
            rows={data.customers}
            rowKey={(c) => c.id}
            rowHref={(c) => `/admin/customers/${c.id}`}
            caption="Знайдені клієнти"
          />
        </Section>
      )}

      {data.products.length > 0 && (
        <Section title="Товари" count={data.products.length}>
          <DataTable
            columns={productColumns}
            rows={data.products}
            rowKey={(p) => p.id}
            rowHref={(p) => `/admin/products/${p.id}`}
            caption="Знайдені товари"
          />
        </Section>
      )}

      {data.purchaseOrders.length > 0 && (
        <Section title="Закупівлі" count={data.purchaseOrders.length}>
          <DataTable
            columns={purchaseColumns}
            rows={data.purchaseOrders}
            rowKey={({ po }) => po.id}
            rowHref={({ po }) => `/admin/purchases/${po.id}`}
            caption="Знайдені закупівлі"
          />
        </Section>
      )}

      {data.requests.length > 0 && (
        <Section title="Заявки" count={data.requests.length}>
          <DataTable
            columns={requestColumns}
            rows={data.requests}
            rowKey={(r) => r.id}
            rowHref={(r) => `/admin/requests?focus=${r.id}`}
            caption="Знайдені заявки"
          />
        </Section>
      )}
    </div>
  );
}
