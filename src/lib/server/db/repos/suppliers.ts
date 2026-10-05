import type { Db } from "mongodb";
import type { Supplier } from "@/lib/admin/types";
import { cols, type SupplierDoc } from "../collections";
import { compact, fromDoc, newId, nowIso, toDoc } from "../util";

export class DuplicateSupplierCodeError extends Error {
  constructor() {
    super("Постачальник із таким кодом уже існує.");
    this.name = "DuplicateSupplierCodeError";
  }
}

const toSupplier = (doc: SupplierDoc): Supplier => fromDoc<Supplier>(doc);

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

export async function listSuppliers(db: Db, options: { activeOnly?: boolean } = {}): Promise<Supplier[]> {
  const docs = await cols(db)
    .suppliers.find(options.activeOnly ? { active: true } : {})
    .sort({ name: 1 })
    .toArray();
  return docs.map(toSupplier);
}

export async function getSupplier(db: Db, id: string): Promise<Supplier | null> {
  const doc = await cols(db).suppliers.findOne({ _id: id });
  return doc ? toSupplier(doc) : null;
}

export async function getSupplierByCode(db: Db, code: string): Promise<Supplier | null> {
  const doc = await cols(db).suppliers.findOne({ code: code.trim().toUpperCase() });
  return doc ? toSupplier(doc) : null;
}

export async function getSuppliersMap(db: Db): Promise<Map<string, Supplier>> {
  const list = await listSuppliers(db);
  return new Map(list.map((s) => [s.id, s]));
}

export type SupplierInput = Omit<Supplier, "id" | "createdAt" | "updatedAt">;

export async function createSupplier(db: Db, input: SupplierInput, options: { id?: string } = {}): Promise<Supplier> {
  const now = nowIso();
  const supplier: Supplier = compact({
    ...input,
    id: options.id ?? newId(),
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    contacts: compact({ ...input.contacts }),
    createdAt: now,
    updatedAt: now,
  });
  try {
    await cols(db).suppliers.insertOne(toDoc(supplier));
  } catch (error) {
    if (isDuplicateKey(error)) throw new DuplicateSupplierCodeError();
    throw error;
  }
  return supplier;
}

export async function updateSupplier(db: Db, id: string, patch: Partial<SupplierInput>): Promise<Supplier | null> {
  const $set: Record<string, unknown> = compact({ ...patch, updatedAt: nowIso() });
  if (typeof patch.code === "string") $set.code = patch.code.trim().toUpperCase();
  if (patch.contacts) $set.contacts = compact({ ...patch.contacts });
  try {
    const doc = await cols(db).suppliers.findOneAndUpdate({ _id: id }, { $set }, { returnDocument: "after" });
    return doc ? toSupplier(doc) : null;
  } catch (error) {
    if (isDuplicateKey(error)) throw new DuplicateSupplierCodeError();
    throw error;
  }
}
