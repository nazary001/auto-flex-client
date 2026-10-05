import { MongoClient, type Db } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { setDbForTests } from "./client";
import { initDatabaseForTests } from "./init";

/*
 * Vitest helper: one in-memory MongoDB per test file. Call `startTestDb()` in beforeAll and
 * `stopTestDb()` in afterAll; repositories then use the test database through getDb().
 */

let server: MongoMemoryServer | null = null;
let client: MongoClient | null = null;

export async function startTestDb(): Promise<Db> {
  server = await MongoMemoryServer.create();
  client = new MongoClient(server.getUri());
  await client.connect();
  const db = client.db(`test-${Math.random().toString(36).slice(2)}`);
  await initDatabaseForTests(db);
  setDbForTests(client, db);
  return db;
}

export async function stopTestDb(): Promise<void> {
  await client?.close();
  await server?.stop();
  client = null;
  server = null;
}

export async function clearTestDb(db: Db): Promise<void> {
  const collections = await db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}
