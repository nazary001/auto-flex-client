import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Query = Record<string, string | string[] | undefined>;

interface PaginationProps {
  /** 1-based current page */
  page: number;
  pageCount: number;
  /** e.g. "/catalog/halmivni-kolodky" */
  pathname: string;
  /** Current search params; `page` is replaced */
  query?: Query;
  className?: string;
}

function hrefFor(pathname: string, query: Query, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "page" || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function pageList(page: number, pageCount: number): (number | "gap")[] {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => wanted.add(p));
  if (page >= pageCount - 2) [pageCount - 1, pageCount - 2, pageCount - 3].forEach((p) => wanted.add(p));
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

const cell =
  "tabular grid h-10 min-w-10 place-content-center rounded-btn px-2 text-[15px] font-semibold transition-colors";

export function Pagination({ page, pageCount, pathname, query = {}, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Сторінки" className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}>
      {page > 1 ? (
        <Link
          href={hrefFor(pathname, query, page - 1)}
          rel="prev"
          aria-label="Попередня сторінка"
          className={cn(cell, "text-ink-2 hover:bg-mist hover:text-ink")}
        >
          <ChevronLeft aria-hidden className="size-5" />
        </Link>
      ) : (
        <span aria-hidden className={cn(cell, "text-silver-300")}>
          <ChevronLeft className="size-5" />
        </span>
      )}

      {pageList(page, pageCount).map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} aria-hidden className="grid h-10 w-6 place-content-center text-ink-3">
            …
          </span>
        ) : item === page ? (
          <span key={item} aria-current="page" className={cn(cell, "bg-brand-600 text-white")}>
            {item}
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(pathname, query, item)}
            aria-label={`Сторінка ${item}`}
            className={cn(cell, "text-ink-2 hover:bg-mist hover:text-ink")}
          >
            {item}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link
          href={hrefFor(pathname, query, page + 1)}
          rel="next"
          aria-label="Наступна сторінка"
          className={cn(cell, "text-ink-2 hover:bg-mist hover:text-ink")}
        >
          <ChevronRight aria-hidden className="size-5" />
        </Link>
      ) : (
        <span aria-hidden className={cn(cell, "text-silver-300")}>
          <ChevronRight className="size-5" />
        </span>
      )}
    </nav>
  );
}
