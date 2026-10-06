import fs from "node:fs";
import path from "node:path";
import { MongoClient, type Db } from "mongodb";
import { initDatabase } from "./init";

/*
 * One MongoClient per process, cached on globalThis so that HMR in development and warm
 * serverless instances reuse the connection pool.
 *
 *   MONGODB_URI  Atlas connection string (required in production)
 *   MONGODB_DB   database name, default "autoflex"
 *
 * Without MONGODB_URI outside production a local MongoDB is started with
 * mongodb-memory-server; its data lives in ./data/mongo so it survives restarts.
 */

interface MongoGlobal {
  __afMongo?: { client: MongoClient; db: Db };
  __afMongoPromise?: Promise<Db>;
  __afMemoryServer?: { stop: () => Promise<boolean> };
}

const g = globalThis as unknown as MongoGlobal;

export const DEFAULT_DB_NAME = "autoflex";

export class DatabaseUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DatabaseUnavailableError";
  }
}

function localDbAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_LOCAL_DB === "true";
}

/*
 * turbopackIgnore: without it the bundler statically resolves this path and traces the whole data
 * directory into the build output (`next build` then fails on the lock files of a running mongod).
 */
function localDataDir(): string {
  const configured = process.env.LOCAL_MONGO_PATH?.trim() || "data/mongo";
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

interface LocalMongoInfo {
  uri: string;
  pid: number;
  startedAt: string;
}

/** Where the running local instance publishes its URI for sibling processes (build workers, scripts, tests) */
function localInfoFile(dbPath: string): string {
  return path.join(path.dirname(dbPath), "local-mongo.json");
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** URI of a local instance that another process already runs, if that process and the instance still answer */
async function existingLocalMongo(infoFile: string): Promise<string | null> {
  let info: LocalMongoInfo;
  try {
    info = JSON.parse(fs.readFileSync(infoFile, "utf8")) as LocalMongoInfo;
  } catch {
    return null;
  }
  if (!info?.uri || !info.pid || !processAlive(info.pid)) return null;
  const probe = new MongoClient(info.uri, { serverSelectionTimeoutMS: 1500, connectTimeoutMS: 1500 });
  try {
    await probe.connect();
    await probe.db("admin").command({ ping: 1 });
    return info.uri;
  } catch {
    return null;
  } finally {
    await probe.close().catch(() => undefined);
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function startLocalMongo(): Promise<string> {
  const dbPath = localDataDir();
  fs.mkdirSync(dbPath, { recursive: true });
  const infoFile = localInfoFile(dbPath);
  // The data directory holds a single-process lock: when the dev server (or a sibling build worker)
  // already runs the instance, share it instead of failing on the lock.
  const shared = await existingLocalMongo(infoFile);
  if (shared) {
    console.info(`[AutoFlex] Використовую вже запущений локальний MongoDB (${shared})`);
    return shared;
  }
  // turbopackIgnore: the package is external (next.config.ts) and must not be traced into the build output
  const { MongoMemoryServer } = await import(/* turbopackIgnore: true */ "mongodb-memory-server");
  const port = Number(process.env.LOCAL_MONGO_PORT) || undefined;
  try {
    const server = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: "wiredTiger", port },
    });
    g.__afMemoryServer = server;
    const uri = server.getUri();
    const info: LocalMongoInfo = { uri, pid: process.pid, startedAt: new Date().toISOString() };
    fs.writeFileSync(infoFile, JSON.stringify(info));
    console.info(`[AutoFlex] MONGODB_URI не задано — запущено локальний MongoDB (${uri}), дані в ${dbPath}`);
    return uri;
  } catch (error) {
    // lost the race against a sibling that is starting the instance right now — wait for it to publish the URI
    for (let attempt = 0; attempt < 20; attempt++) {
      await sleep(1000);
      const uri = await existingLocalMongo(infoFile);
      if (uri) return uri;
    }
    throw error;
  }
}

async function connect(): Promise<Db> {
  let uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    if (!localDbAllowed()) {
      throw new DatabaseUnavailableError(
        "MONGODB_URI is not set. Add the MongoDB Atlas connection string to the environment (see .env.example).",
      );
    }
    uri = await startLocalMongo();
  }
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
    appName: "autoflex-admin",
  });
  try {
    await client.connect();
  } catch (error) {
    throw new DatabaseUnavailableError("Не вдалося підключитися до MongoDB.", { cause: error });
  }
  const db = client.db(process.env.MONGODB_DB?.trim() || DEFAULT_DB_NAME);
  try {
    await initDatabase(db);
  } catch (error) {
    // Otherwise every failed request leaks a connected client (and its pool) until the instance dies
    await client.close().catch(() => undefined);
    throw error;
  }
  g.__afMongo = { client, db };
  return db;
}

/** Connected, indexed and (in development) seeded database */
export function getDb(): Promise<Db> {
  if (g.__afMongo) return Promise.resolve(g.__afMongo.db);
  if (!g.__afMongoPromise) {
    g.__afMongoPromise = connect().catch((error) => {
      g.__afMongoPromise = undefined;
      throw error;
    });
  }
  return g.__afMongoPromise;
}

/** True once a connection has been established in this process (cheap check for health UIs) */
export function isDbConnected(): boolean {
  return Boolean(g.__afMongo);
}

/** Test hook: use an already-connected client instead of the environment */
export function setDbForTests(client: MongoClient, db: Db): void {
  g.__afMongo = { client, db };
  g.__afMongoPromise = undefined;
}

export async function closeDb(): Promise<void> {
  const current = g.__afMongo;
  g.__afMongo = undefined;
  g.__afMongoPromise = undefined;
  if (current) await current.client.close();
  if (g.__afMemoryServer) {
    await g.__afMemoryServer.stop();
    g.__afMemoryServer = undefined;
  }
}
