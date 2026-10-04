import { getProductById } from "@/lib/catalog";
import { formatPhone, formatPrice, isValidUaPhone, normalizePhone } from "@/lib/format";
import { clean, notifyManagers } from "@/lib/server/notify";
import { rejectReason } from "@/lib/server/rate-limit";
import type { CallbackKind } from "@/lib/types";

const titles: Record<CallbackKind, string> = {
  callback: "📞 Замовлення дзвінка",
  quick_order: "⚡ Швидке замовлення",
  question: "❓ Питання від покупця",
  notify_stock: "🔔 Повідомити про наявність",
};

function fail(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const rejected = rejectReason(request);
  if (rejected) return fail(rejected.error, rejected.status);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return fail("Некоректний запит.");
    body = parsed as Record<string, unknown>;
  } catch {
    return fail("Некоректний запит.");
  }

  if (typeof body.kind !== "string" || !Object.hasOwn(titles, body.kind)) return fail("Некоректний запит.");
  const kind = body.kind as CallbackKind;

  const phone = clean(body.phone, 30);
  if (!isValidUaPhone(phone)) return fail("Вкажіть номер телефону у форматі +38 (0XX) XXX-XX-XX.");

  const name = clean(body.name, 60);
  const comment = clean(body.comment, 600);
  const product = typeof body.productId === "string" ? getProductById(body.productId) : undefined;
  if ((kind === "quick_order" || kind === "notify_stock") && !product) {
    return fail("Товар не знайдено. Оновіть сторінку.");
  }
  if (kind === "quick_order" && product?.stock === "out_of_stock") {
    return fail(`Товару «${product.name}» зараз немає в наявності.`);
  }

  const message = [
    titles[kind],
    "",
    `Телефон: ${formatPhone(normalizePhone(phone))}`,
    name ? `Ім'я: ${name}` : null,
    product ? `Товар: ${product.name}\nарт. ${product.sku} · ${formatPrice(product.price)}` : null,
    comment ? `Коментар: ${comment}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    await notifyManagers(message, {
      type: kind,
      phone: normalizePhone(phone),
      name: name || undefined,
      product: product ? { id: product.id, name: product.name, sku: product.sku, price: product.price } : undefined,
      comment: comment || undefined,
    });
  } catch (error) {
    console.error("[AutoFlex] Не вдалося надіслати заявку менеджеру", error);
    return fail("Не вдалося надіслати заявку. Спробуйте ще раз або зателефонуйте нам.", 502);
  }

  return Response.json({ ok: true });
}
