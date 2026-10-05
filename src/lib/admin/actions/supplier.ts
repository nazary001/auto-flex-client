"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDdConfigured } from "@/lib/server/suppliers/ddtuning/client";
import {
  cancelSync,
  getActiveRun,
  rebuildAllFromSupplier,
  runDdTuningSync,
} from "@/lib/server/suppliers/ddtuning/sync";
import { getSettings, saveSettings } from "@/lib/server/db/repos/settings";
import { nowIso } from "@/lib/server/db/util";
import { ActionError, runAction, type ActionResult } from "./_action";
import { toRunView, type SyncRunView } from "@/lib/admin/supplier-run-view";

export type { SyncRunView };

/*
 * DD Tuning supplier controls (/admin/supplier). Reading the live status needs settings:read;
 * running or cancelling a sync, repricing and saving the pricing policy need settings:write.
 * A full sync of ~100k items runs in 240 s slices: the page's client component calls the start
 * action, then the continue action until the run is done or failed (the page sets maxDuration=300).
 */

const SYNC_BUDGET_MS = 240_000;

/** Light poll target: the currently running or paused run (null when idle). */
export async function getSupplierStatusAction(): Promise<ActionResult<{ run: SyncRunView | null }>> {
  return runAction({
    permission: "settings:read",
    schema: z.object({}).optional(),
    input: {},
    run: async (_data, ctx) => ({ run: toRunView(await getActiveRun(ctx.db)) }),
  });
}

function requireToken(): void {
  if (!isDdConfigured()) {
    throw new ActionError("Токен DD Tuning не налаштовано. Додайте DDTUNING_API_TOKEN у змінні середовища.");
  }
}

/** Starts a sync (or continues an unfinished one) for up to 240 s; the client continues on "paused". */
export async function startSupplierSyncAction(): Promise<ActionResult<{ run: SyncRunView }>> {
  return runAction({
    permission: "settings:write",
    schema: z.object({}).optional(),
    input: {},
    run: async (_data, ctx) => {
      requireToken();
      const run = await runDdTuningSync(ctx.db, { budgetMs: SYNC_BUDGET_MS });
      await ctx.audit({
        action: "supplier.sync",
        entity: "supplier",
        entityId: "DDT",
        summary: `Синхронізація: фаза «${run.phase}», статус «${run.status}»`,
        data: { phase: run.phase, status: run.status, counters: run.counters },
      });
      revalidatePath("/admin/supplier");
      return { run: toRunView(run)! };
    },
  });
}

/** Continues the active run for another 240 s slice. */
export async function continueSupplierSyncAction(): Promise<ActionResult<{ run: SyncRunView | null }>> {
  return runAction({
    permission: "settings:write",
    schema: z.object({}).optional(),
    input: {},
    run: async (_data, ctx) => {
      requireToken();
      const active = await getActiveRun(ctx.db);
      if (!active) return { run: null };
      const run = await runDdTuningSync(ctx.db, { budgetMs: SYNC_BUDGET_MS, runId: active._id });
      if (run.status === "done" || run.status === "failed") {
        await ctx.audit({
          action: "supplier.sync",
          entity: "supplier",
          entityId: "DDT",
          summary: run.status === "done" ? "Синхронізацію завершено" : `Синхронізація завершилася помилкою: ${run.error ?? ""}`,
          data: { status: run.status, counters: run.counters },
        });
      }
      revalidatePath("/admin/supplier");
      return { run: toRunView(run) };
    },
  });
}

export async function cancelSupplierSyncAction(): Promise<ActionResult<{ cancelled: boolean }>> {
  return runAction({
    permission: "settings:write",
    schema: z.object({}).optional(),
    input: {},
    run: async (_data, ctx) => {
      const cancelled = await cancelSync(ctx.db);
      if (cancelled) {
        await ctx.audit({ action: "supplier.cancel", entity: "supplier", entityId: "DDT", summary: "Синхронізацію скасовано" });
      }
      revalidatePath("/admin/supplier");
      return { cancelled };
    },
  });
}

/** Recomputes prices / stock of every supplier product with the current policy (240 s slices). */
export async function rebuildPricesAction(input: unknown): Promise<ActionResult<{ processed: number; complete: boolean; offset: number }>> {
  return runAction({
    permission: "settings:write",
    schema: z.object({ offset: z.coerce.number().int().min(0).default(0) }),
    input,
    run: async ({ offset }, ctx) => {
      const result = await rebuildAllFromSupplier(ctx.db, { budgetMs: SYNC_BUDGET_MS, offset });
      if (result.complete) {
        await ctx.audit({
          action: "supplier.reprice",
          entity: "supplier",
          entityId: "DDT",
          summary: "Ціни перераховано за поточною політикою",
          data: { processed: result.processed },
        });
      }
      revalidatePath("/admin/supplier");
      return result;
    },
  });
}

const settingsSchema = z.object({
  priceSource: z.enum(["retail", "cost_markup"]),
  markupPercent: z.coerce.number().min(0).max(1000),
  roundTo: z.coerce.number().int().min(0).max(1000),
  ratesSource: z.enum(["nbu", "manual"]),
  eur: z.coerce.number().min(0).max(100000),
  usd: z.coerce.number().min(0).max(100000),
  autoSyncEnabled: z.boolean(),
});

export async function saveSupplierSettingsAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "settings:write",
    schema: settingsSchema,
    input,
    run: async (data, ctx) => {
      if (data.ratesSource === "manual" && (data.eur <= 0 || data.usd <= 0)) {
        throw new ActionError("Для ручних курсів вкажіть додатні значення EUR і USD.");
      }
      const current = await getSettings(ctx.db);
      await saveSettings(ctx.db, {
        supplier: {
          priceSource: data.priceSource,
          markupPercent: data.markupPercent,
          roundTo: data.roundTo,
          autoSyncEnabled: data.autoSyncEnabled,
          rates: {
            EUR: data.eur || current.supplier.rates.EUR,
            USD: data.usd || current.supplier.rates.USD,
            source: data.ratesSource,
            updatedAt: nowIso(),
          },
        },
      });
      await ctx.audit({
        action: "supplier.settings",
        entity: "supplier",
        entityId: "DDT",
        summary: `Політику цін оновлено: ${data.priceSource}, націнка ${data.markupPercent}%`,
        data: { priceSource: data.priceSource, markupPercent: data.markupPercent, roundTo: data.roundTo },
      });
      revalidatePath("/admin/supplier");
      revalidatePath("/", "layout");
      return undefined;
    },
  });
}
