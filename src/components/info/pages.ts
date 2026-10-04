/**
 * Registry of the static information pages. Drives the shared side navigation,
 * the breadcrumbs of the (info) route group and the «Інформація» block of the
 * HTML sitemap, so every surface stays in sync.
 */
export interface InfoNavItem {
  href: string;
  label: string;
}

export interface InfoNavGroup {
  title: string;
  items: InfoNavItem[];
}

export const infoNavGroups: InfoNavGroup[] = [
  {
    title: "Покупцям",
    items: [
      { href: "/oplata-i-dostavka", label: "Оплата і доставка" },
      { href: "/povernennia", label: "Обмін та повернення" },
      { href: "/harantiia", label: "Гарантія" },
    ],
  },
  {
    title: "Компанія",
    items: [
      { href: "/pro-nas", label: "Про нас" },
      { href: "/spivpratsia", label: "Співпраця" },
      { href: "/kontakty", label: "Контакти" },
    ],
  },
  {
    title: "Правова інформація",
    items: [
      { href: "/dohovir-oferty", label: "Договір оферти" },
      { href: "/polityka-konfidentsiinosti", label: "Політика конфіденційності" },
    ],
  },
];

/** Flat list in reading order */
export const infoPages: InfoNavItem[] = infoNavGroups.flatMap((group) => group.items);

export function getInfoPage(href: string): InfoNavItem | undefined {
  return infoPages.find((page) => page.href === href);
}
