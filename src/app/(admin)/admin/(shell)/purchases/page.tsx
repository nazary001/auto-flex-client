import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import {
  ActionButton,
  DataTable,
  DateTime,
  FilterBar,
  FilterDateRange,
  FilterInput,
  FilterSelect,
  Money,
  PageHeader,
  SegmentedLinks,
  StatusBadge,
  type Column,
} from "@/components/admin/ui";
import { can } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/lib/admin/types";
import {
  countPurchaseOrdersByStatus,
  listOverduePurchaseOrders,
  listPurchaseOrders,
} from "@/lib/server/db/repos/purchase-orders";
import { listSuppliers } from "@/lib/server/db/repos/suppliers";
import { maxLeadDaysBySupplier } from "@/lib/admin/queries/purchasing";
import { setPurchaseOrderStatusAction } from "@/lib/admin/actions/purchasing";

export const metadata: Metadata = { title: "Закупівлі" };

const PER_PAGE = 25;

const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

const SEGMENTS: { key: string; label: string; status?: PurchaseOrderStatus }[] = [
  { key: "all", label: "Усі" },
  { key: "draft", label: "Чернетки", status: "draft" },
  { key: "sent", label: "Надіслані", status: "sent" },
  { key: "confirmed", label: "Підтверджені", status: "confirmed" },
  { key: "shipped", label: "Відправлені", status: "shipped" },
  { key: "received", label: "Отримані", status: "received" },
  { key: "cancelled", label: "Скасовані", status: "cancelled" },
  { key: "overdue", label: "Прострочені" },
];

const NEXT: Partial<Record<PurchaseOrderStatus, { to: PurchaseOrderStatus; label: string }>> = {
  draft: { to: "sent", label: "Надіслати" },
  sent: { to: "confirmed", label: "Підтвердити" },
  confirmed: { to: "shipped", label: "Відправити" },
  shipped: { to: "received", label: "Отримано" },
};

/** True when the expected date has passed and the order is still in flight (helper keeps render pure). */
function isPoLate(po: PurchaseOrder): boolean {
  if (!po.expectedAt || po.status === "received" || po.status === "cancelled") return false;
  return new Date(po.expectedAt).getTime() < Date.now();
}

