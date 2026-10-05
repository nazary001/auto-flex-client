import Link from "next/link";
import type { ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import { Money } from "@/components/admin/ui";
import type { TopProduct } from "@/lib/server/db/repos/orders";

/* Top products by revenue over the last 30 days. Rows link to the product when it is in the catalog. */

export function TopProducts({ items }: { items: TopProduct[] }) {
  if (items.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-ink-3 sm:px-5">Ще немає продажів за 30 днів.</p>;
  }

  return (
    <ol className="divide-y divide-line-soft">
      {items.map((p, i) => {
        const inner: ReactNode = (
          <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <span className="tabular w-4 shrink-0 text-right text-[13px] text-ink-3">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{p.name}</p>
              <p className="tabular truncate text-[12px] text-ink-3">{p.sku}</p>
            </div>
            <span className="tabular shrink-0 text-[13px] text-ink-2">{formatNumber(p.qty)} шт</span>
            <Money value={p.revenue} className="shrink-0 text-sm font-semibold" />
          </div>
        );
        return (
          <li key={p.sku}>
            {p.productId ? (
              <Link href={`/admin/products/${p.productId}`} className="block transition-colors hover:bg-mist-soft">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ol>
  );
}
