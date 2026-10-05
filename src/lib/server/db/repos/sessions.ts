import { createHash, randomBytes } from "node:crypto";
import type { Db } from "mongodb";
import type { AdminUser } from "@/lib/admin/types";
import { cols } from "../collections";
import { getUserById } from "./users";

/*
 * Database sessions. The browser holds a random token; the database stores only its
 * SHA-256, so a leaked dump cannot be replayed. Expired sessions are removed by a TTL index.
 */

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  db: Db,
  userId: string,
  userAgent?: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await cols(db).sessions.insertOne({
    _id: hashToken(token),
    userId,
    createdAt: now,
    expiresAt,
    userAgent: userAgent?.slice(0, 200),
  });
  return { token, expiresAt };
}

/** The active user behind a token, or null when the session or user is gone / inactive */
export async function getSessionUser(db: Db, token: string): Promise<AdminUser | null> {
  if (!token || token.length < 16) return null;
  const session = await cols(db).sessions.findOne({ _id: hashToken(token) });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  const user = await getUserById(db, session.userId);
  return user && user.active ? user : null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await cols(db).sessions.deleteOne({ _id: hashToken(token) });
}

export async function deleteUserSessions(db: Db, userId: string): Promise<void> {
  await cols(db).sessions.deleteMany({ userId });
}
