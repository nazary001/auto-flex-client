import type { Promo } from "@/lib/types";

/**
 * Current promotions shown on the home page and on /aktsii.
 * Every href points to a catalog group that is non-empty for the current catalog.
 * The copy deliberately names no discount percentage: the real figure is shown on
 * each product, so the banners cannot go stale when prices change.
 */
export const promos: Promo[] = [
  {
    slug: "znyzhky-na-khrom-nakladky",
    title: "Хром-накладки зі знижкою",
    text: "Накладки на ручки, дзеркала, пороги та молдинги з нержавійки й хром-пластику за зниженими цінами. Освіжіть вигляд авто без фарбування.",
    period: "до кінця місяця",
    href: "/catalog/khrom-nakladky?sale=1",
    cta: "Дивитися знижки",
    illustration: "_fallback",
    tone: "navy",
  },
  {
    slug: "deflektory-pid-model",
    title: "Дефлектори під вашу модель",
    text: "Вітровики на вікна, капот і зимові накладки — модельні комплекти, що сідають рівно й без щілин. Підберемо під ваш кузов.",
    period: "цього тижня",
    href: "/catalog/deflektory",
    cta: "Обрати дефлектори",
    illustration: "deflektory-vikon",
    tone: "blue",
  },
  {
    slug: "kylymky-v-salon",
    title: "Килимки в салон і багажник",
    text: "Гумові, текстильні та EVA-килимки з високими бортиками — захистять підлогу від вологи, бруду й реагентів. Модельні та універсальні.",
    period: "поки є на складі",
    href: "/catalog/kylymky",
    cta: "Переглянути килимки",
    illustration: "kylymky",
    tone: "light",
  },
  {
    slug: "bahazhni-systemy-na-dakh",
    title: "Більше простору на даху",
    text: "Рейлінги, поперечини, автобокси та кріплення для велосипедів і лиж. Зберіть багажну систему під свій дах і наступну подорож.",
    period: "перед сезоном подорожей",
    href: "/catalog/bahazhnyky-ta-duhy-na-dakh",
    cta: "Зібрати систему",
    illustration: "bahazhnyky-na-dakh",
    tone: "navy",
  },
];
