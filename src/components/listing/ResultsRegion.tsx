"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useListingNav } from "@/components/listing/ListingProvider";

/**
 * Dims and freezes the grid + pagination (server-rendered children) while a
 * filter/sort/page change is being applied, so the update reads as instant
 * without flashing a skeleton or jumping the scroll position.
 */
export function ResultsRegion({ children, className }: { children: ReactNode; className?: string }) {
  const { isPending } = useListingNav();
  return (
    <div
      aria-busy={isPending}
      className={cn(
        "transition-opacity duration-200",
        isPending && "pointer-events-none opacity-55",
        className,
      )}
    >
      {children}
    </div>
  );
}
