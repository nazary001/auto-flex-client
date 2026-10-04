"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, Clock, ShoppingCart, Truck } from "lucide-react";
import { ProductImage } from "@/components/product/ProductImage";
import { LeadForm } from "@/components/forms/LeadForm";
import { Badge, StockLabel } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { QtyStepper } from "@/components/ui/QtyStepper";
import { cn } from "@/lib/cn";
import { canBuy, discountPercent, formatDeliveryDays, formatPrice } from "@/lib/format";
import { toast, toCartItem, useCartStore } from "@/lib/store";
import type { ProductCardData } from "@/lib/types";

/** Base price corresponds to the zero-delta option value, so start there to match the name and price shown. */
function defaultOptionId(product: ProductCardData): string | undefined {
  if (!product.option) return undefined;
  const base = product.option.values.find((v) => v.priceDelta === 0) ?? product.option.values[0];
  return base?.id;
}

export function BuyBox({ product }: { product: ProductCardData }) {
  const add = useCartStore((s) => s.add);
  const [optionId, setOptionId] = useState(() => defaultOptionId(product));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(timer);
  }, [added]);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const optionValue = product.option?.values.find((v) => v.id === optionId);
  const delta = optionValue?.priceDelta ?? 0;
  const price = product.price + delta;
  const oldPrice = product.oldPrice != null ? product.oldPrice + delta : undefined;
  const discount = discountPercent(price, oldPrice);
  const saving = oldPrice ? oldPrice - price : 0;
  const available = canBuy(product.stock);
  const term = formatDeliveryDays(product.deliveryDays);

  function addToCart() {
    add(toCartItem(product, optionValue), qty);
    setAdded(true);
    toast({
      title: "Додано до кошика",
      description: optionValue ? `${product.name} · ${optionValue.label}` : product.name,
      action: { label: "Перейти до кошика", href: "/cart" },
    });
  }

  const quickDetails = [
    optionValue && product.option ? `${product.option.name}: ${optionValue.label}` : null,
    `Кількість: ${qty} шт`,
  ]
    .filter(Boolean)
    .join(", ");

  const orderSummary = (
    <div className="mb-5 flex items-center gap-3 rounded-btn border border-line-soft bg-mist-soft p-3">
      <div className="size-14 shrink-0 overflow-hidden rounded-[0.5rem] border border-line-soft">
        <ProductImage image={product.image} illustration={product.illustration} alt="" sizes="56px" />
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-sm font-medium text-ink">{product.name}</p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[13px]">
          <span className={cn("tabular font-semibold", oldPrice ? "text-sale" : "text-ink")}>{formatPrice(price)}</span>
          {optionValue && product.option && (
            <span className="text-ink-3">
              {product.option.name}: {optionValue.label}
            </span>
          )}
        </p>
      </div>
    </div>
  );

  return (
    <div className="rounded-card border border-line-soft bg-white p-4 shadow-card sm:p-5">
      {product.option && (
        <div className="mb-4 grid gap-1.5">
          <label htmlFor="buybox-option" className="text-sm font-medium text-ink-2">
            {product.option.name}
          </label>
          <select
            id="buybox-option"
            value={optionId}
            onChange={(event) => setOptionId(event.target.value)}
            className="field"
          >
            {product.option.values.map((value) => (
              <option key={value.id} value={value.id}>
                {value.label}
                {value.priceDelta ? ` (${value.priceDelta > 0 ? "+" : "−"}${formatPrice(Math.abs(value.priceDelta))})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn("tabular text-[2rem] leading-none font-bold tracking-tight", oldPrice ? "text-sale" : "text-ink")}>
          {formatPrice(price)}
        </span>
        {oldPrice && <s className="tabular text-lg text-ink-3">{formatPrice(oldPrice)}</s>}
        {discount > 0 && <Badge tone="sale">−{discount}%</Badge>}
      </div>
      {saving > 0 && <p className="mt-1 text-sm font-medium text-ok">Ви заощаджуєте {formatPrice(saving)}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <StockLabel stock={product.stock} className="text-sm" />
        {available && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-3">
            {product.stock === "preorder" ? (
              <Clock aria-hidden className="size-4 text-brand-700" strokeWidth={1.75} />
            ) : (
              <Truck aria-hidden className="size-4 text-brand-700" strokeWidth={1.75} />
            )}
            {product.stock === "preorder" ? `Привеземо за ${term}` : `Відправимо за ${term}`}
          </span>
        )}
      </div>

      {available ? (
        <div ref={ctaRef} className="mt-5 grid gap-2.5">
          <div className="flex items-stretch gap-2.5">
            <QtyStepper value={qty} onChange={setQty} label={product.name} />
            <Button onClick={addToCart} className="flex-1" aria-label={`Додати до кошика: ${product.name}`}>
              {added ? (
                <>
                  Додано <Check aria-hidden className="size-[18px]" />
                </>
              ) : (
                <>
                  У кошик <ShoppingCart aria-hidden className="size-[18px]" />
                </>
              )}
            </Button>
          </div>
          <Button variant="secondary" block onClick={() => setQuickOpen(true)}>
            Швидке замовлення
          </Button>
          {product.stock === "preorder" && (
            <p className="flex items-start gap-2 rounded-btn bg-brand-50 px-3 py-2.5 text-[13px] text-ink-2">
              <Clock aria-hidden className="mt-px size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
              Товар під замовлення: привеземо зі складу постачальника за {term}. Менеджер підтвердить терміни після
              оформлення.
            </p>
          )}
        </div>
      ) : (
        <div ref={ctaRef} className="mt-5 grid gap-2">
          <Button block onClick={() => setNotifyOpen(true)}>
            Повідомити про наявність <Bell aria-hidden className="size-[18px]" />
          </Button>
          <p className="text-[13px] text-ink-3">{"Залиште номер — повідомимо, щойно товар знову з'явиться."}</p>
        </div>
      )}

      {/* Mobile sticky buy bar — appears when the main CTA scrolls out of view, above the bottom tab bar (64px). */}
      <div
        aria-hidden={!showSticky}
        className={cn(
          "fixed inset-x-0 bottom-16 z-40 border-t border-line-soft bg-white/95 px-4 py-2.5 shadow-[0_-6px_20px_-8px_rgb(0_16_38/0.25)] backdrop-blur-sm transition-[transform,opacity] duration-200 lg:hidden",
          showSticky ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <span className={cn("tabular block text-lg leading-none font-bold", oldPrice ? "text-sale" : "text-ink")}>
              {formatPrice(price)}
            </span>
            {oldPrice && <s className="tabular text-xs text-ink-3">{formatPrice(oldPrice)}</s>}
          </div>
          {available ? (
            <Button onClick={addToCart} className="flex-1" tabIndex={showSticky ? undefined : -1}>
              {added ? (
                <>
                  Додано <Check aria-hidden className="size-[18px]" />
                </>
              ) : (
                <>
                  У кошик <ShoppingCart aria-hidden className="size-[18px]" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={() => setNotifyOpen(true)} className="flex-1" tabIndex={showSticky ? undefined : -1}>
              Повідомити <Bell aria-hidden className="size-[18px]" />
            </Button>
          )}
        </div>
      </div>

      <Modal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        title="Швидке замовлення"
        description="Залиште номер телефону — передзвонимо й оформимо замовлення за вас."
      >
        {orderSummary}
        <LeadForm
          kind="quick_order"
          productId={product.id}
          name="optional"
          commentPrefix={quickDetails}
          submitLabel="Оформити замовлення"
          successTitle="Замовлення прийнято"
          successText="Менеджер зателефонує найближчим часом, щоб підтвердити товар, кількість і доставку."
        />
      </Modal>

      <Modal
        open={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        title="Повідомити про наявність"
        description="Залиште номер — сповістимо, щойно товар з'явиться."
      >
        {orderSummary}
        <LeadForm
          kind="notify_stock"
          productId={product.id}
          name="optional"
          submitLabel="Повідомити про наявність"
          successTitle="Ми повідомимо вас"
          successText="Щойно товар з'явиться в наявності, ми одразу зв'яжемося з вами."
        />
      </Modal>
    </div>
  );
}
