import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import { parseIdentifier, passwordIssue } from "@/lib/account/identity";
import { hashPassword, verifyPassword } from "@/lib/server/auth/password";
import {
  createAccount,
  createAccountSession,
  deleteAccountSessions,
  DuplicateAccountError,
  findAccountByIdentifier,
  findAccountConflict,
  getAccountBySession,
  setAccountPassword,
  updateAccountContacts,
} from "@/lib/server/db/repos/accounts";
import { createCustomer } from "@/lib/server/db/repos/customers";
import { startTestDb, stopTestDb } from "@/lib/server/db/testing";

let db: Db;

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

describe("login identifiers", () => {
  it("recognises Ukrainian phones in any spelling and lower-cases e-mails", () => {
    expect(parseIdentifier("+38 (097) 123-45-67")).toEqual({ kind: "phone", value: "380971234567" });
    expect(parseIdentifier("0971234567")).toEqual({ kind: "phone", value: "380971234567" });
    expect(parseIdentifier("380971234567")).toEqual({ kind: "phone", value: "380971234567" });
    expect(parseIdentifier(" Ivan.Petrenko@Example.COM ")).toEqual({ kind: "email", value: "ivan.petrenko@example.com" });
    expect(parseIdentifier("ivan@")).toBeNull();
    expect(parseIdentifier("12345")).toBeNull();
    expect(parseIdentifier("")).toBeNull();
  });

  it("checks the password length and surrounding spaces", () => {
    expect(passwordIssue("short")).not.toBeNull();
    expect(passwordIssue(" spaced12")).not.toBeNull();
    expect(passwordIssue("longenough")).toBeNull();
  });
});

describe("customer accounts", () => {
  it("creates one account per customer with a unique phone and e-mail and signs in by either", async () => {
    const customer = await createCustomer(db, { phone: "0971234567", firstName: "", lastName: "", email: "ivan@example.com" });
    const account = await createAccount(db, {
      customerId: customer.id,
      phone: "+38 (097) 123-45-67",
      email: "Ivan@Example.com",
      passwordHash: await hashPassword("secret123"),
    });
    expect(account.phone).toBe("380971234567");
    expect(account.email).toBe("ivan@example.com");
    expect(account.status).toBe("active");

    expect((await findAccountByIdentifier(db, "097 123 45 67"))?._id).toBe(account._id);
    expect((await findAccountByIdentifier(db, "IVAN@example.com"))?._id).toBe(account._id);
    expect(await findAccountByIdentifier(db, "nobody@example.com")).toBeNull();
    expect(await findAccountByIdentifier(db, "not an identifier")).toBeNull();

    expect(await findAccountConflict(db, { phone: "0971234567", email: "other@example.com" })).toBe("phone");
    expect(await findAccountConflict(db, { phone: "0501112233", email: "ivan@example.com" })).toBe("email");
    expect(await findAccountConflict(db, { phone: "0501112233", email: "other@example.com" })).toBeNull();
    expect(await findAccountConflict(db, { phone: "0971234567", email: "ivan@example.com" }, account._id)).toBeNull();

    const other = await createCustomer(db, { phone: "0501112233", firstName: "", lastName: "" });
    await expect(
      createAccount(db, { customerId: other.id, phone: "0501112233", email: "ivan@example.com", passwordHash: "x" }),
    ).rejects.toThrow(DuplicateAccountError);
  });

  it("resolves sessions and signs the other devices out after a password change", async () => {
    const customer = await createCustomer(db, { phone: "0631234567", firstName: "Олена", lastName: "" });
    const account = await createAccount(db, {
      customerId: customer.id,
      phone: "0631234567",
      email: "olena@example.com",
      passwordHash: await hashPassword("secret123"),
    });
    const here = await createAccountSession(db, account._id, "vitest-a");
    const elsewhere = await createAccountSession(db, account._id, "vitest-b");
    expect((await getAccountBySession(db, here.token))?._id).toBe(account._id);
    expect(await getAccountBySession(db, "short")).toBeNull();

    await setAccountPassword(db, account._id, await hashPassword("newsecret1"));
    await deleteAccountSessions(db, account._id, here.token);
    expect((await getAccountBySession(db, here.token))?._id).toBe(account._id);
    expect(await getAccountBySession(db, elsewhere.token)).toBeNull();

    const fresh = await findAccountByIdentifier(db, "olena@example.com");
    expect(await verifyPassword("newsecret1", fresh!.passwordHash)).toBe(true);
    expect(await verifyPassword("secret123", fresh!.passwordHash)).toBe(false);

    await updateAccountContacts(db, account._id, { phone: "0631234567", email: "Olena.New@Example.com" });
    expect((await findAccountByIdentifier(db, "olena.new@example.com"))?._id).toBe(account._id);
    await expect(updateAccountContacts(db, account._id, { phone: "0971234567", email: "olena.new@example.com" })).rejects.toThrow(
      DuplicateAccountError,
    );
  });
});
