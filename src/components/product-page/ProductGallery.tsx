"use client";

import { useState } from "react";
import { ProductImage } from "@/components/product/ProductImage";
import { ProductBadgeLabel } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { ProductBadge } from "@/lib/types";

interface ProductGalleryProps {
  images: string[];
  illustration: string;
  alt: string;
  badges: ProductBadge[];
  discount: number;
}

/** Product gallery: large main image with badges; thumbnails switch the main image when there are several photos. */
export function ProductGallery({ images, illustration, alt, badges, discount }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const hasThumbs = images.length > 1;
  const mainImage = images[active];

  return (
    <div className="grid gap-3">
      <div className="relative isolate overflow-hidden rounded-card border border-line-soft bg-white">
        <ProductImage image={mainImage} illustration={illustration} alt={alt} preload sizes="(min-width: 1024px) 42vw, 100vw" />
        {badges.length > 0 && (
          <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5">
            {badges.map((badge) => (
              <ProductBadgeLabel key={badge} badge={badge} discount={discount} />
            ))}
          </div>
        )}
      </div>

      {hasThumbs && (
        <ul className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1">
          {images.map((image, index) => (
            <li key={image} className="shrink-0">
              <button
                type="button"
                aria-label={`Показати фото ${index + 1}`}
                aria-pressed={index === active}
                onClick={() => setActive(index)}
                className={cn(
                  "block size-20 overflow-hidden rounded-[0.625rem] border bg-white transition-colors",
                  index === active ? "border-brand-600 ring-1 ring-brand-600" : "border-line-soft hover:border-silver-400",
                )}
              >
                <ProductImage image={image} illustration={illustration} alt="" sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
