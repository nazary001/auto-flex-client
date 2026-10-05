import type { Db } from "mongodb";
import type { AdminUser, Role } from "@/lib/admin/types";
import { hashPassword } from "@/lib/server/auth/password";
import { cols, type UserDoc } from "../collections";
import { compact, newId, nowIso } from "../util";

export class DuplicateEmailError extends Error {
  constructor() {
    super("Користувач із такою електронною адресою вже існує.");
    this.name = "DuplicateEmailError";
  }
}

function toUser(doc: UserDoc): AdminUser {
  return compact({
    id: doc._id,
    email: doc.email,
    name: doc.name,
    role: doc.role,
    active: doc.active,
    createdAt: doc.createdAt,
    lastLoginAt: doc.lastLoginAt,
  });
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

export async function countUsers(db: Db): Promise<number> {
  return cols(db).users.countDocuments();
}

export async function listUsers(db: Db): Promise<AdminUser[]> {
  const docs = await cols(db).users.find().sort({ createdAt: 1 }).toArray();
  return docs.map(toUser);
}

export async function getUserById(db: Db, id: string): Promise<AdminUser | null> {
  const doc = await cols(db).users.findOne({ _id: id });
  return doc ? toUser(doc) : null;
}

/** For login only: includes the password hash */
export async function getUserByEmail(db: Db, email: string): Promise<(AdminUser & { passwordHash: string }) | null> {
  const doc = await cols(db).users.findOne({ emailLower: email.trim().toLowerCase() });
  return doc ? { ...toUser(doc), passwordHash: doc.passwordHash } : null;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: Role;
  password: string;
}

export async function createUser(db: Db, input: CreateUserInput): Promise<AdminUser> {
  const email = input.email.trim();
  const doc: UserDoc = {
    _id: newId(),
    email,
    emailLower: email.toLowerCase(),
    name: input.name.trim(),
    role: input.role,
    active: true,
    passwordHash: await hashPassword(input.password),
    createdAt: nowIso(),
  };
  try {
    await cols(db).users.insertOne(doc);
  } catch (error) {
    if (isDuplicateKey(error)) throw new DuplicateEmailError();
    throw error;
  }
  return toUser(doc);
}

export async function updateUser(
  db: Db,
  id: string,
  patch: Partial<Pick<AdminUser, "name" | "role" | "active" | "email">>,
): Promise<AdminUser | null> {
  const $set: Record<string, unknown> = compact({ ...patch });
  if (typeof patch.email === "string") {
    $set.email = patch.email.trim();
    $set.emailLower = patch.email.trim().toLowerCase();
  }
  try {
    const doc = await cols(db).users.findOneAndUpdate({ _id: id }, { $set }, { returnDocument: "after" });
    return doc ? toUser(doc) : null;
  } catch (error) {
    if (isDuplicateKey(error)) throw new DuplicateEmailError();
    throw error;
  }
}

export async function setPassword(db: Db, id: string, password: string): Promise<void> {
  await cols(db).users.updateOne({ _id: id }, { $set: { passwordHash: await hashPassword(password) } });
}

export async function touchLogin(db: Db, id: string): Promise<void> {
  await cols(db).users.updateOne({ _id: id }, { $set: { lastLoginAt: nowIso() } });
}

export async function countActiveOwners(db: Db): Promise<number> {
  return cols(db).users.countDocuments({ role: "owner", active: true });
}
