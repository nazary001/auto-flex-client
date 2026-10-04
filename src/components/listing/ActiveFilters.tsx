"use client";

import { X } from "lucide-react";
import { useListingNav } from "@/components/listing/ListingProvider";
import { RESET_FILTERS_PATCH, type ListingPatch } from "@/components/listing/params";
import { cn } from "@/lib/cn";

export interface FilterChip {
  key: string;
  label: string;
  /** URL patch that removes this filter */
  patch: ListingPatch;
}

/**
 * Removable chips for the active filters plus «Скинути все». Labels and patches
 * are computed on the server (where brand/category names resolve) and applied
 * here through the shared listing navigation.
 */
export function ActiveFilters({ chips, className }: { chips: FilterChip[]; className?: string }) {
  const { navigate } = useListingNav();
  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => navigate(chip.patch)}
          className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-white py-1 pr-1.5 pl-3 text-[13px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
        >
          {chip.label}
          <span
            aria-hidden
            className="grid size-4 place-content-center rounded-full bg-mist text-ink-3 transition-colors group-hover:bg-brand-600 group-hover:text-white"
          >
            <X className="size-3" strokeWidth={2.5} />
          </span>
          <span className="sr-only">— прибрати фільтр</span>
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={() => navigate(RESET_FILTERS_PATCH)}
          className="rounded-full px-2.5 py-1 text-[13px] font-semibold text-brand-600 transition-colors hover:text-brand-800"
        >
          Скинути все
        </button>
      )}
    </div>
  );
}
