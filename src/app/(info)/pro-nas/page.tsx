import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Boxes, CreditCard, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import mechanic from "@/assets/brand/photo-mechanic.jpg";
import { SpeedStripes } from "@/components/brand/Graphics";
import { InfoContactCard } from "@/components/info/InfoContactCard";
import { InfoCallout, InfoCard, InfoHeader, InfoSection, Prose } from "@/components/info/InfoContent";
import { getBrands, getCategories, getMakes, getModels, getProducts, getTopCategories } from "@/lib/catalog";
import { countUk, formatNumber } from "@/lib/format";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Про нас",
  description:
    "AutoFlex — інтернет-магазин автозапчастин для популярних марок авто. Підбір за маркою та VIN, перевірка сумісності перед відправкою, доставка по Україні.",
  alternates: { canonical: "/pro-nas" },
};

export default function ProNasPage() {
  const productCount = getProducts().length;
  const brandCount = getBrands().length;
  const makeCount = getMakes().length;
  const modelCount = getMakes().reduce((sum, make) => sum + getModels(make.id).length, 0);
  const groupCount = getTopCategories().length;
  const categoryCount = getCategories().length - groupCount;

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
        lead="AutoFlex — інтернет-магазин автозапчастин для популярних марок авто. Допомагаємо дібрати правильну деталь і привозимо її по всій Україні."
      />

      <section className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center md:gap-8">
        <div className="prose-af">
          <p>
            Ми зібрали каталог із {countUk(categoryCount, ["категорії", "категорій", "категорій"])} у{" "}
            {countUk(groupCount, ["розділі", "розділах", "розділах"])} — від гальм і двигуна до олив та аксесуарів.
            Запчастини підбираються за маркою й моделлю авто, за артикулом або OE-номером.
          </p>
          <p>
            AutoFlex працює онлайн і за моделлю дропшипінгу: товар їде зі складів постачальників. Тому у нас немає
            фізичного магазину й самовивозу, зате є широкий асортимент і можливість швидко перевірити наявність під ваш
            автомобіль.
          </p>
        </div>
        <div className="relative isolate w-full max-w-[20rem] justify-self-center md:justify-self-end">
          <SpeedStripes aria-hidden className="absolute -top-3 -right-3 -z-10 h-16 w-28 opacity-70" />
          <Image
            src={mechanic}
            alt="Майстер у сервісі оглядає деталь перед встановленням"
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
              <strong>Обираєте деталь.</strong> За маркою й моделлю авто в{" "}
              <Link href="/avto">підборі за авто</Link>, за артикулом чи OE-номером або через пошук по каталогу.
            </li>
            <li>
              <strong>Ми перевіряємо сумісність.</strong> Менеджер підтверджує замовлення і за VIN-кодом звіряє, що
              деталь підходить саме до вашого авто.
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
          <InfoCard icon={<BadgeCheck aria-hidden strokeWidth={1.75} />} title="Перевірка сумісності за VIN">
            Менеджер звіряє деталь із вашим авто перед відправкою, тож ризик отримати невідповідну запчастину мінімальний.
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
            Гарантійний строк виробника вказано на сторінці кожної деталі.
          </InfoCard>
        </div>
      </InfoSection>

      <InfoCallout title="Чесно про формат роботи">
        У нас немає власного складу чи роздрібної точки — ми онлайн-вітрина, що відправляє товар зі складів
        постачальників. Такий формат дає змогу пропонувати широкий асортимент, а перевірка сумісності за VIN захищає вас
        від помилки з деталлю. Деталі про доставку й оплату — на сторінці{" "}
        <Link href="/oplata-i-dostavka">«Оплата і доставка»</Link>, а умови для бізнесу —{" "}
        <Link href="/spivpratsia">у розділі співпраці</Link>.
      </InfoCallout>

      <InfoContactCard />
    </article>
  );
}
