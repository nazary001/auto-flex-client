import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryIcon } from "@/components/icons";
import { CategorySidebar } from "@/components/catalog/CategorySidebar";
import { VehicleBar } from "@/components/catalog/VehicleBar";
import { ProductListing } from "@/components/listing/ProductListing";
import { hasListingParams, parseListingParams, type RawSearchParams } from "@/components/listing/params";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getCategoryProductCount, getSubcategories, getTopCategories } from "@/lib/catalog";
import { countUk, formatNumber } from "@/lib/format";

const COUNT_FORMS: [string, string, string] = ["товар", "товари", "товарів"];

type CatalogPageProps = { searchParams: Promise<RawSearchParams> };

/** With listing parameters (?sale=1, ?brand=…, ?sort=…) the catalog root lists products of all groups */
function listingTitle(searchParams: RawSearchParams): string {
  return parseListingParams(searchParams).sale ? "Товари зі знижкою" : "Усі товари каталогу";
}

export async function generateMetadata({ searchParams }: CatalogPageProps): Promise<Metadata> {
  const sp = await searchParams;
  if (hasListingParams(sp)) {
    return {
      title: listingTitle(sp),
      description:
        "Товари всіх груп каталогу AutoFlex з фільтрами за виробником, ціною та наявністю. Доставка по Україні, перевірка сумісності за VIN.",
      alternates: { canonical: "/catalog" },
      robots: { index: false, follow: true },
    };
  }
  return {
    title: "Каталог автозапчастин",
    description:
      "Каталог автозапчастин AutoFlex: гальма, двигун, підвіска, фільтри, оливи та аксесуари. Підбір за маркою авто й за VIN, доставка по Україні за 1–3 дні.",
    alternates: { canonical: "/catalog" },
  };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const sp = await searchParams;

  if (hasListingParams(sp)) {
    const title = listingTitle(sp);
    return (
      <>
        <VehicleBar />
        <div className="container-page py-6 lg:py-8">
          <Breadcrumbs items={[{ label: "Каталог", href: "/catalog" }, { label: title }]} />
          <h1 className="page-title mt-4">{title}</h1>
          <ProductListing
            pathname="/catalog"
            searchParams={sp}
            facets={{ brands: true, categories: true }}
            columns={3}
            sidebar={<CategorySidebar />}
            className="mt-6"
          />
        </div>
      </>
    );
  }

  const groups = await getTopCategories();
  const groupData = await Promise.all(
    groups.map(async (group) => {
      const [subcategories, count] = await Promise.all([
        getSubcategories(group.id),
        getCategoryProductCount(group.id),
      ]);
      const subcategoryItems = await Promise.all(
        subcategories.map(async (sub) => ({ sub, count: await getCategoryProductCount(sub.id) })),
      );
      return { group, count, subcategoryItems };
    }),
  );

  return (
    <>
      <VehicleBar />
      <div className="container-page py-6 lg:py-8">
        <Breadcrumbs items={[{ label: "Каталог" }]} />

        <header className="mt-4">
          <h1 className="page-title">Каталог автозапчастин</h1>
          <p className="lead mt-2.5">
            Оберіть групу запчастин або скористайтеся підбором за маркою авто. Усі деталі відправляємо зі складів
            постачальників по всій Україні, а перед відправленням менеджер перевіряє сумісність за VIN.
          </p>
        </header>

        <ul className="reveal-children mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {groupData.map(({ group, count, subcategoryItems }) => (
            <li key={group.id}>
              <article className="card flex h-full flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-content-center rounded-lg bg-brand-50 text-brand-700">
                    <CategoryIcon name={group.icon} className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg leading-tight font-bold text-ink">
                      <Link href={`/catalog/${group.slug}`} className="transition-colors hover:text-brand-700">
                        {group.name}
                      </Link>
                    </h2>
                    <p className="tabular mt-1 text-[13px] text-ink-3">
                      {countUk(count, COUNT_FORMS)}
                    </p>
                  </div>
                </div>

                {group.description && (
                  <p className="mt-3 text-sm leading-relaxed text-ink-2">{group.description}</p>
                )}

                <ul className="mt-4 grid gap-0.5 border-t border-line-soft pt-3">
                  {subcategoryItems.map(({ sub, count: subCount }) => (
                    <li key={sub.id}>
                      <Link
                        href={`/catalog/${sub.slug}`}
                        className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm text-ink-2 transition-colors hover:bg-mist-soft hover:text-brand-700"
                      >
                        <span className="min-w-0 truncate">{sub.name}</span>
                        <span className="tabular shrink-0 text-[13px] text-ink-3">
                          {formatNumber(subCount)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/catalog/${group.slug}`}
                  className="group mt-4 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brand-600 transition-colors hover:text-brand-800"
                >
                  Усі товари групи
                  <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
