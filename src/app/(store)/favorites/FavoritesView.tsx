"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { countUk } from "@/lib/format";
import { useFavorites } from "@/lib/store";
import type { ProductCardData } from "@/lib/types";

export function FavoritesView() {
  const { hydrated, ids, count, clear } = useFavorites();
  const idsKey = ids.join(",");
  const [data, setData] = useState<{ key: string; products: ProductCardData[] } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!hydrated || idsKey === "") return;
    let cancelled = false;
    fetch(`/api/products?ids=${encodeURIComponent(idsKey)}`)
      .then((response) => response.json())
      .then((json: { products?: ProductCardData[] }) => {
        if (!cancelled) setData({ key: idsKey, products: Array.isArray(json.products) ? json.products : [] });
      })
      .catch(() => {
        if (!cancelled) setData({ key: idsKey, products: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, idsKey]);

  const loading = hydrated && ids.length > 0 && data === null;
  const displayed = data ? data.products.filter((product) => ids.includes(product.id)) : [];

  function handleClear() {
    clear();
    setConfirmClear(false);
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="page-title">
          Обране
          {hydrated && count > 0 && (
            <span className="tabular text-ink-3"> · {countUk(count, ["товар", "товари", "товарів"])}</span>
          )}
        </h1>
        {hydrated && count > 0 && (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 transition-colors hover:text-danger"
          >
            <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
            Очистити обране
          </button>
        )}
      </div>

      <p className="mt-2 max-w-2xl text-[15px] text-ink-3">
        Товари, які ви зберегли, щоб повернутися до них пізніше. Обране зберігається у цьому браузері на цьому пристрої.
      </p>

      <div className="mt-6">
        {!hydrated || loading ? (
          <FavoritesSkeleton />
        ) : ids.length === 0 ? (
          <EmptyState
            icon={<Heart aria-hidden strokeWidth={1.75} />}
            title="В обраному поки порожньо"
            text="Натискайте на сердечко на картці товару, щоб зберегти запчастину тут і легко повернутися до неї пізніше."
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
        ) : (
          <ProductGrid products={displayed} />
        )}
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Очистити обране?"
        description="Усі товари буде прибрано зі списку обраного на цьому пристрої."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setConfirmClear(false)} className={buttonClass({ variant: "ghost" })}>
            Скасувати
          </button>
          <button type="button" onClick={handleClear} className={buttonClass({ variant: "primary" })}>
            Очистити обране
          </button>
        </div>
      </Modal>
    </>
  );
}

function FavoritesSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="rounded-card border border-line-soft bg-white p-2.5 sm:p-3">
          <div className="aspect-square w-full animate-pulse rounded-[0.625rem] bg-mist" />
          <div className="space-y-2 p-1 pt-3">
            <div className="h-3 w-16 animate-pulse rounded bg-mist" />
            <div className="h-4 w-full animate-pulse rounded bg-mist" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-mist" />
            <div className="mt-3 h-9 w-full animate-pulse rounded-btn bg-mist" />
          </div>
        </li>
      ))}
    </ul>
  );
}
