import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import { SYSTEM_ACTOR } from "@/lib/admin/types";
import { getCustomerByPhone } from "@/lib/server/db/repos/customers";
import { bestOfferFor, upsertOffers } from "@/lib/server/db/repos/offers";
import {
  changeOrderStatus,
  createOrder,
  getOrder,
  listOrderEvents,
  listOrders,
  updateOrder,
} from "@/lib/server/db/repos/orders";
import { createPurchaseOrder, getPurchaseOrder, setPurchaseOrderStatus } from "@/lib/server/db/repos/purchase-orders";
import { createSupplier } from "@/lib/server/db/repos/suppliers";
import { startTestDb, stopTestDb } from "@/lib/server/db/testing";

let db: Db;
const actor = SYSTEM_ACTOR;

beforeAll(async () => {
  db = await startTestDb();
  await createSupplier(
    db,
    {
      code: "S1",
      name: "Supplier One",
      active: true,
      contacts: {},
      leadDays: [1, 2],
      shipsDirect: true,
    },
    { id: "s1" },
  );
  await createSupplier(
    db,
    { code: "S2", name: "Supplier Two", active: true, contacts: {}, leadDays: [2, 4], shipsDirect: false },
    { id: "s2" },
  );
  await upsertOffers(db, "s1", [
    { sku: "ABC-1", productId: "p1", cost: 700, availability: "in_stock" },
    { sku: "ABC-2", productId: "p2", cost: 400, availability: "on_order" },
  ]);
  await upsertOffers(db, "s2", [{ sku: "ABC 1", productId: "p1", cost: 650, availability: "none" }]);
});

afterAll(async () => {
  await stopTestDb();
});

async function newOrder(phone = "+38 (097) 123-45-67") {
  return createOrder(
    db,
    {
      source: "website",
      customer: { firstName: "Андрій", lastName: "Коваленко", phone, email: "a@example.com" },
      delivery: { method: "np_branch", city: "Київ", address: "відділення 12" },
      payment: { method: "cod" },
      lines: [
        { productId: "p1", sku: "ABC-1", name: "Колодки", price: 1200, qty: 2 },
        { productId: "p2", sku: "ABC-2", name: "Диски", price: 2000, qty: 1 },
      ],
      comment: "Після 18:00",
      doNotCall: false,
    },
    actor,
  );
}

