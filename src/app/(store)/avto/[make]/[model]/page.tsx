import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, PackageSearch, ShieldCheck } from "lucide-react";
import { VehicleBar } from "@/components/catalog/VehicleBar";
import { CallbackButton } from "@/components/listing/CallbackButton";
import { ProductListing } from "@/components/listing/ProductListing";
import {
  buildListingHref,
  hasListingParams,
  RESET_FILTERS_PATCH,
  type RawSearchParams,
} from "@/components/listing/params";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CategoryPills } from "@/components/vehicle/CategoryPills";
import { RememberVehicleButton } from "@/components/vehicle/RememberVehicleButton";
import { getCategoriesForVehicle, getCategory, getMake, getModel, getModelProductCount, modelYears } from "@/lib/catalog";
import { countUk } from "@/lib/format";

interface Props {
  params: Promise<{ make: string; model: string }>;
  searchParams: Promise<RawSearchParams>;
}

const PRODUCT_FORMS: [string, string, string] = ["товар", "товари", "товарів"];

const UNIVERSAL_LINKS: { slug: string; name: string }[] = [
  { slug: "motorni-olyvy", name: "Моторні оливи" },
  { slug: "shchitky-sklochysnyka", name: "Щітки склоочисника" },
  { slug: "avtolampy", name: "Автолампи" },
  { slug: "akumuliatory", name: "Акумулятори" },
];

function clampDescription(text: string, max = 160): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { make: makeSlug, model: modelSlug } = await params;
  const [make, model] = await Promise.all([getMake(makeSlug), getModel(makeSlug, modelSlug)]);
  if (!make || !model) return { title: "Авто не знайдено" };

  const sp = await searchParams;
  // Supplier models may have no year range or body — keep the descriptor tidy when they are empty.
  const spec = [modelYears(model), model.body].filter(Boolean).join(", ");
  return {
    title: `Запчастини для ${make.name} ${model.name}`,
    description: clampDescription(
      `Запчастини для ${make.name} ${model.name}${spec ? ` (${spec})` : ""}: підбір за моделлю, перевірка за VIN, доставка по Україні за 1–3 дні.`,
    ),
    alternates: { canonical: `/avto/${make.slug}/${model.slug}` },
    ...(hasListingParams(sp) ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ModelPage({ params, searchParams }: Props) {
  const { make: makeSlug, model: modelSlug } = await params;
  const [make, model] = await Promise.all([getMake(makeSlug), getModel(makeSlug, modelSlug)]);
  if (!make || !model) notFound();

  const sp = await searchParams;
  const pathname = `/avto/${make.slug}/${model.slug}`;
  const label = `${make.name} ${model.name}`;
  // Supplier models may carry no year range or body; omit the empty parts from the UI.
  const years = modelYears(model);
  const spec = [years, model.body].filter(Boolean).join(", ");

  const categoryParam = firstParam(sp.category)?.trim();
  const [productCount, categoriesRaw, selectedCategory] = await Promise.all([
    getModelProductCount(model.id),
    getCategoriesForVehicle(make.id, model.id),
    categoryParam ? getCategory(categoryParam) : Promise.resolve(undefined),
  ]);
  const categories = categoriesRaw.sort(
    (a, b) => b.count - a.count || a.item.name.localeCompare(b.item.name, "uk"),
  );

  const resetHref = buildListingHref(pathname, sp, RESET_FILTERS_PATCH);

  return (
    <>
      <VehicleBar initial={{ makeSlug: make.slug, modelSlug: model.slug }} />
      <div className="container-page py-6 lg:py-8">
        <Breadcrumbs
          items={[
            { label: "Підбір за авто", href: "/avto" },
            { label: make.name, href: `/avto/${make.slug}` },
            { label: model.name },
          ]}
        />

        <header className="mt-4">
          <h1 className="page-title">
            Запчастини для {make.name} {model.name}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink-2">
            {years && <span className="tabular">{years}</span>}
            {years && <span aria-hidden className="size-1 rounded-full bg-silver-400" />}
            {model.body && <span>{model.body}</span>}
            {model.body && <span aria-hidden className="size-1 rounded-full bg-silver-400" />}
            <span className="tabular">{countUk(productCount, PRODUCT_FORMS)}</span>
          </p>
          <div className="mt-4">
            <RememberVehicleButton makeSlug={make.slug} modelSlug={model.slug} label={label} />
          </div>
        </header>

        {categories.length > 0 && (
          <section className="mt-7" aria-label={`Категорії запчастин для ${label}`}>
            <h2 className="mb-3 text-[15px] font-semibold text-ink">Запчастини за категорією</h2>
            <CategoryPills
              pathname={pathname}
              searchParams={sp}
              categories={categories}
              activeSlug={selectedCategory?.slug}
            />
          </section>
        )}

        <section className="mt-8 lg:mt-10">
          <SectionHeading as="h2" title={`Товари для ${label}`} className="mb-6" />
          <ProductListing
            pathname={pathname}
            searchParams={sp}
            base={{ makeId: make.id, modelId: model.id, categoryId: selectedCategory?.id }}
            facets={{ brands: true }}
            columns={3}
            emitItemList
            empty={
              <EmptyState
                icon={<PackageSearch />}
                title="За фільтрами нічого не знайшли"
                text="Приберіть частину фільтрів або замовте дзвінок — менеджер підбере деталь саме для вашого авто."
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link href={resetHref} scroll={false} className={buttonClass({ variant: "secondary" })}>
                      Скинути фільтри
                    </Link>
                    <CallbackButton />
                  </div>
                }
              />
            }
          />
        </section>

        <section className="mt-10 grid gap-4 lg:mt-12 lg:grid-cols-2">
          <div className="card flex flex-col bg-mist-soft p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <Boxes aria-hidden className="size-5 text-brand-700" strokeWidth={1.75} />
              Універсальні товари
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              Багато витратних матеріалів підходять до будь-якого авто — їх не треба підбирати за моделлю:
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {UNIVERSAL_LINKS.map((link) => (
                <li key={link.slug}>
                  <Link
                    href={`/catalog/${link.slug}`}
                    className="inline-flex rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="card flex flex-col bg-mist-soft p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <ShieldCheck aria-hidden className="size-5 text-brand-700" strokeWidth={1.75} />
              Перевірка сумісності за VIN
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              Перед відправленням зі складу менеджер звіряє деталь із VIN вашого {make.name} {model.name} — ви
              отримаєте саме те, що підходить. Потрібна допомога з підбором?
            </p>
            <div className="mt-4">
              <CallbackButton variant="secondary" />
            </div>
          </div>
        </section>

        <section className="mt-12 border-t border-line-soft pt-8 lg:mt-14">
          <div className="prose-af">
            <h2>
              Запчастини для {make.name} {model.name}
            </h2>
            <p>
              На цій сторінці зібрані деталі, сумісні з {make.name} {model.name}
              {spec ? ` (${spec})` : ""}. Оберіть категорію вгорі або скористайтеся фільтрами за виробником і ціною.
              У картці товару вказані сумісні двигуни та оригінальні номери — зручно звірити з тим, що стоїть на
              вашому авто.
            </p>
            <p>
              Не знайшли потрібну деталь? Напишіть нам або замовте дзвінок — менеджер підкаже аналог і перевірить
              сумісність за VIN. Також дивіться всі запчастини для{" "}
              <Link href={`/avto/${make.slug}`}>{make.name}</Link> чи повернення до{" "}
              <Link href="/avto">підбору за авто</Link>.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
