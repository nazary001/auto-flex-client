import type { Metadata } from "next";
import Link from "next/link";
import { CarFront, ShieldCheck } from "lucide-react";
import { getSelectorData } from "@/components/catalog/VehicleBar";
import { VehicleSelector } from "@/components/catalog/VehicleSelector";
import { EntityFinder, type FinderItem } from "@/components/vehicle/EntityFinder";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getMakeProductCount, getMakes, getModels } from "@/lib/catalog";
import type { Make } from "@/lib/types";

const MODEL_FORMS: [string, string, string] = ["модель", "моделі", "моделей"];
const MAKE_FORMS: [string, string, string] = ["марка", "марки", "марок"];

export const metadata: Metadata = {
  title: "Підбір запчастин за маркою авто",
  description:
    "Оберіть марку та модель авто — покажемо сумісні запчастини. Перевірка за VIN перед відправленням, доставка по Україні за 1–3 дні.",
  alternates: { canonical: "/avto" },
};

function toItem(make: Make): FinderItem {
  const monogram = make.name.slice(0, 1).toUpperCase();
  return {
    slug: make.slug,
    name: make.name,
    country: make.country,
    count: getModels(make.id).length,
    href: `/avto/${make.slug}`,
    monogram,
    group: monogram,
  };
}

export default function AvtoPage() {
  const { makes: selectorMakes, categories } = getSelectorData();
  const makes = getMakes();
  const items = makes.map(toItem);
  const popular = makes
    .filter((make) => make.popular)
    .sort((a, b) => getMakeProductCount(b.id) - getMakeProductCount(a.id) || a.name.localeCompare(b.name, "uk"))
    .map(toItem);

  return (
    <div className="container-page py-6 lg:py-8">
      <Breadcrumbs items={[{ label: "Підбір за авто" }]} />

      <header className="mt-4">
        <h1 className="page-title">Підбір запчастин за маркою авто</h1>
        <p className="lead mt-2.5">
          Оберіть марку та модель свого авто — і ми покажемо лише ті деталі, що підходять саме йому. Перед
          відправленням менеджер перевіряє сумісність за VIN, тож ви отримаєте потрібну запчастину.
        </p>
      </header>

      <section className="mt-6" aria-label="Підбір за авто">
        <div className="card relative isolate overflow-hidden p-5 sm:p-7">
          <span aria-hidden className="halftone absolute -top-4 -right-4 -z-10 size-48 text-brand-300" />
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CarFront aria-hidden className="size-5 text-brand-700" strokeWidth={1.75} />
            Оберіть авто
          </p>
          <p className="mt-1 max-w-xl text-sm text-ink-3">
            Марка, модель і група запчастин — покажемо сумісні товари на окремій сторінці вашого авто.
          </p>
          <VehicleSelector makes={selectorMakes} categories={categories} variant="hero" className="mt-4" />
          <p className="mt-4 flex items-start gap-2 text-[13px] text-ink-3">
            <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
            Не впевнені у виборі? Залиште заявку — менеджер перевірить сумісність за VIN ще до відправлення.
          </p>
        </div>
      </section>

      <EntityFinder
        className="mt-10 lg:mt-12"
        items={items}
        popular={popular}
        popularTitle="Популярні марки"
        popularDescription="Марки з найбільшим вибором запчастин у нас"
        allTitle="Усі марки"
        allDescription="Знайдіть свою марку в списку або почніть вводити назву"
        placeholder="Почніть вводити марку, напр. Skoda"
        countForms={MODEL_FORMS}
        resultForms={MAKE_FORMS}
      />

      <section className="mt-12 border-t border-line-soft pt-8 lg:mt-14">
        <div className="prose-af">
          <h2>Як працює підбір запчастин за авто</h2>
          <p>
            Виберіть марку, далі — покоління моделі з роком випуску та типом кузова. На сторінці авто зібрані
            сумісні деталі за категоріями: гальма, двигун, підвіска, фільтри, оптика та інше. Якщо знаєте артикул
            або оригінальний номер, швидше буде скористатися <Link href="/search">пошуком</Link>.
          </p>
          <p>
            Багато витратних матеріалів — оливи, щітки склоочисника, лампи, акумулятори — універсальні й підходять
            до будь-якого авто. Їх можна обрати напряму в <Link href="/catalog">каталозі</Link>. А щоб не
            помилитися зі складнішими деталями, менеджер перевіряє сумісність за VIN перед відправленням.
          </p>
          <h2>Доставка, оплата та гарантія</h2>
          <p>
            Товари відправляємо зі складів постачальників по всій Україні — Новою Поштою та Укрпоштою. Позиції в
            наявності зазвичай вирушають за 1–3 дні. Оплата — при отриманні, карткою онлайн, частинами або за
            рахунком. На кожну деталь діє гарантія виробника, а протягом 14 днів ви можете повернути товар
            належної якості згідно із Законом «Про захист прав споживачів».
          </p>
        </div>
      </section>
    </div>
  );
}
