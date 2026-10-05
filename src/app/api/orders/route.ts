import { randomInt } from "node:crypto";
import { STOREFRONT_ACTOR } from "@/lib/admin/types";
import { dateStamp } from "@/lib/admin/domain/numbering";
import { formatPhone, formatPrice, isValidUaPhone, normalizePhone } from "@/lib/format";
import { getProductDoc } from "@/lib/server/catalog/products";
import { docToProduct } from "@/lib/server/catalog/product-doc";
import { getDb } from "@/lib/server/db/client";
import { addOrderEvent, createOrder } from "@/lib/server/db/repos/orders";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/server/db/repos/settings";
import { clean, notifyManagers } from "@/lib/server/notify";
import { rejectReason } from "@/lib/server/rate-limit";
import { variantCost } from "@/lib/server/suppliers/ddtuning/mapping";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";

/*
 * Checkout endpoint. Validates and re-prices the cart from the catalog (including the chosen
 * variant), stores the order with the supplier cost snapshot and notifies the managers.
 */

const deliveryLabels: Record<DeliveryMethod, string> = {
  np_branch: "Нова Пошта — відділення",
  np_locker: "Нова Пошта — поштомат",
  np_courier: "Нова Пошта — кур'єр",
  ukrposhta: "Укрпошта",
};

const paymentLabels: Record<PaymentMethod, string> = {
  cod: "Оплата при отриманні",
  card_online: "Карткою онлайн",
  installments: "Оплата частинами",
  invoice: "Безготівковий рахунок",
};

const MAX_LINES = 50;
const MAX_QTY = 99;

