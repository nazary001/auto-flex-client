import { CarFront } from "lucide-react";
import { VehicleSelector, type SelectorMake } from "@/components/catalog/VehicleSelector";
import { cn } from "@/lib/cn";
import { getMakes, getModels, getTopCategories, modelYears } from "@/lib/catalog";

/** Data for <VehicleSelector>: every make with its models, plus the top-level catalog groups */
export async function getSelectorData(): Promise<{ makes: SelectorMake[]; categories: { slug: string; name: string }[] }> {
  const [makes, topCategories] = await Promise.all([getMakes(), getTopCategories()]);
  const selectorMakes = await Promise.all(
    makes.map(async (make) => {
      const models = await getModels(make.id);
      return {
        slug: make.slug,
        name: make.name,
        models: models.map((model) => ({ slug: model.slug, name: model.name, years: modelYears(model) })),
      };
    }),
  );
  return {
    makes: selectorMakes,
    categories: topCategories.map((c) => ({ slug: c.slug, name: c.name })),
  };
}

interface VehicleBarProps {
  initial?: { makeSlug?: string; modelSlug?: string; categorySlug?: string };
  className?: string;
}

/**
 * Slim «Підбір за авто» strip for the top of catalog pages (Server Component).
 * On phones it collapses into a single toggle row.
 */
export async function VehicleBar({ initial, className }: VehicleBarProps) {
  const { makes, categories } = await getSelectorData();
  return (
    <section aria-label="Підбір за авто" className={cn("border-b border-line-soft bg-mist", className)}>
      <div className="container-page flex items-center gap-4 py-2.5 md:py-3">
        <p className="hidden shrink-0 items-center gap-2 text-sm font-semibold text-ink md:flex">
          <CarFront aria-hidden className="size-5 text-brand-700" strokeWidth={1.75} />
          Підбір за авто
        </p>
        <VehicleSelector makes={makes} categories={categories} variant="bar" initial={initial} className="min-w-0 flex-1" />
      </div>
    </section>
  );
}
