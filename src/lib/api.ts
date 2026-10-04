/** Result of a call to one of the store's JSON API routes */
export type ApiResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * POSTs JSON to an API route (e.g. /api/orders, /api/callback) and never throws:
 * network and server failures come back as { ok: false, error } with a message for the buyer.
 */
export async function postJson<T extends object = object>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    if (response.ok && typeof data === "object" && data !== null && (data as { ok?: unknown }).ok === true) {
      return data as { ok: true } & T;
    }
    const message =
      typeof data === "object" && data !== null && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : "Сталася помилка. Спробуйте ще раз або зателефонуйте нам.";
    return { ok: false, error: message };
  } catch {
    return { ok: false, error: "Немає з'єднання із сервером. Перевірте інтернет і спробуйте ще раз." };
  }
}
