import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/*
 * Browser-side view of the signed-in customer. The session cookie is httpOnly, so the page
 * asks /api/account/me — but only when the plain `af_user_hint` flag says someone signed in,
 * which keeps guest page views free of the extra request. The answer is cached for a short
 * while because the header (mounted once in the layout) re-checks on every navigation.
 */

export interface AccountSummary {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
}

const CACHE_MS = 30_000;
let cache: { at: number; summary: AccountSummary } | null = null;

export function hasAccountHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => part.trim().startsWith("af_user_hint=1"));
}

export async function fetchAccountSummary(signal?: AbortSignal): Promise<AccountSummary | null> {
  if (!hasAccountHint()) {
    cache = null;
    return null;
  }
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.summary;
  try {
    const response = await fetch("/api/account/me", { cache: "no-store", credentials: "same-origin", signal });
    if (!response.ok) return null;
    const data = (await response.json()) as { authenticated?: boolean; profile?: AccountSummary };
    if (!data.authenticated || !data.profile) {
      cache = null;
      return null;
    }
    cache = { at: Date.now(), summary: data.profile };
    return data.profile;
  } catch {
    return null;
  }
}

/** Forget the cached profile (after the customer edits it) */
export function invalidateAccountSummary(): void {
  cache = null;
}

/** null while unknown or signed out; the profile once the server confirmed the session. Re-checked on navigation. */
export function useAccountSummary(): { loading: boolean; summary: AccountSummary | null } {
  const pathname = usePathname();
  const [summary, setSummary] = useState<AccountSummary | null>(() => cache?.summary ?? null);
  const [loading, setLoading] = useState(() => cache === null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAccountSummary(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setSummary(result);
      setLoading(false);
    });
    return () => controller.abort();
  }, [pathname]);

  return { loading, summary };
}
