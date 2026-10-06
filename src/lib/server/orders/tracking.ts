import type { Db } from "mongodb";
import { canTransition } from "@/lib/admin/domain/order-status";
import type { Actor, Order, OrderStatus, TrackingSnapshot } from "@/lib/admin/types";
import { SYSTEM_ACTOR } from "@/lib/admin/types";
import { changeOrderStatus, listOrdersAwaitingDelivery, updateOrder } from "@/lib/server/db/repos/orders";
import { getSettings } from "@/lib/server/db/repos/settings";
import { compact, nowIso } from "@/lib/server/db/util";
import { isTrackingNumber, trackDocument, trackingStage, type TrackingResult } from "@/lib/server/nova-poshta";

/*
 * Parcel tracking keeps the order status honest on its own:
 *
 *   a tracking number appears (manager or drop-shipping supplier)  → "in_transit"
 *   Nova Poshta reports the parcel moving / waiting at the branch   → "in_transit"
 *   Nova Poshta reports a hand-over to the buyer                    → "delivered"
 *
 * Snapshots are refreshed when a manager opens the order, when the buyer opens the cabinet,
 * by the daily cron and on demand («Перевірити»). Carrier errors never throw out of here.
 */

export const TRACKING_MAX_AGE_MS = 15 * 60 * 1000;

const CLOSED: OrderStatus[] = ["delivered", "completed", "cancelled", "returned"];

/** The next step on the happy path towards a shipped / delivered order */
const NEXT_TOWARDS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "confirmed",
  on_hold: "confirmed",
  confirmed: "in_transit",
  sourcing: "in_transit",
  in_transit: "delivered",
};
const RANK: Partial<Record<OrderStatus, number>> = { new: 0, on_hold: 0, confirmed: 1, sourcing: 1, in_transit: 2, delivered: 3 };

/** Orders whose Nova Poshta parcel can still move */
export function trackingEligible(order: Order): boolean {
  const ttn = order.delivery.trackingNumber;
  if (!ttn || !isTrackingNumber(ttn)) return false;
  if ((order.delivery.carrier ?? "nova_poshta") !== "nova_poshta") return false;
  return !CLOSED.includes(order.status);
}

export function trackingStale(order: Order, maxAgeMs = TRACKING_MAX_AGE_MS, now = Date.now()): boolean {
  const checkedAt = order.delivery.tracking?.checkedAt;
  if (!checkedAt) return true;
  const at = Date.parse(checkedAt);
  return Number.isNaN(at) || now - at > maxAgeMs;
}

export function toTrackingSnapshot(result: TrackingResult, checkedAt = nowIso()): TrackingSnapshot {
  return compact({
    status: result.status,
    statusCode: result.statusCode,
    checkedAt,
    scheduledDeliveryDate: result.scheduledDeliveryDate,
    warehouse: result.warehouseRecipient,
    receivedAt: result.recipientDateTime,
  }) as TrackingSnapshot;
}

/** Moves the order forward along the delivery path, one allowed step at a time; closed orders and backwards moves are never touched */
export async function advanceOrderTo(
  db: Db,
  order: Order,
  target: "in_transit" | "delivered",
  actor: Actor = SYSTEM_ACTOR,
): Promise<Order> {
  let current = order;
  for (let guard = 0; guard < 4; guard++) {
    if (current.status === target || CLOSED.includes(current.status)) break;
    if ((RANK[current.status] ?? Number.POSITIVE_INFINITY) >= (RANK[target] ?? 0)) break;
    const step = NEXT_TOWARDS[current.status];
    if (!step || !canTransition(current.status, step)) break;
    current = await changeOrderStatus(db, current.id, step, actor);
  }
  return current;
}

