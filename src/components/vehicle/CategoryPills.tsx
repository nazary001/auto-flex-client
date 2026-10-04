import Link from "next/link";
import { buildListingHref, type RawSearchParams } from "@/components/listing/params";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { Category, FacetCount } from "@/lib/types";

interface CategoryPillsProps {
  pathname: string;
  searchParams: RawSearchParams;
  categories: FacetCount<Category>[];
  /** Currently selected leaf category slug (from ?category=) */
  activeSlug?: string;
}

/**
 * Quick category picker for a vehicle: links that set ?category=<slug> on the
 * current listing, preserving other filters. Server-rendered (pure hrefs), so it
 * works without JavaScript; the selected pill is marked with aria-current.
 */
export function CategoryPills({ pathname, searchParams, categories, activeSlug }: CategoryPillsProps) {
  const pillClass = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
      active
        ? "border-brand-600 bg-brand-600 text-white"
        : "border-line bg-white text-ink-2 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800",
    );

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={buildListingHref(pathname, searchParams, { category: null })}
        replace
        scroll={false}
        aria-current={activeSlug ? undefined : "true"}
        className={pillClass(!activeSlug)}
      >
        Усі категорії
      </Link>
      {categories.map(({ item, count }) => {
        const active = activeSlug === item.slug;
        return (
          <Link
            key={item.slug}
            href={buildListingHref(pathname, searchParams, { category: item.slug })}
            replace
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={pillClass(active)}
          >
            {item.name}
            <span className={cn("tabular text-[12px]", active ? "text-white/75" : "text-ink-3")}>
              {formatNumber(count)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
