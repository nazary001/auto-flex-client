import { PromoBanner } from "@/components/content/PromoBanner";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/cn";
import type { Promo } from "@/lib/types";

/** Promotions block: the first promo as a wide strip, the rest as tiles, with a link to /aktsii. */
export function Promotions({ promos }: { promos: Promo[] }) {
  if (promos.length === 0) return null;

  const [first, ...rest] = promos;
  const restCols =
    rest.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : rest.length === 2 ? "sm:grid-cols-2" : "";

  return (
    <section className="container-page py-10 lg:py-14">
      <SectionHeading
        title="Акції та пропозиції"
        description="Сезонні знижки та вигідні комплекти на запчастини для планового ТО."
        action={{ label: "Усі акції", href: "/aktsii" }}
        className="mb-6"
      />
      <div className="grid gap-4">
        <PromoBanner promo={first} variant="wide" />
        {rest.length > 0 && (
          <ul className={cn("reveal-children grid gap-4", restCols)}>
            {rest.map((promo) => (
              <li key={promo.slug} className="flex">
                <PromoBanner promo={promo} variant="tile" className="w-full" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
