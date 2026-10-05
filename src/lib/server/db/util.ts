import { randomUUID } from "node:crypto";
import type { Collection, Document, Filter, Sort } from "mongodb";
import type { Page, Paging } from "@/lib/admin/types";

/*
 * Small helpers shared by the repositories: ids, timestamps, `_id` ↔ `id` mapping,
 * atomic counters and paging.
 */

export function newId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Stored shape of a domain entity: `id` becomes MongoDB's `_id` */
export type Doc<T extends { id: string }> = Omit<T, "id"> & { _id: string };

export function toDoc<T extends { id: string }>(entity: T): Doc<T> {
  const { id, ...rest } = entity;
  return { _id: id, ...rest } as Doc<T>;
}

export function fromDoc<T extends { id: string }>(doc: Doc<T>): T;
export function fromDoc<T extends { id: string }>(doc: Doc<T> | null | undefined): T | null;
export function fromDoc<T extends { id: string }>(doc: Doc<T> | null | undefined): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest } as unknown as T;
}

/** Removes `undefined` values so `$set` does not write them as null */
export function compact<T extends Record<string, unknown>>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) if (v !== undefined) out[key] = v;
  return out as T;
}

/** Fields to unset on a patch: every key whose value is explicitly `undefined` */
export function unsetKeys<T extends Record<string, unknown>>(value: T): Record<string, ""> {
  const out: Record<string, ""> = {};
  for (const [key, v] of Object.entries(value)) if (v === undefined) out[key] = "";
  return out;
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive "contains" regex for free-text filters */
export function containsRegex(text: string): RegExp {
  return new RegExp(escapeRegex(text.trim()), "i");
}

/** Atomic per-key sequence: 1, 2, 3… Used for order and purchase-order numbers. */
export async function nextSequence(counters: Collection<{ _id: string; seq: number }>, key: string): Promise<number> {
  const result = await counters.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return result?.seq ?? 1;
}

/** Runs count + find with skip/limit and returns a Page */
export async function paginate<TDoc extends Document, TOut>(
  collection: Collection<TDoc>,
  filter: Filter<TDoc>,
  sort: Sort,
  paging: Paging,
  map: (doc: TDoc) => TOut,
): Promise<Page<TOut>> {
  const total = await collection.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / paging.perPage));
  const page = Math.min(paging.page, pageCount);
  const docs = await collection
    .find(filter)
    .sort(sort)
    .skip((page - 1) * paging.perPage)
    .limit(paging.perPage)
    .toArray();
  return { items: docs.map((doc) => map(doc as TDoc)), total, page, perPage: paging.perPage, pageCount };
}

/** Start of the day N days ago (local time), as ISO */
export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** ISO range filter for a `createdAt`-like string field; `to` is inclusive of the whole day */
export function dateRange(from?: string, to?: string): { $gte?: string; $lte?: string } | undefined {
  const range: { $gte?: string; $lte?: string } = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.$gte = d.toISOString();
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) d.setHours(23, 59, 59, 999);
      range.$lte = d.toISOString();
    }
  }
  return range.$gte || range.$lte ? range : undefined;
}
