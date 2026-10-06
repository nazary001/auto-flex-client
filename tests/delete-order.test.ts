import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import { SYSTEM_ACTOR } from "@/lib/admin/types";
import { getCustomerByPhone } from "@/lib/server/db/repos/customers";
import { createOrder, deleteOrderCascade, getOrder, listOrderEvents } from "@/lib/server/db/repos/orders";
import { createPurchaseOrder, getPurchaseOrder } from "@/lib/server/db/repos/purchase-orders";
import { createSupplier } from "@/lib/server/db/repos/suppliers";
import { startTestDb, stopTestDb } from "@/lib/server/db/testing";

let db: Db;
const actor = SYSTEM_ACTOR;
const PHONE = "+38 (097) 111-22-33";

async function newOrder() {
  return createOrder(
    db,
    {
      source: "manual",
      customer: { firstName: "Тест", lastName: "Тестовий", phone: PHONE },
      delivery: { method: "np_branch", city: "Київ", address: "відділення 1" },
      payment: { method: "cod" },
      lines: [
        { productId: "p1", sku: "DEL-1", name: "Позиція 1", price: 500, qty: 1 },
        { productId: "p2", sku: "DEL-2", name: "Позиція 2", price: 700, qty: 2 },
      ],
      doNotCall: false,
    },
    actor,
  );
}

beforeAll(async () => {
  db = await startTestDb();
  await createSupplier(
    db,
    { code: "DEL", name: "Supplier Del", active: true, contacts: {}, leadDays: [1, 2], shipsDirect: true },
    { id: "s-del" },
  );
});

afterAll(async () => {
  await stopTestDb();
});

describe("deleteOrderCascade", () => {
  it("removes the order, its timeline, its purchase order and resets the customer totals", async () => {
    const order = await newOrder();
    const po = await createPurchaseOrder(
      db,
      { supplierId: "s-del", lines: order.lines.map((line) => ({ orderId: order.id, orderLineId: line.id, cost: 100 })) },
      actor,
    );
    expect((await listOrderEvents(db, order.id)).length).toBeGreaterThan(0);

    const result = await deleteOrderCascade(db, order.id);
    expect(result.order.number).toBe(order.number);
    expect(result.purchaseOrdersRemoved).toBe(1);
    expect(result.purchaseOrdersTrimmed).toBe(0);
    expect(await getOrder(db, order.id)).toBeNull();
    expect(await listOrderEvents(db, order.id)).toEqual([]);
    expect(await getPurchaseOrder(db, po.id)).toBeNull();

    const customer = await getCustomerByPhone(db, PHONE);
    expect(customer?.ordersCount ?? 0).toBe(0);
    expect(customer?.totalSpent ?? 0).toBe(0);
  });

  it("only trims a purchase order that also holds lines of another order", async () => {
    const a = await newOrder();
    const b = await newOrder();
    const po = await createPurchaseOrder(
      db,
      {
        supplierId: "s-del",
        lines: [
          { orderId: a.id, orderLineId: a.lines[0].id, cost: 100 },
          { orderId: b.id, orderLineId: b.lines[0].id, cost: 100 },
        ],
      },
      actor,
    );
    const result = await deleteOrderCascade(db, a.id);
    expect(result.purchaseOrdersRemoved).toBe(0);
    expect(result.purchaseOrdersTrimmed).toBe(1);
    const left = await getPurchaseOrder(db, po.id);
    expect(left?.lines.map((line) => line.orderId)).toEqual([b.id]);
    expect(left?.totalCost).toBe(100);
    expect(await getOrder(db, b.id)).not.toBeNull();
  });
});
