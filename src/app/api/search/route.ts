import type { NextRequest } from "next/server";
import { toCardList } from "@/lib/card";
import { searchCatalog } from "@/lib/catalog";
import type { SearchResponse } from "@/lib/types";

/** Live search suggestions for the header: GET /api/search?q=колодки */
export function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const result = searchCatalog(q, 6);
  const payload: SearchResponse = {
    products: toCardList(result.products),
    categories: result.categories.slice(0, 4).map((c) => ({ slug: c.slug, name: c.name })),
    brands: result.brands.slice(0, 4).map((b) => ({ slug: b.slug, name: b.name })),
    total: result.total,
  };
  return Response.json(payload);
}
