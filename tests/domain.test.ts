import { describe, expect, it } from "vitest";
import { parseCsv, parseNumber, toCsv } from "@/lib/admin/domain/csv";
import { computeTotals, marginPercent, priceFromCost } from "@/lib/admin/domain/money";
import { dateStamp, formatOrderNumber, formatPurchaseOrderNumber, ORDER_NUMBER_RE } from "@/lib/admin/domain/numbering";
import { applyTransition, canTransition, linesAwaitingPurchase, suggestNextStep, TransitionError } from "@/lib/admin/domain/order-status";
import { renderTemplate, templateVariables } from "@/lib/admin/domain/templates";
import { can } from "@/lib/admin/permissions";
import type { Order, OrderLine } from "@/lib/admin/types";

function line(over: Partial<OrderLine> = {}): OrderLine {
  return {
    id: over.id ?? "l1",
    productId: "p1",
    sku: "SKU-1",
    name: "Гальмівні колодки",
    price: 1000,
    qty: 2,
    discount: 0,
    fulfillment: "pending",
    ...over,
  };
}

function order(over: Partial<Order> = {}): Order {
  const lines = over.lines ?? [line()];
  const totals = computeTotals(lines, over.delivery, over.orderDiscount ?? 0);
  return {
    id: "o1",
    number: "AF-261005-1000",
    status: "new",
    source: "website",
    customer: { firstName: "Андрій", lastName: "Коваленко", phone: "380971234567" },
    delivery: { method: "np_branch", city: "Київ", address: "відділення 12" },
    payment: { method: "cod", status: "unpaid", paidAmount: 0 },
    lines,
    orderDiscount: 0,
    doNotCall: false,
    tags: [],
    createdAt: "2026-10-05T10:00:00.000Z",
    updatedAt: "2026-10-05T10:00:00.000Z",
    ...totals,
    ...over,
  };
}

describe("money", () => {
  it("computes totals, discounts and margin", () => {
    const totals = computeTotals(
      [line({ costPrice: 600 }), line({ id: "l2", price: 500, qty: 1, discount: 50, costPrice: 300 })],
      { cost: 80, costPayer: "shop" },
      100,
    );
    expect(totals.subtotal).toBe(2500);
    expect(totals.discount).toBe(150);
    expect(totals.total).toBe(2350);
    expect(totals.costTotal).toBe(1500);
    expect(totals.margin).toBe(2350 - 1500 - 80);
    expect(totals.marginKnown).toBe(true);
  });

  it("ignores cancelled lines and flags unknown cost", () => {
    const totals = computeTotals([line({ costPrice: 600 }), line({ id: "l2", fulfillment: "cancelled", price: 9999 }), line({ id: "l3" })], undefined);
    expect(totals.subtotal).toBe(4000);
    expect(totals.marginKnown).toBe(false);
    expect(totals.costTotal).toBe(1200);
  });

  it("derives margin percent and rounds suggested prices", () => {
    expect(marginPercent({ total: 2000, margin: 500, marginKnown: true })).toBe(25);
    expect(marginPercent({ total: 2000, margin: 500, marginKnown: false })).toBeNull();
    expect(priceFromCost(80, 25)).toBe(100);
    expect(priceFromCost(333, 25)).toBe(420);
    expect(priceFromCost(1234, 25)).toBe(1550);
  });
});

