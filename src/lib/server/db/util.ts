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

/*
 * The business day is Europe/Kyiv (the same zone <DateTime> displays in), not the server's local
 * zone — on Vercel the runtime is UTC, which would otherwise bucket the first 2-3 h of a Kyiv day
 * into the previous day. daysAgoIso returns Kyiv-local midnight as a UTC ISO instant.
 */
const KYIV_TZ = "Europe/Kyiv";

const kyivParts = new Intl.DateTimeFormat("en-US", {
  timeZone: KYIV_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Kyiv UTC offset in minutes at the given instant (120 in winter EET, 180 in summer EEST). */
function kyivOffsetMinutes(at: Date): number {
  const parts = kyivParts.formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** Start of the day N days ago in Europe/Kyiv, as a UTC ISO string */
export function daysAgoIso(days: number): string {
  const [y, m, d] = kyivToday();
  // Kyiv wall-clock midnight of (today − days) treated as UTC, then shifted by the Kyiv offset on
  // that day. DST switches happen at 03:00/04:00 local, never at midnight, so the offset is stable.
  const wallMidnight = Date.UTC(y, m - 1, d - days, 0, 0, 0, 0);
  const offset = kyivOffsetMinutes(new Date(wallMidnight));
  return new Date(wallMidnight - offset * 60000).toISOString();
}

/** Today's calendar date in Europe/Kyiv as [year, month (1-12), day] */
export function kyivToday(): [number, number, number] {
  const parts = kyivParts.formatToParts(new Date());
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return [n("year"), n("month"), n("day")];
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
