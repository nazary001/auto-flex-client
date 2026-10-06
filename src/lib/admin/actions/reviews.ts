"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProductById, searchCatalog } from "@/lib/catalog";
import {
  createReview,
  deleteReview,
  getReview,
  setReviewStatus,
  updateReview,
} from "@/lib/server/db/repos/reviews";
import { ActionError, runAction, type ActionResult } from "./_action";

/*
 * Review moderation (permission content:write). Approving / rejecting / editing a review changes
 * what the storefront shows (the repo recomputes the product rating), so every write revalidates
 * the storefront layout, the product page and the admin queue.
 */

const reviewStatusEnum = z.enum(["pending", "approved", "rejected"]);

async function afterReviewWrite(productId: string | undefined): Promise<void> {
  revalidatePath("/", "layout");
  revalidatePath("/admin/reviews");
  if (productId) {
    const slug = (await getProductById(productId))?.slug;
    if (slug) revalidatePath(`/product/${slug}`);
  }
}

export async function setReviewStatusAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "content:write",
    schema: z.object({ id: z.string().min(1), status: reviewStatusEnum }),
    input,
    run: async ({ id, status }, ctx) => {
      const review = await setReviewStatus(ctx.db, id, status);
      if (!review) throw new ActionError("Відгук не знайдено.");
      await ctx.audit({
        action: "review.status",
        entity: "review",
        entityId: id,
        summary: `Відгук ${status === "approved" ? "опубліковано" : status === "rejected" ? "відхилено" : "на модерації"}`,
      });
      await afterReviewWrite(review.productId);
      return undefined;
    },
  });
}

export async function updateReviewAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "content:write",
    schema: z.object({
      id: z.string().min(1),
      author: z.string().trim().min(1, "Вкажіть автора.").max(120),
      rating: z.coerce.number().int().min(1).max(5),
      text: z.string().trim().min(1, "Текст відгуку не може бути порожнім.").max(4000),
      car: z.string().trim().max(120).optional(),
      date: z.string().trim().max(40).optional(),
    }),
    input,
    run: async ({ id, author, rating, text, car, date }, ctx) => {
      const review = await updateReview(ctx.db, id, {
        author,
        rating,
        text,
        // Pass an emptied car through as "" so the repo can clear it (collapsing to undefined would ignore it).
        car,
        ...(date ? { date: date.slice(0, 10) } : {}),
      });
      if (!review) throw new ActionError("Відгук не знайдено.");
      await ctx.audit({ action: "review.update", entity: "review", entityId: id, summary: `Відгук відредаговано` });
      await afterReviewWrite(review.productId);
      return undefined;
    },
  });
}

export async function deleteReviewAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "content:write",
    schema: z.object({ id: z.string().min(1) }),
    input,
    run: async ({ id }, ctx) => {
      const review = await getReview(ctx.db, id);
      await deleteReview(ctx.db, id);
      await ctx.audit({ action: "review.delete", entity: "review", entityId: id, summary: `Відгук видалено` });
      await afterReviewWrite(review?.productId);
      return undefined;
    },
  });
}

export async function createReviewAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "content:write",
    schema: z.object({
      productId: z.string().min(1, "Оберіть товар."),
      author: z.string().trim().min(1, "Вкажіть автора.").max(120),
      rating: z.coerce.number().int().min(1).max(5),
      text: z.string().trim().min(1, "Напишіть текст відгуку.").max(4000),
      car: z.string().trim().max(120).optional(),
      date: z.string().trim().max(40).optional(),
    }),
    input,
    run: async ({ productId, author, rating, text, car, date }, ctx) => {
      if (!(await getProductById(productId))) throw new ActionError("Товар не знайдено.", { productId: "Оберіть товар зі списку." });
      const review = await createReview(ctx.db, {
        productId,
        author,
        rating,
        text,
        car: car || undefined,
        status: "approved",
        source: "admin",
        ...(date ? { date } : {}),
      });
      await ctx.audit({ action: "review.create", entity: "review", entityId: review.id, summary: `Додано відгук до товару` });
      await afterReviewWrite(productId);
      return { id: review.id };
    },
  });
}

export async function searchProductsForReviewAction(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string; sku: string }[]>> {
  return runAction({
    permission: "content:read",
    schema: z.object({ q: z.string().trim().max(120) }),
    input,
    run: async ({ q }) => {
      if (q.length < 2) return [];
      const result = await searchCatalog(q, 10);
      return result.products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }));
    },
  });
}
