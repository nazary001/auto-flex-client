import { cache } from "react";
import { redirect } from "next/navigation";
import type { Customer, CustomerAccount } from "@/lib/admin/types";
import { getDb } from "@/lib/server/db/client";
import { getAccountBySession, toAccount } from "@/lib/server/db/repos/accounts";
import { getCustomer } from "@/lib/server/db/repos/customers";
import { readAccountToken } from "./session";

/*
 * Who is signed in to the storefront for this request. Pages call requireAccount(); Server
 * Actions and Route Handlers call getCurrentAccount() and handle null themselves.
 */

export interface AccountContext {
  account: CustomerAccount;
  /** CRM customer that owns the profile data (name, city, address) and the orders */
  customer: Customer;
}

export const getCurrentAccount = cache(async (): Promise<AccountContext | null> => {
  const token = await readAccountToken();
  if (!token) return null;
  try {
    const db = await getDb();
    const doc = await getAccountBySession(db, token);
    if (!doc) return null;
    const customer = await getCustomer(db, doc.customerId);
    return customer ? { account: toAccount(doc), customer } : null;
  } catch (error) {
    console.error("[AutoFlex] Не вдалося перевірити сесію покупця", error);
    return null;
  }
});

/** Only same-site paths are allowed as a return address; the back office is never one */
export function safeAccountNext(next: string | undefined | null, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/admin")) return fallback;
  if (next.startsWith("/account/login") || next.startsWith("/account/register")) return fallback;
  return next.length > 500 ? fallback : next;
}

export function accountLoginPath(next?: string): string {
  const target = safeAccountNext(next, "");
  return target ? `/account/login?next=${encodeURIComponent(target)}` : "/account/login";
}

/** For pages: redirects guests to the login screen and comes back afterwards */
export async function requireAccount(currentPath?: string): Promise<AccountContext> {
  const context = await getCurrentAccount();
  if (!context) redirect(accountLoginPath(currentPath));
  return context;
}
