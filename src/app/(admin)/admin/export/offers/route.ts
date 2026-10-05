import { AuthError, requireActor } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { csvResponse, toCsv } from "@/lib/admin/domain/csv";
import { getSupplier } from "@/lib/server/db/repos/suppliers";
import { offersForSupplier } from "@/lib/admin/queries/purchasing";

/*
 * CSV export of a supplier's price list (or an empty template). Header matches the import
 * parser: sku;cost;availability;qty;lead_min;lead_max.
 */

const COLUMNS = [
  { key: "sku", header: "sku" },
  { key: "cost", header: "cost" },
  { key: "availability", header: "availability" },
  { key: "qty", header: "qty" },
  { key: "lead_min", header: "lead_min" },
  { key: "lead_max", header: "lead_max" },
];

export async function GET(request: Request): Promise<Response> {
  try {
    await requireActor("export");
  } catch (error) {
    if (error instanceof AuthError) return new Response("Потрібна авторизація.", { status: 401 });
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const supplierId = searchParams.get("supplier") ?? "";
  const template = searchParams.get("template") === "1";

  if (template) {
    return csvResponse("offers-template.csv", toCsv(COLUMNS, []));
  }
  if (!supplierId) return new Response("Не вказано постачальника.", { status: 400 });

  const db = await getDb();
  const supplier = await getSupplier(db, supplierId);
  if (!supplier) return new Response("Постачальника не знайдено.", { status: 404 });

  const offers = await offersForSupplier(db, supplierId);
  const rows = offers.map((o) => ({
    sku: o.sku,
    cost: o.cost,
    availability: o.availability,
    qty: o.qty ?? "",
    lead_min: o.leadDays?.[0] ?? "",
    lead_max: o.leadDays?.[1] ?? "",
  }));
  return csvResponse(`offers-${supplier.code.toLowerCase()}.csv`, toCsv(COLUMNS, rows));
}
