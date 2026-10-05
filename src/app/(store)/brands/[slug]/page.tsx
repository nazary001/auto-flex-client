import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Package } from "lucide-react";
import { VehicleBar } from "@/components/catalog/VehicleBar";
import { ProductListing } from "@/components/listing/ProductListing";
import { hasListingParams, type RawSearchParams } from "@/components/listing/params";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getBrand, getBrandProductCount } from "@/lib/catalog";
import { countUk } from "@/lib/format";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}

const PRODUCT_FORMS: [string, string, string] = ["товар", "товари", "товарів"];

function clampDescription(text: string, max = 160): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) return { title: "Виробника не знайдено" };

  const sp = await searchParams;
  return {
    title: `Запчастини ${brand.name}`,
    description: clampDescription(
      `Запчастини ${brand.name} (${brand.country}) в AutoFlex: ${brand.description}`,
    ),
    alternates: { canonical: `/brands/${brand.slug}` },
    ...(hasListingParams(sp) ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BrandPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) notFound();

  const sp = await searchParams;
  const pathname = `/brands/${brand.slug}`;
  const count = await getBrandProductCount(brand.id);

  return (
    <>
      <VehicleBar />
      <div className="container-page py-6 lg:py-8">
        <Breadcrumbs items={[{ label: "Виробники", href: "/brands" }, { label: brand.name }]} />

        <header className="mt-4">
          <div className="card relative isolate overflow-hidden p-5 sm:p-6">
            <span aria-hidden className="halftone absolute -top-3 -right-3 -z-10 size-40 text-brand-300" />
            <h1 className="page-title">Запчастини {brand.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-[13px] font-medium text-ink-2">
                <MapPin aria-hidden className="size-3.5 text-brand-700" strokeWidth={1.75} />
                {brand.country}
              </span>
              <span className="tabular inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-[13px] font-medium text-ink-2">
                <Package aria-hidden className="size-3.5 text-brand-700" strokeWidth={1.75} />
                {countUk(count, PRODUCT_FORMS)} у каталозі
              </span>
            </div>
            <p className="prose-af mt-3.5">{brand.description}</p>
          </div>
        </header>

        <section className="mt-8 lg:mt-10">
          <SectionHeading as="h2" title={`Товари ${brand.name}`} className="mb-6" />
          <ProductListing
            pathname={pathname}
            searchParams={sp}
            base={{ brandIds: [brand.id] }}
            facets={{ brands: false, categories: true }}
            columns={3}
            emitItemList
          />
        </section>

        <section className="mt-12 border-t border-line-soft pt-8 lg:mt-14">
          <div className="prose-af">
            <h2>Про запчастини {brand.name}</h2>
            <p>
              {brand.description} У каталозі AutoFlex — {countUk(count, PRODUCT_FORMS)} цього виробника. Оберіть
              категорію у фільтрах праворуч або скористайтеся{" "}
              <Link href="/avto">підбором за маркою авто</Link>, щоб бачити лише сумісні з вашим автомобілем
              позиції.
            </p>
            <p>
              Знаєте артикул або оригінальний номер? Введіть його в <Link href="/search">пошуку</Link> — знайдемо
              потрібну деталь за секунду. Перед відправленням зі складу постачальника менеджер перевіряє
              сумісність за VIN.
            </p>
            <h2>Гарантія, оплата та доставка</h2>
            <p>
              На товари {brand.name} діє гарантія виробника (строк указано в картці товару). Відправляємо по всій
              Україні Новою Поштою та Укрпоштою — зазвичай за 1–3 дні. Оплата при отриманні, карткою онлайн,
              частинами або за рахунком. Протягом 14 днів ви можете повернути товар належної якості згідно із
              Законом «Про захист прав споживачів».
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
