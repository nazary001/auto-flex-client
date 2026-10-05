import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import { cols } from "@/lib/server/db/collections";
import { listOrders, countOrdersByStatus, salesByDay, topProducts } from "@/lib/server/db/repos/orders";
import { getSidebarCounts } from "@/lib/server/db/repos/stats";
import { seedDemoData } from "@/lib/server/db/seed";
import { startTestDb, stopTestDb } from "@/lib/server/db/testing";
import { importDemoCatalog } from "@/lib/server/suppliers/ddtuning/demo-import";

let db: Db;

beforeAll(async () => {
  db = await startTestDb();
  await importDemoCatalog(db);
  await seedDemoData(db);
});

afterAll(async () => {
  await stopTestDb();
});

describe("demo seed", () => {
  it("creates suppliers, offers, customers, orders, purchase orders, requests and reviews", async () => {
    const c = cols(db);
    expect(await c.suppliers.countDocuments()).toBe(4);
    expect(await c.offers.countDocuments()).toBeGreaterThan(200);
    expect(await c.customers.countDocuments()).toBeGreaterThan(20);
    expect(await c.orders.countDocuments()).toBe(88);
    expect(await c.purchaseOrders.countDocuments()).toBeGreaterThan(20);
    expect(await c.requests.countDocuments()).toBe(18);
    expect(await c.reviews.countDocuments({ source: "site" })).toBe(8);
    expect(await c.orderEvents.countDocuments()).toBeGreaterThan(88);
  });

  it("keeps every order's money consistent", async () => {
    const page = await listOrders(db, {}, { page: 1, perPage: 200 });
    expect(page.total).toBe(88);
    for (const order of page.items) {
      const active = order.lines.filter((l) => l.fulfillment !== "cancelled");
      const subtotal = active.reduce((s, l) => s + l.price * l.qty, 0);
      expect(order.subtotal).toBe(subtotal);
      expect(order.total).toBe(subtotal - order.discount);
      expect(order.number).toMatch(/^AF-\d{6}-\d{4}$/);
      expect(order.customer.customerId).toBeTruthy();
    }
    const numbers = new Set(page.items.map((o) => o.number));
    expect(numbers.size).toBe(88);
  });

  it("produces orders in every pipeline stage with matching line fulfillment", async () => {
    const counts = await countOrdersByStatus(db);
    expect(counts.new.count).toBeGreaterThan(0);
    expect(counts.completed.count).toBeGreaterThan(0);
    expect(counts.sourcing.count + counts.in_transit.count).toBeGreaterThan(0);
    const page = await listOrders(db, { status: ["completed"] }, { page: 1, perPage: 5 });
    for (const order of page.items) {
      expect(order.payment.status).toBe("paid");
      expect(order.lines.every((l) => l.purchaseOrderId)).toBe(true);
    }
  });

  it("answers dashboard and sidebar queries", async () => {
    const days = await salesByDay(db, 30);
    expect(days).toHaveLength(30);
    expect(days.reduce((s, d) => s + d.orders, 0)).toBeGreaterThan(0);
    const top = await topProducts(db, 60, 5);
    expect(top.length).toBeGreaterThan(0);
    const counts = await getSidebarCounts(db);
    expect(counts.newOrders).toBeGreaterThan(0);
    expect(counts.pendingReviews).toBe(6);
  });

});
