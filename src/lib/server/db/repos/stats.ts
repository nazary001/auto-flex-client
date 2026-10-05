import type { Db } from "mongodb";
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
      status: { $in: ["new", "confirmed", "sourcing", "on_hold"] },
      lines: { $elemMatch: { fulfillment: "pending", purchaseOrderId: { $exists: false } } },
    }),
  ]);
  return { newOrders, openOrders, newRequests, pendingReviews, needsSourcing };
}
