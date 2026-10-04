import { getBrandById, getCategory } from "@/lib/catalog";
import type { Product, ProductCardData } from "@/lib/types";

/** Resolves brand and category so the card can be rendered anywhere, including Client Components */
export function toCardData(product: Product): ProductCardData {
  const category = getCategory(product.categoryId);
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    brandName: getBrandById(product.brandId)?.name ?? "",
    categoryName: category?.name ?? "",
    illustration: category?.illustration ?? "_fallback",
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
