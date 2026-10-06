import type { Db } from "mongodb";
import { cols, ensureIndexes } from "./collections";
import { createUser, countUsers } from "./repos/users";
import { seedDemoData } from "./seed";
import { seedContentIfEmpty } from "./repos/content";
import { importDemoCatalog } from "@/lib/server/suppliers/ddtuning/demo-import";
import { isDdConfigured } from "@/lib/server/suppliers/ddtuning/client";

/*
 * Runs once per process right after connecting: indexes, the owner account from the
 * environment, default content, the catalog (demo data when no supplier token is configured)
 * and, in development, the demo orders.
 */

interface InitGlobal {
  __afDbInit?: Promise<void>;
}
const g = globalThis as unknown as InitGlobal;

function seedWanted(): boolean {
  const flag = process.env.ADMIN_SEED_DEMO?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

/** Demo orders need products; runs after the catalog exists (demo import or first supplier sync) */
export async function seedDemoOrdersIfPending(db: Db): Promise<boolean> {
  const seeded = await cols(db).meta.findOne({ _id: "seededAt" });
  if (seeded || !seedWanted()) return false;
  if ((await cols(db).products.countDocuments({ hidden: false })) === 0) return false;
  await seedDemoData(db);
  await cols(db).meta.updateOne({ _id: "seededAt" }, { $set: { value: new Date().toISOString() } }, { upsert: true });
  console.info("[AutoFlex] Демо-дані для адмінки створено (замовлення, постачальники, клієнти, заявки)");
  return true;
}

async function run(db: Db): Promise<void> {
  // Index creation is a write: when Atlas blocks writes (storage quota exceeded) the indexes
  // already exist from earlier runs, so keep serving reads instead of taking the whole site down.
  try {
    await ensureIndexes(db);
  } catch (error) {
    console.error("[AutoFlex] Не вдалося створити індекси — продовжую без них (читання працює, записи можуть падати)", error);
  }

  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password && (await countUsers(db)) === 0) {
    await createUser(db, { email, name: "Власник", role: "owner", password });
    console.info(`[AutoFlex] Створено обліковий запис власника ${email} з ADMIN_EMAIL / ADMIN_PASSWORD`);
  }

  await seedContentIfEmpty(db);

  const productCount = await cols(db).products.estimatedDocumentCount();
  if (productCount === 0 && !isDdConfigured()) {
    const result = await importDemoCatalog(db);
    console.info(`[AutoFlex] Токен постачальника не задано — завантажено демо-каталог (${result.products} товарів)`);
  }

  await seedDemoOrdersIfPending(db);
}

export function initDatabase(db: Db): Promise<void> {
  if (!g.__afDbInit) {
    g.__afDbInit = run(db).catch((error) => {
      g.__afDbInit = undefined;
      throw error;
    });
  }
  return g.__afDbInit;
}

/** Test hook: indexes only, no bootstrap or seed */
export async function initDatabaseForTests(db: Db): Promise<void> {
  await ensureIndexes(db);
}
