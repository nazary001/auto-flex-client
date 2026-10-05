import type { Db, Filter, Sort } from "mongodb";
import type { Customer, CustomerListFilter } from "@/lib/admin/types";
import { cols, type CustomerDoc } from "@/lib/server/db/collections";
import { containsRegex, fromDoc } from "@/lib/server/db/util";

/*
 * Read queries for the customers module that are not covered by the shared repository.
 * The list page and the CSV export share the same filter parsing and query building so an
 * export always matches what the list shows.
 */

export interface CustomerFilterInput {
  q?: string;
  tag?: string;
  /** "yes" (do-not-call only) | "no" (callable only) | anything else (any) */
  doNotCall?: string;
  sort?: string;
}

const SORTS: ReadonlySet<NonNullable<CustomerListFilter["sort"]>> = new Set(["recent", "spent", "orders", "name"]);

/** Builds a CustomerListFilter from raw query-string values (defensive, single values only). */
export function parseCustomerFilter(input: CustomerFilterInput): CustomerListFilter {
  const filter: CustomerListFilter = {};
  const q = input.q?.trim();
  if (q) filter.q = q;
  const tag = input.tag?.trim();
  if (tag) filter.tag = tag;
  if (input.doNotCall === "yes") filter.doNotCall = true;
  else if (input.doNotCall === "no") filter.doNotCall = false;
  if (input.sort && SORTS.has(input.sort as NonNullable<CustomerListFilter["sort"]>)) {
    filter.sort = input.sort as CustomerListFilter["sort"];
  }
  return filter;
}

/** True when any narrowing filter is set (used to pick the empty state). */
export function customerFilterActive(filter: CustomerListFilter): boolean {
  return Boolean(filter.q || filter.tag || typeof filter.doNotCall === "boolean");
}

function buildCustomerQuery(filter: CustomerListFilter): Filter<CustomerDoc> {
  const query: Filter<CustomerDoc> = {};
  if (filter.q?.trim()) {
    const q = filter.q.trim();
    const digits = q.replace(/\D/g, "");
    const re = containsRegex(q);
    query.$or = [{ firstName: re }, { lastName: re }, { email: re }, { city: re }];
    if (digits.length >= 3) query.$or.push({ phone: new RegExp(digits) });
  }
  if (filter.tag) query.tags = filter.tag;
  if (typeof filter.doNotCall === "boolean") query.doNotCall = filter.doNotCall;
  return query;
}

function customerSort(filter: CustomerListFilter): Sort {
  return filter.sort === "spent"
    ? { totalSpent: -1 }
    : filter.sort === "orders"
      ? { ordersCount: -1 }
      : filter.sort === "name"
        ? { lastName: 1, firstName: 1 }
        : { lastOrderAt: -1, createdAt: -1 };
}

/** Every matching customer, newest first — for the CSV export (capped). */
export async function findCustomersForExport(db: Db, filter: CustomerListFilter, limit = 10_000): Promise<Customer[]> {
  const docs = await cols(db).customers.find(buildCustomerQuery(filter)).sort(customerSort(filter)).limit(limit).toArray();
  return docs.map((doc) => fromDoc<Customer>(doc));
}
