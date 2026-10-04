import type { NextRequest } from "next/server";
import { toCardData } from "@/lib/card";
import { getProductById } from "@/lib/catalog";
import type { ProductCardData } from "@/lib/types";

const MAX_IDS = 60;

/**
 * Card data for products known to the browser only by id (favourites, recently viewed):
 * GET /api/products?ids=a,b,c → { products } in the requested order; unknown ids are skipped.
 */
export function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);

  const products: ProductCardData[] = [];
  for (const id of new Set(ids)) {
    const product = getProductById(id);
    if (product) products.push(toCardData(product));
  }
  return Response.json({ products });
}
