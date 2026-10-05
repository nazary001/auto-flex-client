import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  hideBelow?: "sm" | "md" | "lg" | "xl";
  render: (row: T) => ReactNode;
  /** When set with `sort`, the header becomes a sort toggle */
  sortKey?: string;
}

interface SortState {
  key?: string;
  dir?: "asc" | "desc";
  hrefFor: (key: string, dir: "asc" | "desc") => string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Makes each row a link via a stretched link on the first cell */
  rowHref?: (row: T) => string;
  empty?: ReactNode;
  dense?: boolean;
  sort?: SortState;
  /** Below md, render this card per row instead of the table */
  mobileCard?: (row: T) => ReactNode;
  caption?: string;
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

const hideBelowClass = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
} as const;

/*
 * Server-rendered table (no hooks). Numeric columns right-align on tabular figures; the sticky
 * header, hover rows and scroll live in admin.css. When `rowHref` is set the first cell carries a
 * stretched link (`before:absolute before:inset-0`) over the relatively-positioned row — any
 * interactive control in another cell must add `relative z-10` so it stays clickable.
 */
export function DataTable<T>({ columns, rows, rowKey, rowHref, empty, dense, sort, mobileCard, caption }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <>{empty ?? <p className="px-1 py-10 text-center text-sm text-ink-3">Нічого не знайдено.</p>}</>;
  }

  const table = (
    <table className="adm-table adm-table-hover">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              scope="col"
              className={cn(alignClass[col.align ?? "left"], col.hideBelow && hideBelowClass[col.hideBelow])}
              style={col.width ? { width: col.width } : undefined}
            >
              {sort && col.sortKey ? (
                <SortHeader column={col} sort={sort} />
              ) : (
                col.header
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const href = rowHref?.(row);
          return (
            <tr key={rowKey(row)} className={cn("relative", href && "cursor-pointer")}>
              {columns.map((col, index) => {
                const content = col.render(row);
                return (
                  <td
                    key={col.key}
                    className={cn(
                      alignClass[col.align ?? "left"],
                      col.align === "right" && "tabular",
                      col.hideBelow && hideBelowClass[col.hideBelow],
                      dense && "py-1.5",
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {index === 0 && href ? (
                      <Link
                        href={href}
                        className="font-medium text-ink before:absolute before:inset-0 before:content-['']"
                      >
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  if (mobileCard) {
    return (
      <>
        <ul className="space-y-2.5 md:hidden">
          {rows.map((row) => {
            const href = rowHref?.(row);
            const card = <div className="rounded-card border border-line-soft bg-white p-3.5">{mobileCard(row)}</div>;
            return <li key={rowKey(row)}>{href ? <Link href={href} className="block">{card}</Link> : card}</li>;
          })}
        </ul>
        <div className="adm-scroll-x hidden rounded-card border border-line-soft bg-white md:block">{table}</div>
      </>
    );
  }

  return <div className="adm-scroll-x rounded-card border border-line-soft bg-white">{table}</div>;
}

function SortHeader<T>({ column, sort }: { column: Column<T>; sort: SortState }) {
  const key = column.sortKey!;
  const active = sort.key === key;
  const nextDir: "asc" | "desc" = active && sort.dir === "asc" ? "desc" : "asc";
  return (
    <Link
      href={sort.hrefFor(key, nextDir)}
      className={cn("inline-flex items-center gap-1 transition-colors hover:text-ink", active && "text-ink")}
    >
      {column.header}
      {active ? (
        sort.dir === "asc" ? (
          <ChevronUp aria-hidden className="size-3.5" strokeWidth={2} />
        ) : (
          <ChevronDown aria-hidden className="size-3.5" strokeWidth={2} />
        )
      ) : (
        <ChevronDown aria-hidden className="size-3.5 opacity-30" strokeWidth={2} />
      )}
    </Link>
  );
}