interface SearchParams {
  view?: string | string[];
  supplier?: string | string[];
  from?: string | string[];
  to?: string | string[];
  q?: string | string[];
  page?: string | string[];
}

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("purchases:read");
  const db = await getDb();
  const sp = await searchParams;

  const view = first(sp.view) ?? "all";
  const supplierId = first(sp.supplier) ?? "";
  const from = first(sp.from) || undefined;
  const to = first(sp.to) || undefined;
  const q = first(sp.q)?.trim() ?? "";
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const canWrite = can(user, "purchases:write");

  const [suppliers, statusCounts] = await Promise.all([listSuppliers(db), countPurchaseOrdersByStatus(db)]);
  const supplierMap = new Map(suppliers.map((s) => [s.id, s]));
  const overdue = await listOverduePurchaseOrders(db, maxLeadDaysBySupplier(suppliers));
  const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const countFor = (key: string): number => {
    if (key === "all") return totalAll;
    if (key === "overdue") return overdue.length;
    return statusCounts[key as PurchaseOrderStatus] ?? 0;
  };

  // resolve the list for the active view
  let items: PurchaseOrder[] = [];
  let pageCount = 1;
  let pageNum = page;
  if (view === "overdue") {
    let list = overdue;
    if (supplierId) list = list.filter((po) => po.supplierId === supplierId);
    if (q) {
      const qq = q.toLowerCase();
      list = list.filter(
        (po) =>
          po.number.toLowerCase().includes(qq) ||
          po.lines.some((l) => l.sku.toLowerCase().includes(qq) || l.orderNumber.toLowerCase().includes(qq)),
      );
    }
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) list = list.filter((po) => new Date(po.createdAt) >= d);
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        list = list.filter((po) => new Date(po.createdAt) <= d);
      }
    }
    pageCount = Math.max(1, Math.ceil(list.length / PER_PAGE));
    pageNum = Math.min(page, pageCount);
    items = list.slice((pageNum - 1) * PER_PAGE, pageNum * PER_PAGE);
  } else {
    const status = SEGMENTS.find((s) => s.key === view)?.status;
    const result = await listPurchaseOrders(
      db,
      { status: status ? [status] : undefined, supplierId: supplierId || undefined, from, to, q: q || undefined },
      { page, perPage: PER_PAGE },
    );
    items = result.items;
    pageCount = result.pageCount;
    pageNum = result.page;
  }

  const carry = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const base: Record<string, string | undefined> = { view: view === "all" ? undefined : view, supplier: supplierId || undefined, from, to, q: q || undefined, ...over };
    for (const [k, v] of Object.entries(base)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/admin/purchases?${qs}` : "/admin/purchases";
  };

  const segmentItems = SEGMENTS.map((s) => ({
    label: s.label,
    href: carry({ view: s.key === "all" ? undefined : s.key, page: undefined }),
    count: countFor(s.key),
    active: view === s.key,
  }));

  const orderLinks = (po: PurchaseOrder) => {
    const seen = new Map<string, string>();
    for (const line of po.lines) if (!seen.has(line.orderId)) seen.set(line.orderId, line.orderNumber);
    return [...seen.entries()];
  };

  const columns: Column<PurchaseOrder>[] = [
    {
      key: "number",
      header: "№ / дата",
      render: (po) => (
        <div className="grid gap-0.5">
          <span className="tabular font-semibold">{po.number}</span>
          <DateTime iso={po.createdAt} className="text-[12.5px] text-ink-3" />
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Постачальник",
      render: (po) => (
        <Link href={`/admin/suppliers/${po.supplierId}`} className="link relative z-10 font-medium">
          {supplierMap.get(po.supplierId)?.name ?? "—"}
        </Link>
      ),
    },
    {
      key: "orders",
      header: "Замовлення",
      hideBelow: "lg",
      render: (po) => (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          {orderLinks(po).map(([orderId, number]) => (
            <Link key={orderId} href={`/admin/orders/${orderId}`} className="link relative z-10 tabular text-[13px]">
              {number}
            </Link>
          ))}
        </div>
      ),
    },
    { key: "lines", header: "Поз.", align: "right", hideBelow: "sm", render: (po) => <span className="tabular text-ink-2">{po.lines.length}</span> },
    { key: "total", header: "Сума", align: "right", render: (po) => <Money value={po.totalCost} /> },
    {
      key: "expected",
      header: "Очікується",
      hideBelow: "md",
      render: (po) =>
        po.expectedAt ? (
          <DateTime iso={po.expectedAt} className={isPoLate(po) ? "font-medium text-danger" : "text-ink-2"} />
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    { key: "status", header: "Статус", render: (po) => <StatusBadge kind="po" value={po.status} /> },
    {
      key: "action",
      header: "",
      align: "right",
      render: (po) => {
        const next = NEXT[po.status];
        if (!next || !canWrite) return null;
        return (
          <span className="relative z-10 inline-flex">
            <ActionButton
              action={setPurchaseOrderStatusAction.bind(null, { id: po.id, to: next.to })}
              variant="secondary"
              size="sm"
              successMessage="Статус оновлено"
            >
              {next.label}
            </ActionButton>
          </span>
        );
      },
    },
  ];

  const mobileCard = (po: PurchaseOrder) => (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="tabular font-semibold">{po.number}</span>
        <StatusBadge kind="po" value={po.status} size="sm" />
      </div>
      <div className="flex items-center justify-between gap-2 text-[13px] text-ink-2">
        <span>{supplierMap.get(po.supplierId)?.name ?? "—"}</span>
        <Money value={po.totalCost} />
      </div>
      <div className="flex items-center justify-between gap-2 text-[12.5px] text-ink-3">
        <DateTime iso={po.createdAt} />
        <span>{po.lines.length} поз.</span>
      </div>
    </div>
  );

  const hasFilters = Boolean(supplierId || from || to || q || view !== "all");

  return (
    <div>
      <PageHeader
        title="Закупівлі"
        description="Замовлення запчастин у постачальників"
        actions={
          canWrite && (
            <Link href="/admin/purchases/new" className={buttonClass({ size: "sm" })}>
              <Plus aria-hidden className="size-4" strokeWidth={2} />
              Нова закупівля
            </Link>
          )
        }
      >
        <div className="grid gap-3">
          <SegmentedLinks items={segmentItems} ariaLabel="Фільтр за статусом" />
          <FilterBar action="/admin/purchases" hidden={view === "all" ? undefined : { view }} resetHref={view === "all" ? "/admin/purchases" : `/admin/purchases?view=${view}`}>
            <FilterSelect
              name="supplier"
              value={supplierId}
              allLabel="Усі постачальники"
              ariaLabel="Постачальник"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
            <FilterDateRange from={from} to={to} />
            <FilterInput name="q" value={q} placeholder="№, артикул, замовлення" />
          </FilterBar>
        </div>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(po) => po.id}
        rowHref={(po) => `/admin/purchases/${po.id}`}
        mobileCard={mobileCard}
        empty={
          <EmptyState
            icon={<PackageSearch />}
            title={hasFilters ? "Нічого не знайдено" : "Закупівель ще немає"}
            text={
              hasFilters
                ? "Спробуйте змінити фільтри або скиньте їх."
                : "Створіть закупівлю з позицій замовлень, що очікують на постачальника."
            }
            action={
              !hasFilters && canWrite ? (
                <Link href="/admin/purchases/new" className={buttonClass({})}>
                  Створити закупівлю
                </Link>
              ) : undefined
            }
          />
        }
      />

      {pageCount > 1 && (
        <Pagination
          page={pageNum}
          pageCount={pageCount}
          pathname="/admin/purchases"
          query={{ view: view === "all" ? undefined : view, supplier: supplierId || undefined, from, to, q: q || undefined }}
          className="mt-5"
        />
      )}
    </div>
  );
}
