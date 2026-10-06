import type { Db, Filter } from "mongodb";
import { purchaseOrderStatusMeta } from "@/lib/admin/labels";
import { dateStamp, formatPurchaseOrderNumber, purchaseOrderCounterKey } from "@/lib/admin/domain/numbering";
import type {
  Actor,
  Page,
  Paging,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderListFilter,
  PurchaseOrderStatus,
} from "@/lib/admin/types";
import { cols, type PurchaseOrderDoc } from "../collections";
import { compact, containsRegex, dateRange, fromDoc, newId, nextSequence, nowIso, paginate, toDoc } from "../util";
import { isTrackingNumber } from "@/lib/server/nova-poshta";
import { advanceOrderTo } from "@/lib/server/orders/tracking";
import { getOrders, markLinesOrdered, setLinesFulfillmentByPurchaseOrder, updateOrder } from "./orders";
import { getSupplier } from "./suppliers";

/*
 * Purchase orders group lines of one or many customer orders for one supplier. Creating one
 * marks those lines as "ordered"; status changes move the lines along (shipped → delivered).
 */

const toPo = (doc: PurchaseOrderDoc): PurchaseOrder => fromDoc<PurchaseOrder>(doc);

export const PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ["sent", "confirmed", "cancelled"],
  sent: ["draft", "confirmed", "shipped", "received", "cancelled"],
  confirmed: ["sent", "shipped", "received", "cancelled"],
  shipped: ["confirmed", "received", "cancelled"],
  received: ["shipped"],
  cancelled: ["draft"],
};

export function canTransitionPo(from: PurchaseOrderStatus, to: PurchaseOrderStatus): boolean {
  return PO_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  /** Lines to source, taken from one or many orders */
  lines: Array<{ orderId: string; orderLineId: string; cost?: number; qty?: number }>;
  shipDirect?: boolean;
  notes?: string;
  expectedAt?: string;
  supplierRef?: string;
  status?: PurchaseOrderStatus;
}

export async function createPurchaseOrder(
  db: Db,
  input: CreatePurchaseOrderInput,
  actor: Actor,
  options: { createdAt?: string } = {},
): Promise<PurchaseOrder> {
  const supplier = await getSupplier(db, input.supplierId);
  if (!supplier) throw new Error("Постачальника не знайдено.");
  const orderIds = [...new Set(input.lines.map((l) => l.orderId))];
  const orders = await getOrders(db, orderIds);
  const orderById = new Map(orders.map((o) => [o.id, o]));

  const lines: PurchaseOrderLine[] = [];
  for (const wanted of input.lines) {
    const order = orderById.get(wanted.orderId);
    const line = order?.lines.find((l) => l.id === wanted.orderLineId);
    if (!order || !line) throw new Error("Позицію замовлення не знайдено.");
    if (line.purchaseOrderId) throw new Error(`Позиція «${line.name}» уже в закупівлі.`);
    if (line.fulfillment === "cancelled") throw new Error(`Позиція «${line.name}» скасована.`);
    lines.push({
      id: newId(),
      orderId: order.id,
      orderNumber: order.number,
      orderLineId: line.id,
      productId: line.productId,
      sku: line.sku,
      name: line.name,
      qty: Math.max(1, Math.round(wanted.qty ?? line.qty)),
      cost: Math.max(0, Math.round(wanted.cost ?? line.costPrice ?? 0)),
    });
  }
  if (lines.length === 0) throw new Error("Оберіть хоча б одну позицію.");

  const now = options.createdAt ?? nowIso();
  const stamp = dateStamp(new Date(now));
  const seq = await nextSequence(cols(db).counters, purchaseOrderCounterKey(stamp));
  const po: PurchaseOrder = compact({
    id: newId(),
    number: formatPurchaseOrderNumber(stamp, seq),
    supplierId: supplier.id,
    status: input.status ?? "draft",
    lines,
    totalCost: lines.reduce((sum, l) => sum + l.cost * l.qty, 0),
    shipDirect: input.shipDirect ?? supplier.shipsDirect,
    supplierRef: input.supplierRef?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    expectedAt: input.expectedAt,
    createdBy: actor.name,
    createdAt: now,
    updatedAt: now,
  });
  await cols(db).purchaseOrders.insertOne(toDoc(po));

  const byOrder = new Map<string, PurchaseOrderLine[]>();
  for (const line of lines) byOrder.set(line.orderId, [...(byOrder.get(line.orderId) ?? []), line]);
  for (const [orderId, poLines] of byOrder) {
    await markLinesOrdered(
      db,
      orderId,
      poLines.map((l) => l.orderLineId),
      {
        purchaseOrderId: po.id,
        purchaseOrderNumber: po.number,
        supplierId: supplier.id,
        costs: Object.fromEntries(poLines.map((l) => [l.orderLineId, l.cost])),
      },
      actor,
    );
  }
  return po;
}

