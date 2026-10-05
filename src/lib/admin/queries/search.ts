import type { Db } from "mongodb";
import { searchCatalog } from "@/lib/catalog";
import type { Customer, CustomerRequest, Order, PurchaseOrder } from "@/lib/admin/types";
import { searchCustomers } from "@/lib/server/db/repos/customers";
import { findOrders } from "@/lib/server/db/repos/orders";
import { findPurchaseOrders } from "@/lib/server/db/repos/purchase-orders";
import { listRequests } from "@/lib/server/db/repos/requests";
import { getSuppliersMap } from "@/lib/server/db/repos/suppliers";

/*
 * Global search across the back office. Each section is capped at 10 rows; the database reads
 * run together and the catalog is searched in MongoDB via `searchCatalog`. Sections are rendered
 * only when non-empty.
 */

export const MIN_QUERY_LENGTH = 2;

export interface ProductHit {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brand?: string;
  price: number;
}

export interface PurchaseOrderHit {
  po: PurchaseOrder;
  supplierName?: string;
}

export interface SearchData {
  q: string;
  /** Query is present but shorter than the minimum */
  tooShort: boolean;
  orders: Order[];
  customers: Customer[];
  products: ProductHit[];
  purchaseOrders: PurchaseOrderHit[];
  requests: CustomerRequest[];
  /** True when the query ran and every section is empty */
  empty: boolean;
}

export async function getSearchResults(db: Db, rawQuery: string): Promise<SearchData> {
  const q = rawQuery.trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return { q, tooShort: q.length > 0, orders: [], customers: [], products: [], purchaseOrders: [], requests: [], empty: false };
  }

  const [orders, customersPage, poList, requestsPage, suppliers, catalog] = await Promise.all([
    findOrders(db, { q }, 10),
    searchCustomers(db, { q }, { page: 1, perPage: 10 }),
    findPurchaseOrders(db, { q }, 10),
    listRequests(db, { q }, { page: 1, perPage: 10 }),
    getSuppliersMap(db),
    searchCatalog(q, 10),
  ]);

  const products: ProductHit[] = catalog.products.map((p) => ({
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    name: p.name,
    brand: p.brandName,
    price: p.price,
  }));

  const purchaseOrders: PurchaseOrderHit[] = poList.map((po) => ({
    po,
    supplierName: suppliers.get(po.supplierId)?.name,
  }));

  const customers = customersPage.items;
  const requests = requestsPage.items;
  const empty =
    orders.length === 0 &&
    customers.length === 0 &&
    products.length === 0 &&
    purchaseOrders.length === 0 &&
    requests.length === 0;

  return { q, tooShort: false, orders, customers, products, purchaseOrders, requests, empty };
}
