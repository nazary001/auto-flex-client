import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { countUk } from "@/lib/format";

export interface CategoryTile {
  slug: string;
  name: string;
  illustration: string;
  count: number;
}

/** Grid of catalog-group tiles: part illustration, name and product count. */
export function CategoryTiles({ items, className }: { items: CategoryTile[]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {items.map((category) => (
        <li key={category.slug}>
          <Link
            href={`/catalog/${category.slug}`}
            className="group flex h-full flex-col gap-3 rounded-card border border-line-soft bg-white p-4 transition-[box-shadow,border-color] duration-200 hover:border-line hover:shadow-card"
          >
            <span className="relative grid size-12 shrink-0 place-content-center overflow-hidden rounded-[0.625rem] bg-mist-soft ring-1 ring-line-soft">
              <Image
                src={`/illustrations/${category.illustration}.svg`}
                alt=""
                width={48}
                height={48}
                unoptimized
                className="size-8 object-contain transition-transform duration-200 group-hover:scale-105"
              />
            </span>
            <span className="mt-auto">
              <span className="block text-sm leading-snug font-semibold text-ink transition-colors group-hover:text-brand-700">
                {category.name}
              </span>
              <span className="tabular mt-1 block text-[13px] text-ink-3">
                {countUk(category.count, ["товар", "товари", "товарів"])}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
