"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search, Tag, Wrench, X } from "lucide-react";
import { ProductImage } from "@/components/product/ProductImage";
import { useEscape } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import type { SearchResponse } from "@/lib/types";
import { useOutsidePointer } from "./use-dismiss";

const EMPTY: SearchResponse = { products: [], categories: [], brands: [], total: 0 };
const MIN_CHARS = 2;
const DEBOUNCE_MS = 200;

type Status = "idle" | "loading" | "done";

interface HeaderSearchProps {
  /** `id` suffix so the two instances (desktop/mobile) keep unique ids */
  instanceId: string;
  className?: string;
}

export function HeaderSearch({ instanceId, className }: HeaderSearchProps) {
  const router = useRouter();
  const baseId = `${useId()}-${instanceId}`;
  const listboxId = `${baseId}-listbox`;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useOutsidePointer(open, () => setOpen(false), [rootRef]);
  useEscape(open, () => {
    setOpen(false);
    setActiveIndex(-1);
  });

  // Abort any in-flight request / pending debounce when the field unmounts
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  const products = results?.products ?? [];
  const categories = results?.categories ?? [];
  const brands = results?.brands ?? [];
  const total = results?.total ?? 0;
  const showAll = status === "done" && total > 0;

  // Flat, ordered href list that ↑/↓/Enter walk through
  const hrefs: string[] = [
    ...products.map((p) => `/product/${p.slug}`),
    ...categories.map((c) => `/catalog/${c.slug}`),
    ...brands.map((b) => `/brands/${b.slug}`),
    ...(showAll ? [`/search?q=${encodeURIComponent(query.trim())}`] : []),
  ];
  const catStart = products.length;
  const brandStart = catStart + categories.length;
  const allIndex = brandStart + brands.length;

  const hasResults = products.length > 0 || categories.length > 0 || brands.length > 0;
  const showEmpty = status === "done" && query.trim().length >= MIN_CHARS && !hasResults;

  function runFetch(q: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((res) => res.json() as Promise<SearchResponse>)
      .then((data) => {
        if (controller.signal.aborted) return;
        setResults(data);
        setStatus("done");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResults(EMPTY);
        setStatus("done");
      });
  }

  function onChange(value: string) {
    setQuery(value);
    setOpen(true);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      setResults(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    debounceRef.current = setTimeout(() => runFetch(q), DEBOUNCE_MS);
  }

  function dismiss() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    dismiss();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (hrefs.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (i + 1) % hrefs.length);
    } else if (event.key === "ArrowUp") {
      if (hrefs.length === 0) return;
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? hrefs.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      if (open && activeIndex >= 0 && activeIndex < hrefs.length) {
        event.preventDefault();
        const href = hrefs[activeIndex];
        dismiss();
        router.push(href);
      }
    }
  }

  const activeDescendant = open && activeIndex >= 0 ? `${baseId}-opt-${activeIndex}` : undefined;

  function optionProps(index: number) {
    return {
      id: `${baseId}-opt-${index}`,
      role: "option" as const,
      "aria-selected": activeIndex === index,
      tabIndex: -1,
      onMouseEnter: () => setActiveIndex(index),
      onClick: dismiss,
    };
  }

  const dropdownOpen = open && query.trim().length >= MIN_CHARS;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <form role="search" aria-label="Пошук по каталогу" onSubmit={onSubmit}>
        <div className="flex h-11 items-center rounded-btn border border-line bg-white shadow-field transition-[border-color,box-shadow] focus-within:border-brand-600 focus-within:shadow-[0_0_0_3px_rgb(0_84_198/0.16)] lg:h-12">
          <Search aria-hidden className="ml-3 size-5 shrink-0 text-ink-3" strokeWidth={1.75} />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => {
              if (query.trim().length >= MIN_CHARS) setOpen(true);
            }}
            placeholder="Пошук по артикулу, бренду або назві товару..."
            aria-label="Пошуковий запит"
            role="combobox"
            aria-expanded={dropdownOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeDescendant}
            className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-[15px] text-ink outline-hidden placeholder:text-ink-3/90"
          />
          {query && (
            <button
              type="button"
              aria-label="Очистити пошук"
              onClick={() => {
                setQuery("");
                setResults(null);
                setStatus("idle");
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
              className="grid size-8 shrink-0 place-content-center rounded-full text-ink-3 transition-colors hover:bg-mist hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Знайти"
            className="m-1 grid aspect-square h-[calc(100%-0.5rem)] shrink-0 place-content-center rounded-[0.5rem] bg-brand-600 bg-linear-to-br from-[#0a5fd4] to-brand-700 text-white shadow-[0_6px_14px_-6px_rgb(0_84_198/0.7)] transition-colors hover:from-brand-800 hover:to-brand-900"
          >
            <Search aria-hidden className="size-5" strokeWidth={2} />
          </button>
        </div>
      </form>

      {dropdownOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Підказки пошуку"
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-card border border-line-soft bg-white shadow-pop animate-drop-in"
        >
          {status === "loading" && (
            <p className="flex items-center gap-2.5 px-4 py-5 text-sm text-ink-3">
              <LoaderCircle aria-hidden className="size-4 animate-spin text-brand-600" />
              Шукаємо…
            </p>
          )}

          {status === "done" && showEmpty && (
            <div className="px-4 py-6 text-center">
              <p className="text-[15px] font-semibold text-ink">Нічого не знайдено</p>
              <p className="mt-1 text-sm text-ink-3">
                Перевірте артикул або спробуйте іншу назву. Не впевнені — ми підберемо за VIN.
              </p>
            </div>
          )}

          {status === "done" && hasResults && (
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain py-1.5">
              {products.length > 0 && (
                <section aria-label="Товари" className="py-1">
                  <p className="px-4 pt-1 pb-1.5 text-xs font-semibold tracking-wide text-ink-3">Товари</p>
                  {products.map((p, i) => (
                    <Link
                      key={p.id}
                      href={`/product/${p.slug}`}
                      {...optionProps(i)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 transition-colors",
                        activeIndex === i ? "bg-brand-50" : "hover:bg-mist-soft",
                      )}
                    >
                      <span className="size-11 shrink-0 overflow-hidden rounded-md border border-line-soft">
                        <ProductImage image={p.image} illustration={p.illustration} alt="" sizes="44px" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                        <span className="tabular mt-0.5 block truncate text-xs text-ink-3">арт. {p.sku}</span>
                      </span>
                      <span className="tabular shrink-0 text-sm font-semibold text-ink">{formatPrice(p.price)}</span>
                    </Link>
                  ))}
                </section>
              )}

              {categories.length > 0 && (
                <section aria-label="Категорії" className="border-t border-line-soft py-1">
                  <p className="px-4 pt-1.5 pb-1.5 text-xs font-semibold tracking-wide text-ink-3">Категорії</p>
                  {categories.map((c, i) => {
                    const index = catStart + i;
                    return (
                      <Link
                        key={c.slug}
                        href={`/catalog/${c.slug}`}
                        {...optionProps(index)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 text-sm text-ink transition-colors",
                          activeIndex === index ? "bg-brand-50" : "hover:bg-mist-soft",
                        )}
                      >
                        <Wrench aria-hidden className="size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
                        <span className="truncate">{c.name}</span>
                      </Link>
                    );
                  })}
                </section>
              )}

              {brands.length > 0 && (
                <section aria-label="Бренди" className="border-t border-line-soft py-1">
                  <p className="px-4 pt-1.5 pb-1.5 text-xs font-semibold tracking-wide text-ink-3">Бренди</p>
                  {brands.map((b, i) => {
                    const index = brandStart + i;
                    return (
                      <Link
                        key={b.slug}
                        href={`/brands/${b.slug}`}
                        {...optionProps(index)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2 text-sm text-ink transition-colors",
                          activeIndex === index ? "bg-brand-50" : "hover:bg-mist-soft",
                        )}
                      >
                        <Tag aria-hidden className="size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
                        <span className="truncate">{b.name}</span>
                      </Link>
                    );
                  })}
                </section>
              )}

              {showAll && (
                <Link
                  href={`/search?q=${encodeURIComponent(query.trim())}`}
                  {...optionProps(allIndex)}
                  className={cn(
                    "flex items-center justify-between gap-3 border-t border-line-soft px-4 py-3 text-sm font-semibold transition-colors",
                    activeIndex === allIndex ? "bg-brand-50 text-brand-800" : "text-brand-700 hover:bg-mist-soft",
                  )}
                >
                  Усі результати ({total})
                  <Search aria-hidden className="size-4" strokeWidth={2} />
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
