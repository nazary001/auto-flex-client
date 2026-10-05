import { cookies } from "next/headers";
import { ACCOUNT_SESSION_TTL_MS } from "@/lib/server/db/repos/accounts";

/*
 * The storefront account cookies. `af_user` carries the random session token (httpOnly, whole
 * site). `af_user_hint` is a plain flag the header reads to decide whether to ask the server who
 * is signed in — it carries no data and is never trusted.
 */

export const ACCOUNT_COOKIE = "af_user";
export const ACCOUNT_HINT_COOKIE = "af_user_hint";

function cookieOptions(expires: Date, httpOnly: boolean) {
  return {
    httpOnly,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

export async function readAccountToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCOUNT_COOKIE)?.value ?? null;
}

/** Call from a Server Action or Route Handler only */
export async function setAccountCookies(token: string, expiresAt?: Date): Promise<void> {
  const store = await cookies();
  const expires = expiresAt ?? new Date(Date.now() + ACCOUNT_SESSION_TTL_MS);
  store.set(ACCOUNT_COOKIE, token, cookieOptions(expires, true));
  store.set(ACCOUNT_HINT_COOKIE, "1", cookieOptions(expires, false));
}

export async function clearAccountCookies(): Promise<void> {
  const store = await cookies();
  const gone = new Date(0);
  store.set(ACCOUNT_COOKIE, "", { ...cookieOptions(gone, true), maxAge: 0 });
  store.set(ACCOUNT_HINT_COOKIE, "", { ...cookieOptions(gone, false), maxAge: 0 });
}
