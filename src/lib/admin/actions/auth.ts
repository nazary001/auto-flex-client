"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, loginPath } from "@/lib/server/auth/dal";
import { clearLoginFailures, loginBlockedFor, recordLoginFailure } from "@/lib/server/auth/login-limit";
import { passwordProblem, verifyPassword } from "@/lib/server/auth/password";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "@/lib/server/auth/session";
import { getDb } from "@/lib/server/db/client";
import { recordAudit } from "@/lib/server/db/repos/audit";
import { createSession, deleteSession } from "@/lib/server/db/repos/sessions";
import { countUsers, createUser, getUserByEmail, touchLogin } from "@/lib/server/db/repos/users";

/*
 * Sign-in, first-run owner setup and sign-out. Used with useActionState on the login screen.
 */

export interface LoginState {
  error?: string;
  fieldErrors?: { email?: string; password?: string; name?: string; confirm?: string };
}

const loginSchema = z.object({
  email: z.string().trim().min(1, "Вкажіть електронну адресу.").max(120),
  password: z.string().min(1, "Вкажіть пароль.").max(200),
  next: z.string().max(500).optional(),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/admin") && !next.startsWith("/admin/login") && !next.startsWith("//") ? next : "/admin";
}

export async function loginAction(_prev: LoginState | undefined, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "email" || key === "password") fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }
  const { email, password, next } = parsed.data;
  const ip = await clientIp();
  const wait = loginBlockedFor(ip, email);
  if (wait > 0) {
    return { error: `Забагато невдалих спроб. Спробуйте через ${Math.ceil(wait / 60)} хв.` };
  }

  const db = await getDb();
  const user = await getUserByEmail(db, email);
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    recordLoginFailure(ip, email);
    return { error: "Невірна електронна адреса або пароль." };
  }
  if (!user.active) return { error: "Обліковий запис вимкнено. Зверніться до власника магазину." };

  clearLoginFailures(ip, email);
  const h = await headers();
  const { token, expiresAt } = await createSession(db, user.id, h.get("user-agent") ?? undefined);
  await setSessionCookie(token, expiresAt);
  await touchLogin(db, user.id);
  await recordAudit(db, {
    actor: { id: user.id, name: user.name },
    action: "auth.login",
    entity: "user",
    entityId: user.id,
    summary: `${user.name} увійшов до адмінки`,
  });
  redirect(safeNext(next));
}

const setupSchema = z
  .object({
    name: z.string().trim().min(2, "Вкажіть ім'я.").max(80),
    email: z.email("Перевірте електронну адресу.").trim().max(120),
    password: z.string().max(200),
    confirm: z.string().max(200),
  })
  .refine((v) => v.password === v.confirm, { message: "Паролі не збігаються.", path: ["confirm"] });

/** First run only: creates the owner account when the users collection is empty */
export async function setupOwnerAction(_prev: LoginState | undefined, formData: FormData): Promise<LoginState> {
  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const fieldErrors: LoginState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "email" || key === "password" || key === "name" || key === "confirm") fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }
  const problem = passwordProblem(parsed.data.password);
  if (problem) return { fieldErrors: { password: problem } };

  const db = await getDb();
  if ((await countUsers(db)) > 0) return { error: "Обліковий запис власника вже створено. Увійдіть." };

  const user = await createUser(db, {
    email: parsed.data.email,
    name: parsed.data.name,
    role: "owner",
    password: parsed.data.password,
  });
  const h = await headers();
  const { token, expiresAt } = await createSession(db, user.id, h.get("user-agent") ?? undefined);
  await setSessionCookie(token, expiresAt);
  await touchLogin(db, user.id);
  await recordAudit(db, {
    actor: { id: user.id, name: user.name },
    action: "auth.setup",
    entity: "user",
    entityId: user.id,
    summary: `Створено обліковий запис власника ${user.email}`,
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const token = await readSessionToken();
  const user = await getCurrentUser();
  if (token) {
    try {
      const db = await getDb();
      await deleteSession(db, token);
      if (user) {
        await recordAudit(db, {
          actor: { id: user.id, name: user.name },
          action: "auth.logout",
          entity: "user",
          entityId: user.id,
          summary: `${user.name} вийшов з адмінки`,
        });
      }
    } catch (error) {
      console.error("[AutoFlex] Не вдалося завершити сесію", error);
    }
  }
  await clearSessionCookie();
  redirect(loginPath());
}
