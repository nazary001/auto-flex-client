import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { CategoryIcon } from "@/components/icons";
import { VehicleBar } from "@/components/catalog/VehicleBar";
import { CallbackButton } from "@/components/listing/CallbackButton";
import { ProductListing } from "@/components/listing/ProductListing";
import type { RawSearchParams } from "@/components/listing/params";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { toCardList } from "@/lib/card";
import { getPopularProducts, getTopCategories, queryProducts } from "@/lib/catalog";
import { formatNumber } from "@/lib/format";

interface Props {
  searchParams: Promise<RawSearchParams>;
}

const COUNT_FORMS: [string, string, string] = ["товар", "товари", "товарів"];

export const metadata: Metadata = {
  title: "Результати пошуку",
  description: "Пошук автозапчастин за назвою, артикулом або оригінальним номером у каталозі AutoFlex.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

function readQuery(sp: RawSearchParams): string {
  const raw = sp.q;
  return (Array.isArray(raw) ? raw[0] : (raw ?? "")).trim().slice(0, 80);
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = readQuery(sp);
  const hasQuery = q.length >= 2;
  const matchTotal = hasQuery ? (await queryProducts({ q, perPage: 1 })).total : 0;

  return (
    <>
      <VehicleBar />
      <div className="container-page py-6 lg:py-8">
        <Breadcrumbs items={[{ label: "Результати пошуку" }]} />

        <header className="mt-4">
          <h1 className="page-title">Результати пошуку</h1>
          {hasQuery ? (
            <p className="lead mt-2.5">
              За запитом «<span className="font-semibold text-ink">{q}</span>» знайдено{" "}
              <span className="tabular font-semibold text-ink">{formatNumber(matchTotal)}</span>{" "}
              {COUNT_FORMS[2]}
            </p>
          ) : (
            <p className="lead mt-2.5">
              Введіть назву запчастини, артикул або оригінальний номер — ми знайдемо потрібну деталь.
            </p>
          )}
        </header>

        {!hasQuery ? (
          <SearchPrompt />
        ) : matchTotal === 0 ? (
          <div className="mt-8 grid gap-12">
            <EmptyState
              icon={<SearchX />}
              title={`За запитом «${q}» нічого не знайшли`}
              text="Перевірте правильність написання, спробуйте вказати артикул або оригінальний номер, чи оберіть категорію вручну. Не вдається знайти — замовте дзвінок, і ми підберемо деталь разом."
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <CallbackButton />
                  <Link href="/catalog" className={buttonClass({ variant: "secondary" })}>
                    Перейти до каталогу
                  </Link>
                </div>
              }
            />
            <PopularProducts />
          </div>
        ) : (
          <div className="mt-8">
            <ProductListing
              pathname="/search"
              searchParams={sp}
              base={{ q }}
              facets={{ brands: true, categories: true }}
              columns={3}
            />
          </div>
        )}
      </div>
    </>
  );
}

async function SearchPrompt() {
  const groups = await getTopCategories();
  return (
    <div className="mt-8 grid gap-12">
      <section aria-label="Популярні категорії">
        <SectionHeading as="h2" title="Популярні категорії" description="Оберіть групу, щоб перейти до каталогу." />
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/catalog/${group.slug}`}
                className="group card flex items-center gap-3 p-3.5 transition-[box-shadow,border-color] hover:border-line hover:shadow-card"
              >
                <span className="grid size-10 shrink-0 place-content-center rounded-lg bg-brand-50 text-brand-700">
                  <CategoryIcon name={group.icon} className="size-5" />
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-ink transition-colors group-hover:text-brand-700">
                  {group.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <PopularProducts />
    </div>
  );
}

async function PopularProducts() {
  const products = toCardList(await getPopularProducts(8));
  if (products.length === 0) return null;
  return (
    <section aria-label="Популярні товари">
      <SectionHeading as="h2" title="Популярні товари" action={{ label: "Усі товари", href: "/catalog" }} />
      <ProductGrid products={products} columns={4} className="mt-5" />
    </section>
  );
}
