"use client";

import { useId, useOptimistic, useState, type FormEvent, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import { useListingNav } from "@/components/listing/ListingProvider";
import { hrefFromState, type ListingState, type RawSearchParams } from "@/components/listing/params";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import type { Brand, Category, FacetCount } from "@/lib/types";

const MAX_VISIBLE = 8;

export interface ListingFiltersProps {
  pathname: string;
  searchParams: RawSearchParams;
  state: ListingState;
  brands: FacetCount<Brand>[];
  categories: FacetCount<Category>[];
  priceRange: [number, number];
  inStockCount: number;
  showBrands: boolean;
  showCategories: boolean;
  className?: string;
}

function CheckRow({
  checked,
  onChange,
  label,
  count,
  type = "checkbox",
  name,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  count?: number;
  type?: "checkbox" | "radio";
  name?: string;
}) {
  return (
    <label className="-mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 text-[15px] leading-5 transition-colors hover:bg-mist-soft">
      <input
        type={type}
        name={name}
        className={type === "radio" ? "radio" : "check"}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0 flex-1 text-ink">{label}</span>
      {count != null && <span className="tabular shrink-0 text-[13px] text-ink-3">{formatNumber(count)}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <h3 className="mb-2.5 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Filter panel shared by the desktop sidebar and the mobile drawer. Drives the
 * URL from an optimistic copy of the listing state, so toggles feel instant and
 * several quick changes accumulate rather than overwrite one another.
 */
export function ListingFilters({
  pathname,
  searchParams,
  state,
  brands,
  categories,
  priceRange,
  inStockCount,
  showBrands,
  showCategories,
  className,
}: ListingFiltersProps) {
  const { replace } = useListingNav();
  const [view, applyView] = useOptimistic(state, (_current, next: ListingState) => next);
  const [brandsExpanded, setBrandsExpanded] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const radioName = useId();

  const update = (partial: Partial<ListingState>) => {
    const next: ListingState = { ...view, ...partial, page: 1 };
    replace(hrefFromState(pathname, searchParams, next), () => applyView(next));
  };

  const toggleBrand = (slug: string) => {
    const next = view.brandSlugs.includes(slug)
      ? view.brandSlugs.filter((s) => s !== slug)
      : [...view.brandSlugs, slug];
    update({ brandSlugs: next });
  };

  const applyPrice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) => {
      const raw = String(data.get(key) ?? "").replace(/\D/g, "");
      return raw ? Math.max(0, Number.parseInt(raw, 10)) : null;
    };
    update({ min: read("min") ?? undefined, max: read("max") ?? undefined });
  };

  const brandRows = brandsExpanded
    ? brands
    : brands.filter((b, i) => i < MAX_VISIBLE || view.brandSlugs.includes(b.item.slug));
  const hiddenBrands = brands.length - brandRows.length;

  const categoryRows = categoriesExpanded ? categories : categories.slice(0, MAX_VISIBLE);
  const hiddenCategories = categories.length - categoryRows.length;

  const showPrice = priceRange[1] > 0 || view.min != null || view.max != null;

  return (
    <div className={cn("divide-y divide-line-soft", className)}>
      {showBrands && brands.length > 0 && (
        <Section title="Виробник">
          <div className="grid">
            {brandRows.map(({ item, count }) => (
              <CheckRow
                key={item.slug}
                checked={view.brandSlugs.includes(item.slug)}
                onChange={() => toggleBrand(item.slug)}
                label={item.name}
                count={count}
              />
            ))}
          </div>
          {(hiddenBrands > 0 || brandsExpanded) && (
            <button
              type="button"
              onClick={() => setBrandsExpanded((v) => !v)}
              className="mt-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-800"
            >
              {brandsExpanded ? "Згорнути" : `Показати ще ${hiddenBrands}`}
            </button>
          )}
        </Section>
      )}

      {showPrice && (
        <Section title="Ціна, ₴">
          <form
            key={`${view.min ?? ""}-${view.max ?? ""}`}
            onSubmit={applyPrice}
            className="grid gap-2.5"
          >
            <div className="flex items-center gap-2">
              <input
                name="min"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={view.min ?? ""}
                placeholder={priceRange[0] > 0 ? formatNumber(priceRange[0]) : "0"}
                aria-label="Ціна від"
                className="field field-sm tabular w-full min-w-0"
              />
              <span aria-hidden className="text-ink-3">
                —
              </span>
              <input
                name="max"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={view.max ?? ""}
                placeholder={priceRange[1] > 0 ? formatNumber(priceRange[1]) : "0"}
                aria-label="Ціна до"
                className="field field-sm tabular w-full min-w-0"
              />
            </div>
            <button type="submit" className={buttonClass({ variant: "secondary", size: "sm" })}>
              Застосувати
            </button>
          </form>
        </Section>
      )}

      <Section title="Наявність">
        <div className="grid">
          <CheckRow
            checked={view.inStock}
            onChange={(next) => update({ inStock: next })}
            label="Тільки в наявності"
            count={inStockCount}
          />
          <CheckRow checked={view.sale} onChange={(next) => update({ sale: next })} label="Зі знижкою" />
        </div>
      </Section>

      {showCategories && categories.length > 0 && (
        <Section title="Категорія">
          <fieldset className="grid">
            <legend className="sr-only">Оберіть категорію</legend>
            <CheckRow
              type="radio"
              name={radioName}
              checked={!view.categorySlug}
              onChange={() => update({ categorySlug: undefined })}
              label="Усі категорії"
            />
            {categoryRows.map(({ item, count }) => (
              <CheckRow
                key={item.id}
                type="radio"
                name={radioName}
                checked={view.categorySlug === item.id}
                onChange={() => update({ categorySlug: item.id })}
                label={item.name}
                count={count}
              />
            ))}
          </fieldset>
          {(hiddenCategories > 0 || categoriesExpanded) && (
            <button
              type="button"
              onClick={() => setCategoriesExpanded((v) => !v)}
              className="mt-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-800"
            >
              {categoriesExpanded ? "Згорнути" : `Показати ще ${hiddenCategories}`}
            </button>
          )}
        </Section>
      )}
    </div>
  );
}
