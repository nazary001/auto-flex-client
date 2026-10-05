import type { Db } from "mongodb";
import type { PurchaseOrderStatus, Supplier, SupplierOffer } from "@/lib/admin/types";
import { cols } from "@/lib/server/db/collections";
import { fromDoc } from "@/lib/server/db/util";

/*
 * Read-only queries for the purchasing module that are not covered by the shared repositories.
 * New read helpers for this module live here (repos stay frozen during parallel module work).
 */

/** Purchase orders that are still open at the supplier, grouped by supplier id. */
const OPEN_PO_STATUSES: PurchaseOrderStatus[] = ["draft", "sent", "confirmed", "shipped"];

export async function openPurchaseOrderCountsBySupplier(db: Db): Promise<Map<string, number>> {
  const rows = await cols(db)
    .purchaseOrders.aggregate<{ _id: string; n: number }>([
      { $match: { status: { $in: OPEN_PO_STATUSES } } },
      { $group: { _id: "$supplierId", n: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.n]));
}

/** Every price-list row of one supplier, cheapest SKU first — used by the CSV export. */
export async function offersForSupplier(db: Db, supplierId: string): Promise<SupplierOffer[]> {
  const docs = await cols(db).offers.find({ supplierId }).sort({ sku: 1 }).toArray();
  return docs.map((doc) => fromDoc<SupplierOffer>(doc));
}

/** supplier id → its maximum lead time in days (fallback 5), for the overdue purchase-order view. */
export function maxLeadDaysBySupplier(suppliers: Supplier[]): Map<string, number> {
  return new Map(suppliers.map((s) => [s.id, s.leadDays[1] || s.leadDays[0] || 5]));
}
