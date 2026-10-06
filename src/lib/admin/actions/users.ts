"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { roleLabel } from "@/lib/admin/labels";
import { passwordProblem, verifyPassword } from "@/lib/server/auth/password";
import { deleteUserSessions } from "@/lib/server/db/repos/sessions";
import {
  countActiveOwners,
  createUser,
  DuplicateEmailError,
  getUserByEmail,
  getUserById,
  setPassword,
  updateUser,
} from "@/lib/server/db/repos/users";
import { ActionError, idSchema, runAction, type ActionResult } from "./_action";

/*
 * User administration. Creating, editing roles / activity and resetting passwords require
 * `users:write` (owner only). Every signed-in user can edit their own profile and change their
 * own password through the profile actions, which take no extra permission.
 *
 * Invariant: the store must always keep at least one active owner, enforced here as well as in
 * the UI, so an owner cannot lock everyone out by demoting or deactivating the last owner.
 */

const roleSchema = z.enum(["owner", "manager", "viewer"]);

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Вкажіть ім'я.").max(80),
  email: z.email("Перевірте електронну адресу.").trim().max(120),
  role: roleSchema,
  password: z.string().max(200),
});

export async function createUserAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "users:write",
    schema: createUserSchema,
    input,
    run: async (data, ctx) => {
      const problem = passwordProblem(data.password);
      if (problem) throw new ActionError(problem, { password: problem });
      try {
        const user = await createUser(ctx.db, {
          name: data.name,
          email: data.email,
          role: data.role,
          password: data.password,
        });
        await ctx.audit({
          action: "user.create",
          entity: "user",
          entityId: user.id,
          summary: `Створено користувача ${user.email} — ${roleLabel[user.role]}`,
        });
        revalidatePath("/admin/users");
        return { id: user.id };
      } catch (error) {
        if (error instanceof DuplicateEmailError) throw new ActionError(error.message, { email: error.message });
        throw error;
      }
    },
  });
}

const updateUserSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(2, "Вкажіть ім'я.").max(80).optional(),
  email: z.email("Перевірте електронну адресу.").trim().max(120).optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
});

export async function updateUserAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "users:write",
    schema: updateUserSchema,
    input,
    run: async (data, ctx) => {
      const target = await getUserById(ctx.db, data.id);
      if (!target) throw new ActionError("Користувача не знайдено.");
      if (target.id === ctx.user.id) {
        throw new ActionError("Відкрийте свій профіль, щоб змінити власні дані.");
      }
      const demoting = data.role !== undefined && data.role !== "owner" && target.role === "owner";
      const deactivating = data.active === false && target.active;
      if (target.role === "owner" && target.active && (demoting || deactivating)) {
        const owners = await countActiveOwners(ctx.db);
        if (owners <= 1) {
          throw new ActionError("Це останній активний власник — його не можна понизити чи вимкнути.");
        }
      }
      let updated: Awaited<ReturnType<typeof updateUser>> = null;
      try {
        updated = await updateUser(ctx.db, data.id, {
          name: data.name,
          email: data.email,
          role: data.role,
          active: data.active,
        });
      } catch (error) {
        if (error instanceof DuplicateEmailError) throw new ActionError(error.message, { email: error.message });
        throw error;
      }
      if (!updated) throw new ActionError("Користувача не знайдено.");
      await ctx.audit({
        action: "user.update",
        entity: "user",
        entityId: data.id,
        summary: `Оновлено користувача ${updated.email} — ${roleLabel[updated.role]}${updated.active ? "" : ", вимкнено"}`,
        data: { role: updated.role, active: updated.active },
      });
      revalidatePath("/admin/users");
      return undefined;
    },
  });
}

const resetPasswordSchema = z.object({ id: idSchema, password: z.string().max(200) });

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "users:write",
    schema: resetPasswordSchema,
    input,
    run: async (data, ctx) => {
      if (data.id === ctx.user.id) {
        throw new ActionError("Змініть власний пароль у своєму профілі.");
      }
      const target = await getUserById(ctx.db, data.id);
      if (!target) throw new ActionError("Користувача не знайдено.");
      const problem = passwordProblem(data.password);
      if (problem) throw new ActionError(problem, { password: problem });
      await setPassword(ctx.db, data.id, data.password);
      await deleteUserSessions(ctx.db, data.id);
      await ctx.audit({
        action: "user.password_reset",
        entity: "user",
        entityId: data.id,
        summary: `Скинуто пароль користувача ${target.email}`,
      });
      revalidatePath("/admin/users");
      return undefined;
    },
  });
}

// ── Self-service (any signed-in user) ───────────────────────

const profileSchema = z.object({ name: z.string().trim().min(2, "Вкажіть ім'я.").max(80) });

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  return runAction({
    schema: profileSchema,
    input,
    run: async (data, ctx) => {
      await updateUser(ctx.db, ctx.user.id, { name: data.name });
      await ctx.audit({
        action: "user.profile",
        entity: "user",
        entityId: ctx.user.id,
        summary: `Оновлено профіль — ${data.name}`,
      });
      revalidatePath("/admin/users/me");
      revalidatePath("/admin", "layout");
      return undefined;
    },
  });
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Введіть поточний пароль.").max(200),
  newPassword: z.string().max(200),
  confirm: z.string().max(200),
});

export async function changeOwnPasswordAction(input: unknown): Promise<ActionResult> {
  return runAction({
    schema: changePasswordSchema,
    input,
    run: async (data, ctx) => {
      const account = await getUserByEmail(ctx.db, ctx.user.email);
      if (!account) throw new ActionError("Обліковий запис не знайдено.");
      const valid = await verifyPassword(data.currentPassword, account.passwordHash);
      if (!valid) throw new ActionError("Невірний поточний пароль.", { currentPassword: "Невірний поточний пароль." });
      if (data.newPassword !== data.confirm) {
        throw new ActionError("Паролі не збігаються.", { confirm: "Паролі не збігаються." });
      }
      const problem = passwordProblem(data.newPassword);
      if (problem) throw new ActionError(problem, { newPassword: problem });
      await setPassword(ctx.db, ctx.user.id, data.newPassword);
      await ctx.audit({
        action: "user.password_change",
        entity: "user",
        entityId: ctx.user.id,
        summary: "Змінено власний пароль",
      });
      revalidatePath("/admin/users/me");
      return undefined;
    },
  });
}
