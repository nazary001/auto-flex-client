import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/server/db/client";
import { getSettings } from "@/lib/server/db/repos/settings";
import { seedDemoOrdersIfPending } from "@/lib/server/db/init";
import { isDdConfigured } from "@/lib/server/suppliers/ddtuning/client";
import { refreshAwaitingDeliveries } from "@/lib/server/orders/tracking";
import { rebuildAllFromSupplier, runDdTuningSync } from "@/lib/server/suppliers/ddtuning/sync";

/*
 * Scheduled catalog sync (Vercel Cron or any scheduler). Protected by CRON_SECRET:
 *   GET /api/cron/ddtuning-sync  with  Authorization: Bearer <CRON_SECRET>  (or x-cron-secret)
 * Each invocation works for up to ~4 minutes and continues an unfinished run next time.
 */

export const maxDuration = 300;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-cron-secret") ?? "";
  if (header.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(secret));
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const db = await getDb();
  // Parcel statuses first: cheap, and orders must keep moving even when the catalog sync is off
  let tracking: Record<string, unknown>;
  try {
    tracking = await refreshAwaitingDeliveries(db, { limit: 60 });
  } catch (error) {
    console.error("[AutoFlex] Не вдалося оновити статуси посилок", error);
    tracking = { error: error instanceof Error ? error.message : String(error) };
  }
  if (!isDdConfigured()) return Response.json({ ok: false, error: "DDTUNING_API_TOKEN is not set", tracking }, { status: 400 });
  const settings = await getSettings(db);
  const url = new URL(request.url);
  if (!settings.supplier.autoSyncEnabled && url.searchParams.get("force") !== "1") {
    return Response.json({ ok: true, skipped: "autoSyncEnabled is off", tracking });
  }
  // ?content=reset: reload promos and FAQ from the static defaults (src/data), e.g. after a copy update
  if (url.searchParams.get("content") === "reset") {
    const { cols } = await import("@/lib/server/db/collections");
    const { seedContentIfEmpty } = await import("@/lib/server/db/repos/content");
    await cols(db).promos.deleteMany({});
    await cols(db).faq.deleteMany({});
    await seedContentIfEmpty(db);
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");
    return Response.json({ ok: true, content: "reset" });
  }
  // ?rebuild=1[&offset=N]: recompute prices / stock of every supplier product with the current settings (no API calls)
  if (url.searchParams.get("rebuild") === "1") {
    const result = await rebuildAllFromSupplier(db, { budgetMs: 240_000, offset: Number(url.searchParams.get("offset")) || 0 });
    return Response.json({ ok: true, rebuild: result });
  }
  const run = await runDdTuningSync(db, { budgetMs: 240_000 });
  if (run.status === "done") await seedDemoOrdersIfPending(db);
  return Response.json({
    ok: run.status !== "failed",
    status: run.status,
    phase: run.phase,
    offset: run.offset,
    counters: run.counters,
    error: run.error,
    tracking,
  });
}
