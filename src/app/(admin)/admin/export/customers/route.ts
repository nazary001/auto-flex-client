import { csvResponse, toCsv } from "@/lib/admin/domain/csv";
import { findCustomersForExport, parseCustomerFilter } from "@/lib/admin/queries/customers";
import { AuthError, requireActor } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";

/*
 * Customer CSV export. Honours the list filters (q / tag / doNotCall / sort). UTF-8 BOM and a
 * ";" separator come from toCsv so Excel with a Ukrainian locale opens it cleanly.
 */

const COLUMNS = [
  { key: "firstName", header: "Імʼя" },
  { key: "lastName", header: "Прізвище" },
  { key: "phone", header: "Телефон" },
  { key: "email", header: "Email" },
  { key: "city", header: "Місто" },
  { key: "tags", header: "Теги" },
  { key: "ordersCount", header: "Замовлень" },
  { key: "totalSpent", header: "Сума, грн" },
  { key: "firstOrderAt", header: "Перше замовлення" },
  { key: "lastOrderAt", header: "Останнє замовлення" },
  { key: "doNotCall", header: "Не телефонувати" },
  { key: "notes", header: "Нотатки" },
];

export async function GET(request: Request): Promise<Response> {
  try {
    await requireActor("export");
  } catch (error) {
    if (error instanceof AuthError) return new Response("Потрібна авторизація.", { status: 401 });
    throw error;
  }

  const db = await getDb();
  const params = new URL(request.url).searchParams;
  const filter = parseCustomerFilter({
    q: params.get("q") ?? undefined,
    tag: params.get("tag") ?? undefined,
    doNotCall: params.get("doNotCall") ?? undefined,
    sort: params.get("sort") ?? undefined,
  });

  const customers = await findCustomersForExport(db, filter);
  const rows = customers.map((c) => ({
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    email: c.email ?? "",
    city: c.city ?? "",
    tags: c.tags,
    ordersCount: c.ordersCount,
    totalSpent: c.totalSpent,
    firstOrderAt: c.firstOrderAt ? c.firstOrderAt.slice(0, 10) : "",
    lastOrderAt: c.lastOrderAt ? c.lastOrderAt.slice(0, 10) : "",
    doNotCall: c.doNotCall ? "так" : "ні",
    notes: c.notes,
  }));

  const filename = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, toCsv(COLUMNS, rows));
}
