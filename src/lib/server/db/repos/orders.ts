import type { Db, Filter, Sort } from "mongodb";
import { normalizePhone } from "@/lib/format";
import { OPEN_ORDER_STATUSES, REVENUE_ORDER_STATUSES, orderSourceLabel, orderStatusMeta } from "@/lib/admin/labels";
import { computeTotals } from "@/lib/admin/domain/money";
import { dateStamp, formatOrderNumber, orderCounterKey } from "@/lib/admin/domain/numbering";
import { applyTransition, type TransitionOptions } from "@/lib/admin/domain/order-status";
import type {
  Actor,
  LineFulfillment,
  Order,
  OrderCreateInput,
  OrderEvent,
  OrderEventType,
  OrderLine,
  OrderListFilter,
  OrderStatus,
  Page,
  Paging,
} from "@/lib/admin/types";
import { cols, type OrderDoc } from "../collections";
import { compact, containsRegex, dateRange, daysAgoIso, kyivToday, newId, nextSequence, nowIso, paginate } from "../util";
import { recomputeStats, upsertFromOrder } from "./customers";
import { bestOfferFor } from "./offers";

/*
 * Orders: the aggregate at the centre of the back office. Lines, payment and delivery are
 * embedded; the timeline lives in order_events. Money fields are always recomputed here.
 */

