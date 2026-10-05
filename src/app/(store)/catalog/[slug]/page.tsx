import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { CategorySidebar } from "@/components/catalog/CategorySidebar";
import { VehicleBar } from "@/components/catalog/VehicleBar";
import { ProductListing } from "@/components/listing/ProductListing";
import { hasListingParams, type RawSearchParams } from "@/components/listing/params";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  getCategory,
  getCategoryPath,
  getCategoryProductCount,
  getSubcategories,
} from "@/lib/catalog";
import { countUk, formatNumber } from "@/lib/format";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}

const COUNT_FORMS: [string, string, string] = ["товар", "товари", "товарів"];

function clampDescription(text: string, max = 160): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Категорію не знайдено" };

  const sp = await searchParams;
  const description = clampDescription(
    category.description ??
      `${category.name} від перевірених виробників. Підбір за маркою авто та за VIN, доставка по Україні за 1–3 дні.`,
  );

  return {
    title: category.name,
    description,
    alternates: { canonical: `/catalog/${category.slug}` },
    ...(hasListingParams(sp) ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const sp = await searchParams;
  const pathname = `/catalog/${category.slug}`;
  const isGroup = category.parentId === null;
  // getSubcategories returns [] for a leaf, so the group-only section below never shows for leaves.
  const [path, subcategories, count] = await Promise.all([
    getCategoryPath(category),
    getSubcategories(category.id),
    getCategoryProductCount(category.id),
  ]);
  const subcategoryItems = await Promise.all(
    subcategories.map(async (sub) => ({ sub, count: await getCategoryProductCount(sub.id) })),
  );

  const crumbs = [
    { label: "Каталог", href: "/catalog" },
    ...path.map((node, index) =>
      index === path.length - 1 ? { label: node.name } : { label: node.name, href: `/catalog/${node.slug}` },
    ),
  ];

  return (
    <>
      <VehicleBar />
      <div className="container-page py-6 lg:py-8">
        <Breadcrumbs items={crumbs} />

        <header className="mt-4">
          <h1 className="page-title">{category.name}</h1>
          {category.description && <p className="lead mt-2.5">{category.description}</p>}
          <p className="mt-2 text-sm text-ink-3">
            У цьому розділі <span className="tabular font-semibold text-ink-2">{formatNumber(count)}</span>{" "}
            {COUNT_FORMS[2]} від перевірених виробників
          </p>
        </header>

        {isGroup && subcategoryItems.length > 0 && (
          <section className="mt-7" aria-label="Підкатегорії">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subcategoryItems.map(({ sub, count: subCount }) => (
                <li key={sub.id}>
                  <Link
                    href={`/catalog/${sub.slug}`}
                    className="group card flex items-center gap-3.5 p-3 transition-[box-shadow,border-color] hover:border-line hover:shadow-card"
                  >
                    <span className="grid size-14 shrink-0 place-content-center rounded-lg bg-mist-soft">
                      <Image
                        src={`/illustrations/${sub.illustration}.svg`}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className="size-10 object-contain"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink transition-colors group-hover:text-brand-700">
                        {sub.name}
                      </span>
                      <span className="tabular mt-0.5 block text-[13px] text-ink-3">
                        {countUk(subCount, COUNT_FORMS)}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-silver-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-8 lg:mt-10">
          <ProductListing
            pathname={pathname}
            searchParams={sp}
            base={{ categoryId: category.id }}
            facets={{ brands: true }}
            columns={3}
            emitItemList
            sidebar={<CategorySidebar activeSlug={category.slug} />}
          />
        </div>

        <CategorySeo
          name={category.name}
          isGroup={isGroup}
          subcategories={subcategories.map((s) => ({ slug: s.slug, name: s.name }))}
          groupSlug={isGroup ? category.slug : (path[0]?.slug ?? category.slug)}
          groupName={path[0]?.name ?? category.name}
        />
      </div>
    </>
  );
}

function CategorySeo({
  name,
  isGroup,
  subcategories,
  groupSlug,
  groupName,
}: {
  name: string;
  isGroup: boolean;
  subcategories: { slug: string; name: string }[];
  groupSlug: string;
  groupName: string;
}) {
  const lower = name.toLowerCase();

  return (
    <section className="mt-12 border-t border-line-soft pt-8 lg:mt-14">
      <div className="prose-af">
        <h2>{isGroup ? `Що входить до розділу «${name}»` : `Як підібрати ${lower}`}</h2>

        {isGroup ? (
          <>
            <p>
              У розділі «{name}» зібрані запчастини для різних вузлів авто. Оберіть потрібну підкатегорію, щоб
              звузити пошук, або скористайтеся фільтром за виробником і ціною праворуч.
            </p>
            {subcategories.length > 0 && (
              <ul>
                {subcategories.map((sub) => (
                  <li key={sub.slug}>
                    <Link href={`/catalog/${sub.slug}`}>{sub.name}</Link>
                  </li>
                ))}
              </ul>
            )}
            <p>
              Щоб не помилитися з вибором, укажіть марку й модель авто у формі «Підбір за авто» вгорі сторінки.
              Перед відправленням менеджер додатково перевіряє сумісність деталі за VIN-кодом, тож ви отримаєте
              саме те, що підходить до вашого автомобіля.
            </p>
          </>
        ) : (
          <>
            <p>
              Щоб {lower} точно підійшли до вашого авто, укажіть марку, модель і рік у формі «Підбір за авто» або
              знайдіть товар за артикулом чи оригінальним номером. Фільтри за виробником і ціною допоможуть обрати
              оптимальний варіант — від бюджетного до преміального.
            </p>
            <p>
              Не впевнені у виборі? Залиште заявку — менеджер перевірить сумісність за VIN-кодом ще до відправлення.
              Дивіться також інші запчастини розділу{" "}
              <Link href={`/catalog/${groupSlug}`}>{groupName}</Link>.
            </p>
          </>
        )}

        <h2>Доставка, оплата та гарантія</h2>
        <p>
          Товари відправляємо зі складів постачальників по всій Україні — Новою Поштою та Укрпоштою. Позиції, що є в
          наявності, зазвичай вирушають за 1–3 дні; термін доставки вказано в картці кожного товару. Оплата —
          готівкою при отриманні, карткою онлайн, частинами або за рахунком для СТО та оптових покупців.
        </p>
        <p>
          На кожну позицію діє гарантія виробника (її строк указано в картці товару), а протягом 14 днів ви можете
          повернути товар належної якості згідно із Законом «Про захист прав споживачів».
        </p>
      </div>
    </section>
  );
}
