"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const THROTTLE_MS = 30_000;

/**
 * Keeps server-rendered counts and lists fresh: calls router.refresh() when the tab regains focus
 * or becomes visible, at most once every 30 seconds.
 */
export function RefreshOnFocus() {
  const router = useRouter();
  const last = useRef(0);

  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last.current < THROTTLE_MS) return;
      last.current = now;
      router.refresh();
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