describe("orders", () => {
  it("creates an order with a daily number, costs from the best offer and a customer", async () => {
    const order = await newOrder();
    expect(order.number).toMatch(/^AF-\d{6}-1000$/);
    expect(order.customer.phone).toBe("380971234567");
    expect(order.subtotal).toBe(4400);
    expect(order.total).toBe(4400);
    expect(order.lines[0].costPrice).toBe(700);
    expect(order.lines[0].supplierId).toBe("s1");
    expect(order.lines[1].costPrice).toBe(400);
    expect(order.costTotal).toBe(1800);
    expect(order.margin).toBe(2600);
    expect(order.marginKnown).toBe(true);

    const customer = await getCustomerByPhone(db, "0971234567");
    expect(customer?.ordersCount).toBe(1);
    expect(customer?.totalSpent).toBe(4400);

    const second = await newOrder();
    expect(second.number.endsWith("-1001")).toBe(true);
    expect((await getCustomerByPhone(db, "380971234567"))?.ordersCount).toBe(2);

    const events = await listOrderEvents(db, order.id);
    expect(events.map((e) => e.type)).toEqual(["created"]);
  });

  it("ranks offers: available first, then cheapest; normalises SKUs", async () => {
    const best = await bestOfferFor(db, { sku: "abc1" });
    expect(best?.supplierId).toBe("s1");
    expect(best?.cost).toBe(700);
  });

  it("enforces the status machine and records the timeline", async () => {
    const order = await newOrder("+380501112233");
    await expect(changeOrderStatus(db, order.id, "delivered", actor)).rejects.toThrow();
    const confirmed = await changeOrderStatus(db, order.id, "confirmed", actor);
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.confirmedAt).toBeTruthy();
    await expect(changeOrderStatus(db, order.id, "cancelled", actor)).rejects.toThrow(/причину/);
    const cancelled = await changeOrderStatus(db, order.id, "cancelled", actor, { reason: "Передумав" });
    expect(cancelled.lines.every((l) => l.fulfillment === "cancelled")).toBe(true);
    expect((await getCustomerByPhone(db, "380501112233"))?.ordersCount).toBe(0);
    const events = await listOrderEvents(db, order.id);
    expect(events.at(-1)?.text).toContain("Скасовано: Передумав");
  });

  it("moves lines through a purchase order", async () => {
    const order = await newOrder("+380631234567");
    await changeOrderStatus(db, order.id, "confirmed", actor);
    const po = await createPurchaseOrder(
      db,
      { supplierId: "s1", lines: order.lines.map((l) => ({ orderId: order.id, orderLineId: l.id })) },
      actor,
    );
    expect(po.number).toMatch(/^PO-\d{6}-01$/);
    expect(po.totalCost).toBe(700 * 2 + 400);
    expect(po.shipDirect).toBe(true);

    let current = (await getOrder(db, order.id))!;
    expect(current.status).toBe("sourcing");
    expect(current.lines.every((l) => l.fulfillment === "ordered" && l.purchaseOrderId === po.id)).toBe(true);

    await expect(
      createPurchaseOrder(db, { supplierId: "s2", lines: [{ orderId: order.id, orderLineId: order.lines[0].id }] }, actor),
    ).rejects.toThrow(/уже в закупівлі/);

    await setPurchaseOrderStatus(db, po.id, "sent", actor);
    await setPurchaseOrderStatus(db, po.id, "shipped", actor, { trackingNumber: "20450000000001" });
    current = (await getOrder(db, order.id))!;
    expect(current.lines.every((l) => l.fulfillment === "shipped")).toBe(true);
    expect((await getPurchaseOrder(db, po.id))?.trackingNumber).toBe("20450000000001");

    await setPurchaseOrderStatus(db, po.id, "received", actor);
    current = (await getOrder(db, order.id))!;
    expect(current.lines.every((l) => l.fulfillment === "delivered")).toBe(true);

    const events = await listOrderEvents(db, order.id);
    expect(events.filter((e) => e.type === "po_created")).toHaveLength(1);
    expect(events.filter((e) => e.type === "po_updated").length).toBeGreaterThanOrEqual(3);
  });

  it("lists with filters, text search and sourcing flag", async () => {
    const all = await listOrders(db, {}, { page: 1, perPage: 50 });
    expect(all.total).toBeGreaterThanOrEqual(4);
    const byPhone = await listOrders(db, { q: "063 123" }, { page: 1, perPage: 50 });
    expect(byPhone.total).toBe(1);
    const bySku = await listOrders(db, { q: "abc-2", status: ["new"] }, { page: 1, perPage: 50 });
    expect(bySku.items.every((o) => o.status === "new")).toBe(true);
    const sourcing = await listOrders(db, { needsSourcing: true }, { page: 1, perPage: 50 });
    expect(sourcing.items.every((o) => o.lines.some((l) => l.fulfillment === "pending" && !l.purchaseOrderId))).toBe(true);
    expect(sourcing.total).toBe(2);
  });

  it("recomputes money when lines change", async () => {
    const order = await newOrder("+380991234567");
    const updated = await updateOrder(
      db,
      order.id,
      { lines: [{ ...order.lines[0], qty: 3, discount: 100 }], orderDiscount: 50 },
      actor,
      { type: "lines_changed", text: "Змінено склад" },
    );
    expect(updated.subtotal).toBe(3600);
    expect(updated.discount).toBe(150);
    expect(updated.total).toBe(3450);
    expect(updated.costTotal).toBe(2100);
  });
});
