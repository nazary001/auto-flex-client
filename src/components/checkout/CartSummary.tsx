"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { DeliveryNote } from "@/components/checkout/DeliveryNote";
import { buttonClass } from "@/components/ui/Button";
import { countUk, formatPrice } from "@/lib/format";

interface CartSummaryProps {
  count: number;
  total: number;
  /** Sum of (oldPrice − price) across the cart, when there are discounts */
  savings: number;
}

/** Sticky totals card on the cart page: goods, savings, delivery note, VIN reassurance and the checkout CTA. */
export function CartSummary({ count, total, savings }: CartSummaryProps) {
  return (
    <div className="card p-5 lg:sticky lg:top-24">
      <h2 className="text-lg font-bold text-ink">Разом</h2>

      <dl className="mt-4 grid gap-2.5 text-[15px]">
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
      </dl>

      <div className="mt-4 flex items-end justify-between gap-4 border-t border-line-soft pt-4">
        <span className="text-[15px] font-semibold text-ink">До сплати за товари</span>
        <span className="tabular text-2xl font-bold text-ink">{formatPrice(total)}</span>
      </div>

      <DeliveryNote total={total} className="mt-4" />

      <div className="mt-5 grid gap-2.5">
        <Link href="/checkout" className={buttonClass({ size: "lg", block: true })}>
          Оформити замовлення
          <ArrowRight aria-hidden className="size-[18px]" />
        </Link>
        <Link href="/catalog" className={buttonClass({ variant: "secondary", block: true })}>
          Продовжити покупки
        </Link>
      </div>

      <p className="mt-4 flex items-start gap-2 text-[13px] text-ink-3">
        <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
        Перед відправкою менеджер перевірить сумісність запчастин із вашим авто за VIN.
      </p>
    </div>
  );
}
