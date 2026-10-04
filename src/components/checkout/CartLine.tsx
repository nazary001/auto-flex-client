"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ProductImage } from "@/components/product/ProductImage";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { formatPrice } from "@/lib/format";
import type { CartItem } from "@/lib/types";

interface CartLineProps {
  item: CartItem;
  onQty: (key: string, qty: number) => void;
  onRemove: (item: CartItem) => void;
}

/** One editable row of the cart: thumb, name, SKU, option, unit price, quantity, line total, remove. */
export function CartLine({ item, onQty, onRemove }: CartLineProps) {
  const href = `/product/${item.slug}`;
  const lineTotal = item.price * item.qty;

  return (
    <li className="grid grid-cols-[4.5rem_1fr] gap-x-3 py-5 first:pt-0 sm:grid-cols-[5rem_1fr_11rem] sm:gap-x-4">
      <Link
        href={href}
        aria-hidden
        tabIndex={-1}
        className="row-span-2 self-start overflow-hidden rounded-card border border-line-soft bg-white sm:row-span-1"
      >
        <ProductImage image={item.image} illustration={item.illustration} alt={item.name} sizes="80px" />
      </Link>

      <div className="min-w-0 self-start">
        <p className="text-[13px] font-semibold text-ink-2">{item.brandName}</p>
        <h3 className="mt-0.5 text-sm leading-snug font-semibold text-ink sm:text-[15px]">
          <Link href={href} className="transition-colors hover:text-brand-700">
            {item.name}
          </Link>
        </h3>
        <p className="mt-1 text-[13px] text-ink-3">
          Артикул: <span className="tabular text-ink-2">{item.sku}</span>
        </p>
        {item.optionLabel && <p className="mt-0.5 text-[13px] text-ink-3">{item.optionLabel}</p>}
      </div>

      <div className="col-start-2 mt-3 sm:col-start-3 sm:mt-0 sm:text-right">
        <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-2">
          <QtyStepper value={item.qty} onChange={(qty) => onQty(item.key, qty)} size="sm" label={item.name} />
          <div className="text-right">
            <span className="tabular text-base font-bold text-ink sm:text-lg">{formatPrice(lineTotal)}</span>
            {item.oldPrice && item.oldPrice > item.price && (
              <s className="tabular ml-2 text-xs text-ink-3 sm:ml-0 sm:block">{formatPrice(item.oldPrice * item.qty)}</s>
            )}
            {item.qty > 1 && <span className="tabular block text-xs text-ink-3">{formatPrice(item.price)} / шт</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item)}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-danger"
        >
          <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
          Прибрати
        </button>
      </div>
    </li>
  );
}
