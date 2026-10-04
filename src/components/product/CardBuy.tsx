"use client";

import { useEffect, useId, useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { cn } from "@/lib/cn";
import { canBuy, formatPrice } from "@/lib/format";
import { toCartItem, toast, useCartStore } from "@/lib/store";
import type { ProductCardData } from "@/lib/types";

/** Bottom of a product card: option select, price, quantity and the «У кошик» button */
export function CardBuy({ product, className }: { product: ProductCardData; className?: string }) {
  const add = useCartStore((s) => s.add);
  const [qty, setQty] = useState(1);
  // Default to the variant the listed price belongs to (the one without a surcharge)
  const [optionId, setOptionId] = useState(
    (product.option?.values.find((v) => v.priceDelta === 0) ?? product.option?.values[0])?.id,
  );
  const [added, setAdded] = useState(false);
  const selectId = useId();

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(timer);
  }, [added]);

  const optionValue = product.option?.values.find((v) => v.id === optionId);
  const delta = optionValue?.priceDelta ?? 0;
  const price = product.price + delta;
  const oldPrice = product.oldPrice ? product.oldPrice + delta : undefined;
  const available = canBuy(product.stock);

  function addToCart() {
    add(toCartItem(product, optionValue), qty);
    setAdded(true);
    setQty(1);
    toast({
      title: "Додано до кошика",
      description: optionValue ? `${product.name} · ${optionValue.label}` : product.name,
      action: { label: "Перейти до кошика", href: "/cart" },
    });
  }

  return (
    <div className={cn("relative z-10 grid grid-cols-[minmax(0,1fr)] gap-3", className)}>
      {product.option && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-1">
          <label htmlFor={selectId} className="text-xs text-ink-3">
            {product.option.name}
          </label>
          <select
            id={selectId}
            value={optionId}
            onChange={(event) => setOptionId(event.target.value)}
            className="field field-sm"
          >
            {product.option.values.map((value) => (
              <option key={value.id} value={value.id}>
                {value.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("tabular text-xl leading-none font-bold", oldPrice ? "text-sale" : "text-ink")}>
          {formatPrice(price)}
        </span>
        {oldPrice && <s className="tabular text-sm text-ink-3">{formatPrice(oldPrice)}</s>}
      </div>

      {available ? (
        <div className="flex items-center gap-2">
          {/* Phones get a two-column grid: the cell only has room for the button */}
          <QtyStepper value={qty} onChange={setQty} size="sm" label={product.name} className="max-sm:hidden" />
          <Button size="sm" onClick={addToCart} className="min-w-0 flex-1 px-3">
            {added ? (
              <>
                Додано
                <Check aria-hidden className="size-4" />
              </>
            ) : (
              <>
                У кошик
                <ShoppingCart aria-hidden className="size-4" />
              </>
            )}
          </Button>
        </div>
      ) : (
        <Button size="sm" disabled block>
          Немає в наявності
        </Button>
      )}
    </div>
  );
}
