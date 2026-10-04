import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { CardBuy } from "@/components/product/CardBuy";
import { CopySku } from "@/components/product/CopySku";
import { FavoriteButton } from "@/components/product/FavoriteButton";
import { ProductImage } from "@/components/product/ProductImage";
import { ProductBadgeLabel, StockLabel } from "@/components/ui/Badge";
import { Rating } from "@/components/ui/Rating";
import { cn } from "@/lib/cn";
import { discountPercent } from "@/lib/format";
import type { ProductCardData } from "@/lib/types";

interface ProductCardProps {
  product: ProductCardData;
  /** `sizes` hint for the photo */
  sizes?: string;
  className?: string;
}

/**
 * Catalog card. Works in Server and Client Components — build `product`
 * with `toCardData()` from "@/lib/card" on the server.
 */
export function ProductCard({ product, sizes, className }: ProductCardProps) {
  const href = `/product/${product.slug}`;
  const discount = discountPercent(product.price, product.oldPrice);

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-card border border-line-soft bg-white transition-[box-shadow,border-color] duration-200 hover:border-line hover:shadow-card",
        className,
      )}
    >
      <div className="relative p-2.5 pb-0 sm:p-3 sm:pb-0">
        <Link href={href} tabIndex={-1} aria-hidden className="block">
          <ProductImage
            image={product.image}
            illustration={product.illustration}
            alt=""
            sizes={sizes}
            className="rounded-[0.625rem]"
          />
        </Link>
        {product.badges.length > 0 && (
          <div className="pointer-events-none absolute top-4 left-4 flex flex-col items-start gap-1 sm:top-5 sm:left-5">
            {product.badges.map((badge) => (
              <ProductBadgeLabel key={badge} badge={badge} discount={discount} />
            ))}
          </div>
        )}
        <FavoriteButton
          productId={product.id}
          name={product.name}
          className="absolute top-4 right-4 z-10 sm:top-5 sm:right-5"
        />
      </div>

      <div className="flex flex-1 flex-col p-3 pt-2.5 sm:p-4 sm:pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-ink-2">{product.brandName}</span>
          <StockLabel stock={product.stock} className="shrink-0 max-sm:text-xs" />
        </div>

        <h3 className="mt-1.5 line-clamp-3 min-h-[3.9em] text-sm leading-[1.3] font-semibold text-ink sm:line-clamp-2 sm:min-h-[2.6em] sm:text-[15px]">
          <Link href={href} className="transition-colors after:absolute after:inset-0 hover:text-brand-700">
            {product.name}
          </Link>
        </h3>

        {product.fitLabel && (
          <p className="mt-1.5 flex items-start gap-1 text-xs leading-snug font-medium text-ok">
            <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />
            <span className="line-clamp-2">Підходить до {product.fitLabel}</span>
          </p>
        )}

        <div className="mt-2 flex min-h-6 flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <CopySku sku={product.sku} />
          {product.reviewsCount > 0 && <Rating value={product.rating} count={product.reviewsCount} />}
        </div>

        <CardBuy product={product} className="mt-auto pt-3" />
      </div>
    </article>
  );
}
