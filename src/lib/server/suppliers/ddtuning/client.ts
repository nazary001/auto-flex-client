/*
 * HTTP client for the DD Tuning / DD Audio partner API (https://ddtuning.com.ua/developers.html).
 * Bearer token from DDTUNING_API_TOKEN. Pages are at most 10 000 items.
 */

export const DD_API_BASE = process.env.DDTUNING_API_BASE?.replace(/\/$/, "") || "https://ddaudio.com.ua/api";
export const DD_PAGE_SIZE = 10_000;

export interface RawParent {
  id: number | string;
  title: string;
}

/** One row of /price/retail or /price/wholesale */
export interface RawItem {
  id: number;
  mark: string;
  model: string;
  title: string;
  category: string;
  subcategory?: string;
  images?: string[];
  manufacturer?: string;
  country?: string;
  material?: string;
  installation?: string;
  kit?: string;
  color?: string;
  type?: string;
  place?: string;
  sku: string;
  price: number;
  currency?: string;
  quantity?: number;
  available_in_stock?: number;
  warehouse?: string;
  sale_price?: number;
  sale_start_at?: string;
  sale_end_at?: string;
  short_title?: string;
  parent?: RawParent;
  coefficient?: number;
  shipping?: number;
}

export interface PricePage {
  total: number;
  totalResults: number;
  limit: number;
  offset: number;
  data: RawItem[];
}

export interface RawCategories {
  [groupId: string]: { title: string; children?: Record<string, string> };
}

export class DdApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DdApiError";
  }
}

export function ddToken(): string | undefined {
  const token = process.env.DDTUNING_API_TOKEN?.trim();
  return token || undefined;
}

export function isDdConfigured(): boolean {
  return Boolean(ddToken());
}

async function request<T>(path: string, options: { timeoutMs?: number; retries?: number } = {}): Promise<T> {
  const token = ddToken();
  if (!token) throw new DdApiError("DDTUNING_API_TOKEN не задано.");
  const url = `${DD_API_BASE}${path}`;
  const retries = options.retries ?? 3;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "AutoFlex/1.0" },
        signal: AbortSignal.timeout(options.timeoutMs ?? 180_000),
        cache: "no-store",
      });
      if (response.status === 401) throw new DdApiError("Токен DD Tuning недійсний або прострочений.", 401);
      if (response.status === 429 || response.status >= 500) {
        throw new DdApiError(`DD API відповів ${response.status}`, response.status);
      }
      if (!response.ok) throw new DdApiError(`DD API відповів ${response.status}`, response.status);
      const json = (await response.json()) as { success?: boolean; error?: string } & T;
      if (json.success === false) throw new DdApiError(json.error || "DD API повернув помилку.");
      return json;
    } catch (error) {
      lastError = error;
      const status = error instanceof DdApiError ? error.status : undefined;
      if (status === 401 || (status && status < 500 && status !== 429)) throw error;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new DdApiError("DD API недоступний.");
}

export async function fetchCategories(lang: "ua" | "ru" = "ua"): Promise<RawCategories> {
  const json = await request<{ data: RawCategories }>(`/categories?lang=${lang}`, { timeoutMs: 60_000 });
  return json.data ?? {};
}

export async function fetchWarehouses(): Promise<string[]> {
  const json = await request<{ data: Record<string, string> | string[] }>("/warehouses", { timeoutMs: 60_000 });
  return Array.isArray(json.data) ? json.data : Object.values(json.data ?? {});
}

export async function fetchPricePage(
  kind: "retail" | "wholesale",
  offset: number,
  limit = DD_PAGE_SIZE,
  lang: "ua" | "ru" = "ua",
): Promise<PricePage> {
  const json = await request<PricePage>(`/price/${kind}?lang=${lang}&offset=${offset}&limit=${limit}`);
  return {
    total: Number(json.total ?? json.data?.length ?? 0),
    totalResults: Number(json.totalResults ?? 0),
    limit: Number(json.limit ?? limit),
    offset: Number(json.offset ?? offset),
    data: Array.isArray(json.data) ? json.data : [],
  };
}

/** Cheap connectivity/token check for the admin */
export async function checkConnection(): Promise<{ ok: true; totalResults: number } | { ok: false; error: string }> {
  try {
    const page = await fetchPricePage("retail", 0, 1);
    return { ok: true, totalResults: page.totalResults };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
