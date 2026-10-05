import type { Product, ProductCardData } from "@/lib/types";

/**
 * Plain card data for Client Components. Brand, category and illustration are denormalised
 * on every catalog product, so no lookup is needed.
 */
export function toCardData(product: Product): ProductCardData {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    brandName: product.brandName ?? "",
    categoryName: product.categoryName ?? "",
    illustration: product.illustration ?? "_fallback",
    image: product.images[0],
    price: product.price,
    oldPrice: product.oldPrice,
    stock: product.stock,
    deliveryDays: product.deliveryDays,
    badges: product.badges,
    rating: product.rating,
    reviewsCount: product.reviewsCount,
    option: product.option,
  };
}

export function toCardList(products: Product[]): ProductCardData[] {
  return products.map(toCardData);
}
