import type { Order, OrderLine, OrderStatus } from "../types";

/*
 * Order lifecycle of a dropshipping shop:
 *
 *   new → confirmed → sourcing → in_transit → delivered → completed
 *     ↘ on_hold ↗                      ↘ returned
 *     ↘ cancelled (reopen → new)
 *
 * The happy path is what the automation follows (purchase orders and parcel tracking move the
 * order forward, see src/lib/server/orders/tracking.ts). A manager may also step back, skip a
 * stage, cancel before completion or reopen a closed order — the table below only rules out
 * moves that make no sense (e.g. "new" straight to "delivered").
 */

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "sourcing", "in_transit", "on_hold", "cancelled"],
  confirmed: ["new", "sourcing", "in_transit", "delivered", "on_hold", "cancelled"],
  sourcing: ["confirmed", "in_transit", "delivered", "on_hold", "cancelled"],
  in_transit: ["confirmed", "sourcing", "delivered", "completed", "on_hold", "returned", "cancelled"],
  delivered: ["in_transit", "completed", "returned", "cancelled"],
  completed: ["delivered", "returned"],
  on_hold: ["new", "confirmed", "sourcing", "in_transit", "cancelled"],
  cancelled: ["new", "confirmed"],
  returned: ["new", "delivered", "completed"],
};

export const TERMINAL_STATUSES: OrderStatus[] = ["completed", "cancelled", "returned"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[from] ?? [];
}

export interface TransitionOptions {
  /** Required when moving to "cancelled" */
  reason?: string;
  /** For COD orders moving to "completed": mark the payment as received */
  markPaid?: boolean;
  now?: string;
}

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

/**
 * Returns the fields to patch on the order for a status change (the repository persists them
 * and records the event). Throws TransitionError when the move is not allowed.
 */
export function applyTransition(order: Order, to: OrderStatus, options: TransitionOptions = {}): Partial<Order> {
  const from = order.status;
  if (from === to) throw new TransitionError("Замовлення вже має цей статус.");
  if (!canTransition(from, to)) {
    throw new TransitionError("Такий перехід статусу неможливий.");
  }
  const now = options.now ?? new Date().toISOString();
  const patch: Partial<Order> = { status: to, updatedAt: now };

  switch (to) {
    case "confirmed":
      patch.confirmedAt = order.confirmedAt ?? now;
      break;
    case "in_transit":
      patch.shippedAt = order.shippedAt ?? now;
      patch.delivery = { ...order.delivery, shippedAt: order.delivery.shippedAt ?? now };
      patch.lines = order.lines.map((line) =>
        line.fulfillment === "pending" || line.fulfillment === "ordered" ? { ...line, fulfillment: "shipped" } : line,
      );
      break;
    case "delivered":
      patch.delivery = { ...order.delivery, deliveredAt: order.delivery.deliveredAt ?? now };
      patch.lines = order.lines.map((line) =>
        line.fulfillment === "shipped" || line.fulfillment === "ordered" || line.fulfillment === "pending"
          ? { ...line, fulfillment: "delivered" }
          : line,
      );
      break;
    case "completed":
      patch.completedAt = now;
      if (options.markPaid && order.payment.status !== "paid") {
        patch.payment = { ...order.payment, status: "paid", paidAmount: order.total, paidAt: now };
      }
      break;
    case "cancelled": {
      const reason = options.reason?.trim();
      if (!reason) throw new TransitionError("Вкажіть причину скасування.");
      patch.cancelReason = reason;
      patch.cancelledAt = now;
      patch.lines = order.lines.map((line) =>
        line.fulfillment === "pending" || line.fulfillment === "ordered" ? { ...line, fulfillment: "cancelled" } : line,
      );
      break;
    }
    case "new":
      // Reopening a cancelled / returned order: lines go back to awaiting purchase
      if (from === "cancelled" || from === "returned") {
        patch.cancelReason = undefined;
        patch.cancelledAt = undefined;
        patch.lines = order.lines.map((line) =>
          line.fulfillment === "cancelled" || line.fulfillment === "shipped" || line.fulfillment === "delivered"
            ? { ...line, fulfillment: "pending" }
            : line,
        );
      }
      break;
    default:
      break;
  }
  return patch;
}

/** Lines that still need a purchase order */
export function linesAwaitingPurchase(lines: OrderLine[]): OrderLine[] {
  return lines.filter((line) => line.fulfillment === "pending" && !line.purchaseOrderId);
}

/** What the UI should propose next for an order in its current state */
export function suggestNextStep(order: Order): { status: OrderStatus; label: string } | null {
  switch (order.status) {
    case "new":
      return { status: "confirmed", label: "Підтвердити замовлення" };
    case "confirmed":
      return linesAwaitingPurchase(order.lines).length > 0
        ? null
        : { status: "in_transit", label: "Позначити відправленим" };
    case "sourcing": {
      const active = order.lines.filter((line) => line.fulfillment !== "cancelled");
      const allShipped =
        active.length > 0 && active.every((line) => line.fulfillment === "shipped" || line.fulfillment === "delivered");
      return allShipped ? { status: "in_transit", label: "Позначити відправленим" } : null;
    }
    case "in_transit":
      return { status: "delivered", label: "Позначити доставленим" };
    case "delivered":
      return { status: "completed", label: "Закрити замовлення" };
    default:
      return null;
  }
}
