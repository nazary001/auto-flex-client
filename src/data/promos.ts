import type { Promo } from "@/lib/types";

/**
 * Current promotions shown on the home page and on /aktsii.
 * Every href points to a listing that is non-empty for the current catalog.
 * The copy deliberately names no discount percentage: the real figure is shown on
 * each product, so the banners cannot go stale when prices change.
 */
export const promos: Promo[] = [
  {
    slug: "znyzhky-na-halmivnu-systemu",
    title: "Гальма за зниженими цінами",
    text: "Колодки, диски та супорти перевірених брендів за зниженими цінами. Підберемо за VIN і перевіримо сумісність перед відправкою.",
    period: "до кінця місяця",
    href: "/catalog/halmivna-systema?sale=1",
    cta: "Дивитися знижки",
    illustration: "halmivni-dysky",
    tone: "navy",
  },
  {
    slug: "znyzhky-na-pidvisku",
    title: "Оновіть ходову частину",
    text: "Амортизатори, важелі, опори та стійки стабілізатора — знижки на вибрані позиції підвіски й рульового.",
    period: "цього тижня",
    href: "/catalog/pidviska-ta-rulove?sale=1",
    cta: "Обрати запчастини",
    illustration: "amortyzatory",
    tone: "blue",
  },
  {
    slug: "znyzhky-na-dvyhun",
    title: "Двигун у тонусі",
    text: "Комплекти ГРМ, свічки та котушки запалювання зі знижками. Планове обслуговування — поки є на складі.",
    period: "поки є на складі",
    href: "/catalog/dvyhun?sale=1",
    cta: "Переглянути товари",
    illustration: "komplekty-hrm",
    tone: "light",
  },
  {
    slug: "pidhotovka-do-zymy",
    title: "Готуємо авто до зими",
    text: "Моторні оливи, антифриз, гальмівна рідина та автохімія — усе, щоб спокійно зустріти холодний сезон. Зберіть набір одним замовленням.",
    period: "перед зимою",
    href: "/catalog/olyvy-ta-avtokhimiia",
    cta: "Зібрати набір",
    illustration: "antyfryzy",
    tone: "navy",
  },
];
