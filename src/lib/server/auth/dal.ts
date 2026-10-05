import { cache } from "react";
import { redirect } from "next/navigation";
import { can, type Permission } from "@/lib/admin/permissions";
import type { Actor, AdminUser } from "@/lib/admin/types";
import { getDb } from "@/lib/server/db/client";
import { getSessionUser } from "@/lib/server/db/repos/sessions";
import { readSessionToken } from "./session";

/*
 * Data access layer for authentication. Every admin page, Server Action and Route Handler
 * goes through these helpers; the proxy only does the optimistic cookie check.
 */

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: "unauthenticated" | "forbidden",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** The signed-in admin user for this request, memoised per render pass */
export const getCurrentUser = cache(async (): Promise<AdminUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  try {
    const db = await getDb();
    return await getSessionUser(db, token);
  } catch (error) {
    console.error("[AutoFlex] Не вдалося перевірити сесію адміністратора", error);
    return null;
  }
});

export function loginPath(next?: string): string {
  const target = next && next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "";
  return target ? `/admin/login?next=${encodeURIComponent(target)}` : "/admin/login";
}

/**
 * For pages and layouts: redirects to the login screen when signed out and to the dashboard
 * (with a flash) when the permission is missing.
 */
export async function requireUser(permission?: Permission, currentPath?: string): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(currentPath));
  if (permission && !can(user, permission)) redirect("/admin?denied=1");
  return user;
}

/** For Server Actions and Route Handlers: throws instead of redirecting */
export async function requireActor(permission?: Permission): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Сесія завершилась. Увійдіть знову.", "unauthenticated");
  if (permission && !can(user, permission)) throw new AuthError("У вас немає прав для цієї дії.", "forbidden");
  return user;
}

export function toActor(user: AdminUser): Actor {
  return { id: user.id, name: user.name };
}
