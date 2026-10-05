"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requestStatusMeta } from "@/lib/admin/labels";
import { getRequest, updateRequest } from "@/lib/server/db/repos/requests";
import { getUserById } from "@/lib/server/db/repos/users";
import type { CustomerRequest } from "@/lib/admin/types";
import { ActionError, idSchema, optionalText, runAction, type ActionResult } from "./_action";

/*
 * Request inbox mutations: move a request through new → in_progress → done / spam, (re)assign it
 * and keep a short result note. Every change is audited and refreshes the inbox and any open
 * customer card (requests are shown there by phone).
 */

function revalidateRequests(): void {
  revalidatePath("/admin/requests");
  // Requests surface on the customer card (matched by phone), so refresh any open one.
  revalidatePath("/admin/customers/[id]", "page");
}

const requestStatusEnum = z.enum(["new", "in_progress", "done", "spam"]);

const setStatusSchema = z.object({
  id: idSchema,
  status: requestStatusEnum,
  resultNote: optionalText(1000),
  assignToMe: z.boolean().optional(),
});

export async function setRequestStatusAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "requests:write",
    schema: setStatusSchema,
    input,
    run: async (data, ctx) => {
      const request = await getRequest(ctx.db, data.id);
      if (!request) throw new ActionError("Заявку не знайдено.");

      const patch: Partial<Pick<CustomerRequest, "status" | "assigneeId" | "resultNote">> = { status: data.status };
      if (data.resultNote !== undefined) patch.resultNote = data.resultNote;
      if (data.assignToMe && ctx.user.id) patch.assigneeId = ctx.user.id;

      await updateRequest(ctx.db, data.id, patch);
      await ctx.audit({
        action: "request.status",
        entity: "request",
        entityId: data.id,
        summary: `Заявку від ${request.phone} → ${requestStatusMeta[data.status].label}`,
        data: { from: request.status, to: data.status },
      });
      revalidateRequests();
      return { id: data.id };
    },
  });
}

const assignSchema = z.object({
  id: idSchema,
  /** Empty string clears the assignment */
  assigneeId: z.string().trim().max(80),
});

export async function assignRequestAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "requests:write",
    schema: assignSchema,
    input,
    run: async (data, ctx) => {
      const request = await getRequest(ctx.db, data.id);
      if (!request) throw new ActionError("Заявку не знайдено.");

      const assigneeId = data.assigneeId || undefined;
      let summary = `Знято відповідального із заявки від ${request.phone}`;
      if (assigneeId) {
        const user = await getUserById(ctx.db, assigneeId);
        if (!user) throw new ActionError("Користувача не знайдено.");
        summary = `Заявку від ${request.phone} призначено: ${user.name}`;
      }

      await updateRequest(ctx.db, data.id, { assigneeId });
      await ctx.audit({
        action: "request.assign",
        entity: "request",
        entityId: data.id,
        summary,
        data: { assigneeId: assigneeId ?? null },
      });
      revalidateRequests();
      return { id: data.id };
    },
  });
}

const noteSchema = z.object({
  id: idSchema,
  resultNote: z.string().trim().max(1000),
});

export async function requestNoteAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "requests:write",
    schema: noteSchema,
    input,
    run: async (data, ctx) => {
      const request = await getRequest(ctx.db, data.id);
      if (!request) throw new ActionError("Заявку не знайдено.");

      await updateRequest(ctx.db, data.id, { resultNote: data.resultNote || undefined });
      await ctx.audit({
        action: "request.note",
        entity: "request",
        entityId: data.id,
        summary: `Нотатка до заявки від ${request.phone}`,
      });
      revalidateRequests();
      return { id: data.id };
    },
  });
}
