import type { Metadata } from "next";
import Link from "next/link";
import { Download, Inbox, Plus } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import {
  ActionButton,
  type Column,
  DataTable,
  FilterBar,
  FilterDateRange,
  FilterInput,
  FilterSelect,
  Money,
  PageHeader,
  Pill,
  SegmentedLinks,
  StatusBadge,
} from "@/components/admin/ui";
import { OrdersBulkBar } from "@/components/admin/orders/OrdersBulkBar";
import { changeOrderStatusAction } from "@/lib/admin/actions/orders";
import {
  countSavedViews,
  listOrdersForView,
  ORDER_VIEWS,
  parseOrderQuery,
  type RawSearchParams,
} from "@/lib/admin/queries/orders";
import {
  DELIVERY_METHODS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  deliveryMethodShort,
  orderStatusMeta,
  paymentStatusMeta,
} from "@/lib/admin/labels";
import { linesAwaitingPurchase, suggestNextStep } from "@/lib/admin/domain/order-status";
import { marginPercent } from "@/lib/admin/domain/money";
import { can } from "@/lib/admin/permissions";
import type { Order, OrderSort, OrderStatus } from "@/lib/admin/types";
import { normalizePaging } from "@/lib/admin/types";
import { formatPhone } from "@/lib/format";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { listSuppliers } from "@/lib/server/db/repos/suppliers";
import { getSettings } from "@/lib/server/db/repos/settings";
import { listUsers } from "@/lib/server/db/repos/users";
import { initials } from "@/components/admin/shell/nav";

export const metadata: Metadata = { title: "Замовлення" };

function queryString(sp: RawSearchParams, drop: string[] = []): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined || drop.includes(key)) continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.set(key, value);
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