export async function getPurchaseOrder(db: Db, id: string): Promise<PurchaseOrder | null> {
  const doc = await cols(db).purchaseOrders.findOne({ _id: id });
  return doc ? toPo(doc) : null;
}

export async function getPurchaseOrders(db: Db, ids: string[]): Promise<PurchaseOrder[]> {
  if (ids.length === 0) return [];
  const docs = await cols(db).purchaseOrders.find({ _id: { $in: ids } }).toArray();
  return docs.map(toPo);
}

export async function listPurchaseOrdersForOrder(db: Db, orderId: string): Promise<PurchaseOrder[]> {
  const docs = await cols(db).purchaseOrders.find({ "lines.orderId": orderId }).sort({ createdAt: -1 }).toArray();
  return docs.map(toPo);
}

export function buildPurchaseOrderQuery(filter: PurchaseOrderListFilter): Filter<PurchaseOrderDoc> {
  const query: Filter<PurchaseOrderDoc> = {};
  if (filter.status?.length) query.status = { $in: filter.status };
  if (filter.supplierId) query.supplierId = filter.supplierId;
  if (filter.orderId) query["lines.orderId"] = filter.orderId;
  const range = dateRange(filter.from, filter.to);
  if (range) query.createdAt = range;
  if (filter.q?.trim()) {
    const re = containsRegex(filter.q);
    query.$or = [
      { number: re },
      { supplierRef: re },
      { trackingNumber: re },
      { "lines.sku": re },
      { "lines.name": re },
      { "lines.orderNumber": re },
    ];
  }
  return query;
}

export async function listPurchaseOrders(
  db: Db,
  filter: PurchaseOrderListFilter,
  paging: Paging,
): Promise<Page<PurchaseOrder>> {
  return paginate(cols(db).purchaseOrders, buildPurchaseOrderQuery(filter), { createdAt: -1 }, paging, toPo);
}

export async function findPurchaseOrders(db: Db, filter: PurchaseOrderListFilter, limit = 2000): Promise<PurchaseOrder[]> {
  const docs = await cols(db)
    .purchaseOrders.find(buildPurchaseOrderQuery(filter))
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toPo);
}

export async function countPurchaseOrdersByStatus(db: Db): Promise<Record<PurchaseOrderStatus, number>> {
  const rows = await cols(db)
    .purchaseOrders.aggregate<{ _id: PurchaseOrderStatus; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }])
    .toArray();
  const out = { draft: 0, sent: 0, confirmed: 0, shipped: 0, received: 0, cancelled: 0 };
  for (const row of rows) out[row._id] = row.n;
  return out;
}

export type PurchaseOrderPatch = Partial<
  Pick<PurchaseOrder, "supplierRef" | "trackingNumber" | "expectedAt" | "notes" | "shipDirect">
> & { lines?: PurchaseOrderLine[] };

export async function updatePurchaseOrder(db: Db, id: string, patch: PurchaseOrderPatch): Promise<PurchaseOrder | null> {
  const $set: Record<string, unknown> = compact({ ...patch, updatedAt: nowIso() });
  const $unset: Record<string, ""> = {};
  for (const [key, value] of Object.entries(patch)) if (value === undefined) $unset[key] = "";
  if (patch.lines) $set.totalCost = patch.lines.reduce((sum, l) => sum + l.cost * l.qty, 0);
  const update: Record<string, unknown> = { $set };
  if (Object.keys($unset).length) update.$unset = $unset;
  const doc = await cols(db).purchaseOrders.findOneAndUpdate({ _id: id }, update, { returnDocument: "after" });
  return doc ? toPo(doc) : null;
}