function buildSearch(order: Order): string {
  return [
    order.number,
    order.customer.lastName,
    order.customer.firstName,
    order.customer.phone,
    order.customer.email,
    order.delivery.city,
    order.delivery.trackingNumber,
    ...order.lines.flatMap((line) => [line.sku, line.name]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function toOrderDoc(order: Order): OrderDoc {
  const { id, ...rest } = order;
  return { _id: id, ...rest, customerPhone: order.customer.phone, search: buildSearch(order) };
}

function fromOrderDoc(doc: OrderDoc): Order {
  const { _id, customerPhone: _phone, search: _search, ...rest } = doc;
  void _phone;
  void _search;
  return { id: _id, ...rest };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

/** Daily sequence keyed by the order's own date (seeded orders keep their historical stamp) */
async function allocateNumber(db: Db, createdAt: string): Promise<string> {
  const stamp = dateStamp(new Date(createdAt));
  const seq = await nextSequence(cols(db).counters, orderCounterKey(stamp));
  return formatOrderNumber(stamp, seq);
}

// ── events ──────────────────────────────────────────────────

export async function addOrderEvent(
  db: Db,
  orderId: string,
  type: OrderEventType,
  actor: Actor,
  text: string,
  data?: Record<string, unknown>,
  options: { at?: string } = {},
): Promise<OrderEvent> {
  const event: OrderEvent = compact({
    id: newId(),
    orderId,
    type,
    at: options.at ?? nowIso(),
    actorId: actor.id,
    actorName: actor.name,
    text,
    data,
  });
  const { id, ...rest } = event;
  await cols(db).orderEvents.insertOne({ _id: id, ...rest });
  return event;
}

export async function listOrderEvents(db: Db, orderId: string): Promise<OrderEvent[]> {
  const docs = await cols(db).orderEvents.find({ orderId }).sort({ at: 1 }).toArray();
  return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
}

export async function listRecentOrderEvents(db: Db, limit = 20): Promise<OrderEvent[]> {
  const docs = await cols(db).orderEvents.find().sort({ at: -1 }).limit(limit).toArray();
  return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
}

// ── create ──────────────────────────────────────────────────

export interface CreateOrderOptions {
  /** Look up the best supplier offer for lines without a cost price (default true) */
  resolveCosts?: boolean;
  /** Override the creation time (seed) */
  createdAt?: string;
  number?: string;
}

export async function createOrder(
  db: Db,
  input: OrderCreateInput,
  actor: Actor,
  options: CreateOrderOptions = {},
): Promise<Order> {
  const now = options.createdAt ?? nowIso();
  const customerPhone = normalizePhone(input.customer.phone);
  const customer = await upsertFromOrder(
    db,
    { ...input.customer, phone: customerPhone },
    { city: input.delivery.city, doNotCall: input.doNotCall },
  );

  const lines: OrderLine[] = [];
  for (const raw of input.lines) {
    let costPrice = raw.costPrice;
    let supplierId = raw.supplierId;
    if ((costPrice === undefined || supplierId === undefined) && options.resolveCosts !== false) {
      const offer = await bestOfferFor(db, { productId: raw.productId, sku: raw.sku });
      if (offer) {
        costPrice ??= offer.cost;
        supplierId ??= offer.supplierId;
      }
    }
    lines.push(
      compact({
        id: newId(),
        productId: raw.productId,
        sku: raw.sku,
        name: raw.name,
        optionLabel: raw.optionLabel,
        price: Math.round(raw.price),
        qty: Math.max(1, Math.round(raw.qty)),
        discount: Math.max(0, Math.round(raw.discount ?? 0)),
        costPrice,
        supplierId,
        fulfillment: "pending" as LineFulfillment,
        note: raw.note,
      }),
    );
  }

  const delivery = compact({
    method: input.delivery.method,
    city: input.delivery.city.trim(),
    address: input.delivery.address.trim(),
    carrier: input.delivery.carrier ?? (input.delivery.method === "ukrposhta" ? "ukrposhta" : "nova_poshta"),
    cost: input.delivery.cost,
    costPayer: input.delivery.costPayer,
  });
  const orderDiscount = Math.max(0, Math.round(input.orderDiscount ?? 0));
  const totals = computeTotals(lines, delivery, orderDiscount);

  const base: Omit<Order, "id" | "number"> = compact({
    status: input.status ?? "new",
    source: input.source,
    customer: compact({
      customerId: customer.id,
      firstName: input.customer.firstName.trim(),
      lastName: input.customer.lastName.trim(),
      phone: customerPhone,
      email: input.customer.email?.trim() || undefined,
    }),
    delivery,
    payment: compact({
      method: input.payment.method,
      status: input.payment.status ?? "unpaid",
      paidAmount: input.payment.paidAmount ?? 0,
      paymentLink: input.payment.paymentLink,
    }),
    lines,
    orderDiscount,
    ...totals,
    comment: input.comment?.trim() || undefined,
    vehicle: input.vehicle?.trim() || undefined,
    doNotCall: input.doNotCall ?? false,
    managerNote: input.managerNote?.trim() || undefined,
    assigneeId: input.assigneeId,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  });

  let order: Order | null = null;
  for (let attempt = 0; attempt < 5 && !order; attempt++) {
    const candidate: Order = { id: newId(), number: options.number ?? (await allocateNumber(db, now)), ...base };
    try {
      await cols(db).orders.insertOne(toOrderDoc(candidate));
      order = candidate;
    } catch (error) {
      if (!isDuplicateKey(error) || options.number) throw error;
    }
  }
  if (!order) throw new Error("Не вдалося згенерувати унікальний номер замовлення.");

  await addOrderEvent(db, order.id, "created", actor, `Замовлення створено (${orderSourceLabel[order.source]})`, undefined, {
    at: now,
  });
  await recomputeStats(db, customer.id);
  return order;
}

// ── read ────────────────────────────────────────────────────

export async function getOrder(db: Db, id: string): Promise<Order | null> {
  const doc = await cols(db).orders.findOne({ _id: id });
  return doc ? fromOrderDoc(doc) : null;
}

export async function getOrderByNumber(db: Db, number: string): Promise<Order | null> {
  const doc = await cols(db).orders.findOne({ number: number.trim().toUpperCase() });
  return doc ? fromOrderDoc(doc) : null;
}

export async function getOrders(db: Db, ids: string[]): Promise<Order[]> {
  if (ids.length === 0) return [];
  const docs = await cols(db).orders.find({ _id: { $in: ids } }).toArray();
  return docs.map(fromOrderDoc);
}

export function buildOrderQuery(filter: OrderListFilter): Filter<OrderDoc> {
  const query: Filter<OrderDoc> = {};
  const and: Filter<OrderDoc>[] = [];
  if (filter.status?.length) query.status = { $in: filter.status };
  if (filter.paymentStatus?.length) query["payment.status"] = { $in: filter.paymentStatus };
  if (filter.deliveryMethod?.length) query["delivery.method"] = { $in: filter.deliveryMethod };
  if (filter.source?.length) query.source = { $in: filter.source };
  if (filter.supplierId) query["lines.supplierId"] = filter.supplierId;
  if (filter.assigneeId) query.assigneeId = filter.assigneeId === "none" ? { $exists: false } : filter.assigneeId;
  if (filter.customerId) query["customer.customerId"] = filter.customerId;
  if (filter.tag) query.tags = filter.tag;
  const range = dateRange(filter.from, filter.to);
  if (range) query.createdAt = range;
  if (filter.needsSourcing) {
    and.push({ status: { $in: OPEN_ORDER_STATUSES } });
    and.push({ lines: { $elemMatch: { fulfillment: "pending", purchaseOrderId: { $exists: false } } } });
  }
  if (filter.q?.trim()) {
    const q = filter.q.trim();
    const digits = q.replace(/\D/g, "");
    const or: Filter<OrderDoc>[] = [{ search: containsRegex(q) }];
    if (digits.length >= 4) or.push({ customerPhone: new RegExp(digits) });
    and.push({ $or: or });
  }
  if (and.length) query.$and = and;
  return query;
}

function orderSort(sort: OrderListFilter["sort"]): Sort {
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

export async function listOrders(db: Db, filter: OrderListFilter, paging: Paging): Promise<Page<Order>> {
  return paginate(cols(db).orders, buildOrderQuery(filter), orderSort(filter.sort), paging, fromOrderDoc);
}

/** Every matching order, newest first — for exports and bulk actions (capped) */
export async function findOrders(db: Db, filter: OrderListFilter, limit = 5000): Promise<Order[]> {
  const docs = await cols(db).orders.find(buildOrderQuery(filter)).sort(orderSort(filter.sort)).limit(limit).toArray();
  return docs.map(fromOrderDoc);
}

export async function countOrders(db: Db, filter: OrderListFilter): Promise<number> {
  return cols(db).orders.countDocuments(buildOrderQuery(filter));
}

export async function listOrdersByCustomer(db: Db, customerId: string, limit = 50): Promise<Order[]> {
  const docs = await cols(db)
    .orders.find({ "customer.customerId": customerId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(fromOrderDoc);
}

export async function listOrdersByPhone(db: Db, phone: string, limit = 50): Promise<Order[]> {
  const docs = await cols(db)
    .orders.find({ customerPhone: normalizePhone(phone) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(fromOrderDoc);
}

/** Orders with a tracking number whose parcel may still be on its way (periodic status refresh) */
export async function listOrdersAwaitingDelivery(db: Db, limit = 60): Promise<Order[]> {
  const docs = await cols(db)
    .orders.find({
      "delivery.trackingNumber": { $type: "string", $ne: "" },
      status: { $in: ["new", "confirmed", "sourcing", "on_hold", "in_transit"] },
    })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .toArray();
  return docs.map(fromOrderDoc);
}

export async function listOrdersForPurchaseOrder(db: Db, purchaseOrderId: string): Promise<Order[]> {
  const docs = await cols(db).orders.find({ "lines.purchaseOrderId": purchaseOrderId }).toArray();
  return docs.map(fromOrderDoc);
}

// ── update ──────────────────────────────────────────────────

export interface OrderEventInput {
  type: OrderEventType;
  text: string;
  data?: Record<string, unknown>;
  /** Backdate the event (seed) */
  at?: string;
}

/**
 * Applies a patch, recomputes totals and the search field, stores the document and records
 * an optional timeline event. Keys set to `undefined` are removed from the order.
 * `patch.updatedAt` is honoured when given (seed), otherwise set to now.
 */
export async function updateOrder(
  db: Db,
  id: string,
  patch: Partial<Order>,
  actor: Actor,
  event?: OrderEventInput,
): Promise<Order> {
  const current = await getOrder(db, id);
  if (!current) throw new Error("Замовлення не знайдено.");
  const merged: Order = {
    ...current,
    ...patch,
    id: current.id,
    number: current.number,
    updatedAt: patch.updatedAt ?? nowIso(),
  };
  const totals = computeTotals(merged.lines, merged.delivery, merged.orderDiscount);
  const next = compact({ ...merged, ...totals }) as Order;
  await cols(db).orders.replaceOne({ _id: id }, toOrderDoc(next));
  if (event) await addOrderEvent(db, id, event.type, actor, event.text, event.data, { at: event.at ?? merged.updatedAt });
  // Customer aggregates (ordersCount / totalSpent) depend on the order's status and total, so
  // recompute whenever either changed — editing lines/discounts moves the total without a status change.
  const statusChanged = Boolean(patch.status && patch.status !== current.status);
  if ((statusChanged || next.total !== current.total) && next.customer.customerId) {
    await recomputeStats(db, next.customer.customerId);
  }
  return next;
}

export async function changeOrderStatus(
  db: Db,
  id: string,
  to: OrderStatus,
  actor: Actor,
  options: TransitionOptions = {},
): Promise<Order> {
  const current = await getOrder(db, id);
  if (!current) throw new Error("Замовлення не знайдено.");
  // Automation (parcel tracking, drop-shipping) may already have moved the order: a repeat is a no-op
  if (current.status === to) return current;
  const patch = applyTransition(current, to, options);
  const text =
    `${orderStatusMeta[current.status].label} → ${orderStatusMeta[to].label}` +
    (to === "cancelled" && options.reason ? `: ${options.reason}` : "");
  return updateOrder(db, id, patch, actor, {
    type: "status_changed",
    text,
    data: { from: current.status, to },
    at: options.now,
  });
}

/** Marks lines as ordered from a supplier and moves a confirmed order to "sourcing" */
export async function markLinesOrdered(
  db: Db,
  orderId: string,
  lineIds: string[],
  info: { purchaseOrderId: string; purchaseOrderNumber: string; supplierId: string; costs?: Record<string, number> },
  actor: Actor,
): Promise<Order> {
  const current = await getOrder(db, orderId);
  if (!current) throw new Error("Замовлення не знайдено.");
  const ids = new Set(lineIds);
  const lines = current.lines.map((line) =>
    ids.has(line.id)
      ? compact({
          ...line,
          fulfillment: "ordered" as LineFulfillment,
          purchaseOrderId: info.purchaseOrderId,
          supplierId: info.supplierId,
          costPrice: info.costs?.[line.id] ?? line.costPrice,
        })
      : line,
  );
  const patch: Partial<Order> = { lines };
  if (current.status === "confirmed") patch.status = "sourcing";
  return updateOrder(db, orderId, patch, actor, {
    type: "po_created",
    text: `Створено закупівлю ${info.purchaseOrderNumber} (${lines.filter((l) => ids.has(l.id)).length} поз.)`,
    data: { purchaseOrderId: info.purchaseOrderId },
  });
}

/** Updates the fulfillment of the lines that belong to a purchase order */
export async function setLinesFulfillmentByPurchaseOrder(
  db: Db,
  purchaseOrderId: string,
  fulfillment: LineFulfillment,
  actor: Actor,
  text: string,
  options: { detach?: boolean } = {},
): Promise<Order[]> {
  const orders = await listOrdersForPurchaseOrder(db, purchaseOrderId);
  const updated: Order[] = [];
  for (const order of orders) {
    const lines = order.lines.map((line) => {
      if (line.purchaseOrderId !== purchaseOrderId) return line;
      const next = { ...line, fulfillment };
      if (options.detach) {
        delete next.purchaseOrderId;
      }
      return next;
    });
    updated.push(await updateOrder(db, order.id, { lines }, actor, { type: "po_updated", text, data: { purchaseOrderId } }));
  }
  return updated;
}

// ── aggregates ──────────────────────────────────────────────

export type StatusCounts = Record<OrderStatus, { count: number; total: number }>;

export async function countOrdersByStatus(db: Db): Promise<StatusCounts> {
  const rows = await cols(db)
    .orders.aggregate<{ _id: OrderStatus; count: number; total: number }>([
      { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: "$total" } } },
    ])
    .toArray();
  const out = {} as StatusCounts;
  for (const status of Object.keys(orderStatusMeta) as OrderStatus[]) out[status] = { count: 0, total: 0 };
  for (const row of rows) out[row._id] = { count: row.count, total: row.total };
  return out;
}

export interface DaySales {
  /** YYYY-MM-DD */
  day: string;
  orders: number;
  revenue: number;
  margin: number;
}

/** Orders per calendar day (Europe/Kyiv) for the last N days (revenue statuses only), zero-filled */
export async function salesByDay(db: Db, days: number): Promise<DaySales[]> {
  const since = daysAgoIso(days - 1);
  const rows = await cols(db)
    .orders.aggregate<{ _id: string; orders: number; revenue: number; margin: number }>([
      { $match: { createdAt: { $gte: since }, status: { $in: REVENUE_ORDER_STATUSES } } },
      {
        $group: {
          // Stamp each order by its Kyiv calendar day, so the buckets line up with how the dates are
          // displayed (and with the Kyiv-anchored `since` boundary) rather than by the UTC day.
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $dateFromString: { dateString: "$createdAt" } },
              timezone: "Europe/Kyiv",
            },
          },
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
          margin: { $sum: { $cond: ["$marginKnown", "$margin", 0] } },
        },
      },
    ])
    .toArray();
  const byDay = new Map(rows.map((r) => [r._id, r]));
  const out: DaySales[] = [];
  const [ty, tm, td] = kyivToday();
  for (let i = days - 1; i >= 0; i--) {
    // Pure calendar arithmetic (UTC midnight read back as a date), so each label is a Kyiv calendar
    // day that matches the group keys above.
    const day = new Date(Date.UTC(ty, tm - 1, td - i)).toISOString().slice(0, 10);
    const row = byDay.get(day);
    out.push({ day, orders: row?.orders ?? 0, revenue: row?.revenue ?? 0, margin: row?.margin ?? 0 });
  }
  return out;
}

export interface TopProduct {
  productId: string | null;
  sku: string;
  name: string;
  qty: number;
  revenue: number;
}

export async function topProducts(db: Db, days: number, limit = 10): Promise<TopProduct[]> {
  const since = daysAgoIso(days - 1);
  return cols(db)
    .orders.aggregate<TopProduct>([
      { $match: { createdAt: { $gte: since }, status: { $in: REVENUE_ORDER_STATUSES } } },
      { $unwind: "$lines" },
      { $match: { "lines.fulfillment": { $ne: "cancelled" } } },
      {
        $group: {
          _id: "$lines.sku",
          productId: { $first: "$lines.productId" },
          name: { $first: "$lines.name" },
          qty: { $sum: "$lines.qty" },
          revenue: { $sum: { $subtract: [{ $multiply: ["$lines.price", "$lines.qty"] }, "$lines.discount"] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      { $project: { _id: 0, sku: "$_id", productId: 1, name: 1, qty: 1, revenue: 1 } },
    ])
    .toArray();
}

export interface PeriodSummary {
  orders: number;
  revenue: number;
  margin: number;
  marginKnownRevenue: number;
  averageOrder: number;
}

export async function summarizePeriod(db: Db, fromIso: string, toIso?: string): Promise<PeriodSummary> {
  const createdAt: { $gte: string; $lt?: string } = { $gte: fromIso };
  if (toIso) createdAt.$lt = toIso;
  const [row] = await cols(db)
    .orders.aggregate<{ orders: number; revenue: number; margin: number; knownRevenue: number }>([
      { $match: { createdAt, status: { $in: REVENUE_ORDER_STATUSES } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
          margin: { $sum: { $cond: ["$marginKnown", "$margin", 0] } },
          knownRevenue: { $sum: { $cond: ["$marginKnown", "$total", 0] } },
        },
      },
    ])
    .toArray();
  const orders = row?.orders ?? 0;
  const revenue = row?.revenue ?? 0;
  return {
    orders,
    revenue,
    margin: row?.margin ?? 0,
    marginKnownRevenue: row?.knownRevenue ?? 0,
    averageOrder: orders > 0 ? Math.round(revenue / orders) : 0,
  };
}
