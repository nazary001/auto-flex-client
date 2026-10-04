"use client";

import { useEffect, useState } from "react";
import { Carousel } from "@/components/ui/Carousel";
import { ProductCard } from "@/components/product/ProductCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useRecentlyViewed } from "@/lib/store";
import type { ProductCardData } from "@/lib/types";

/** «Ви переглядали» — records the current product and shows previously viewed ones (hidden when empty). */
export function RecentlyViewed({ currentId }: { currentId: string }) {
  const { hydrated, ids, push } = useRecentlyViewed();
  const [items, setItems] = useState<ProductCardData[]>([]);

  // Record this product as viewed once client state is ready.
  useEffect(() => {
    if (hydrated) push(currentId);
  }, [hydrated, currentId, push]);

  const key = ids.filter((id) => id !== currentId).slice(0, 8).join(",");

  useEffect(() => {
    if (!hydrated || !key) return;
    let cancelled = false;
    fetch(`/api/products?ids=${key}`)
      .then((res) => res.json())
      .then((data: { products?: ProductCardData[] }) => {
        if (!cancelled) setItems(data.products ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hydrated, key]);

  if (!hydrated || items.length === 0) return null;

  return (
    <section aria-label="Ви переглядали" className="border-t border-line-soft">
      <div className="container-page py-10 lg:py-14">
        <SectionHeading as="h2" title="Ви переглядали" className="mb-5" />
        <Carousel label="Нещодавно переглянуті товари">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </Carousel>
      </div>
    </section>
  );
}
