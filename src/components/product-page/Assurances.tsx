import Link from "next/link";
import { CreditCard, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { pluralUk } from "@/lib/format";
import { site } from "@/lib/site";

interface AssurancesProps {
  warrantyMonths: number;
}

/** Compact delivery / payment / warranty / returns list under the buy box, with links to the info pages. */
export function Assurances({ warrantyMonths }: AssurancesProps) {
  const warranty =
    warrantyMonths > 0
      ? `Гарантія ${warrantyMonths} ${pluralUk(warrantyMonths, ["місяць", "місяці", "місяців"])}`
      : "Гарантія за умовами виробника";

  const rows = [
    {
      icon: Truck,
      href: "/oplata-i-dostavka",
      text: "Доставка по всій Україні — Нова Пошта та Укрпошта",
      note:
        site.freeDeliveryFrom > 0
          ? `безкоштовно від ${site.freeDeliveryFrom} ₴`
          : "вартість за тарифами перевізника",
    },
    {
      icon: CreditCard,
      href: "/oplata-i-dostavka",
      text: "Оплата при отриманні, карткою, частинами або за реквізитами",
      note: "обирайте зручний спосіб на оформленні",
    },
    {
      icon: ShieldCheck,
      href: "/harantiia",
      text: warranty,
      note: "офіційна гарантія на товар",
    },
    {
      icon: RotateCcw,
      href: "/povernennia",
      text: `Повернення та обмін протягом ${site.returnDays} днів`,
      note: "згідно із Законом про захист прав споживачів",
    },
  ] as const;

  return (
    <ul className="grid gap-px overflow-hidden rounded-card border border-line-soft bg-line-soft">
      {rows.map((row) => {
        const Icon = row.icon;
        return (
          <li key={row.text} className="bg-white">
            <Link
              href={row.href}
              className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-mist-soft"
            >
              <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-700" strokeWidth={1.75} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink group-hover:text-brand-700">{row.text}</span>
                <span className="block text-[13px] text-ink-3">{row.note}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
