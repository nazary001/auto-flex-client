import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/server/auth/password";
import { clearLoginFailures, loginBlockedFor, recordLoginFailure } from "@/lib/server/auth/login-limit";
import { createSession, deleteSession, deleteUserSessions, getSessionUser } from "@/lib/server/db/repos/sessions";
import { createUser, DuplicateEmailError, getUserByEmail, updateUser } from "@/lib/server/db/repos/users";
import { startTestDb, stopTestDb } from "@/lib/server/db/testing";

let db: Db;

beforeAll(async () => {
  db = await startTestDb();
});

afterAll(async () => {
  await stopTestDb();
});

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const hash = await hashPassword("Secret123");
    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("Secret123", hash)).toBe(true);
    expect(await verifyPassword("secret123", hash)).toBe(false);
    expect(await verifyPassword("Secret123", "garbage")).toBe(false);
  });

  it("rejects weak passwords", () => {
    expect(passwordProblem("short1")).not.toBeNull();
    expect(passwordProblem("onlyletters")).not.toBeNull();
    expect(passwordProblem("Secret123")).toBeNull();
  });
});

describe("users and sessions", () => {
  it("creates users with unique e-mails and resolves sessions", async () => {
    const user = await createUser(db, { email: "Owner@Example.com", name: "Власник", role: "owner", password: "Secret123" });
    expect(user.email).toBe("Owner@Example.com");
    await expect(createUser(db, { email: "owner@example.com", name: "Dup", role: "viewer", password: "Secret123" })).rejects.toThrow(DuplicateEmailError);

    const stored = await getUserByEmail(db, "OWNER@example.com");
    expect(stored?.id).toBe(user.id);
    expect(await verifyPassword("Secret123", stored!.passwordHash)).toBe(true);

    const { token } = await createSession(db, user.id, "vitest");
    expect(token.length).toBeGreaterThan(30);
    expect((await getSessionUser(db, token))?.id).toBe(user.id);
    expect(await getSessionUser(db, "nope")).toBeNull();

    await updateUser(db, user.id, { active: false });
    expect(await getSessionUser(db, token)).toBeNull();
    await updateUser(db, user.id, { active: true });
    expect((await getSessionUser(db, token))?.id).toBe(user.id);

    await deleteSession(db, token);
    expect(await getSessionUser(db, token)).toBeNull();

    const a = await createSession(db, user.id);
    const b = await createSession(db, user.id);
    await deleteUserSessions(db, user.id);
    expect(await getSessionUser(db, a.token)).toBeNull();
    expect(await getSessionUser(db, b.token)).toBeNull();
  });
});

describe("login limiter", () => {
  it("blocks after eight failures within the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < 7; i++) recordLoginFailure("1.2.3.4", "a@b.c", now + i);
    expect(loginBlockedFor("1.2.3.4", "a@b.c", now + 10)).toBe(0);
    recordLoginFailure("1.2.3.4", "a@b.c", now + 8);
    expect(loginBlockedFor("1.2.3.4", "a@b.c", now + 10)).toBeGreaterThan(0);
    expect(loginBlockedFor("1.2.3.4", "other@b.c", now + 10)).toBe(0);
    expect(loginBlockedFor("1.2.3.4", "a@b.c", now + 16 * 60 * 1000)).toBe(0);
    clearLoginFailures("1.2.3.4", "a@b.c");
    expect(loginBlockedFor("1.2.3.4", "a@b.c", now + 10)).toBe(0);
  });
});
