"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FaqItem, Promo } from "@/lib/types";
import {
  deleteFaq,
  deletePromo,
  getFaqItem,
  getPromo,
  reorderFaq,
  reorderPromos,
  saveFaq,
  savePromo,
} from "@/lib/server/db/repos/content";
import { ActionError, idSchema, runAction, type ActionResult } from "./_action";

/*
 * Content mutations: home-page / «Акції» promotions and the FAQ. Every write refreshes the
 * storefront (`revalidatePath("/", "layout")`) so the public pages pick the change up at once,
 * and the admin list. Content lives in the DB (seeded from the static files on first run).
 */

function revalidatePromos(id?: string): void {
  revalidatePath("/admin/promos");
  if (id) revalidatePath(`/admin/promos/${id}`);
  revalidatePath("/", "layout");
}

function revalidateFaq(): void {
  revalidatePath("/admin/faq");
  revalidatePath("/", "layout");
}

// ── Promos ──────────────────────────────────────────────────

const promoSchema = z.object({
  id: idSchema.optional(),
  slug: z
    .string()
    .trim()
    .min(1, "Вкажіть ідентифікатор.")
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Лише малі латинські літери, цифри та дефіс."),
  title: z.string().trim().min(1, "Вкажіть заголовок.").max(120),
  text: z.string().trim().min(1, "Додайте опис акції.").max(600),
  period: z.string().trim().max(60),
  href: z
    .string()
    .trim()
    .min(1, "Вкажіть посилання.")
    .max(200)
    .refine((value) => value.startsWith("/"), "Посилання має починатися з «/»."),
  cta: z.string().trim().min(1, "Вкажіть текст кнопки.").max(40),
  illustration: z.string().trim().min(1, "Оберіть ілюстрацію.").max(80),
  tone: z.enum(["navy", "blue", "light"]),
  active: z.boolean().optional(),
});

export async function savePromoAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "content:write",
    schema: promoSchema,
    input,
    run: async (data, ctx) => {
      const promo: Promo = {
        slug: data.slug,
        title: data.title,
        text: data.text,
        period: data.period,
        href: data.href,
        cta: data.cta,
        illustration: data.illustration,
        tone: data.tone,
      };
      const saved = await savePromo(ctx.db, { id: data.id, data: promo, active: data.active });
      await ctx.audit({
        action: data.id ? "promo.update" : "promo.create",
        entity: "promo",
        entityId: saved.id,
        summary: `${data.id ? "Оновлено" : "Створено"} акцію «${promo.title}»`,
        data: { slug: promo.slug, tone: promo.tone },
      });
      revalidatePromos(saved.id);
      return { id: saved.id };
    },
  });
}

const setActiveSchema = z.object({ id: idSchema, active: z.boolean() });

export async function setPromoActiveAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "content:write",
    schema: setActiveSchema,
    input,
    run: async (data, ctx) => {
      const existing = await getPromo(ctx.db, data.id);
      if (!existing) throw new ActionError("Акцію не знайдено.");
      await savePromo(ctx.db, { id: data.id, data: existing.data, active: data.active });
      await ctx.audit({
        action: "promo.active",
        entity: "promo",
        entityId: data.id,
        summary: `Акцію «${existing.data.title}» ${data.active ? "показано" : "приховано"}`,
      });
      revalidatePromos(data.id);
      return undefined;
    },
  });
}

const reorderSchema = z.object({ ids: z.array(idSchema).min(1).max(100) });

export async function reorderPromosAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "content:write",
    schema: reorderSchema,
    input,
    run: async (data, ctx) => {
      await reorderPromos(ctx.db, data.ids);
      await ctx.audit({
        action: "promo.reorder",
        entity: "promo",
        entityId: "list",
        summary: "Змінено порядок акцій",
        data: { ids: data.ids },
      });
      revalidatePromos();
      return undefined;
    },
  });
}

export async function deletePromoAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "content:write",
    schema: z.object({ id: idSchema }),
    input,
    run: async (data, ctx) => {
      const existing = await getPromo(ctx.db, data.id);
      await deletePromo(ctx.db, data.id);
      await ctx.audit({
        action: "promo.delete",
        entity: "promo",
        entityId: data.id,
        summary: `Видалено акцію «${existing?.data.title ?? data.id}»`,
      });
      revalidatePromos();
      return undefined;
    },
  });
}

// ── FAQ ─────────────────────────────────────────────────────

const faqSchema = z.object({
  id: idSchema.optional(),
  question: z.string().trim().min(1, "Вкажіть питання.").max(200),
  answer: z.string().trim().min(1, "Додайте відповідь.").max(2000),
  active: z.boolean().optional(),
});

export async function saveFaqAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "content:write",
    schema: faqSchema,
    input,
    run: async (data, ctx) => {
      const item: FaqItem = { question: data.question, answer: data.answer };
      const saved = await saveFaq(ctx.db, { id: data.id, data: item, active: data.active });
      await ctx.audit({
        action: data.id ? "faq.update" : "faq.create",
        entity: "faq",
        entityId: saved.id,
        summary: `${data.id ? "Оновлено" : "Додано"} питання «${item.question}»`,
      });
      revalidateFaq();
      return { id: saved.id };
    },
  });
}

export async function setFaqActiveAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "content:write",
    schema: setActiveSchema,
    input,
    run: async (data, ctx) => {
      const existing = await getFaqItem(ctx.db, data.id);
      if (!existing) throw new ActionError("Питання не знайдено.");
      await saveFaq(ctx.db, { id: data.id, data: existing.data, active: data.active });
      await ctx.audit({
        action: "faq.active",
        entity: "faq",
        entityId: data.id,
        summary: `Питання «${existing.data.question}» ${data.active ? "показано" : "приховано"}`,
      });
      revalidateFaq();
      return undefined;
    },
  });
}

export async function reorderFaqAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "content:write",
    schema: reorderSchema,
    input,
    run: async (data, ctx) => {
      await reorderFaq(ctx.db, data.ids);
      await ctx.audit({
        action: "faq.reorder",
        entity: "faq",
        entityId: "list",
        summary: "Змінено порядок питань",
        data: { ids: data.ids },
      });
      revalidateFaq();
      return undefined;
    },
  });
}

export async function deleteFaqAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "content:write",
    schema: z.object({ id: idSchema }),
    input,
    run: async (data, ctx) => {
      const existing = await getFaqItem(ctx.db, data.id);
      await deleteFaq(ctx.db, data.id);
      await ctx.audit({
        action: "faq.delete",
        entity: "faq",
        entityId: data.id,
        summary: `Видалено питання «${existing?.data.question ?? data.id}»`,
      });
      revalidateFaq();
      return undefined;
    },
  });
}
