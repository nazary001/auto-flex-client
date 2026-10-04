/*
 * Small in-memory limiter for the public POST endpoints (orders, call-back requests).
 * It stops accidental loops and casual flooding of the managers' chat. It is per server
 * instance, so on a multi-instance / serverless deployment put a platform-level rule
 * (firewall, edge rate limit) in front as well.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;
const MAX_BODY_BYTES = 64 * 1024;

const hits = new Map<string, number[]>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

/** Returns an error message when the request must be rejected, otherwise null */
export function rejectReason(request: Request): { status: number; error: string } | null {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return { status: 413, error: "Запит завеликий." };

  const now = Date.now();
  const key = clientKey(request);
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(key, recent);
    return { status: 429, error: "Забагато запитів. Спробуйте за кілька хвилин або зателефонуйте нам." };
  }
  recent.push(now);
  hits.set(key, recent);

  // Keep the map from growing without bound
  if (hits.size > 5000) {
    for (const [k, times] of hits) if (times.every((time) => now - time >= WINDOW_MS)) hits.delete(k);
  }
  return null;
}
