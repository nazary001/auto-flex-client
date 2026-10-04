import { site } from "@/lib/site";
import type { StockStatus } from "@/lib/types";

interface ProductJsonLdProps {
  name: string;
  sku: string;
  mpn: string;
  brandName: string;
  categoryName: string;
  description: string;
  imageUrl: string;
  url: string;
  price: number;
  stock: StockStatus;
  rating: number;
  reviewsCount: number;
}

const availabilityFor: Record<StockStatus, string> = {
  in_stock: "https://schema.org/InStock",
  low_stock: "https://schema.org/LimitedAvailability",
  preorder: "https://schema.org/PreOrder",
  out_of_stock: "https://schema.org/OutOfStock",
};

/** Product JSON-LD (schema.org) for rich results. */
export function ProductJsonLd({
  name,
  sku,
  mpn,
  brandName,
  categoryName,
  description,
  imageUrl,
  url,
  price,
  stock,
  rating,
  reviewsCount,
}: ProductJsonLdProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    sku,
    mpn,
    category: categoryName,
    description,
    image: [imageUrl],
    brand: { "@type": "Brand", name: brandName },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "UAH",
      price,
      availability: availabilityFor[stock],
      seller: { "@type": "Organization", name: site.name },
    },
    ...(reviewsCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating,
            bestRating: 5,
            worstRating: 1,
            ratingCount: reviewsCount,
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
