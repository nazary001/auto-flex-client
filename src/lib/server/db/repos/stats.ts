import type { Db } from "mongodb";
import { OPEN_ORDER_STATUSES } from "@/lib/admin/labels";
import { cols } from "../collections";

export interface SidebarCounts {
  newOrders: number;
  openOrders: number;
  newRequests: number;
  pendingReviews: number;
  needsSourcing: number;
}

/** Badge numbers for the admin sidebar; one round of cheap counts */
export async function getSidebarCounts(db: Db): Promise<SidebarCounts> {
  const c = cols(db);
  const [newOrders, openOrders, newRequests, pendingReviews, needsSourcing] = await Promise.all([
    c.orders.countDocuments({ status: "new" }),
    c.orders.countDocuments({ status: { $in: ["new", "confirmed", "sourcing", "in_transit", "on_hold"] } }),
    c.requests.countDocuments({ status: "new" }),
    c.reviews.countDocuments({ status: "pending" }),
    c.orders.countDocuments({
      // Same open-order set as the dashboard «Очікують закупівлі» and the orders needsSourcing filter
      status: { $in: OPEN_ORDER_STATUSES },
      lines: { $elemMatch: { fulfillment: "pending", purchaseOrderId: { $exists: false } } },
    }),
  ]);
  return { newOrders, openOrders, newRequests, pendingReviews, needsSourcing };
}
