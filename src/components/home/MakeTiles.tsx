import Link from "next/link";
import { CarFront } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { countUk } from "@/lib/format";

export interface MakeTile {
  slug: string;
  name: string;
  modelCount: number;
}

/** «Запчастини за маркою авто»: popular makes as tiles with their model count. */
export function MakeTiles({ items }: { items: MakeTile[] }) {
  if (items.length === 0) return null;

  return (
    <section className="bg-mist-soft">
      <div className="container-page py-10 lg:py-14">
        <SectionHeading
          title="Запчастини за маркою авто"
          description="Популярні марки на українському ринку — оберіть свою та перейдіть до сумісних деталей."
          action={{ label: "Усі марки", href: "/avto" }}
          className="mb-6"
        />
        <ul className="reveal-children grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((make) => (
            <li key={make.slug}>
              <Link
                href={`/avto/${make.slug}`}
                className="group flex h-full flex-col gap-2 rounded-card border border-line-soft bg-white p-4 transition-[box-shadow,border-color] duration-200 hover:border-line hover:shadow-card"
              >
                <CarFront aria-hidden className="size-6 text-brand-700" strokeWidth={1.75} />
                <span className="mt-auto">
                  <span className="block font-semibold text-ink transition-colors group-hover:text-brand-700">
                    {make.name}
                  </span>
                  <span className="tabular mt-0.5 block text-[13px] text-ink-3">
                    {countUk(make.modelCount, ["модель", "моделі", "моделей"])}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
