"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { ShoppingCart, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/product/ProductImage";
import { buttonClass } from "@/components/ui/Button";
import { useEscape } from "@/lib/hooks";
import { countUk, formatPrice } from "@/lib/format";
import { useCart } from "@/lib/store";
import { useOutsidePointer } from "./use-dismiss";

const CART_FORMS: [string, string, string] = ["товар", "товари", "товарів"];

export function MiniCart() {
  const { items, count, total, remove } = useCart();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  useOutsidePointer(open, () => setOpen(false), [rootRef]);
  useEscape(open, () => setOpen(false));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-controls={popoverId}
        aria-expanded={open}
        aria-label={count > 0 ? `Кошик, ${countUk(count, CART_FORMS)}` : "Кошик порожній"}
        onClick={() => setOpen((v) => !v)}
        className="group flex w-[4.25rem] flex-col items-center gap-1 rounded-btn px-1 py-1.5 text-[11px] font-medium text-ink-2 transition-colors hover:bg-mist hover:text-brand-700"
      >
        <span className="relative">
          <ShoppingCart aria-hidden className="size-6" strokeWidth={1.75} />
          {count > 0 && (
            <span className="tabular absolute -top-2 -right-2.5 grid h-[18px] min-w-[18px] place-content-center rounded-full bg-brand-600 px-1 text-[11px] leading-none font-bold text-white ring-2 ring-white">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </span>
        Кошик
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Кошик"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
          className="absolute right-0 top-full z-20 mt-2 w-[22.5rem] overflow-hidden rounded-card border border-line-soft bg-white shadow-pop animate-fade-in"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
            <p className="font-bold text-ink">Кошик</p>
            {count > 0 && <span className="text-sm text-ink-3">{countUk(count, CART_FORMS)}</span>}
          </div>

          {items.length === 0 ? (
            <div className="grid justify-items-center gap-2 px-6 py-9 text-center">
              <span className="grid size-12 place-content-center rounded-full bg-mist text-brand-700">
                <ShoppingCart aria-hidden className="size-6" strokeWidth={1.75} />
              </span>
              <p className="text-[15px] font-semibold text-ink">Кошик порожній</p>
              <p className="max-w-[16rem] text-sm text-ink-3">
                Додайте товари — менеджер перевірить сумісність за VIN перед відправкою.
              </p>
              <Link href="/catalog" className={buttonClass({ variant: "secondary", size: "sm", className: "mt-1" })}>
                Перейти до каталогу
              </Link>
            </div>
          ) : (
            <>
              <ul className="max-h-[21rem] divide-y divide-line-soft overflow-y-auto overscroll-contain">
                {items.map((item) => (
                  <li key={item.key} className="flex gap-3 px-4 py-3">
                    <Link
                      href={`/product/${item.slug}`}
                      tabIndex={-1}
                      aria-hidden
                      className="size-14 shrink-0 overflow-hidden rounded-md border border-line-soft"
                    >
                      <ProductImage image={item.image} illustration={item.illustration} alt="" sizes="56px" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/product/${item.slug}`}
                        className="line-clamp-2 text-sm font-medium text-ink transition-colors hover:text-brand-700"
                      >
                        {item.name}
                      </Link>
                      {item.optionLabel && <p className="mt-0.5 truncate text-xs text-ink-3">{item.optionLabel}</p>}
                      <p className="tabular mt-1 text-sm text-ink-2">
                        {item.qty} × <span className="font-semibold text-ink">{formatPrice(item.price)}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(item.key)}
                      aria-label={`Прибрати з кошика: ${item.name}`}
                      className="grid size-8 shrink-0 place-content-center self-start rounded-full text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="border-t border-line-soft p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-ink-2">Разом</span>
                  <span className="tabular text-lg font-bold text-ink">{formatPrice(total)}</span>
                </div>
                <div className="grid gap-2">
                  <Link href="/checkout" className={buttonClass({ block: true })}>
                    Оформити замовлення
                  </Link>
                  <Link href="/cart" className={buttonClass({ variant: "secondary", block: true })}>
                    Перейти до кошика
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
