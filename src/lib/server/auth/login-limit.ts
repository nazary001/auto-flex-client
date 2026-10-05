/*
 * In-memory brute-force limiter for the admin login: 8 failed attempts per 15 minutes per
 * IP + e-mail. Per server instance; good enough for a small team, cheap to keep.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

const failures = new Map<string, number[]>();

function key(ip: string, email: string): string {
  return `${ip}|${email.trim().toLowerCase()}`;
}

function recent(times: number[] | undefined, now: number): number[] {
  return (times ?? []).filter((t) => now - t < WINDOW_MS);
}

/** Seconds to wait when the limit is reached, otherwise 0 */
export function loginBlockedFor(ip: string, email: string, now = Date.now()): number {
  const times = recent(failures.get(key(ip, email)), now);
  if (times.length < MAX_FAILURES) return 0;
  const oldest = Math.min(...times);
  return Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
}

export function recordLoginFailure(ip: string, email: string, now = Date.now()): void {
  const k = key(ip, email);
  const times = recent(failures.get(k), now);
  times.push(now);
  failures.set(k, times);
  if (failures.size > 5000) {
    for (const [existing, list] of failures) if (recent(list, now).length === 0) failures.delete(existing);
  }
}

export function clearLoginFailures(ip: string, email: string): void {
  failures.delete(key(ip, email));
}
