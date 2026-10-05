import { formatPrice } from "@/lib/format";
import type { MessageTemplate, Order } from "../types";

/*
 * Message templates the manager copies into Viber/Telegram/SMS. Placeholders are
 * {{name}} rendered from the order; unknown placeholders are left as-is so the manager sees them.
 */

export const TEMPLATE_PLACEHOLDERS: { key: string; description: string }[] = [
  { key: "number", description: "Номер замовлення" },
  { key: "name", description: "Ім'я покупця" },
  { key: "fullName", description: "Прізвище та ім'я" },
  { key: "total", description: "Сума замовлення" },
  { key: "items", description: "Список товарів (кожен з нового рядка)" },
  { key: "ttn", description: "Номер ТТН" },
  { key: "city", description: "Місто доставки" },
  { key: "address", description: "Відділення / адреса" },
  { key: "paymentLink", description: "Посилання на оплату" },
];

export function templateVariables(order: Order): Record<string, string> {
  const activeLines = order.lines.filter((line) => line.fulfillment !== "cancelled");
  return {
    number: order.number,
    name: order.customer.firstName,
    fullName: `${order.customer.lastName} ${order.customer.firstName}`.trim(),
    total: formatPrice(order.total),
    items: activeLines.map((line) => `${line.name}${line.optionLabel ? ` (${line.optionLabel})` : ""} — ${line.qty} шт`).join("\n"),
    ttn: order.delivery.trackingNumber ?? "",
    city: order.delivery.city,
    address: order.delivery.address,
    paymentLink: order.payment.paymentLink ?? "",
  };
}

export function renderTemplate(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, key: string) => (key in variables ? variables[key] : match));
}

export function renderOrderTemplate(template: Pick<MessageTemplate, "body">, order: Order): string {
  return renderTemplate(template.body, templateVariables(order));
}

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: "confirm",
    name: "Підтвердження замовлення",
    body:
      "Вітаємо, {{name}}! Ваше замовлення {{number}} на суму {{total}} прийнято.\n{{items}}\nПісля перевірки наявності у постачальника ми повідомимо дату відправлення. Дякуємо, що обрали AutoFlex!",
  },
  {
    id: "shipped",
    name: "Відправлено, номер ТТН",
    body:
      "{{name}}, ваше замовлення {{number}} відправлено. Номер ТТН: {{ttn}}. Доставка: {{city}}, {{address}}. Відстежити: https://novaposhta.ua/tracking/?cargo_number={{ttn}}",
  },
  {
    id: "payment",
    name: "Посилання на оплату",
    body: "{{name}}, для замовлення {{number}} на суму {{total}} сформовано посилання на оплату: {{paymentLink}}. Після оплати ми одразу передамо замовлення на відправлення.",
  },
  {
    id: "delay",
    name: "Затримка у постачальника",
    body:
      "{{name}}, вибачте за очікування: постачальник затримує позицію з вашого замовлення {{number}}. Ми тримаємо ситуацію на контролі й повідомимо нову дату відправлення найближчим часом.",
  },
];
