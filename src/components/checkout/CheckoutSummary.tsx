"use client";

import { ChevronDown, ShieldCheck } from "lucide-react";
import { ProductImage } from "@/components/product/ProductImage";
import { DeliveryNote } from "@/components/checkout/DeliveryNote";
import { countUk, formatPrice } from "@/lib/format";
import type { CartItem } from "@/lib/types";

/**
 * Read-only order recap shown on the checkout page. A sticky card on desktop;
 * a collapsible disclosure on phones (the total stays visible when collapsed).
 */
export function CheckoutSummary({ items, count, total }: { items: CartItem[]; count: number; total: number }) {
  const savings = items.reduce(
    (sum, item) => sum + (item.oldPrice && item.oldPrice > item.price ? (item.oldPrice - item.price) * item.qty : 0),
    0,
  );
  return (
    <div className="order-first lg:order-none lg:sticky lg:top-24">
      <details open className="group card overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5 lg:pointer-events-none lg:cursor-default">
          <span className="text-base font-bold text-ink">Ваше замовлення</span>
          <span className="flex items-center gap-3">
            <span className="tabular text-base font-bold text-ink group-open:hidden lg:hidden">{formatPrice(total)}</span>
            <ChevronDown
              aria-hidden
              className="size-5 text-ink-3 transition-transform duration-200 group-open:rotate-180 lg:hidden"
            />
          </span>
        </summary>

        <div className="border-t border-line-soft p-4 sm:p-5">
          <ul className="grid gap-3">
            {items.map((item) => (
              <li key={item.key} className="flex items-start gap-3">
                <div className="size-12 shrink-0 overflow-hidden rounded-btn border border-line-soft bg-white">
                  <ProductImage image={item.image} illustration={item.illustration} alt={item.name} sizes="48px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] leading-snug font-medium text-ink">{item.name}</p>
                  {item.optionLabel && <p className="mt-0.5 text-xs text-ink-3">{item.optionLabel}</p>}
                  <p className="tabular mt-0.5 text-xs text-ink-3">
                    {item.qty} × {formatPrice(item.price)}
                  </p>
                </div>
                <span className="tabular shrink-0 text-sm font-semibold text-ink">
                  {formatPrice(item.price * item.qty)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 grid gap-2 border-t border-line-soft pt-4 text-[15px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ink-2">{countUk(count, ["товар", "товари", "товарів"])}</dt>
              <dd className="tabular font-medium text-ink">{formatPrice(total + savings)}</dd>
            </div>
            {savings > 0 && (
              <div className="flex items-center justify-between gap-4 text-sale">
                <dt>Знижка</dt>
                <dd className="tabular font-medium">−{formatPrice(savings)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <dt className="text-ink-2">Доставка</dt>
              <dd className="text-right text-sm text-ink-3">за тарифами перевізника</dd>
            </div>
          </dl>

          <div className="mt-3 flex items-end justify-between gap-4 border-t border-line-soft pt-3">
            <span className="font-semibold text-ink">Разом за товари</span>
            <span className="tabular text-xl font-bold text-ink">{formatPrice(total)}</span>
          </div>

          <DeliveryNote total={total} className="mt-4" />

          <p className="mt-4 flex items-start gap-2 text-[13px] text-ink-3">
            <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
            {"Перед відправкою менеджер перевірить сумісність за VIN і зв'яжеться з вами."}
          </p>
        </div>
      </details>
    </div>
  );
}
