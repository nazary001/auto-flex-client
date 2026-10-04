import type { StockStatus } from "@/lib/types";

const NBSP = " ";
const numberFormat = new Intl.NumberFormat("uk-UA");
const dateFormat = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** 1965 → "1 965 ₴" (non-breaking spaces) */
export function formatPrice(value: number): string {
  return `${numberFormat.format(Math.round(value))}${NBSP}₴`;
}

/** Ukrainian plural: pluralUk(3, ["товар", "товари", "товарів"]) → "товари" */
export function pluralUk(n: number, forms: [one: string, few: string, many: string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

/** countUk(5, ["товар", "товари", "товарів"]) → "5 товарів" */
export function countUk(n: number, forms: [one: string, few: string, many: string]): string {
  return `${formatNumber(n)}${NBSP}${pluralUk(n, forms)}`;
}

export function discountPercent(price: number, oldPrice?: number): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

export type StockTone = "ok" | "warn" | "info" | "muted";

export const stockMeta: Record<StockStatus, { label: string; tone: StockTone }> = {
  in_stock: { label: "В наявності", tone: "ok" },
  low_stock: { label: "Закінчується", tone: "warn" },
  preorder: { label: "Під замовлення", tone: "info" },
  out_of_stock: { label: "Немає в наявності", tone: "muted" },
};

export function canBuy(stock: StockStatus): boolean {
  return stock !== "out_of_stock";
}

/** [1, 3] → "1–3 дні", [5, 10] → "5–10 днів" */
export function formatDeliveryDays([min, max]: [number, number]): string {
  const forms: [string, string, string] = ["день", "дні", "днів"];
  return min === max ? `${min}${NBSP}${pluralUk(min, forms)}` : `${min}–${max}${NBSP}${pluralUk(max, forms)}`;
}

/** "2026-09-28" → "28 вересня 2026" */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso)).replace(/\s*р\.$/, "");
}

/** Keeps digits only and normalises to 380XXXXXXXXX when possible */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("80") && digits.length === 11) digits = `3${digits}`;
  if (digits.startsWith("0") && digits.length === 10) digits = `38${digits}`;
  return digits;
}

export function isValidUaPhone(input: string): boolean {
  return /^380\d{9}$/.test(normalizePhone(input));
}

/** "380971234567" → "+38 (097) 123-45-67"; partial input is formatted as far as it goes */
export function formatPhone(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("380")) d = d.slice(2);
  else if (d.startsWith("80")) d = d.slice(1);
  else if (d.length > 0 && !d.startsWith("0")) d = `0${d}`;
  d = d.slice(0, 10);
  if (d.length === 0) return "";
  let out = `+38 (${d.slice(0, 3)}`;
  if (d.length >= 3) out += ")";
  if (d.length > 3) out += ` ${d.slice(3, 6)}`;
  if (d.length > 6) out += `-${d.slice(6, 8)}`;
  if (d.length > 8) out += `-${d.slice(8, 10)}`;
  return out;
}
