import type { Collection, Db } from "mongodb";
import { faq as staticFaq } from "@/data/faq";
import { promos as staticPromos } from "@/data/promos";
import type { FaqItem, Promo } from "@/lib/types";
import type { ContentEntry } from "@/lib/admin/types";
import { cols, type ContentDoc } from "../collections";
import { newId, nowIso } from "../util";

/*
 * Editable content: promotions (home page + /aktsii) and FAQ. The database is authoritative;
 * it is filled from the static files once, on an empty collection.
 */

type AnyContentCollection = Collection<ContentDoc<unknown>>;

function fromContentDoc<T>(doc: ContentDoc<unknown>): ContentEntry<T> {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest, data: rest.data as T };
}

async function list<T>(collection: AnyContentCollection, includeInactive: boolean): Promise<ContentEntry<T>[]> {
  const docs = await collection
    .find(includeInactive ? {} : { active: true })
    .sort({ sort: 1 })
    .toArray();
  return docs.map((doc) => fromContentDoc<T>(doc));
}

async function get<T>(collection: AnyContentCollection, id: string): Promise<ContentEntry<T> | null> {
  const doc = await collection.findOne({ _id: id });
  return doc ? fromContentDoc<T>(doc) : null;
}

async function save<T>(
  collection: AnyContentCollection,
  input: { id?: string; data: T; active?: boolean; sort?: number },
): Promise<ContentEntry<T>> {
  const id = input.id ?? newId();
  const existing = await collection.findOne({ _id: id });
  let sort = input.sort ?? existing?.sort;
  if (sort === undefined) {
    const last = await collection.find().sort({ sort: -1 }).limit(1).toArray();
    sort = (last[0]?.sort ?? 0) + 10;
  }
  const entry: ContentEntry<T> = {
    id,
    active: input.active ?? existing?.active ?? true,
    sort,
    updatedAt: nowIso(),
    data: input.data,
  };
  const { id: _id, ...rest } = entry;
  await collection.replaceOne({ _id }, rest, { upsert: true });
  return entry;
}

async function reorder(collection: AnyContentCollection, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await collection.bulkWrite(
    ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { sort: (index + 1) * 10 } } } })),
  );
}

const promos = (db: Db) => cols(db).promos as unknown as AnyContentCollection;
const faq = (db: Db) => cols(db).faq as unknown as AnyContentCollection;

// ── promos ──────────────────────────────────────────────────

export const listPromos = (db: Db, includeInactive = false) => list<Promo>(promos(db), includeInactive);
export const getPromo = (db: Db, id: string) => get<Promo>(promos(db), id);
export const savePromo = (db: Db, input: { id?: string; data: Promo; active?: boolean; sort?: number }) =>
  save(promos(db), input);
export const reorderPromos = (db: Db, ids: string[]) => reorder(promos(db), ids);
export async function deletePromo(db: Db, id: string): Promise<void> {
  await cols(db).promos.deleteOne({ _id: id });
}

// ── faq ─────────────────────────────────────────────────────

export const listFaq = (db: Db, includeInactive = false) => list<FaqItem>(faq(db), includeInactive);
export const getFaqItem = (db: Db, id: string) => get<FaqItem>(faq(db), id);
export const saveFaq = (db: Db, input: { id?: string; data: FaqItem; active?: boolean; sort?: number }) =>
  save(faq(db), input);
export const reorderFaq = (db: Db, ids: string[]) => reorder(faq(db), ids);
export async function deleteFaq(db: Db, id: string): Promise<void> {
  await cols(db).faq.deleteOne({ _id: id });
}

// ── seed ────────────────────────────────────────────────────

/** Copies the static promos and FAQ into empty collections (first start) */
export async function seedContentIfEmpty(db: Db): Promise<void> {
  const c = cols(db);
  if ((await c.promos.countDocuments()) === 0 && staticPromos.length > 0) {
    const now = nowIso();
    await c.promos.insertMany(
      staticPromos.map((promo, index) => ({
        _id: promo.slug,
        active: true,
        sort: (index + 1) * 10,
        updatedAt: now,
        data: promo,
      })),
    );
  }
  if ((await c.faq.countDocuments()) === 0 && staticFaq.length > 0) {
    const now = nowIso();
    await c.faq.insertMany(
      staticFaq.map((item, index) => ({ _id: newId(), active: true, sort: (index + 1) * 10, updatedAt: now, data: item })),
    );
  }
}
