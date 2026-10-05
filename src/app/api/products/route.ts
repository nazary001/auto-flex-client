import type { NextRequest } from "next/server";
import { toCardList } from "@/lib/card";
import { getProductsByIds } from "@/lib/catalog";

const MAX_IDS = 60;

/**
 * Card data for products known to the browser only by id (favourites, recently viewed):
 * GET /api/products?ids=a,b,c → { products } in the requested order; unknown ids are skipped.
 */
export async function GET(request: NextRequest) {
  const ids = [
    ...new Set(
      (request.nextUrl.searchParams.get("ids") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, MAX_IDS),
    ),
  ];
  try {
    const products = await getProductsByIds(ids);
    return Response.json({ products: toCardList(products) });
  } catch (error) {
    console.error("[AutoFlex] /api/products", error);
    return Response.json({ products: [] }, { status: 503 });
  }
}
