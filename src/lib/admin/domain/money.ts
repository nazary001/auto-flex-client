import type { Order, OrderDelivery, OrderLine } from "../types";

/*
 * Money helpers. All amounts are integer UAH; rounding happens once, at the end of a
 * calculation, with Math.round.
 */

export interface OrderTotals {
  subtotal: number;
  discount: number;
  total: number;
  costTotal: number;
  margin: number;
  marginKnown: boolean;
}

export function lineTotal(line: Pick<OrderLine, "price" | "qty" | "discount">): number {
  return Math.max(0, Math.round(line.price * line.qty - (line.discount ?? 0)));
}

export function isActiveLine(line: Pick<OrderLine, "fulfillment">): boolean {
  return line.fulfillment !== "cancelled";
}

/**
 * Recomputes the money fields of an order from its lines. `orderDiscount` is an extra
 * discount on top of the per-line ones; it is included in `discount`.
 */
export function computeTotals(
  lines: OrderLine[],
  delivery: Pick<OrderDelivery, "cost" | "costPayer"> | undefined,
  orderDiscount = 0,
): OrderTotals {
  const active = lines.filter(isActiveLine);
  const subtotal = active.reduce((sum, line) => sum + line.price * line.qty, 0);
  const lineDiscounts = active.reduce((sum, line) => sum + (line.discount ?? 0), 0);
  const discount = Math.min(subtotal, Math.max(0, lineDiscounts + Math.max(0, orderDiscount)));
  const total = Math.max(0, Math.round(subtotal - discount));

  let costTotal = 0;
  let marginKnown = active.length > 0;
  for (const line of active) {
    if (typeof line.costPrice === "number" && Number.isFinite(line.costPrice)) costTotal += line.costPrice * line.qty;
    else marginKnown = false;
  }
  const shopDelivery = delivery?.costPayer === "shop" ? (delivery.cost ?? 0) : 0;
  const margin = Math.round(total - costTotal - shopDelivery);

  return { subtotal: Math.round(subtotal), discount: Math.round(discount), total, costTotal: Math.round(costTotal), margin, marginKnown };
}

export function withTotals<T extends Pick<Order, "lines" | "delivery" | "orderDiscount">>(order: T): T & OrderTotals {
  return { ...order, ...computeTotals(order.lines, order.delivery, order.orderDiscount) };
}

/** Margin as a percentage of total, null when unknown or total is 0 */
export function marginPercent(order: Pick<Order, "total" | "margin" | "marginKnown">): number | null {
  if (!order.marginKnown || order.total <= 0) return null;
  return Math.round((order.margin / order.total) * 1000) / 10;
}

/** Suggested sale price from a cost and a markup percentage, rounded to a "nice" number */
export function priceFromCost(cost: number, markupPercent: number): number {
  const raw = cost * (1 + markupPercent / 100);
  if (raw < 100) return Math.ceil(raw);
  if (raw < 1000) return Math.ceil(raw / 5) * 5;
  return Math.ceil(raw / 10) * 10;
}
