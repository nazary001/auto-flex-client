import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Boxes, CreditCard, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import mechanic from "@/assets/brand/photo-mechanic.jpg";
import { SpeedStripes } from "@/components/brand/Graphics";
import { InfoContactCard } from "@/components/info/InfoContactCard";
import { InfoCallout, InfoCard, InfoHeader, InfoSection, Prose } from "@/components/info/InfoContent";
import { countProducts, getBrands, getCategories, getMakes, getModels, getTopCategories } from "@/lib/catalog";
import { countUk, formatNumber } from "@/lib/format";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Про нас",
  description:
    "AutoFlex — інтернет-магазин автоаксесуарів і тюнінгу для популярних марок авто. Підбір за моделлю авто, доставка по Україні за 1–3 дні.",
  alternates: { canonical: "/pro-nas" },
};

export default async function ProNasPage() {
  const [productCount, brands, makes, categories, topCategories] = await Promise.all([
    countProducts(),
    getBrands(),
    getMakes(),
    getCategories(),
    getTopCategories(),
  ]);
  const brandCount = brands.length;
  const makeCount = makes.length;
  const groupCount = topCategories.length;
  const categoryCount = categories.length - groupCount;
  const modelsByMake = await Promise.all(makes.map((make) => getModels(make.id)));
  const modelCount = modelsByMake.reduce((sum, models) => sum + models.length, 0);

  const stats = [
    { value: productCount, label: "позицій у каталозі" },
    { value: makeCount, label: "марок авто" },
    { value: modelCount, label: "моделей і поколінь" },
    { value: brandCount, label: "брендів-виробників" },
  ];

  return (
    <article className="space-y-10 lg:space-y-12">
      <InfoHeader
        title="Про AutoFlex"
        lead="AutoFlex — інтернет-магазин автоаксесуарів і тюнінгу для популярних марок авто. Допомагаємо дібрати правильний аксесуар під вашу модель і привозимо його по всій Україні."
      />

      <section className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center md:gap-8">
        <div className="prose-af">
          <p>
            Ми зібрали каталог із {countUk(categoryCount, ["категорії", "категорій", "категорій"])} у{" "}
            {countUk(groupCount, ["розділі", "розділах", "розділах"])} — від дефлекторів, килимків і хром-накладок до
            багажників на дах, чохлів та автосвітла. Аксесуари підбираються за маркою, моделлю та роком авто.
          </p>
          <p>
            AutoFlex працює онлайн і за моделлю дропшипінгу: товар їде зі складу постачальника. Тому у нас немає
            фізичного магазину й самовивозу, зате є широкий асортимент і можливість швидко перевірити наявність під ваш
            автомобіль.
          </p>
        </div>
        <div className="relative isolate w-full max-w-[20rem] justify-self-center md:justify-self-end">
          <SpeedStripes aria-hidden className="absolute -top-3 -right-3 -z-10 h-16 w-28 opacity-70" />
          <Image
            src={mechanic}
            alt="Фахівець у сервісі оглядає аксесуар перед встановленням"
            sizes="(min-width: 768px) 320px, 100vw"
            className="h-auto w-full rounded-card border border-line-soft"
          />
        </div>
      </section>

      <section aria-label="Каталог у цифрах" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-card border border-line-soft bg-mist-soft p-4 sm:p-5">
            <p className="display tabular text-[2rem] leading-none text-brand-700 sm:text-[2.25rem]">
              {formatNumber(stat.value)}
            </p>
            <p className="mt-2 text-[13px] leading-snug text-ink-2 sm:text-sm">{stat.label}</p>
          </div>
        ))}
      </section>

      <InfoSection id="yak-pratsiuie" title="Як це працює">
        <Prose>
          <ol>
            <li>
              <strong>Обираєте аксесуар.</strong> За маркою й моделлю авто в{" "}
              <Link href="/avto">підборі за авто</Link> або через пошук за назвою та артикулом.
            </li>
            <li>
              <strong>Ми перевіряємо сумісність.</strong> Менеджер підтверджує замовлення, а за потреби за VIN-кодом
              звіряє, що аксесуар підходить саме до вашого авто.
            </li>
            <li>
              <strong>Товар їде зі складу постачальника.</strong> Завдяки моделі дропшипінгу ми тримаємо широкий
              асортимент без власного складу.
            </li>
            <li>
              <strong>Доставляємо по Україні.</strong> Новою Поштою або Укрпоштою; позиції в наявності відправляємо
              наступного робочого дня.
            </li>
          </ol>
        </Prose>
      </InfoSection>

      <InfoSection id="perevahy" title="Що отримує покупець">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard icon={<BadgeCheck aria-hidden strokeWidth={1.75} />} title="Підбір за моделлю авто">
            Товари підібрані під конкретні моделі; за потреби менеджер звіряє покоління за VIN, тож ризик отримати
            невідповідний аксесуар мінімальний.
          </InfoCard>
          <InfoCard icon={<Boxes aria-hidden strokeWidth={1.75} />} title="Широкий вибір">
            {formatNumber(productCount)} позицій від {formatNumber(brandCount)} брендів для {formatNumber(makeCount)}{" "}
            популярних марок авто.
          </InfoCard>
          <InfoCard icon={<Truck aria-hidden strokeWidth={1.75} />} title="Доставка по Україні">
            Нова Пошта та Укрпошта. Товари в наявності — 1–3 дні після відправлення.
          </InfoCard>
          <InfoCard icon={<CreditCard aria-hidden strokeWidth={1.75} />} title="Зручна оплата">
            При отриманні, карткою онлайн, частинами або за рахунком для компаній.
          </InfoCard>
          <InfoCard icon={<RotateCcw aria-hidden strokeWidth={1.75} />} title={`Повернення ${site.returnDays} днів`}>
            Товар належної якості можна повернути чи обміняти за законом про захист прав споживачів.
          </InfoCard>
          <InfoCard icon={<ShieldCheck aria-hidden strokeWidth={1.75} />} title="Гарантія на кожен товар">
            Гарантійний строк виробника вказано на сторінці кожного товару.
          </InfoCard>
        </div>
      </InfoSection>

      <InfoCallout title="Чесно про формат роботи">
        У нас немає власного складу чи роздрібної точки — ми онлайн-вітрина, що відправляє товар зі складу
        постачальника. Такий формат дає змогу пропонувати широкий асортимент, а підбір за моделлю авто захищає вас від
        помилки з товаром. Деталі про доставку й оплату — на сторінці{" "}
        <Link href="/oplata-i-dostavka">«Оплата і доставка»</Link>, а умови для бізнесу —{" "}
        <Link href="/spivpratsia">у розділі співпраці</Link>.
      </InfoCallout>

      <InfoContactCard />
    </article>
  );
}
