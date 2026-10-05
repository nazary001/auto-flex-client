import { cookies } from "next/headers";
import { SESSION_TTL_MS } from "@/lib/server/db/repos/sessions";

/*
 * The admin session cookie. Only the random token travels in the cookie; the database keeps
 * its hash (see repos/sessions). Scoped to /admin so the storefront never sees it.
 */

export const SESSION_COOKIE = "af_admin";

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    expires,
  };
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** Call from a Server Action or Route Handler only */
export async function setSessionCookie(token: string, expiresAt?: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt ?? new Date(Date.now() + SESSION_TTL_MS)));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}
