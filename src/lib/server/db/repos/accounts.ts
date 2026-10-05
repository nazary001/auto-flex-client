import { createHash, randomBytes } from "node:crypto";
import type { Db } from "mongodb";
import { MongoServerError } from "mongodb";
import { normalizeEmail, parseIdentifier } from "@/lib/account/identity";
import type { CustomerAccount } from "@/lib/admin/types";
import { normalizePhone } from "@/lib/format";
import { cols, type AccountDoc } from "../collections";
import { newId, nowIso } from "../util";

/*
 * Storefront accounts and their sessions. An account belongs to exactly one CRM customer; the
 * phone and the e-mail are the login identifiers and are unique across accounts. Sessions follow
 * the admin pattern: the browser holds a random token, the database only its SHA-256.
 */

export const ACCOUNT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class DuplicateAccountError extends Error {
  constructor(public readonly field: "phone" | "email") {
    super(
      field === "phone"
        ? "Користувач із таким номером телефону вже зареєстрований."
        : "Користувач із такою електронною адресою вже зареєстрований.",
    );
    this.name = "DuplicateAccountError";
  }
}

export function toAccount(doc: AccountDoc): CustomerAccount {
  const account: CustomerAccount = {
    id: doc._id,
    customerId: doc.customerId,
    phone: doc.phone,
    email: doc.email,
    status: doc.status,
    createdAt: doc.createdAt,
  };
  if (doc.lastLoginAt) account.lastLoginAt = doc.lastLoginAt;
  return account;
}

/** Which login identifier an existing account already uses, or null when both are free */
export async function findAccountConflict(
  db: Db,
  contacts: { phone: string; email: string },
  exceptId?: string,
): Promise<"phone" | "email" | null> {
  const phone = normalizePhone(contacts.phone);
  const email = normalizeEmail(contacts.email);
  const clash = await cols(db)
    .accounts.find({ $or: [{ phone }, { email }], ...(exceptId ? { _id: { $ne: exceptId } } : {}) })
    .project<{ phone: string; email: string }>({ phone: 1, email: 1 })
    .toArray();
  if (clash.some((a) => a.phone === phone)) return "phone";
  if (clash.some((a) => a.email === email)) return "email";
  return null;
}

function duplicateFrom(error: unknown): DuplicateAccountError | null {
  if (error instanceof MongoServerError && error.code === 11000) {
    const key = Object.keys((error.keyPattern as Record<string, unknown> | undefined) ?? {})[0];
    return new DuplicateAccountError(key === "email" ? "email" : "phone");
  }
  return null;
}

export async function createAccount(
  db: Db,
  input: { customerId: string; phone: string; email: string; passwordHash: string },
): Promise<AccountDoc> {
  const conflict = await findAccountConflict(db, input);
  if (conflict) throw new DuplicateAccountError(conflict);
  const now = nowIso();
  const doc: AccountDoc = {
    _id: newId(),
    customerId: input.customerId,
    phone: normalizePhone(input.phone),
    email: normalizeEmail(input.email),
    passwordHash: input.passwordHash,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  try {
    await cols(db).accounts.insertOne(doc);
  } catch (error) {
    throw duplicateFrom(error) ?? error;
  }
  return doc;
}

export async function getAccountById(db: Db, id: string): Promise<AccountDoc | null> {
  return cols(db).accounts.findOne({ _id: id });
}

export async function getAccountByCustomerId(db: Db, customerId: string): Promise<AccountDoc | null> {
  return cols(db).accounts.findOne({ customerId });
}

/** The account behind what the visitor typed into the login form (phone or e-mail) */
export async function findAccountByIdentifier(db: Db, input: string): Promise<AccountDoc | null> {
  const identifier = parseIdentifier(input);
  if (!identifier) return null;
  return cols(db).accounts.findOne(identifier.kind === "phone" ? { phone: identifier.value } : { email: identifier.value });
}

export async function updateAccountContacts(
  db: Db,
  id: string,
  contacts: { phone: string; email: string },
): Promise<void> {
  const conflict = await findAccountConflict(db, contacts, id);
  if (conflict) throw new DuplicateAccountError(conflict);
  try {
    await cols(db).accounts.updateOne(
      { _id: id },
      { $set: { phone: normalizePhone(contacts.phone), email: normalizeEmail(contacts.email), updatedAt: nowIso() } },
    );
  } catch (error) {
    throw duplicateFrom(error) ?? error;
  }
}

export async function setAccountPassword(db: Db, id: string, passwordHash: string): Promise<void> {
  const now = nowIso();
  await cols(db).accounts.updateOne({ _id: id }, { $set: { passwordHash, passwordChangedAt: now, updatedAt: now } });
}

export async function touchAccountLogin(db: Db, id: string): Promise<void> {
  await cols(db).accounts.updateOne({ _id: id }, { $set: { lastLoginAt: nowIso() } });
}

// ── sessions ────────────────────────────────────────────────

export function hashAccountToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAccountSession(
  db: Db,
  accountId: string,
  userAgent?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACCOUNT_SESSION_TTL_MS);
  await cols(db).accountSessions.insertOne({
    _id: hashAccountToken(token),
    accountId,
    createdAt: now,
    expiresAt,
    userAgent: userAgent?.slice(0, 200),
  });
  return { token, expiresAt };
}

/** The active account behind a token, or null when the session is gone / expired or the account is blocked */
export async function getAccountBySession(db: Db, token: string): Promise<AccountDoc | null> {
  if (!token || token.length < 16) return null;
  const session = await cols(db).accountSessions.findOne({ _id: hashAccountToken(token) });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  const account = await getAccountById(db, session.accountId);
  return account && account.status === "active" ? account : null;
}

export async function deleteAccountSession(db: Db, token: string): Promise<void> {
  await cols(db).accountSessions.deleteOne({ _id: hashAccountToken(token) });
}

/** Signs the account out everywhere, optionally keeping the current browser signed in */
export async function deleteAccountSessions(db: Db, accountId: string, keepToken?: string): Promise<void> {
  await cols(db).accountSessions.deleteMany({
    accountId,
    ...(keepToken ? { _id: { $ne: hashAccountToken(keepToken) } } : {}),
  });
}
