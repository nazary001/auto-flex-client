import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import { SYSTEM_ACTOR } from "@/lib/admin/types";
import { changeOrderStatus, createOrder, listOrderEvents, updateOrder } from "@/lib/server/db/repos/orders";
import { startTestDb, stopTestDb } from "@/lib/server/db/testing";
import { carrierTrackingUrl, formatNpDate, trackingStage, type TrackingResult } from "@/lib/server/nova-poshta";
import { advanceOrderTo, applyTrackingResult, trackingEligible, trackingStale } from "@/lib/server/orders/tracking";

let db: Db;
const actor = SYSTEM_ACTOR;
const TTN = "20450000000001";

function npResult(statusCode: string, extra: Partial<TrackingResult> = {}): TrackingResult {
  return {
    number: TTN,
    status: `Статус ${statusCode}`,
    statusCode,
    delivered: ["9", "10", "11"].includes(statusCode),
    awaitingPickup: ["7", "8"].includes(statusCode),
    returning: ["102", "103", "108"].includes(statusCode),
    ...extra,
  };
}

async function newOrder(withTtn = true) {
  const order = await createOrder(
    db,
    {
      source: "website",
      customer: { firstName: "Іван", lastName: "Петренко", phone: "+38 (097) 555-44-33" },
      delivery: { method: "np_branch", city: "Київ", address: "відділення 12" },
      payment: { method: "cod" },
      lines: [{ productId: "p1", sku: "ABC-1", name: "Колодки", price: 1200, qty: 1 }],
      doNotCall: false,
    },
    actor,
  );
  if (!withTtn) return order;
  return updateOrder(db, order.id, { delivery: { ...order.delivery, trackingNumber: TTN, carrier: "nova_poshta" } }, actor);
}

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

describe("nova poshta helpers", () => {
  it("maps status codes to stages", () => {
    expect(trackingStage("1")).toBe("label");
    expect(trackingStage("5")).toBe("in_transit");
    expect(trackingStage("7")).toBe("awaiting_pickup");
    expect(trackingStage("9")).toBe("delivered");
    expect(trackingStage("102")).toBe("returning");
    expect(trackingStage(undefined)).toBe("unknown");
  });

  it("formats carrier dates and tracking links", () => {
    expect(formatNpDate("15-03-2026 14:21:03")).toBe("15.03.2026");
    expect(formatNpDate("15-03-2026 14:21:03", true)).toBe("15.03.2026, 14:21");
    expect(formatNpDate(undefined)).toBeUndefined();
    expect(carrierTrackingUrl("nova_poshta", "2045 0000 0000 01")).toContain("novaposhta.ua/tracking/?cargo_number=20450000000001");
    expect(carrierTrackingUrl("ukrposhta", "0500123456789")).toContain("ukrposhta.ua");
  });
});

describe("order tracking", () => {
  it("knows which orders to ask the carrier about", async () => {
    const plain = await newOrder(false);
    expect(trackingEligible(plain)).toBe(false);
    const tracked = await newOrder();
    expect(trackingEligible(tracked)).toBe(true);
    expect(trackingStale(tracked)).toBe(true);
  });

  it("advances along the happy path one allowed step at a time", async () => {
    const order = await newOrder();
    const shipped = await advanceOrderTo(db, order, "in_transit", actor);
    expect(shipped.status).toBe("in_transit");
    expect(shipped.confirmedAt).toBeTruthy();
    expect(shipped.shippedAt).toBeTruthy();
    const closed = await changeOrderStatus(db, shipped.id, "delivered", actor);
    const untouched = await advanceOrderTo(db, await changeOrderStatus(db, closed.id, "completed", actor), "in_transit", actor);
    expect(untouched.status).toBe("completed");
  });

  it("moves a confirmed order to in_transit and then to delivered from the carrier's answers", async () => {
    const order = await changeOrderStatus(db, (await newOrder()).id, "confirmed", actor);
    const moving = await applyTrackingResult(db, order, npResult("5", { scheduledDeliveryDate: "08-10-2026 00:00:00" }), actor);
    expect(moving.status).toBe("in_transit");
    expect(moving.delivery.tracking?.statusCode).toBe("5");
    expect(moving.delivery.tracking?.scheduledDeliveryDate).toBe("08-10-2026 00:00:00");
    expect(trackingStale(moving)).toBe(false);

    const delivered = await applyTrackingResult(db, moving, npResult("9", { recipientDateTime: "07-10-2026 12:30:00" }), actor);
    expect(delivered.status).toBe("delivered");
    expect(delivered.delivery.deliveredAt).toBeTruthy();
    expect(delivered.delivery.tracking?.receivedAt).toBe("07-10-2026 12:30:00");
    expect(delivered.lines.every((line) => line.fulfillment === "delivered")).toBe(true);
    expect(trackingEligible(delivered)).toBe(false);

    const events = await listOrderEvents(db, order.id);
    expect(events.filter((e) => e.type === "tracking_checked")).toHaveLength(2);
    expect(events.filter((e) => e.type === "status_changed").map((e) => e.data?.to)).toEqual(expect.arrayContaining(["in_transit", "delivered"]));
  });

  it("does not spam the timeline when the status is unchanged and ignores an unshipped label", async () => {
    const order = await newOrder();
    const labelOnly = await applyTrackingResult(db, order, npResult("1"), actor);
    expect(labelOnly.status).toBe("new");
    const again = await applyTrackingResult(db, labelOnly, npResult("1"), actor);
    expect(again.status).toBe("new");
    const events = await listOrderEvents(db, order.id);
    expect(events.filter((e) => e.type === "tracking_checked")).toHaveLength(1);
  });
});
