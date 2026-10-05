import type { Db } from "mongodb";
import { DEFAULT_TEMPLATES } from "@/lib/admin/domain/templates";
import type { StoreSettings } from "@/lib/admin/types";
import { cols } from "../collections";
import { nowIso } from "../util";

export const DEFAULT_SETTINGS: StoreSettings = {
  checkout: {
    delivery: {
      np_branch: { enabled: true },
      np_locker: { enabled: true },
      np_courier: { enabled: true },
      ukrposhta: { enabled: true },
    },
    payment: {
      cod: { enabled: true },
      card_online: { enabled: true },
      installments: { enabled: true },
      invoice: { enabled: true },
    },
  },
  orders: {
    defaultMarkupPercent: 25,
    lowMarginPercent: 10,
    staleNewHours: 4,
    staleSourcingDays: 5,
    staleTransitDays: 7,
  },
  notifications: {
    telegramNewOrder: true,
    telegramNewRequest: true,
  },
  novaPoshta: {},
  templates: DEFAULT_TEMPLATES,
  supplier: {
    priceSource: "retail",
    markupPercent: 0,
    roundTo: 0,
    rates: { EUR: 50, USD: 45, source: "nbu" },
    autoSyncEnabled: true,
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep merge of stored settings over the defaults, so new keys always have a value */
export function mergeSettings(stored: unknown): StoreSettings {
  const merge = (base: unknown, over: unknown): unknown => {
    if (!isObject(base) || !isObject(over)) return over === undefined ? base : over;
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(over)) out[key] = merge(base[key], value);
    return out;
  };
  return merge(DEFAULT_SETTINGS, isObject(stored) ? stored : {}) as StoreSettings;
}

export async function getSettings(db: Db): Promise<StoreSettings> {
  const doc = await cols(db).settings.findOne({ _id: "store" });
  return mergeSettings(doc?.value);
}

/** Saves a partial update (deep-merged) and returns the full settings */
export async function saveSettings(db: Db, patch: Partial<StoreSettings> | Record<string, unknown>): Promise<StoreSettings> {
  const current = await getSettings(db);
  const next = mergeSettings({ ...current, ...patch });
  await cols(db).settings.replaceOne({ _id: "store" }, { value: next, updatedAt: nowIso() }, { upsert: true });
  return next;
}
