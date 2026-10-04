import type { Metadata } from "next";
import Link from "next/link";
import { articles } from "@/data/articles";
import { CategoryIcon } from "@/components/icons";
import { infoNavGroups } from "@/components/info/pages";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getBrands, getMakes, getModels, getSubcategories, getTopCategories } from "@/lib/catalog";
import { countUk } from "@/lib/format";

export const metadata: Metadata = {
  title: "Карта сайту",
  description:
    "Карта сайту AutoFlex: усі категорії запчастин, марки й моделі авто, виробники, інформаційні сторінки та статті блогу на одній сторінці.",
  alternates: { canonical: "/karta-saitu" },
};

const mainPages = [
  { href: "/", label: "Головна" },
  { href: "/catalog", label: "Каталог" },
  { href: "/avto", label: "Підбір за авто" },
  { href: "/brands", label: "Виробники" },
  { href: "/aktsii", label: "Акції" },
  { href: "/blog", label: "Блог" },
  { href: "/kontakty", label: "Контакти" },
];

const linkClass = "text-sm text-ink-2 underline-offset-2 transition-colors hover:text-brand-700 hover:underline";

export default function KartaSaytuPage() {
  const groups = getTopCategories();
  const makes = getMakes();
  const brands = getBrands();

  const groupCount = groups.length;
  const leafCount = groups.reduce((sum, group) => sum + getSubcategories(group.id).length, 0);
  const makeCount = makes.length;
  const brandCount = brands.length;

  return (
    <div className="container-page py-6 lg:py-10">
      <Breadcrumbs items={[{ label: "Карта сайту" }]} />

      <header className="mt-5">
        <h1 className="page-title">Карта сайту</h1>
        <p className="lead mt-3">
          Усі розділи магазину на одній сторінці: {countUk(leafCount, ["категорія", "категорії", "категорій"])} у{" "}
          {countUk(groupCount, ["розділі", "розділах", "розділах"])}, {countUk(makeCount, ["марка", "марки", "марок"])}{" "}
          авто та {countUk(brandCount, ["бренд", "бренди", "брендів"])}.
        </p>
      </header>

      <div className="mt-10 space-y-12 lg:mt-12 lg:space-y-14">
        <section>
          <SectionHeading as="h2" title="Основні сторінки" />
          <ul className="mt-5 flex flex-wrap gap-2.5">
            {mainPages.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  className="inline-flex h-9 items-center rounded-full border border-line bg-white px-3.5 text-sm text-ink-2 transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionHeading as="h2" title="Каталог запчастин" action={{ label: "Усі категорії", href: "/catalog" }} />
          <div className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <div key={group.id}>
                <Link
                  href={`/catalog/${group.slug}`}
                  className="flex items-center gap-2 font-semibold text-ink transition-colors hover:text-brand-700"
                >
                  <CategoryIcon name={group.icon} className="size-[18px] shrink-0 text-brand-700" />
                  {group.name}
                </Link>
                <ul className="mt-2.5 space-y-1.5 border-l border-line-soft pl-3.5">
                  {getSubcategories(group.id).map((leaf) => (
                    <li key={leaf.id}>
                      <Link href={`/catalog/${leaf.slug}`} className={linkClass}>
                        {leaf.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading as="h2" title="Підбір за маркою авто" action={{ label: "Усі марки", href: "/avto" }} />
          <div className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {makes.map((make) => (
              <div key={make.id}>
                <Link
                  href={`/avto/${make.slug}`}
                  className="font-semibold text-ink transition-colors hover:text-brand-700"
                >
                  {make.name}
                </Link>
                <ul className="mt-2.5 space-y-1.5 border-l border-line-soft pl-3.5">
                  {getModels(make.id).map((model) => (
                    <li key={model.id}>
                      <Link href={`/avto/${make.slug}/${model.slug}`} className={linkClass}>
                        {model.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading as="h2" title="Виробники" action={{ label: "Усі виробники", href: "/brands" }} />
          <ul className="mt-6 columns-2 gap-x-8 sm:columns-3 lg:columns-4">
            {brands.map((brand) => (
              <li key={brand.id} className="mb-2 break-inside-avoid">
                <Link href={`/brands/${brand.slug}`} className={linkClass}>
                  {brand.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <SectionHeading as="h2" title="Інформація" />
          <div className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-3">
            {infoNavGroups.map((group) => (
              <div key={group.title}>
                <p className="font-semibold text-ink">{group.title}</p>
                <ul className="mt-2.5 space-y-1.5 border-l border-line-soft pl-3.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className={linkClass}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionHeading as="h2" title="Блог" action={{ label: "Усі статті", href: "/blog" }} />
          <ul className="mt-6 space-y-2">
            {articles.map((article) => (
              <li key={article.slug}>
                <Link href={`/blog/${article.slug}`} className={linkClass}>
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
