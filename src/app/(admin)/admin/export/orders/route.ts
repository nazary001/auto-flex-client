import type { NextRequest } from "next/server";
import { formatPhone } from "@/lib/format";
import {
  deliveryMethodLabel,
  orderSourceLabel,
  orderStatusMeta,
  paymentMethodLabel,
  paymentStatusMeta,
} from "@/lib/admin/labels";
import { csvResponse, toCsv } from "@/lib/admin/domain/csv";
import { findOrdersForView, parseOrderQuery } from "@/lib/admin/queries/orders";
import { AuthError, requireActor } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { listUsers } from "@/lib/server/db/repos/users";

/*
 * GET /admin/export/orders — CSV of the current list (filters + saved view honoured).
 * UTF-8 BOM and ";" separator so Excel opens it correctly.
 */

const COLUMNS = [
  { key: "number", header: "Номер" },
  { key: "createdAt", header: "Дата" },
  { key: "status", header: "Статус" },
  { key: "paymentStatus", header: "Оплата" },
  { key: "paymentMethod", header: "Спосіб оплати" },
  { key: "deliveryMethod", header: "Доставка" },
  { key: "city", header: "Місто" },
  { key: "address", header: "Адреса / відділення" },
  { key: "trackingNumber", header: "ТТН" },
  { key: "customer", header: "Клієнт" },
  { key: "phone", header: "Телефон" },
  { key: "email", header: "E-mail" },
  { key: "lines", header: "Позиції" },
  { key: "subtotal", header: "Сума позицій" },
  { key: "discount", header: "Знижка" },
  { key: "total", header: "Разом" },
  { key: "costTotal", header: "Собівартість" },
  { key: "margin", header: "Маржа" },
  { key: "source", header: "Джерело" },
  { key: "assignee", header: "Відповідальний" },
  { key: "tags", header: "Мітки" },
];

function formatStamp(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

export async function GET(request: NextRequest) {
  try {
    await requireActor("export");
  } catch (error) {
    if (error instanceof AuthError) return new Response(error.message, { status: 401 });
    throw error;
  }

  const db = await getDb();
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { view, filter } = parseOrderQuery(sp);
  const [orders, users] = await Promise.all([findOrdersForView(db, view, filter), listUsers(db)]);
  const userById = new Map(users.map((u) => [u.id, u.name]));

  const rows = orders.map((order) => ({
    number: order.number,
    createdAt: formatStamp(order.createdAt),
    status: orderStatusMeta[order.status].label,
    paymentStatus: paymentStatusMeta[order.payment.status].label,
    paymentMethod: paymentMethodLabel[order.payment.method],
    deliveryMethod: deliveryMethodLabel[order.delivery.method],
    city: order.delivery.city,
    address: order.delivery.address,
    trackingNumber: order.delivery.trackingNumber ?? "",
    customer: `${order.customer.lastName} ${order.customer.firstName}`.trim(),
    phone: formatPhone(order.customer.phone),
    email: order.customer.email ?? "",
    lines: order.lines
      .filter((line) => line.fulfillment !== "cancelled")
      .map((line) => `${line.sku}×${line.qty}`)
      .join("; "),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    costTotal: order.costTotal,
    margin: order.marginKnown ? order.margin : "",
    source: orderSourceLabel[order.source],
    assignee: order.assigneeId ? (userById.get(order.assigneeId) ?? "") : "",
    tags: order.tags.join(", "),
  }));

  const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  return csvResponse(filename, toCsv(COLUMNS, rows));
}
