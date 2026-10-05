"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomInt } from "node:crypto";
import { isValidUaPhone, normalizePhone } from "@/lib/format";
import { hashPassword } from "@/lib/server/auth/password";
import { deleteAccountSessions, getAccountByCustomerId, setAccountPassword } from "@/lib/server/db/repos/accounts";
import { createCustomer, getCustomer, getCustomerByPhone, updateCustomer } from "@/lib/server/db/repos/customers";
import { ActionError, idSchema, optionalText, runAction, type ActionResult } from "./_action";

/*
 * Customer mutations. Phones are normalised to 380XXXXXXXXX and unique; a clash returns a
 * field error plus the existing customer's id (under `_duplicateId`) so the form can link to it.
 */

const DUPLICATE_MESSAGE = "Клієнт із цим номером уже є";

const nameSchema = z.string().trim().max(80);
const phoneSchema = z
  .string()
  .trim()
  .min(1, "Вкажіть номер телефону.")
  .refine(isValidUaPhone, "Невірний номер телефону.");
const emailSchema = optionalText(120).refine(
  (v) => v === undefined || z.email().safeParse(v).success,
  "Перевірте електронну адресу.",
);
const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(20);

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

function duplicate(id: string): ActionError {
  return new ActionError(DUPLICATE_MESSAGE, { phone: DUPLICATE_MESSAGE, _duplicateId: id });
}

function displayName(firstName: string, lastName: string, phone: string): string {
  return `${firstName} ${lastName}`.trim() || phone;
}

const createSchema = z.object({
  firstName: z.string().trim().min(1, "Вкажіть імʼя клієнта.").max(80),
  lastName: nameSchema.optional(),
  phone: phoneSchema,
  email: emailSchema,
  city: optionalText(120),
  tags: tagsSchema.optional(),
  notes: optionalText(2000),
  doNotCall: z.boolean().optional(),
});

export async function createCustomerAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "customers:write",
    schema: createSchema,
    input,
    run: async (data, ctx) => {
      const phone = normalizePhone(data.phone);
      const existing = await getCustomerByPhone(ctx.db, phone);
      if (existing) throw duplicate(existing.id);

      let customer;
      try {
        customer = await createCustomer(ctx.db, {
          phone,
          firstName: data.firstName,
          lastName: data.lastName ?? "",
          email: data.email,
          city: data.city,
          tags: data.tags,
          notes: data.notes,
          doNotCall: data.doNotCall,
        });
      } catch (error) {
        if (isDuplicateKey(error)) {
          const clash = await getCustomerByPhone(ctx.db, phone);
          throw duplicate(clash?.id ?? "");
        }
        throw error;
      }

      await ctx.audit({
        action: "customer.create",
        entity: "customer",
        entityId: customer.id,
        summary: `Створено клієнта ${displayName(customer.firstName, customer.lastName, customer.phone)}`,
      });
      revalidatePath("/admin/customers");
      revalidatePath(`/admin/customers/${customer.id}`);
      return { id: customer.id };
    },
  });
}

const updateSchema = z.object({
  id: idSchema,
  firstName: z.string().trim().min(1, "Вкажіть імʼя клієнта.").max(80).optional(),
  lastName: nameSchema.optional(),
  phone: phoneSchema.optional(),
  email: emailSchema,
  city: optionalText(120),
  tags: tagsSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
  doNotCall: z.boolean().optional(),
});

export async function updateCustomerAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "customers:write",
    schema: updateSchema,
    input,
    run: async (data, ctx) => {
      const { id, ...patch } = data;
      const existing = await getCustomer(ctx.db, id);
      if (!existing) throw new ActionError("Клієнта не знайдено.");

      if (patch.phone) {
        const phone = normalizePhone(patch.phone);
        if (phone !== existing.phone) {
          const other = await getCustomerByPhone(ctx.db, phone);
          if (other && other.id !== id) throw duplicate(other.id);
        }
      }

      let updated;
      try {
        updated = await updateCustomer(ctx.db, id, patch);
      } catch (error) {
        if (isDuplicateKey(error)) {
          const clash = patch.phone ? await getCustomerByPhone(ctx.db, normalizePhone(patch.phone)) : null;
          throw duplicate(clash?.id ?? "");
        }
        throw error;
      }
      if (!updated) throw new ActionError("Клієнта не знайдено.");

      await ctx.audit({
        action: "customer.update",
        entity: "customer",
        entityId: id,
        summary: `Оновлено клієнта ${displayName(updated.firstName, updated.lastName, updated.phone)}`,
      });
      revalidatePath("/admin/customers");
      revalidatePath(`/admin/customers/${id}`);
      return { id };
    },
  });
}

// ── storefront account ──────────────────────────────────────

/** 10 characters without look-alikes (0/O, 1/l/I), e.g. "k7Rm2xPq9W" */
function temporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/**
 * Restores access for a customer who lost the password: a one-off temporary password replaces
 * the old one and every session of the account is closed. Shown once, never stored in clear.
 */
export async function issueTemporaryPasswordAction(input: unknown): Promise<ActionResult<{ password: string }>> {
  return runAction({
    permission: "customers:write",
    schema: z.object({ customerId: idSchema }),
    input,
    run: async ({ customerId }, ctx) => {
      const account = await getAccountByCustomerId(ctx.db, customerId);
      if (!account) throw new ActionError("У цього клієнта немає акаунта на сайті.");
      const password = temporaryPassword();
      await setAccountPassword(ctx.db, account._id, await hashPassword(password));
      await deleteAccountSessions(ctx.db, account._id);
      await ctx.audit({
        action: "customer.password_reset",
        entity: "customer",
        entityId: customerId,
        summary: `Видано тимчасовий пароль для акаунта ${account.email}`,
      });
      revalidatePath(`/admin/customers/${customerId}`);
      return { password };
    },
  });
}
