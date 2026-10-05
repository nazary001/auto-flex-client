import type { Metadata } from "next";
import Link from "next/link";
import { VehicleBar } from "@/components/catalog/VehicleBar";
import { EntityFinder, type FinderItem } from "@/components/vehicle/EntityFinder";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getBrandProductCount, getBrands } from "@/lib/catalog";
import type { Brand } from "@/lib/types";

const PRODUCT_FORMS: [string, string, string] = ["товар", "товари", "товарів"];
const BRAND_FORMS: [string, string, string] = ["виробник", "виробники", "виробників"];

export const metadata: Metadata = {
  title: "Виробники запчастин",
  description:
    "Усі виробники автозапчастин в AutoFlex: оригінал і якісні аналоги. Знайдіть бренд, перегляньте товари та замовте з доставкою по Україні.",
  alternates: { canonical: "/brands" },
};

export default async function BrandsPage() {
  const brands = await getBrands();
  const productCounts = new Map<string, number>();
  await Promise.all(
    brands.map(async (brand) => {
      productCounts.set(brand.id, await getBrandProductCount(brand.id));
    }),
  );

  const toItem = (brand: Brand): FinderItem => {
    const group = brand.name.slice(0, 1).toUpperCase();
    return {
      slug: brand.slug,
      name: brand.name,
      country: brand.country,
      count: productCounts.get(brand.id) ?? 0,
      href: `/brands/${brand.slug}`,
      group,
    };
  };

  const items = brands.map(toItem);
  const popular = brands
    .filter((brand) => brand.popular)
    .sort((a, b) => (productCounts.get(b.id) ?? 0) - (productCounts.get(a.id) ?? 0) || a.name.localeCompare(b.name, "uk"))
    .map(toItem);

  return (
    <>
      <VehicleBar />
      <div className="container-page py-6 lg:py-8">
        <Breadcrumbs items={[{ label: "Виробники" }]} />

        <header className="mt-4">
          <h1 className="page-title">Виробники запчастин</h1>
          <p className="lead mt-2.5">
            Працюємо з виробниками оригінальних деталей і перевіреними брендами якісних аналогів. Оберіть
            виробника, щоб переглянути його товари, або почніть вводити назву в пошуку.
          </p>
        </header>

        <EntityFinder
          className="mt-8 lg:mt-10"
          items={items}
          popular={popular}
          popularTitle="Популярні виробники"
          popularDescription="Бренди з найбільшим вибором у каталозі"
          allTitle="Усі виробники"
          allDescription="Згруповано за алфавітом — або скористайтеся пошуком"
          placeholder="Почніть вводити виробника, напр. Bosch"
          countForms={PRODUCT_FORMS}
          resultForms={BRAND_FORMS}
          grouped
        />

        <section className="mt-12 border-t border-line-soft pt-8 lg:mt-14">
          <div className="prose-af">
            <h2>Оригінал чи аналог — що обрати</h2>
            <p>
              Оригінальні деталі (OEM) повністю відповідають тому, що встановлено на заводі. Якісні аналоги від
              відомих виробників — наприклад, Bosch, TRW, Febi чи KYB — часто випускаються на тих самих
              потужностях і коштують дешевше за порівнянної надійності. У картці кожного товару вказані
              оригінальні номери, тож ви легко звірите сумісність.
            </p>
            <p>
              Не впевнені, який бренд підійде вашому авто? Скористайтеся{" "}
              <Link href="/avto">підбором за маркою авто</Link> або залиште заявку — менеджер підкаже оптимальний
              варіант і перевірить сумісність за VIN перед відправленням.
            </p>
            <h2>Гарантія та доставка</h2>
            <p>
              На кожну позицію діє гарантія виробника, строк якої вказано в картці товару. Відправляємо по всій
              Україні Новою Поштою та Укрпоштою — зазвичай за 1–3 дні для товарів у наявності. Оплата при
              отриманні, карткою онлайн, частинами або за рахунком для СТО та оптових покупців.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
