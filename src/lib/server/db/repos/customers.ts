import type { Db, Filter, Sort } from "mongodb";
import { normalizePhone } from "@/lib/format";
import type { Customer, CustomerListFilter, OrderCustomer, Page, Paging } from "@/lib/admin/types";
import { cols, type CustomerDoc } from "../collections";
import { compact, containsRegex, fromDoc, newId, nowIso, paginate, toDoc } from "../util";

const toCustomer = (doc: CustomerDoc): Customer => fromDoc<Customer>(doc);

export async function getCustomer(db: Db, id: string): Promise<Customer | null> {
  const doc = await cols(db).customers.findOne({ _id: id });
  return doc ? toCustomer(doc) : null;
}

export async function getCustomerByPhone(db: Db, phone: string): Promise<Customer | null> {
  const doc = await cols(db).customers.findOne({ phone: normalizePhone(phone) });
  return doc ? toCustomer(doc) : null;
}

export interface CreateCustomerInput {
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
  city?: string;
  address?: string;
  tags?: string[];
  notes?: string;
  doNotCall?: boolean;
}

export async function createCustomer(db: Db, input: CreateCustomerInput): Promise<Customer> {
  const now = nowIso();
  const customer: Customer = compact({
    id: newId(),
    phone: normalizePhone(input.phone),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email?.trim() || undefined,
    city: input.city?.trim() || undefined,
    address: input.address?.trim() || undefined,
    tags: input.tags ?? [],
    notes: input.notes ?? "",
    doNotCall: input.doNotCall ?? false,
    ordersCount: 0,
    totalSpent: 0,
    createdAt: now,
    updatedAt: now,
  });
  await cols(db).customers.insertOne(toDoc(customer));
  return customer;
}

/**
 * Finds the customer by phone or creates one. Existing customers keep their name unless it was
 * empty; the latest e-mail and city are remembered.
 */
export async function upsertFromOrder(
  db: Db,
  customer: OrderCustomer,
  extra: { city?: string; doNotCall?: boolean } = {},
): Promise<Customer> {
  const phone = normalizePhone(customer.phone);
  const existing = await cols(db).customers.findOne({ phone });
  if (!existing) {
    return createCustomer(db, {
      phone,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      city: extra.city,
      doNotCall: extra.doNotCall,
    });
  }
  const $set: Record<string, unknown> = { updatedAt: nowIso() };
  if (!existing.firstName && customer.firstName) $set.firstName = customer.firstName.trim();
  if (!existing.lastName && customer.lastName) $set.lastName = customer.lastName.trim();
  if (customer.email) $set.email = customer.email.trim();
  if (extra.city) $set.city = extra.city.trim();
  const doc = await cols(db).customers.findOneAndUpdate({ _id: existing._id }, { $set }, { returnDocument: "after" });
  return toCustomer(doc ?? existing);
}

export async function updateCustomer(
  db: Db,
  id: string,
  patch: Partial<Pick<Customer, "firstName" | "lastName" | "email" | "city" | "address" | "tags" | "notes" | "doNotCall" | "phone">>,
): Promise<Customer | null> {
  const $set: Record<string, unknown> = compact({ ...patch, updatedAt: nowIso() });
  if (typeof patch.phone === "string") $set.phone = normalizePhone(patch.phone);
  const doc = await cols(db).customers.findOneAndUpdate({ _id: id }, { $set }, { returnDocument: "after" });
  return doc ? toCustomer(doc) : null;
}

/** Recounts orders and money from the orders collection (excluding cancelled and returned) */
export async function recomputeStats(db: Db, customerId: string): Promise<void> {
  const [row] = await cols(db)
    .orders.aggregate<{ count: number; total: number; first: string; last: string }>([
      { $match: { "customer.customerId": customerId, status: { $nin: ["cancelled", "returned"] } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: "$total" },
          first: { $min: "$createdAt" },
          last: { $max: "$createdAt" },
        },
      },
    ])
    .toArray();
  await cols(db).customers.updateOne(
    { _id: customerId },
    {
      $set: compact({
        ordersCount: row?.count ?? 0,
        totalSpent: row?.total ?? 0,
        firstOrderAt: row?.first,
        lastOrderAt: row?.last,
      }),
      ...(row ? {} : { $unset: { firstOrderAt: "", lastOrderAt: "" } }),
    },
  );
}

export async function searchCustomers(db: Db, filter: CustomerListFilter, paging: Paging): Promise<Page<Customer>> {
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

  const sort: Sort =
    filter.sort === "spent"
      ? { totalSpent: -1 }
      : filter.sort === "orders"
        ? { ordersCount: -1 }
        : filter.sort === "name"
          ? { lastName: 1, firstName: 1 }
          : { lastOrderAt: -1, createdAt: -1 };

  return paginate(cols(db).customers, query, sort, paging, toCustomer);
}

export async function listCustomerTags(db: Db): Promise<string[]> {
  const tags = await cols(db).customers.distinct("tags");
  return (tags as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b, "uk"));
}

export async function countCustomers(db: Db): Promise<number> {
  return cols(db).customers.countDocuments();
}
