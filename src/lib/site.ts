/**
 * Store-wide settings. Contacts below are placeholders from the brandbook —
 * replace them with the real ones before launch.
 */
export const site = {
  name: "AutoFlex",
  tagline: "Надійні автозапчастини для вашого авто",
  description:
    "Інтернет-магазин автозапчастин AutoFlex: підбір за маркою та моделлю авто, перевірка сумісності перед відправкою, доставка по Україні за 1–3 дні.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://autoflex.ua",
  domainLabel: "www.autoflex.ua",
  phone: { label: "+38 (097) 123-45-67", href: "tel:+380971234567" },
  email: "info@autoflex.ua",
  schedule: [
    { days: "Пн–Пт", hours: "9:00–19:00" },
    { days: "Сб", hours: "10:00–16:00" },
    { days: "Нд", hours: "онлайн-замовлення" },
  ],
  scheduleShort: "Пн–Пт 9:00–19:00, Сб 10:00–16:00",
  city: "Україна, відправка зі складів постачальників",
  socials: {
    telegram: "https://t.me/autoflex_ua",
    viber: "viber://chat?number=%2B380971234567",
    instagram: "https://www.instagram.com/autoflex.ua",
    facebook: "https://www.facebook.com/autoflex.ua",
  },
  /**
   * Free delivery threshold, UAH. 0 — delivery is always paid by the buyer at carrier rates
   * and the UI shows no free-delivery promises. Set e.g. 3000 to enable the promo line.
   */
  freeDeliveryFrom: 0 as number,
  /** Days a buyer has to return an item (Закон «Про захист прав споживачів») */
  returnDays: 14,
  /** Seller details for the public offer and privacy policy — PLACEHOLDERS, fill in before launch */
  legal: {
    entity: "ФОП Прізвище Ім'я По батькові",
    taxId: "0000000000",
    address: "Україна, м. Київ",
    iban: "UA00 0000 0000 0000 0000 0000 00000",
  },
} as const;

export interface NavLink {
  label: string;
  href: string;
}

/** Slim bar above the header */
export const topNav: NavLink[] = [
  { label: "Оплата і доставка", href: "/oplata-i-dostavka" },
  { label: "Обмін та повернення", href: "/povernennia" },
  { label: "Гарантія", href: "/harantiia" },
  { label: "Співпраця", href: "/spivpratsia" },
  { label: "Блог", href: "/blog" },
  { label: "Контакти", href: "/kontakty" },
];

export const footerNav: { title: string; links: NavLink[] }[] = [
  {
    title: "Каталог",
    links: [
      { label: "Усі категорії", href: "/catalog" },
      { label: "Підбір за маркою авто", href: "/avto" },
      { label: "Виробники", href: "/brands" },
      { label: "Акції", href: "/aktsii" },
      { label: "Карта сайту", href: "/karta-saitu" },
    ],
  },
  {
    title: "Покупцям",
    links: [
      { label: "Оплата і доставка", href: "/oplata-i-dostavka" },
      { label: "Обмін та повернення", href: "/povernennia" },
      { label: "Гарантія", href: "/harantiia" },
      { label: "Договір оферти", href: "/dohovir-oferty" },
      { label: "Політика конфіденційності", href: "/polityka-konfidentsiinosti" },
    ],
  },
  {
    title: "Компанія",
    links: [
      { label: "Про AutoFlex", href: "/pro-nas" },
      { label: "Співпраця: СТО та опт", href: "/spivpratsia" },
      { label: "Блог", href: "/blog" },
      { label: "Контакти", href: "/kontakty" },
    ],
  },
];

/** Benefits bar from the brandbook («Приклад використання») */
export const benefits = [
  { icon: "delivery", title: "Доставка по Україні", text: "1–3 дні" },
  { icon: "warranty", title: "Гарантія якості", text: "на всі товари" },
  { icon: "support", title: "Допомога з підбором", text: "підберемо запчастини" },
  { icon: "payment", title: "Оплата зручно", text: "готівка, карта, частинами" },
] as const;
