import { stockMeta } from "@/lib/format";
import type { ProductBadge } from "@/lib/types";
import { csvResponse, toCsv } from "@/lib/admin/domain/csv";
import { listAdminProductsForExport, type ProductFilter } from "@/lib/admin/queries/catalog";
import type { ProductSource } from "@/lib/server/db/collections";
import { AuthError, requireActor } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";

/*
 * GET /admin/export/products — product list as CSV (UTF-8 BOM, ";" separator), honouring the same
 * filters as the products page. Capped at 20 000 rows by the query layer.
 */

const badgeLabel: Record<ProductBadge, string> = { new: "Новинка", sale: "Акція", hit: "Хіт" };
const sourceLabel: Record<ProductSource, string> = { ddtuning: "DD", manual: "вручну", demo: "демо" };

const COLUMNS = [
  { key: "id", header: "id" },
  { key: "sku", header: "sku" },
  { key: "name", header: "name" },
  { key: "brand", header: "brand" },
  { key: "category", header: "category" },
  { key: "price", header: "price" },
  { key: "oldPrice", header: "oldPrice" },
  { key: "stock", header: "stock" },
  { key: "deliveryDays", header: "deliveryDays" },
  { key: "badges", header: "badges" },
  { key: "source", header: "source" },
  { key: "cost", header: "cost" },
  { key: "margin", header: "margin%" },
  { key: "variants", header: "variants" },
  { key: "state", header: "state" },
];

export async function GET(request: Request): Promise<Response> {
  try {
    await requireActor("export");
  } catch (error) {
    if (error instanceof AuthError) return new Response("Unauthorized", { status: 401 });
    throw error;
  }

  const db = await getDb();
  const url = new URL(request.url);
  const get = (key: string) => url.searchParams.get(key) || undefined;
  const filter: ProductFilter = {
    q: get("q"),
    category: get("category"),
    brand: get("brand"),
    stock: get("stock"),
    badge: get("badge"),
    state: get("state"),
    sort: get("sort") || "popular",
  };

  const rows = await listAdminProductsForExport(db, filter);
  const csvRows = rows.map((r) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    brand: r.brandName,
    category: r.categoryName,
    price: r.price,
    oldPrice: r.oldPrice ?? "",
    stock: stockMeta[r.stock].label,
    deliveryDays: `${r.deliveryDays[0]}-${r.deliveryDays[1]}`,
    badges: r.badges.map((b) => badgeLabel[b]).join(", "),
    source: sourceLabel[r.source],
    cost: r.cost ?? "",
    margin: r.marginPercent ?? "",
    variants: r.variants || "",
    state: [r.edited ? "змінено" : "", r.retired ? "знято" : r.hidden ? "приховано" : ""].filter(Boolean).join(", "),
  }));

  return csvResponse("products.csv", toCsv(COLUMNS, csvRows));
}
