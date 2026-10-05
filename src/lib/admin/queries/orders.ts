import type { Db, Filter, Sort } from "mongodb";
import type { DeliveryMethod } from "@/lib/types";
import type { Order, OrderListFilter, OrderSort, OrderStatus, PaymentStatus, Page, Paging } from "@/lib/admin/types";
import { cols, type OrderDoc } from "@/lib/server/db/collections";
import { paginate } from "@/lib/server/db/util";
import { buildOrderQuery } from "@/lib/server/db/repos/orders";

/*
 * Read helpers for the orders list that go beyond the shared repo: the saved-view clauses
 * (some of which cannot be expressed through OrderListFilter), their counts and a view-scoped
 * list/find. Kept in the module so the repo surface stays frozen.
 */

export type OrderViewKey =
  | "all"
  | "attention"
  | "new"
  | "sourcing"
  | "transit"
  | "awaiting_payment"
  | "completed"
  | "cancelled";

export const ORDER_VIEWS: { key: OrderViewKey; label: string }[] = [
  { key: "all", label: "Усі" },
  { key: "attention", label: "Потребують дії" },
  { key: "new", label: "Нові" },
  { key: "sourcing", label: "У постачальника" },
  { key: "transit", label: "В дорозі" },
  { key: "awaiting_payment", label: "Очікують оплати" },
  { key: "completed", label: "Виконані" },
  { key: "cancelled", label: "Скасовані" },
];

const VIEW_KEYS = new Set<string>(ORDER_VIEWS.map((v) => v.key));

export function isOrderView(value: string | undefined): value is OrderViewKey {
  return value !== undefined && VIEW_KEYS.has(value);
}

/** The Mongo clause for a saved view, or null for "all". */
function viewClause(view: OrderViewKey): Filter<OrderDoc> | null {
  switch (view) {
    case "attention":
      return {
        $or: [
          { status: { $in: ["new", "on_hold"] } },
          { status: "confirmed", lines: { $elemMatch: { fulfillment: "pending", purchaseOrderId: { $exists: false } } } },
        ],
      };
    case "new":
      return { status: "new" };
    case "sourcing":
      return { status: "sourcing" };
    case "transit":
      return { status: "in_transit" };
    case "awaiting_payment":
      return { "payment.status": "unpaid", "payment.method": { $ne: "cod" }, status: { $nin: ["cancelled", "returned"] } };
    case "completed":
      return { status: "completed" };
    case "cancelled":
      return { status: "cancelled" };
    default:
      return null;
  }
}

/** Combines a saved-view clause with the filter-bar query (both must match). */
function combinedQuery(view: OrderViewKey, filter: OrderListFilter): Filter<OrderDoc> {
  const base = buildOrderQuery(filter);
  const clause = viewClause(view);
  if (!clause) return base;
  if (Object.keys(base).length === 0) return clause;
  return { $and: [base, clause] };
}

function orderSort(sort: OrderSort | undefined): Sort {
  switch (sort) {
    case "oldest":
      return { createdAt: 1 };
    case "total_desc":
      return { total: -1, createdAt: -1 };
    case "total_asc":
      return { total: 1, createdAt: -1 };
    case "updated":
      return { updatedAt: -1 };
    default:
      return { createdAt: -1 };
  }
}

function fromOrderDoc(doc: OrderDoc): Order {
  const { _id, customerPhone: _phone, search: _search, ...rest } = doc;
  void _phone;
  void _search;
  return { id: _id, ...rest };
}

/** Counts for every saved view (whole dataset, independent of the active filter bar). */
export async function countSavedViews(db: Db): Promise<Record<OrderViewKey, number>> {
  const entries = await Promise.all(
    ORDER_VIEWS.map(async ({ key }) => {
      const clause = viewClause(key);
      const count = await cols(db).orders.countDocuments(clause ?? {});
      return [key, count] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<OrderViewKey, number>;
}

export async function listOrdersForView(
  db: Db,
  view: OrderViewKey,
  filter: OrderListFilter,
  paging: Paging,
): Promise<Page<Order>> {
  return paginate(cols(db).orders, combinedQuery(view, filter), orderSort(filter.sort), paging, fromOrderDoc);
}

export async function findOrdersForView(
  db: Db,
  view: OrderViewKey,
  filter: OrderListFilter,
  limit = 5000,
): Promise<Order[]> {
  const docs = await cols(db)
    .orders.find(combinedQuery(view, filter))
    .sort(orderSort(filter.sort))
    .limit(limit)
    .toArray();
  return docs.map(fromOrderDoc);
}

// ── searchParams parsing ────────────────────────────────────

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v?.trim();
  return trimmed ? trimmed : undefined;
}

const ORDER_STATUS_SET = new Set<string>([
  "new",
  "confirmed",
  "sourcing",
  "in_transit",
  "delivered",
  "completed",
  "on_hold",
  "cancelled",
  "returned",
]);
const PAYMENT_STATUS_SET = new Set<string>(["unpaid", "prepaid", "paid", "refunded", "partially_refunded"]);
const DELIVERY_SET = new Set<string>(["np_branch", "np_locker", "np_courier", "ukrposhta"]);
const SORT_SET = new Set<string>(["newest", "oldest", "total_desc", "total_asc", "updated"]);

export interface ParsedOrderQuery {
  view: OrderViewKey;
  filter: OrderListFilter;
  page: number;
  sort: OrderSort;
}

export function parseOrderQuery(sp: RawSearchParams): ParsedOrderQuery {
  const rawView = first(sp.view);
  const view: OrderViewKey = isOrderView(rawView) ? rawView : "all";

  const status = first(sp.status);
  const paymentStatus = first(sp.payment);
  const deliveryMethod = first(sp.delivery);
  const rawSort = first(sp.sort);
  const sort: OrderSort = rawSort && SORT_SET.has(rawSort) ? (rawSort as OrderSort) : "newest";

  const filter: OrderListFilter = {
    status: status && ORDER_STATUS_SET.has(status) ? [status as OrderStatus] : undefined,
    paymentStatus: paymentStatus && PAYMENT_STATUS_SET.has(paymentStatus) ? [paymentStatus as PaymentStatus] : undefined,
    deliveryMethod: deliveryMethod && DELIVERY_SET.has(deliveryMethod) ? [deliveryMethod as DeliveryMethod] : undefined,
    supplierId: first(sp.supplier),
    assigneeId: first(sp.assignee),
    q: first(sp.q),
    from: first(sp.from),
    to: first(sp.to),
    sort,
  };

  const pageNum = Number.parseInt(first(sp.page) ?? "1", 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  return { view, filter, page, sort };
}