/** Moves the purchase order and the lines of the linked customer orders */
export async function setPurchaseOrderStatus(
  db: Db,
  id: string,
  to: PurchaseOrderStatus,
  actor: Actor,
  extra: { trackingNumber?: string; supplierRef?: string } = {},
): Promise<PurchaseOrder> {
  const current = await getPurchaseOrder(db, id);
  if (!current) throw new Error("Закупівлю не знайдено.");
  if (current.status === to) return current;
  if (!canTransitionPo(current.status, to)) throw new Error("Такий перехід статусу закупівлі неможливий.");
  const now = nowIso();
  const $set: Record<string, unknown> = compact({
    status: to,
    updatedAt: now,
    trackingNumber: extra.trackingNumber?.trim() || undefined,
    supplierRef: extra.supplierRef?.trim() || undefined,
  });
  const stampKey = { sent: "sentAt", confirmed: "confirmedAt", shipped: "shippedAt", received: "receivedAt", cancelled: "cancelledAt" }[
    to as Exclude<PurchaseOrderStatus, "draft">
  ];
  if (stampKey) $set[stampKey] = now;
  const doc = await cols(db).purchaseOrders.findOneAndUpdate({ _id: id }, { $set }, { returnDocument: "after" });
  const updated = toPo(doc!);

  const label = `Закупівля ${updated.number}: ${purchaseOrderStatusMeta[to].label}`;
  if (to === "shipped") {
    await setLinesFulfillmentByPurchaseOrder(db, id, "shipped", actor, label);
  } else if (to === "received") {
    await setLinesFulfillmentByPurchaseOrder(db, id, updated.shipDirect ? "delivered" : "shipped", actor, label);
  } else if (to === "cancelled") {
    await setLinesFulfillmentByPurchaseOrder(db, id, "pending", actor, label, { detach: true });
  } else if (to === "draft" && current.status === "cancelled") {
    // Re-opened: lines are attached again below via markLinesOrdered semantics is not needed; keep detached state
  } else {
    await setLinesFulfillmentByPurchaseOrder(db, id, "ordered", actor, label);
  }
  if (updated.shipDirect && (to === "shipped" || to === "received")) {
    await syncDirectShipment(db, updated, to, actor);
  }
  return updated;
}

/**
 * Drop-shipping: the supplier's parcel is the buyer's parcel, so its tracking number lands on the
 * orders and they move to "in_transit" / "delivered" once every active line has left / arrived.
 */
async function syncDirectShipment(db: Db, po: PurchaseOrder, to: "shipped" | "received", actor: Actor): Promise<void> {
  const orders = await getOrders(db, [...new Set(po.lines.map((line) => line.orderId))]);
  for (const order of orders) {
    let current = order;
    if (po.trackingNumber && !current.delivery.trackingNumber) {
      const carrier = current.delivery.carrier ?? (isTrackingNumber(po.trackingNumber) ? "nova_poshta" : undefined);
      current = await updateOrder(
        db,
        current.id,
        { delivery: compact({ ...current.delivery, trackingNumber: po.trackingNumber, carrier }) },
        actor,
        {
          type: "delivery_changed",
          text: `Номер ТТН від постачальника: ${po.trackingNumber} (закупівля ${po.number})`,
          data: { purchaseOrderId: po.id },
        },
      );
    }
    const active = current.lines.filter((line) => line.fulfillment !== "cancelled");
    const allIn = (states: string[]) => active.length > 0 && active.every((line) => states.includes(line.fulfillment));
    if (to === "received" && allIn(["delivered"])) await advanceOrderTo(db, current, "delivered", actor);
    else if (allIn(["shipped", "delivered"])) await advanceOrderTo(db, current, "in_transit", actor);
  }
}

/** Purchase orders waiting at the supplier longer than its maximum lead time */
export async function listOverduePurchaseOrders(db: Db, leadDaysBySupplier: Map<string, number>): Promise<PurchaseOrder[]> {
  const docs = await cols(db).purchaseOrders.find({ status: { $in: ["sent", "confirmed"] } }).toArray();
  const now = Date.now();
  return docs.map(toPo).filter((po) => {
    const lead = leadDaysBySupplier.get(po.supplierId) ?? 5;
    const since = new Date(po.sentAt ?? po.createdAt).getTime();
    return now - since > lead * 24 * 60 * 60 * 1000;
  });
}
