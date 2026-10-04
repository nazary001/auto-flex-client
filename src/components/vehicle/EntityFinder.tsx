"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";
import { countUk, formatNumber } from "@/lib/format";

export interface FinderItem {
  slug: string;
  name: string;
  country: string;
  /** Number shown on the tile (models for a make, products for a brand) */
  count: number;
  href: string;
  /** Uppercase initial shown in a tinted square; omit for text-only tiles (brands) */
  monogram?: string;
  /** Grouping letter for the A–Z mode */
  group: string;
}

interface EntityFinderProps {
  items: FinderItem[];
  /** Featured subset shown as larger tiles while the filter is empty */
  popular?: FinderItem[];
  popularTitle: string;
  popularDescription?: string;
  allTitle: string;
  allDescription?: string;
  placeholder: string;
  /** Plural of the counted thing on a tile, e.g. ["модель","моделі","моделей"] */
  countForms: [string, string, string];
  /** Plural of the entity for the result line, e.g. ["марка","марки","марок"] */
  resultForms: [string, string, string];
  /** Group tiles under A–Z headings while the filter is empty */
  grouped?: boolean;
  className?: string;
}

/** lowercase + strip diacritics so "skoda" finds "Škoda" and "citroen" finds "Citroën" */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’ʼ`]/g, "");

function Tile({
  item,
  forms,
  size,
}: {
  item: FinderItem;
  forms: [string, string, string];
  size: "lg" | "sm";
}) {
  const lg = size === "lg";
  return (
    <Link
      href={item.href}
      className={cn(
        "group card flex h-full items-center gap-3 transition-[box-shadow,border-color] hover:border-line hover:shadow-card",
        lg ? "p-4" : "p-3",
      )}
    >
      {item.monogram && (
        <span
          aria-hidden
          className={cn(
            "grid shrink-0 place-content-center rounded-lg bg-brand-50 font-bold text-brand-700",
            lg ? "size-11 text-lg sm:size-12 sm:text-xl" : "size-9 text-sm sm:size-10 sm:text-base",
          )}
        >
          {item.monogram}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block font-semibold leading-snug text-ink transition-colors group-hover:text-brand-700",
            lg ? "text-[15px]" : "text-sm",
          )}
        >
          {item.name}
        </span>
        <span className="tabular mt-0.5 block text-[13px] leading-snug text-ink-3">
          {item.country} · {countUk(item.count, forms)}
        </span>
      </span>
      <ArrowRight
        aria-hidden
        className="hidden size-4 shrink-0 text-silver-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600 sm:block"
      />
    </Link>
  );
}

/** Featured tiles — fewer per row, so they read as larger. */
const POPULAR_GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
/** Full list — denser on wide screens. */
const LIST_GRID = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

/**
 * Make / brand directory: featured tiles, an instant filter-as-you-type field
 * and the full list (a flat grid, or A–Z groups). All matching happens on the
 * client, so typing never hits the network.
 */
export function EntityFinder({
  items,
  popular,
  popularTitle,
  popularDescription,
  allTitle,
  allDescription,
  placeholder,
  countForms,
  resultForms,
  grouped = false,
  className,
}: EntityFinderProps) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const resultId = useId();

  const needle = fold(query.trim());
  const searchIndex = useMemo(
    () => items.map((item) => ({ item, hay: fold(`${item.name} ${item.country}`) })),
    [items],
  );
  const filtered = useMemo(
    () => (needle ? searchIndex.filter((row) => row.hay.includes(needle)).map((row) => row.item) : items),
    [needle, searchIndex, items],
  );

  const groups = useMemo(() => {
    if (!grouped) return [];
    const map = new Map<string, FinderItem[]>();
    for (const item of items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "uk"));
  }, [grouped, items]);

  const searching = needle.length > 0;

  return (
    <div className={className}>
      {popular && popular.length > 0 && !searching && (
        <section className="mb-10">
          <SectionHeading as="h2" title={popularTitle} description={popularDescription} />
          <ul className={cn(POPULAR_GRID, "mt-5")}>
            {popular.map((item) => (
              <li key={item.slug}>
                <Tile item={item} forms={countForms} size="lg" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby={`${inputId}-title`}>
        <SectionHeading
          as="h2"
          title={allTitle}
          description={allDescription}
          className="mb-4"
        />

        <div className="relative max-w-md">
          <Search
            aria-hidden
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3"
          />
          <label htmlFor={inputId} className="sr-only">
            {placeholder}
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            aria-describedby={resultId}
            className="field pr-10 pl-11"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистити пошук"
              className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-content-center rounded-full text-ink-3 transition-colors hover:bg-mist hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>

        <p id={resultId} aria-live="polite" className="mt-3 min-h-5 text-sm text-ink-3">
          {searching && filtered.length > 0 && `Знайдено ${countUk(filtered.length, resultForms)}`}
        </p>

        {filtered.length === 0 ? (
          <div className="card grid place-items-center gap-2 px-6 py-12 text-center">
            <span className="grid size-11 place-content-center rounded-full bg-mist text-ink-3">
              <Search aria-hidden className="size-5" strokeWidth={1.75} />
            </span>
            <p className="font-semibold text-ink">Нічого не знайшли</p>
            <p className="max-w-xs text-sm text-ink-3">
              За запитом «{query.trim()}» нічого немає. Перевірте написання або очистіть пошук.
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-800"
            >
              Очистити пошук
            </button>
          </div>
        ) : grouped && !searching ? (
          <div className="mt-5 space-y-7">
            {groups.map(([letter, groupItems]) => (
              <section key={letter} aria-label={`На літеру ${letter}`}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-content-center rounded-md bg-brand-50 text-sm font-bold text-brand-700">
                    {letter}
                  </span>
                  <span aria-hidden className="h-px flex-1 bg-line-soft" />
                  <span className="tabular shrink-0 text-[13px] text-ink-3">{formatNumber(groupItems.length)}</span>
                </div>
                <ul className={LIST_GRID}>
                  {groupItems.map((item) => (
                    <li key={item.slug}>
                      <Tile item={item} forms={countForms} size="sm" />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <ul className={cn(LIST_GRID, "mt-5")}>
            {filtered.map((item) => (
              <li key={item.slug}>
                <Tile item={item} forms={countForms} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