describe("order status machine", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition("new", "confirmed")).toBe(true);
    expect(canTransition("new", "delivered")).toBe(false);
    expect(canTransition("in_transit", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "new")).toBe(true);
    expect(canTransition("returned", "new")).toBe(false);
  });

  it("requires a reason to cancel and cancels pending lines", () => {
    const o = order({ lines: [line(), line({ id: "l2", fulfillment: "shipped" })] });
    expect(() => applyTransition(o, "cancelled")).toThrow(TransitionError);
    const patch = applyTransition(o, "cancelled", { reason: "Передумав", now: "2026-10-06T00:00:00.000Z" });
    expect(patch.cancelReason).toBe("Передумав");
    expect(patch.lines?.map((l) => l.fulfillment)).toEqual(["cancelled", "shipped"]);
    expect(patch.cancelledAt).toBe("2026-10-06T00:00:00.000Z");
  });

  it("marks COD payment on completion when asked", () => {
    const o = order({ status: "delivered" });
    const patch = applyTransition(o, "completed", { markPaid: true, now: "2026-10-07T00:00:00.000Z" });
    expect(patch.payment?.status).toBe("paid");
    expect(patch.payment?.paidAmount).toBe(o.total);
    expect(patch.completedAt).toBe("2026-10-07T00:00:00.000Z");
  });

  it("suggests the next step", () => {
    expect(suggestNextStep(order())?.status).toBe("confirmed");
    expect(suggestNextStep(order({ status: "confirmed" }))).toBeNull();
    expect(suggestNextStep(order({ status: "sourcing", lines: [line({ fulfillment: "shipped" })] }))?.status).toBe("in_transit");
    expect(suggestNextStep(order({ status: "in_transit" }))?.status).toBe("delivered");
    expect(linesAwaitingPurchase([line(), line({ id: "l2", purchaseOrderId: "po" })])).toHaveLength(1);
  });
});

describe("numbering", () => {
  it("formats order and purchase order numbers", () => {
    const stamp = dateStamp(new Date(2026, 9, 5));
    expect(stamp).toBe("261005");
    expect(formatOrderNumber(stamp, 1)).toBe("AF-261005-1000");
    expect(formatOrderNumber(stamp, 42)).toBe("AF-261005-1041");
    expect(ORDER_NUMBER_RE.test(formatOrderNumber(stamp, 1))).toBe(true);
    expect(formatPurchaseOrderNumber(stamp, 3)).toBe("PO-261005-03");
  });
});

describe("csv", () => {
  it("round-trips quoted values with the ; separator", () => {
    const csv = toCsv(
      [
        { key: "sku", header: "Артикул" },
        { key: "name", header: "Назва" },
      ],
      [{ sku: "A;1", name: 'Колодки "передні"' }],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(["артикул", "назва"]);
    expect(parsed.rows[0]).toEqual({ артикул: "A;1", назва: 'Колодки "передні"' });
  });

  it("detects comma separators and parses localised numbers", () => {
    const parsed = parseCsv("sku,cost\nX1,\"1 234,50\"\nX2,99\n\n");
    expect(parsed.rows).toHaveLength(2);
    expect(parseNumber(parsed.rows[0].cost)).toBe(1234.5);
    expect(parseNumber(parsed.rows[1].cost)).toBe(99);
    expect(Number.isNaN(parseNumber("abc"))).toBe(true);
  });
});

describe("templates", () => {
  it("renders order placeholders and leaves unknown ones", () => {
    const vars = templateVariables(order({ delivery: { method: "np_branch", city: "Львів", address: "відділення 5", trackingNumber: "20450000000001" } }));
    expect(renderTemplate("{{name}}, ТТН {{ttn}} → {{city}} {{unknown}}", vars)).toBe("Андрій, ТТН 20450000000001 → Львів {{unknown}}");
    expect(vars.items).toContain("Гальмівні колодки — 2 шт");
  });
});

describe("permissions", () => {
  it("applies the role matrix", () => {
    expect(can({ role: "viewer" }, "orders:read")).toBe(true);
    expect(can({ role: "viewer" }, "orders:write")).toBe(false);
    expect(can({ role: "manager" }, "orders:write")).toBe(true);
    expect(can({ role: "manager" }, "users:write")).toBe(false);
    expect(can({ role: "owner" }, "users:write")).toBe(true);
    expect(can({ role: "owner", active: false }, "orders:read")).toBe(false);
    expect(can(null, "orders:read")).toBe(false);
  });
});
