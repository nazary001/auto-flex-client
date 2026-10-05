import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { VehicleBar } from "@/components/catalog/VehicleBar";
import { ProductListing } from "@/components/listing/ProductListing";
import { hasListingParams, type RawSearchParams } from "@/components/listing/params";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getMake, getMakeProductCount, getModelProductCount, getModels, modelYears } from "@/lib/catalog";
import { countUk } from "@/lib/format";

interface Props {
  params: Promise<{ make: string }>;
  searchParams: Promise<RawSearchParams>;
}

const MODEL_FORMS: [string, string, string] = ["модель", "моделі", "моделей"];
const PRODUCT_FORMS: [string, string, string] = ["товар", "товари", "товарів"];

function clampDescription(text: string, max = 160): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { make: makeSlug } = await params;
  const make = await getMake(makeSlug);
  if (!make) return { title: "Марку не знайдено" };

  const sp = await searchParams;
  return {
    title: `Запчастини для ${make.name}`,
    description: clampDescription(
      `Запчастини для ${make.name} (${make.country}): оригінал і аналоги за моделлю та поколінням. Перевірка сумісності за VIN, доставка по Україні за 1–3 дні.`,
    ),
    alternates: { canonical: `/avto/${make.slug}` },
    ...(hasListingParams(sp) ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function MakePage({ params, searchParams }: Props) {
  const { make: makeSlug } = await params;
  const make = await getMake(makeSlug);
  if (!make) notFound();

  const sp = await searchParams;
  const pathname = `/avto/${make.slug}`;
  const [models, productCount] = await Promise.all([getModels(make.id), getMakeProductCount(make.id)]);
  const modelCards = await Promise.all(
    models.map(async (model) => ({
      model,
      years: modelYears(model),
      count: await getModelProductCount(model.id),
    })),
  );

  return (
    <>
      <VehicleBar initial={{ makeSlug: make.slug }} />
      <div className="container-page py-6 lg:py-8">
        <Breadcrumbs items={[{ label: "Підбір за авто", href: "/avto" }, { label: make.name }]} />

        <header className="mt-4">
          <h1 className="page-title">Запчастини для {make.name}</h1>
          <p className="lead mt-2.5">
            Оригінальні та аналогові запчастини для {make.name}. Оберіть покоління свого авто, щоб бачити лише
            сумісні деталі, або скористайтеся фільтрами за категорією та виробником.
          </p>
          <p className="tabular mt-2 text-sm text-ink-3">
            {countUk(models.length, MODEL_FORMS)} · {countUk(productCount, PRODUCT_FORMS)} у каталозі
          </p>
        </header>

        {models.length > 0 && (
          <section className="mt-8" aria-label={`Моделі ${make.name}`}>
            <SectionHeading
              as="h2"
              title={`Моделі ${make.name}`}
              description="Оберіть покоління — показуватимемо лише сумісні запчастини"
            />
            <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modelCards.map(({ model, years, count }) => (
                <li key={model.id}>
                  <Link
                    href={`/avto/${make.slug}/${model.slug}`}
                    className="group card flex h-full flex-col gap-2 p-4 transition-[box-shadow,border-color] hover:border-line hover:shadow-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-ink transition-colors group-hover:text-brand-700">
                        {model.name}
                      </span>
                      <ArrowRight
                        aria-hidden
                        className="size-4 shrink-0 text-silver-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
                      />
                    </div>
                    {(years || model.body) && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
                        {years && <span className="tabular">{years}</span>}
                        {years && model.body && <span aria-hidden className="size-1 rounded-full bg-silver-400" />}
                        {model.body && <span>{model.body}</span>}
                      </div>
                    )}
                    <span className="tabular mt-auto pt-1 text-[13px] font-medium text-ink-2">
                      {countUk(count, PRODUCT_FORMS)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10 lg:mt-12">
          <SectionHeading as="h2" title={`Товари для ${make.name}`} className="mb-6" />
          <ProductListing
            pathname={pathname}
            searchParams={sp}
            base={{ makeId: make.id }}
            facets={{ brands: true, categories: true }}
            columns={3}
            emitItemList
          />
        </section>

        <section className="mt-12 border-t border-line-soft pt-8 lg:mt-14">
          <div className="prose-af">
            <h2>Запчастини для {make.name}: як підібрати</h2>
            <p>
              Щоб деталь точно підійшла, оберіть покоління авто зі списку вище — ми враховуємо роки випуску та тип
              кузова. У картці кожного товару вказані сумісні моделі та двигуни, а також оригінальні номери для
              звірки. Знаєте артикул? Скористайтеся <Link href="/search">пошуком</Link> за номером.
            </p>
            <p>
              Універсальні товари — оливи, фільтри-витратники, щітки, лампи — підходять до {make.name} незалежно
              від покоління. Якщо сумніваєтеся, залиште заявку: менеджер перевірить сумісність за VIN перед
              відправленням зі складу постачальника.
            </p>
            <h2>Доставка, оплата та гарантія</h2>
            <p>
              Відправляємо по всій Україні Новою Поштою та Укрпоштою; товари в наявності — зазвичай за 1–3 дні.
              Оплата при отриманні, карткою онлайн, частинами або за рахунком. На кожну позицію діє гарантія
              виробника, а протягом 14 днів ви можете повернути товар належної якості.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