function fail(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface PricedLine {
  productId: string;
  name: string;
  sku: string;
  option?: string;
  price: number;
  qty: number;
  costPrice?: number;
  supplierId?: string;
}

export async function POST(request: Request) {
  const rejected = rejectReason(request);
  if (rejected) return fail(rejected.error, rejected.status);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Некоректний запит.");
  }
  if (!isRecord(body) || !isRecord(body.customer) || !isRecord(body.delivery) || !Array.isArray(body.items)) {
    return fail("Некоректний запит.");
  }

  const firstName = clean(body.customer.firstName, 60);
  const lastName = clean(body.customer.lastName, 60);
  const phone = clean(body.customer.phone, 30);
  const email = clean(body.customer.email, 120);
  if (firstName.length < 2 || lastName.length < 2) return fail("Вкажіть ім'я та прізвище одержувача.");
  if (!isValidUaPhone(phone)) return fail("Вкажіть номер телефону у форматі +38 (0XX) XXX-XX-XX.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail("Перевірте адресу електронної пошти.");

  const rawMethod = body.delivery.method;
  const rawPayment = body.payment;
  if (typeof rawMethod !== "string" || !Object.hasOwn(deliveryLabels, rawMethod)) {
    return fail("Оберіть спосіб доставки.");
  }
  if (typeof rawPayment !== "string" || !Object.hasOwn(paymentLabels, rawPayment)) {
    return fail("Оберіть спосіб оплати.");
  }
  const method = rawMethod as DeliveryMethod;
  const payment = rawPayment as PaymentMethod;

  const city = clean(body.delivery.city, 80);
  const address = clean(body.delivery.address, 160);
  if (city.length < 2) return fail("Вкажіть населений пункт.");
  if (address.length < 1) return fail("Вкажіть відділення, поштомат або адресу доставки.");

  if (body.items.length === 0) return fail("Кошик порожній.");
  if (body.items.length > MAX_LINES) return fail("Забагато позицій в одному замовленні.");

  // The catalog lives in the database: without it we cannot price the order
  let db;
  try {
    db = await getDb();
  } catch (error) {
    console.error("[AutoFlex] База даних недоступна під час оформлення замовлення", error);
    return fail("Магазин тимчасово недоступний. Спробуйте за хвилину або зателефонуйте нам.", 503);
  }
  let settings = DEFAULT_SETTINGS;
  try {
    settings = await getSettings(db);
  } catch (error) {
    console.error("[AutoFlex] Не вдалося прочитати налаштування", error);
  }
  if (!settings.checkout.delivery[method]?.enabled) return fail("Цей спосіб доставки наразі недоступний. Оберіть інший.");
  if (!settings.checkout.payment[payment]?.enabled) return fail("Цей спосіб оплати наразі недоступний. Оберіть інший.");
  const rates = { EUR: settings.supplier.rates.EUR, USD: settings.supplier.rates.USD };

  // Prices and names always come from the catalog, never from the client
  const lines: PricedLine[] = [];
  for (const raw of body.items) {
    if (!isRecord(raw)) return fail("Некоректна позиція замовлення.");
    const doc = typeof raw.productId === "string" ? await getProductDoc(db, raw.productId) : null;
    const qty = Number(raw.qty);
    if (!doc || doc.hidden) return fail("Один із товарів більше не продається. Оновіть кошик.");
    const product = docToProduct(doc);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return fail("Некоректна кількість товару.");
    if (product.stock === "out_of_stock") return fail(`Товару «${product.name}» зараз немає в наявності.`);

    const optionValue = product.option?.values.find((v) => `${product.id}:${v.id}` === raw.key);
    if (product.option && !optionValue) return fail(`Оберіть варіант для товару «${product.name}».`);
    if (optionValue?.stock === "out_of_stock") {
      return fail(`Варіант «${optionValue.label}» товару «${product.name}» зараз недоступний. Оберіть інший варіант.`);
    }
    const cost = variantCost(doc, optionValue?.id, rates);
    lines.push({
      productId: product.id,
      name: product.name,
      sku: optionValue?.sku ?? cost.sku ?? product.sku,
      option: optionValue && product.option ? `${product.option.name}: ${optionValue.label}` : undefined,
      price: product.price + (optionValue?.priceDelta ?? 0),
      qty,
      costPrice: cost.costPrice,
      supplierId: doc.source === "ddtuning" ? "sup-ddt" : undefined,
    });
  }

  const comment = clean(body.comment, 600);
  const vehicle = clean(body.vehicle, 160);
  const doNotCall = body.doNotCall === true;
  const normalizedPhone = normalizePhone(phone);

  // 1. Persist. If the write fails the order still goes to the managers with a provisional number.
  let orderNumber: string;
  let orderId: string | null = null;
  let total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  try {
    const order = await createOrder(
      db,
      {
        source: "website",
        customer: { firstName, lastName, phone: normalizedPhone, email: email || undefined },
        delivery: { method, city, address },
        payment: { method: payment },
        lines: lines.map((line) => ({
          productId: line.productId,
          sku: line.sku,
          name: line.name,
          optionLabel: line.option,
          price: line.price,
          qty: line.qty,
          costPrice: line.costPrice,
          supplierId: line.supplierId,
        })),
        comment: comment || undefined,
        vehicle: vehicle || undefined,
        doNotCall,
      },
      STOREFRONT_ACTOR,
    );
    orderNumber = order.number;
    orderId = order.id;
    total = order.total;
  } catch (error) {
    console.error("[AutoFlex] Не вдалося зберегти замовлення в базі", error);
    orderNumber = `AF-${dateStamp()}-${randomInt(1000, 10000)}`;
  }

  // 2. Notify (best effort once the order is stored; mandatory when it could not be stored)
  const message = [
    `🛒 Нове замовлення ${orderNumber}`,
    "",
    ...lines.map(
      (line, i) =>
        `${i + 1}. ${line.name}${line.option ? ` (${line.option})` : ""}\n   арт. ${line.sku} · ${line.qty} шт × ${formatPrice(line.price)}`,
    ),
    "",
    `Разом: ${formatPrice(total)}`,
    "",
    `Одержувач: ${lastName} ${firstName}`,
    `Телефон: ${formatPhone(normalizedPhone)}`,
    email ? `E-mail: ${email}` : null,
    `Доставка: ${deliveryLabels[method]} — ${city}, ${address}`,
    `Оплата: ${paymentLabels[payment]}`,
    vehicle ? `Авто / VIN: ${vehicle}` : null,
    comment ? `Коментар: ${comment}` : null,
    doNotCall ? "Не телефонувати для підтвердження" : "Передзвонити для підтвердження",
    orderId ? `Адмінка: /admin/orders/${orderId}` : "⚠️ Замовлення НЕ збережено в базі — обробіть вручну",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const payload = {
    type: "order",
    orderId,
    orderNumber,
    total,
    customer: { firstName, lastName, phone: normalizedPhone, email: email || undefined },
    delivery: { method, city, address },
    payment,
    vehicle: vehicle || undefined,
    comment: comment || undefined,
    doNotCall,
    items: lines.map((line) => {
      const { costPrice, supplierId, ...rest } = line;
      void costPrice;
      void supplierId;
      return rest;
    }),
  };

  const wantNotify = settings.notifications.telegramNewOrder || !orderId;
  if (wantNotify) {
    try {
      const delivered = await notifyManagers(message, payload);
      if (orderId && delivered) {
        await addOrderEvent(db, orderId, "notified", STOREFRONT_ACTOR, "Сповіщення менеджерам надіслано");
      }
    } catch (error) {
      console.error("[AutoFlex] Не вдалося надіслати замовлення менеджеру", error);
      if (!orderId) {
        return fail("Не вдалося оформити замовлення. Спробуйте ще раз або зателефонуйте нам.", 502);
      }
      try {
        await addOrderEvent(db, orderId, "notify_failed", STOREFRONT_ACTOR, "Сповіщення менеджерам не доставлено");
      } catch {
        // the order itself is safe in the database
      }
    }
  }

  return Response.json({ ok: true, orderNumber, total });
}
