"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { useListingNav } from "@/components/listing/ListingProvider";
import { SORT_OPTIONS } from "@/components/listing/params";
import { cn } from "@/lib/cn";
import { countUk, formatNumber, pluralUk } from "@/lib/format";
import type { ProductSort } from "@/lib/types";

const COUNT_FORMS: [string, string, string] = ["товар", "товари", "товарів"];

interface ListingToolbarProps {
  sort: ProductSort;
  total: number;
  /** Filter panel for the mobile drawer (the desktop copy lives in the sidebar) */
  filterPanel: ReactNode;
  activeCount: number;
}

export function ListingToolbar({ sort, total, filterPanel, activeCount }: ListingToolbarProps) {
  const { navigate } = useListingNav();
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <p aria-live="polite" className="text-sm text-ink-3">
        <span className="tabular font-semibold text-ink">{formatNumber(total)}</span>{" "}
        {pluralUk(total, COUNT_FORMS)}
      </p>

      <div className="flex items-center gap-2">
        {filterPanel && (
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className={cn(
              "btn btn-secondary btn-sm lg:hidden",
              activeCount > 0 && "pr-2",
            )}
          >
            <SlidersHorizontal aria-hidden className="size-4" strokeWidth={1.75} />
            Фільтри
            {activeCount > 0 && (
              <span className="tabular grid size-5 place-content-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </button>
        )}

        <label className="flex items-center gap-2">
          <span className="hidden shrink-0 text-sm text-ink-3 sm:inline">Сортування</span>
          <select
            key={sort}
            defaultValue={sort}
            aria-label="Сортування товарів"
            onChange={(event) => navigate({ sort: event.target.value as ProductSort })}
            className="field field-sm tabular w-auto min-w-[8.5rem] font-medium"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filterPanel && (
        <Drawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Фільтри"
          side="right"
          footer={
            <Button block onClick={() => setFiltersOpen(false)}>
              Показати {countUk(total, COUNT_FORMS)}
            </Button>
          }
        >
          <div className="p-4">{filterPanel}</div>
        </Drawer>
      )}
    </div>
  );
}
