"use client";

import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Cross-fades the page content when the route changes (View Transitions API).
 * Keyed by pathname, so filter / sort / pagination changes — which only touch the
 * query string — do not animate. Browsers without the API just navigate as usual.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page-enter" exit="page-exit" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
