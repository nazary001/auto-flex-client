"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RotateCcw, ShoppingCart, Trash2, X } from "lucide-react";
import { CartLine } from "@/components/checkout/CartLine";
import { CartSummary } from "@/components/checkout/CartSummary";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { countUk } from "@/lib/format";
import { cartItemToAnalytics, trackRemoveFromCart, trackViewCart } from "@/lib/analytics";
import { useCart } from "@/lib/store";
import type { CartItem } from "@/lib/types";

export function CartView() {
  const { hydrated, items, count, total, setQty, remove, add, clear } = useCart();
  const [undo, setUndo] = useState<CartItem | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // view_cart once per visit, after hydration (an empty cart is not a cart view)
  const viewed = useRef(false);
  useEffect(() => {
    if (!hydrated || items.length === 0 || viewed.current) return;
    viewed.current = true;
    trackViewCart(items.map(cartItemToAnalytics));
  }, [hydrated, items]);

  // Auto-dismiss the undo banner after a few seconds
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(timer);
  }, [undo]);

  function handleRemove(item: CartItem) {
    trackRemoveFromCart(cartItemToAnalytics(item));
    remove(item.key);
    setUndo(item);
  }

  function handleUndo() {
    if (!undo) return;
    const { qty, ...rest } = undo;
    add(rest, qty);
    setUndo(null);
  }

  function handleClear() {
    if (items.length) trackRemoveFromCart(items.map(cartItemToAnalytics));
    clear();
    setConfirmClear(false);
    setUndo(null);
  }

  if (!hydrated) return <CartSkeleton />;

  if (items.length === 0) {
    return (
      <>
        <h1 className="page-title mt-4">Кошик</h1>
        <EmptyState
          className="mt-6"
          icon={<ShoppingCart aria-hidden strokeWidth={1.75} />}
          title="У кошику поки порожньо"
          text="Додайте запчастини з каталогу або підберіть їх за маркою та моделлю вашого авто — ми перевіримо сумісність перед відправкою."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/catalog" className={buttonClass()}>
                Перейти до каталогу
              </Link>
              <Link href="/avto" className={buttonClass({ variant: "secondary" })}>
                Підібрати за авто
              </Link>
            </div>
          }
        />
      </>
    );
  }

  const savings = items.reduce(
    (sum, item) => sum + (item.oldPrice && item.oldPrice > item.price ? (item.oldPrice - item.price) * item.qty : 0),
    0,
  );

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="page-title">
          Кошик <span className="tabular text-ink-3">· {countUk(count, ["товар", "товари", "товарів"])}</span>
        </h1>
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 transition-colors hover:text-danger"
        >
          <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
          Очистити кошик
        </button>
      </div>

      {undo && (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line-soft bg-mist-soft px-4 py-3"
        >
          <p className="text-sm text-ink-2">
            Товар «{undo.name}» прибрано з кошика.
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-1.5 rounded-btn px-2.5 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />
              Повернути
            </button>
            <button
              type="button"
              onClick={() => setUndo(null)}
              aria-label="Сховати повідомлення"
              className="grid size-8 place-content-center rounded-full text-ink-3 transition-colors hover:bg-mist hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem] lg:gap-8">
        <section aria-label="Товари в кошику" className="card px-4 py-2 sm:px-6 sm:py-4">
          <ul className="divide-y divide-line-soft">
            {items.map((item) => (
              <CartLine key={item.key} item={item} onQty={setQty} onRemove={handleRemove} />
            ))}
          </ul>
        </section>

        <CartSummary count={count} total={total} savings={savings} />
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Очистити кошик?"
        description="Усі товари буде прибрано з кошика. Цю дію не можна скасувати."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirmClear(false)} className={buttonClass({ variant: "ghost" })}>
            Скасувати
          </button>
          <button type="button" onClick={handleClear} className={buttonClass({ variant: "primary" })}>
            Очистити кошик
          </button>
        </div>
      </Modal>
    </>
  );
}

function CartSkeleton() {
  return (
    <div className="mt-4" aria-hidden>
      <div className="h-9 w-48 animate-pulse rounded-btn bg-mist" />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_22rem] lg:gap-8">
        <div className="card grid gap-4 p-4 sm:p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-4 border-b border-line-soft pb-4 last:border-0 last:pb-0">
              <div className="size-18 shrink-0 animate-pulse rounded-card bg-mist sm:size-20" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-20 animate-pulse rounded bg-mist" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-mist" />
                <div className="h-3 w-24 animate-pulse rounded bg-mist" />
              </div>
            </div>
          ))}
        </div>
        <div className="card space-y-3 p-5">
          <div className="h-6 w-24 animate-pulse rounded bg-mist" />
          <div className="h-4 w-full animate-pulse rounded bg-mist" />
          <div className="h-12 w-full animate-pulse rounded-btn bg-mist" />
          <div className="h-11 w-full animate-pulse rounded-btn bg-mist" />
        </div>
      </div>
    </div>
  );
}
