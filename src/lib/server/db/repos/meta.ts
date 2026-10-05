import type { Db } from "mongodb";
import { cols } from "../collections";

export async function getMeta<T = unknown>(db: Db, key: string): Promise<T | undefined> {
  const doc = await cols(db).meta.findOne({ _id: key });
  return doc?.value as T | undefined;
}

export async function setMeta(db: Db, key: string, value: unknown): Promise<void> {
  await cols(db).meta.updateOne({ _id: key }, { $set: { value } }, { upsert: true });
}
