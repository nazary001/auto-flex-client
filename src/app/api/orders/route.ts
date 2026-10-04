import { randomInt } from "node:crypto";
import { getProductById } from "@/lib/catalog";
import { formatPhone, formatPrice, isValidUaPhone, normalizePhone } from "@/lib/format";
import { clean, notifyManagers } from "@/lib/server/notify";
import { rejectReason } from "@/lib/server/rate-limit";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";

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

  // Prices and names always come from the catalog, never from the client
  const lines: { name: string; sku: string; option?: string; price: number; qty: number }[] = [];
  for (const raw of body.items) {
    if (!isRecord(raw)) return fail("Некоректна позиція замовлення.");
    const product = typeof raw.productId === "string" ? getProductById(raw.productId) : undefined;
    const qty = Number(raw.qty);
    if (!product) return fail("Один із товарів більше не продається. Оновіть кошик.");
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return fail("Некоректна кількість товару.");
    if (product.stock === "out_of_stock") return fail(`Товару «${product.name}» зараз немає в наявності.`);

    const optionValue = product.option?.values.find((v) => `${product.id}:${v.id}` === raw.key);
    if (product.option && !optionValue) return fail(`Оберіть варіант для товару «${product.name}».`);
    lines.push({
      name: product.name,
      sku: product.sku,
      option: optionValue && product.option ? `${product.option.name}: ${optionValue.label}` : undefined,
      price: product.price + (optionValue?.priceDelta ?? 0),
      qty,
    });
  }

  const total = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const orderNumber = `AF-${stamp}-${randomInt(1000, 10000)}`;

  const comment = clean(body.comment, 600);
  const vehicle = clean(body.vehicle, 160);
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
    `Телефон: ${formatPhone(normalizePhone(phone))}`,
    email ? `E-mail: ${email}` : null,
    `Доставка: ${deliveryLabels[method]} — ${city}, ${address}`,
    `Оплата: ${paymentLabels[payment]}`,
    vehicle ? `Авто / VIN: ${vehicle}` : null,
    comment ? `Коментар: ${comment}` : null,
    body.doNotCall === true ? "Не телефонувати для підтвердження" : "Передзвонити для підтвердження",
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    await notifyManagers(message, {
      type: "order",
      orderNumber,
      total,
      customer: { firstName, lastName, phone: normalizePhone(phone), email: email || undefined },
      delivery: { method, city, address },
      payment,
      vehicle: vehicle || undefined,
      comment: comment || undefined,
      doNotCall: body.doNotCall === true,
      items: lines,
    });
  } catch (error) {
    console.error("[AutoFlex] Не вдалося надіслати замовлення менеджеру", error);
    return fail("Не вдалося оформити замовлення. Спробуйте ще раз або зателефонуйте нам.", 502);
  }

  return Response.json({ ok: true, orderNumber, total });
}
