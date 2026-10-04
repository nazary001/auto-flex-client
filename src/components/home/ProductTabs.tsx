import { ProductCard } from "@/components/product/ProductCard";
import { Carousel, carouselItem } from "@/components/ui/Carousel";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import type { ProductCardData } from "@/lib/types";

interface ProductTabsProps {
  newItems: ProductCardData[];
  saleItems: ProductCardData[];
  popularItems: ProductCardData[];
}

const cardSizes = "(min-width: 1280px) 300px, (min-width: 768px) 40vw, 72vw";

function panel(products: ProductCardData[], label: string) {
  return (
    <Carousel label={label} itemClassName={carouselItem.three}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} sizes={cardSizes} />
      ))}
    </Carousel>
  );
}

/** Home product tabs: «Новинки» / «Розпродаж» / «Популярні товари», each a carousel of cards. */
export function ProductTabs({ newItems, saleItems, popularItems }: ProductTabsProps) {
  const items: TabItem[] = [];
  if (newItems.length > 0) items.push({ id: "new", label: "Новинки", content: panel(newItems, "Новинки") });
  if (saleItems.length > 0) items.push({ id: "sale", label: "Розпродаж", content: panel(saleItems, "Розпродаж") });
  if (popularItems.length > 0)
    items.push({ id: "popular", label: "Популярні товари", content: panel(popularItems, "Популярні товари") });

  if (items.length === 0) return null;

  return <Tabs items={items} />;
}
