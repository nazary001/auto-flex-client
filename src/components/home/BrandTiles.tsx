import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";

export interface BrandTile {
  slug: string;
  name: string;
  country: string;
}

/** «Виробники»: popular brands as text-only tiles (lucide ships no brand logos). */
export function BrandTiles({ items }: { items: BrandTile[] }) {
  if (items.length === 0) return null;

  return (
    <section className="container-page py-10 lg:py-14">
      <SectionHeading
        title="Виробники"
        description="Оригінальні та перевірені аналогові бренди, з якими ми працюємо."
        action={{ label: "Усі виробники", href: "/brands" }}
        className="mb-6"
      />
      <ul className="reveal-children grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((brand) => (
          <li key={brand.slug}>
            <Link
              href={`/brands/${brand.slug}`}
              className="group flex h-full flex-col items-center justify-center gap-1 rounded-card border border-line-soft bg-white px-3 py-5 text-center transition-[box-shadow,border-color] duration-200 hover:border-line hover:shadow-card"
            >
              <span className="font-semibold text-ink transition-colors group-hover:text-brand-700">{brand.name}</span>
              <span className="text-[13px] text-ink-3">{brand.country}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
