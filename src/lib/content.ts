import { faq as staticFaq } from "@/data/faq";
import { promos as staticPromos } from "@/data/promos";
import { getDb } from "@/lib/server/db/client";
import { listFaq, listPromos } from "@/lib/server/db/repos/content";
import type { FaqItem, Promo } from "@/lib/types";

/*
 * Editable content for the storefront. The database (managed in the admin) is the source of
 * truth; when it is unreachable the static files keep the site working.
 */

let warned = false;
function warnOnce(error: unknown): void {
  if (warned) return;
  warned = true;
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`[AutoFlex] База даних недоступна — використовуються статичні акції та FAQ (${reason})`);
}

/** Active promotions in display order */
export async function getPromos(): Promise<Promo[]> {
  try {
    const db = await getDb();
    const entries = await listPromos(db);
    return entries.map((entry) => ({ ...entry.data, slug: entry.data.slug || entry.id }));
  } catch (error) {
    warnOnce(error);
    return staticPromos;
  }
}

export async function getPromo(slug: string): Promise<Promo | undefined> {
  const all = await getPromos();
  return all.find((promo) => promo.slug === slug);
}

/** Active FAQ entries in display order */
export async function getFaq(): Promise<FaqItem[]> {
  try {
    const db = await getDb();
    const entries = await listFaq(db);
    return entries.map((entry) => entry.data);
  } catch (error) {
    warnOnce(error);
    return staticFaq;
  }
}
