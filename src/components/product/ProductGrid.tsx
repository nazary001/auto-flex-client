import { ProductCard } from "@/components/product/ProductCard";
import { cn } from "@/lib/cn";
import type { ProductCardData } from "@/lib/types";

const columnClass = {
  /** Full-width pages */
  4: "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
  /** Pages with a sidebar */
  3: "grid-cols-2 xl:grid-cols-3",
} as const;

interface ProductGridProps {
  products: ProductCardData[];
  columns?: keyof typeof columnClass;
  className?: string;
}

export function ProductGrid({ products, columns = 4, className }: ProductGridProps) {
  return (
    <ul className={cn("reveal-children grid gap-3 sm:gap-4", columnClass[columns], className)}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