function sortState(sort: OrderSort): { key: string; dir: "asc" | "desc" } {
  switch (sort) {
    case "oldest":
      return { key: "createdAt", dir: "asc" };
    case "total_desc":
      return { key: "total", dir: "desc" };
    case "total_asc":
      return { key: "total", dir: "asc" };
    case "updated":
      return { key: "updatedAt", dir: "desc" };
    default:
      return { key: "createdAt", dir: "desc" };
  }
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const user = await requireUser("orders:read");
  const db = await getDb();
  const sp = await searchParams;
  const { view, filter, page, sort } = parseOrderQuery(sp);
  const canWrite = can(user, "orders:write");

  const [counts, result, suppliers, users, settings] = await Promise.all([
    countSavedViews(db),
    listOrdersForView(db, view, filter, normalizePaging({ page })),
    listSuppliers(db),
    listUsers(db),
    getSettings(db),
  ]);

  const userById = new Map(users.map((u) => [u.id, u.name]));
  const lowMargin = settings.orders.lowMarginPercent;
  const activeFilters = Boolean(
    filter.status || filter.paymentStatus || filter.deliveryMethod || filter.supplierId || filter.assigneeId || filter.q || filter.from || filter.to,
  );

  const views = ORDER_VIEWS.map((v) => ({
    label: v.label,
    href: `/admin/orders?view=${v.key}`,
    count: counts[v.key],
    active: v.key === view,
  }));

  const current = sortState(sort);
  const hrefFor = (key: string, dir: "asc" | "desc") => {
    const value: OrderSort = key === "total" ? (dir === "asc" ? "total_asc" : "total_desc") : key === "updatedAt" ? "updated" : dir === "asc" ? "oldest" : "newest";
    return `/admin/orders${queryString({ ...sp, sort: value }, ["page"])}`;
  };

  function nextAction(order: Order) {
    const awaiting = linesAwaitingPurchase(order.lines).length > 0;
    if ((order.status === "confirmed" || order.status === "sourcing") && awaiting) {
      return (
        <Link href={`/admin/purchases/new?order=${order.id}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
          Закупівля
        </Link>
      );
    }
    const next = suggestNextStep(order);
    if (!next) return <span className="text-[13px] text-ink-3">—</span>;
    if (!canWrite) return <span className="text-[13px] text-ink-3">{orderStatusMeta[next.status].label}</span>;
    // Short verbs keep the column narrow; the full wording lives on the order page
    const shortLabel: Partial<Record<OrderStatus, string>> = {
      confirmed: "Підтвердити",
      in_transit: "Відправлено",
      delivered: "Доставлено",
      completed: "Закрити",
    };
    return (
      <ActionButton
        size="sm"
        variant="secondary"
        successMessage="Статус оновлено"
        action={changeOrderStatusAction.bind(null, { id: order.id, to: next.status })}
      >
        {shortLabel[next.status] ?? next.label}
      </ActionButton>
    );
  }

  function marginNote(order: Order) {
    const pct = marginPercent(order);
    if (pct === null) return <span className="text-[12px] text-ink-3">маржа —</span>;
    return <span className={pct < lowMargin ? "text-[12px] text-danger" : "text-[12px] text-ink-3"}>маржа {pct}%</span>;
  }

  function linesSummary(order: Order) {
    const active = order.lines.filter((l) => l.fulfillment !== "cancelled");
    const first = active[0]?.name ?? "—";
    return `${active.length} поз. · ${first}`;
  }

  const columns: Column<Order>[] = [];
  if (canWrite) {
    columns.push({
      key: "select",
      header: <span className="sr-only">Вибір</span>,
      width: "2.25rem",
      render: (order) => (
        <input
          type="checkbox"
          name="ids"
          value={order.id}
          data-status={order.status}
          className="check"
          aria-label={`Вибрати ${order.number}`}
        />
      ),
    });
  }
  columns.push(
    {
      key: "number",
      header: "№ / дата",
      sortKey: "createdAt",
      render: (order) => (
        <Link href={`/admin/orders/${order.id}`} className="block">
          <span className="font-semibold whitespace-nowrap text-ink">{order.number}</span>
          <span className="mt-0.5 block text-[12.5px] text-ink-3">
            {new Date(order.createdAt).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })}
          </span>
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Клієнт",
      hideBelow: "lg",
      render: (order) => (
        <span className="block min-w-0">
          <span className="block truncate text-ink">{`${order.customer.lastName} ${order.customer.firstName}`.trim() || "—"}</span>
          <span className="tabular block text-[12.5px] text-ink-3">{formatPhone(order.customer.phone)}</span>
        </span>
      ),
    },
    {
      key: "lines",
      header: "Склад",
      hideBelow: "xl",
      render: (order) => <span className="block max-w-[14rem] truncate text-[13px] text-ink-2">{linesSummary(order)}</span>,
    },
    {
      key: "total",
      header: "Сума",
      align: "right",
      sortKey: "total",
      render: (order) => (
        <span className="block">
          <Money value={order.total} className="font-semibold" />
          <span className="mt-0.5 block">{marginNote(order)}</span>
        </span>
      ),
    },
    {
      key: "payment",
      header: "Оплата",
      hideBelow: "md",
      render: (order) => <StatusBadge kind="payment" value={order.payment.status} size="sm" />,
    },
    {
      key: "status",
      header: "Статус",
      render: (order) => <StatusBadge kind="order" value={order.status} size="sm" />,
    },
    {
      key: "assignee",
      header: "Хто",
      hideBelow: "xl",
      render: (order) =>
        order.assigneeId ? (
          <Pill tone="neutral" size="sm" title={userById.get(order.assigneeId)}>
            {initials(userById.get(order.assigneeId) ?? "?")}
          </Pill>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      key: "action",
      header: "Наступний крок",
      align: "right",
      render: (order) => <div className="flex justify-end">{nextAction(order)}</div>,
    },
  );

  const mobileCard = (order: Order) => (
    <Link href={`/admin/orders/${order.id}`} className="block">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold whitespace-nowrap text-ink">{order.number}</span>
        <Money value={order.total} className="font-semibold" />
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-[12.5px] text-ink-3">
        <span className="tabular">{formatPhone(order.customer.phone)}</span>
        <span>{new Date(order.createdAt).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })}</span>
      </div>
      <div className="mt-1 truncate text-[13px] text-ink-2">{linesSummary(order)}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge kind="order" value={order.status} size="sm" />
        <StatusBadge kind="payment" value={order.payment.status} size="sm" />
        {marginNote(order)}
      </div>
    </Link>
  );

  return (
    <div>
      <PageHeader
        title="Замовлення"
        description="Обробка замовлень від підтвердження до закриття"
        actions={
          <>
            <Link href={`/admin/export/orders${queryString(sp)}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
              <Download aria-hidden className="size-4" strokeWidth={1.75} />
              Експорт CSV
            </Link>
            {canWrite && (
              <Link href="/admin/orders/new" className={buttonClass({ size: "sm" })}>
                <Plus aria-hidden className="size-4" strokeWidth={1.75} />
                Нове замовлення
              </Link>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <SegmentedLinks items={views} ariaLabel="Збережені подання" />
          <FilterBar
            action="/admin/orders"
            hidden={{ view, ...(sort !== "newest" ? { sort } : {}) }}
            resetHref={`/admin/orders?view=${view}`}
          >
            <FilterSelect
              name="status"
              value={filter.status?.[0]}
              allLabel="Усі статуси"
              ariaLabel="Статус"
              options={ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusMeta[s].label }))}
            />
            <FilterSelect
              name="payment"
              value={filter.paymentStatus?.[0]}
              allLabel="Будь-яка оплата"
              ariaLabel="Статус оплати"
              options={PAYMENT_STATUSES.map((s) => ({ value: s, label: paymentStatusMeta[s].label }))}
            />
            <FilterSelect
              name="delivery"
              value={filter.deliveryMethod?.[0]}
              allLabel="Будь-яка доставка"
              ariaLabel="Спосіб доставки"
              options={DELIVERY_METHODS.map((m) => ({ value: m, label: deliveryMethodShort[m] }))}
            />
            <FilterSelect
              name="supplier"
              value={filter.supplierId}
              allLabel="Усі постачальники"
              ariaLabel="Постачальник"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
            <FilterSelect
              name="assignee"
              value={filter.assigneeId}
              allLabel="Усі відповідальні"
              ariaLabel="Відповідальний"
              options={[{ value: "none", label: "Без відповідального" }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
            />
            <FilterDateRange from={filter.from} to={filter.to} />
            <FilterInput name="q" value={filter.q} placeholder="Номер, телефон, ім'я, артикул" />
          </FilterBar>
        </div>
      </PageHeader>

      {result.items.length === 0 ? (
        <EmptyState
          icon={<Inbox aria-hidden strokeWidth={1.75} />}
          title={activeFilters ? "Нічого не знайдено" : "Замовлень поки немає"}
          text={
            activeFilters
              ? "Спробуйте змінити фільтри або скиньте їх."
              : "Коли надійде замовлення з сайту або ви створите його вручну, воно зʼявиться тут."
          }
          action={
            activeFilters ? (
              <Link href={`/admin/orders?view=${view}`} className={buttonClass({ variant: "secondary" })}>
                Скинути фільтри
              </Link>
            ) : canWrite ? (
              <Link href="/admin/orders/new" className={buttonClass({})}>
                Нове замовлення
              </Link>
            ) : undefined
          }
        />
      ) : (
        <form>
          <DataTable
            columns={columns}
            rows={result.items}
            rowKey={(order) => order.id}
            mobileCard={mobileCard}
            sort={{ key: current.key, dir: current.dir, hrefFor }}
          />
          {canWrite && <OrdersBulkBar assignees={users.map((u) => ({ id: u.id, name: u.name }))} />}
        </form>
      )}

      <Pagination page={result.page} pageCount={result.pageCount} pathname="/admin/orders" query={sp} className="mt-5" />
    </div>
  );
}
