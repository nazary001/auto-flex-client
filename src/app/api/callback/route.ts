import { getProductById } from "@/lib/catalog";
import { formatPhone, formatPrice, isValidUaPhone, normalizePhone } from "@/lib/format";
import { getDb } from "@/lib/server/db/client";
import { createRequest } from "@/lib/server/db/repos/requests";
import { createReview } from "@/lib/server/db/repos/reviews";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/server/db/repos/settings";
import { clean, notifyManagers } from "@/lib/server/notify";
import { rejectReason } from "@/lib/server/rate-limit";
import type { CallbackKind } from "@/lib/types";

/*
 * Call-back requests, quick orders, product questions, stock alerts and reviews. Stored in the
 * database (requests inbox / review moderation) and forwarded to the managers.
 */

const titles: Record<CallbackKind, string> = {
  callback: "📞 Замовлення дзвінка",
  quick_order: "⚡ Швидке замовлення",
  question: "❓ Питання від покупця",
  notify_stock: "🔔 Повідомити про наявність",
};

/** The review form sends "Відгук, оцінка 5/5 — text" through the question channel */
const REVIEW_RE = /^Відгук, оцінка (\d)\/5(?:\s*—\s*)?/u;

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
  const normalizedPhone = normalizePhone(phone);

  const name = clean(body.name, 60);
  const comment = clean(body.comment, 600);
  const product = typeof body.productId === "string" ? await getProductById(body.productId) : undefined;
  if ((kind === "quick_order" || kind === "notify_stock") && !product) {
    return fail("Товар не знайдено. Оновіть сторінку.");
  }
  if (kind === "quick_order" && product?.stock === "out_of_stock") {
    return fail(`Товару «${product.name}» зараз немає в наявності.`);
  }

  const reviewMatch = kind === "question" && product ? REVIEW_RE.exec(comment) : null;

  // 1. Persist
  let settings = DEFAULT_SETTINGS;
  let stored = false;
  let requestId: string | null = null;
  try {
    const db = await getDb();
    settings = await getSettings(db);
    if (reviewMatch && product) {
      const review = await createReview(db, {
        productId: product.id,
        author: name || "Покупець",
        rating: Number(reviewMatch[1]),
        text: comment.slice(reviewMatch[0].length).trim() || comment,
        status: "pending",
        source: "site",
      });
      requestId = review.id;
    } else {
      const created = await createRequest(db, {
        kind,
        phone: normalizedPhone,
        name: name || undefined,
        productId: product?.id,
        productName: product?.name,
        productSku: product?.sku,
        comment: comment || undefined,
      });
      requestId = created.id;
    }
    stored = true;
  } catch (error) {
    console.error("[AutoFlex] Не вдалося зберегти заявку в базі", error);
  }

  // 2. Notify
  const message = [
    reviewMatch ? "⭐ Новий відгук (на модерацію)" : titles[kind],
    "",
    `Телефон: ${formatPhone(normalizedPhone)}`,
    name ? `Ім'я: ${name}` : null,
    product ? `Товар: ${product.name}\nарт. ${product.sku} · ${formatPrice(product.price)}` : null,
    comment ? `Коментар: ${comment}` : null,
    stored
      ? reviewMatch
        ? "Адмінка: /admin/reviews"
        : `Адмінка: /admin/requests?focus=${requestId}`
      : "⚠️ Заявку НЕ збережено в базі — обробіть вручну",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const wantNotify = settings.notifications.telegramNewRequest || !stored;
  if (wantNotify) {
    try {
      await notifyManagers(message, {
        type: reviewMatch ? "review" : kind,
        requestId,
        phone: normalizedPhone,
        name: name || undefined,
        product: product ? { id: product.id, name: product.name, sku: product.sku, price: product.price } : undefined,
        comment: comment || undefined,
      });
    } catch (error) {
      console.error("[AutoFlex] Не вдалося надіслати заявку менеджеру", error);
      if (!stored) return fail("Не вдалося надіслати заявку. Спробуйте ще раз або зателефонуйте нам.", 502);
    }
  }

  return Response.json({ ok: true });
}