/** Stores the carrier's answer on the order and moves the status along; returns the fresh order */
export async function applyTrackingResult(db: Db, order: Order, result: TrackingResult, actor: Actor = SYSTEM_ACTOR): Promise<Order> {
  const snapshot = toTrackingSnapshot(result);
  const before = order.delivery.tracking;
  const changed = before?.statusCode !== snapshot.statusCode || before?.status !== snapshot.status;
  let next = await updateOrder(
    db,
    order.id,
    { delivery: { ...order.delivery, tracking: snapshot } },
    actor,
    changed ? { type: "tracking_checked", text: `Статус посилки: ${result.status}`, data: { statusCode: result.statusCode } } : undefined,
  );
  const stage = trackingStage(result.statusCode);
  if (result.delivered) next = await advanceOrderTo(db, next, "delivered", actor);
  else if (stage === "in_transit" || stage === "awaiting_pickup") next = await advanceOrderTo(db, next, "in_transit", actor);
  return next;
}

export interface RefreshOptions {
  actor?: Actor;
  apiKey?: string;
  /** Ask the carrier even when the snapshot is fresh */
  force?: boolean;
  maxAgeMs?: number;
  timeoutMs?: number;
}

export interface RefreshOutcome {
  order: Order;
  refreshed: boolean;
  error?: string;
}

/** Asks Nova Poshta about one order's parcel (when due) and applies the answer; never throws */
export async function refreshOrderTracking(db: Db, order: Order, options: RefreshOptions = {}): Promise<RefreshOutcome> {
  if (!trackingEligible(order)) return { order, refreshed: false };
  if (!options.force && !trackingStale(order, options.maxAgeMs)) return { order, refreshed: false };
  let result: TrackingResult;
  try {
    result = await trackDocument(order.delivery.trackingNumber!, { apiKey: options.apiKey, timeoutMs: options.timeoutMs });
  } catch (error) {
    return { order, refreshed: false, error: error instanceof Error ? error.message : String(error) };
  }
  try {
    return { order: await applyTrackingResult(db, order, result, options.actor), refreshed: true };
  } catch (error) {
    console.error("[AutoFlex] Не вдалося зберегти статус посилки", error);
    return { order, refreshed: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function novaPoshtaApiKey(db: Db): Promise<string | undefined> {
  try {
    return (await getSettings(db)).novaPoshta.apiKey || undefined;
  } catch {
    return undefined;
  }
}

/** Refreshes the stale parcels of a list (at most `limit` carrier calls) and returns the list with fresh copies */
export async function refreshStaleTracking(
  db: Db,
  orders: Order[],
  options: { limit?: number; maxAgeMs?: number; timeoutMs?: number; actor?: Actor } = {},
): Promise<Order[]> {
  const candidates = orders.filter((o) => trackingEligible(o) && trackingStale(o, options.maxAgeMs)).slice(0, options.limit ?? 3);
  if (candidates.length === 0) return orders;
  const apiKey = await novaPoshtaApiKey(db);
  const fresh = new Map<string, Order>();
  await Promise.all(
    candidates.map(async (order) => {
      const outcome = await refreshOrderTracking(db, order, { ...options, apiKey });
      fresh.set(order.id, outcome.order);
    }),
  );
  return orders.map((order) => fresh.get(order.id) ?? order);
}

/** Periodic sweep (cron): every parcel still on its way, a few carrier calls at a time */
export async function refreshAwaitingDeliveries(
  db: Db,
  options: { limit?: number; timeoutMs?: number } = {},
): Promise<{ checked: number; refreshed: number; failed: number }> {
  const orders = (await listOrdersAwaitingDelivery(db, options.limit ?? 60)).filter(trackingEligible);
  const apiKey = await novaPoshtaApiKey(db);
  let refreshed = 0;
  let failed = 0;
  for (let i = 0; i < orders.length; i += 5) {
    await Promise.all(
      orders.slice(i, i + 5).map(async (order) => {
        const outcome = await refreshOrderTracking(db, order, { apiKey, force: true, timeoutMs: options.timeoutMs ?? 8000 });
        if (outcome.refreshed) refreshed++;
        else if (outcome.error) failed++;
      }),
    );
  }
  return { checked: orders.length, refreshed, failed };
}
