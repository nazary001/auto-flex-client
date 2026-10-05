import type { CallbackKind, DeliveryMethod, PaymentMethod } from "@/lib/types";
import type {
  Carrier,
  LineFulfillment,
  OfferAvailability,
  OrderEventType,
  OrderSource,
  OrderStatus,
  PaymentStatus,
  PurchaseOrderStatus,
  RequestStatus,
  ReviewStatus,
  Role,
} from "./types";

/*
 * Ukrainian labels and badge tones for every enum of the back office. One source of truth,
 * consumed by <StatusBadge>, filters, exports and notifications. Plain data, safe on the client.
 */

export type BadgeTone = "blue" | "teal" | "violet" | "amber" | "green" | "slate" | "red" | "rose";

export interface StatusMeta {
  label: string;
  tone: BadgeTone;
  /** Short explanation for tooltips and the order status card */
  hint?: string;
}

export const orderStatusMeta: Record<OrderStatus, StatusMeta> = {
  new: { label: "Нове", tone: "blue", hint: "Надійшло з сайту або створено вручну, ще не підтверджене" },
  confirmed: { label: "Підтверджено", tone: "teal", hint: "Склад замовлення й доставку узгоджено з покупцем" },
  sourcing: { label: "У постачальника", tone: "violet", hint: "Запчастини замовлено у постачальника" },
  in_transit: { label: "Відправлено", tone: "amber", hint: "Посилка в дорозі до покупця" },
  delivered: { label: "Доставлено", tone: "green", hint: "Перевізник видав посилку покупцю" },
  completed: { label: "Виконано", tone: "green", hint: "Оплату отримано, замовлення закрито" },
  on_hold: { label: "Очікує", tone: "slate", hint: "Чекаємо на передплату, відповідь покупця або наявність" },
  cancelled: { label: "Скасовано", tone: "red" },
  returned: { label: "Повернення", tone: "rose", hint: "Покупець повернув товар" },
};

export const paymentStatusMeta: Record<PaymentStatus, StatusMeta> = {
  unpaid: { label: "Не оплачено", tone: "slate" },
  prepaid: { label: "Передплата", tone: "amber" },
  paid: { label: "Оплачено", tone: "green" },
  refunded: { label: "Повернено", tone: "red" },
  partially_refunded: { label: "Частково повернено", tone: "amber" },
};

export const purchaseOrderStatusMeta: Record<PurchaseOrderStatus, StatusMeta> = {
  draft: { label: "Чернетка", tone: "slate" },
  sent: { label: "Надіслано", tone: "blue" },
  confirmed: { label: "Підтверджено", tone: "teal" },
  shipped: { label: "Відправлено", tone: "amber" },
  received: { label: "Отримано", tone: "green" },
  cancelled: { label: "Скасовано", tone: "red" },
};

export const requestStatusMeta: Record<RequestStatus, StatusMeta> = {
  new: { label: "Нова", tone: "blue" },
  in_progress: { label: "В роботі", tone: "amber" },
  done: { label: "Опрацьовано", tone: "green" },
  spam: { label: "Спам", tone: "slate" },
};

export const reviewStatusMeta: Record<ReviewStatus, StatusMeta> = {
  pending: { label: "На модерації", tone: "amber" },
  approved: { label: "Опубліковано", tone: "green" },
  rejected: { label: "Відхилено", tone: "red" },
};

export const fulfillmentMeta: Record<LineFulfillment, StatusMeta> = {
  pending: { label: "Очікує закупівлі", tone: "slate" },
  ordered: { label: "Замовлено", tone: "violet" },
  shipped: { label: "Відправлено", tone: "amber" },
  delivered: { label: "Доставлено", tone: "green" },
  cancelled: { label: "Скасовано", tone: "red" },
};

export const availabilityMeta: Record<OfferAvailability, StatusMeta> = {
  in_stock: { label: "В наявності", tone: "green" },
  on_order: { label: "Під замовлення", tone: "amber" },
  none: { label: "Немає", tone: "slate" },
};

export const orderSourceLabel: Record<OrderSource, string> = {
  website: "Сайт",
  phone: "Телефон",
  manual: "Вручну",
  quick_order: "Швидке замовлення",
};

export const roleLabel: Record<Role, string> = {
  owner: "Власник",
  manager: "Менеджер",
  viewer: "Перегляд",
};

export const roleHint: Record<Role, string> = {
  owner: "Повний доступ, включно з налаштуваннями та користувачами",
  manager: "Замовлення, закупівлі, клієнти, каталог і контент",
  viewer: "Лише перегляд та експорт",
};

export const requestKindLabel: Record<CallbackKind, string> = {
  callback: "Зворотний дзвінок",
  quick_order: "Швидке замовлення",
  question: "Питання",
  notify_stock: "Повідомити про наявність",
};

export const deliveryMethodLabel: Record<DeliveryMethod, string> = {
  np_branch: "Нова Пошта — відділення",
  np_locker: "Нова Пошта — поштомат",
  np_courier: "Нова Пошта — кур'єр",
  ukrposhta: "Укрпошта",
};

export const deliveryMethodShort: Record<DeliveryMethod, string> = {
  np_branch: "НП відділення",
  np_locker: "НП поштомат",
  np_courier: "НП кур'єр",
  ukrposhta: "Укрпошта",
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  cod: "Оплата при отриманні",
  card_online: "Карткою онлайн",
  installments: "Оплата частинами",
  invoice: "Оплата за рахунком",
};

export const carrierLabel: Record<Carrier, string> = {
  nova_poshta: "Нова Пошта",
  ukrposhta: "Укрпошта",
  other: "Інший перевізник",
};

/** Carrier implied by a delivery method */
export function carrierFor(method: DeliveryMethod): Carrier {
  return method === "ukrposhta" ? "ukrposhta" : "nova_poshta";
}

export const orderEventLabel: Record<OrderEventType, string> = {
  created: "Створено",
  status_changed: "Статус змінено",
  payment_changed: "Оплата",
  lines_changed: "Склад замовлення",
  delivery_changed: "Доставка",
  customer_changed: "Дані покупця",
  note: "Нотатка",
  call: "Дзвінок",
  po_created: "Закупівля створена",
  po_updated: "Закупівля оновлена",
  tracking_checked: "Перевірка ТТН",
  notified: "Сповіщення надіслано",
  notify_failed: "Сповіщення не надіслано",
  message_sent: "Повідомлення покупцю",
};

export const ORDER_STATUSES = Object.keys(orderStatusMeta) as OrderStatus[];
export const PAYMENT_STATUSES = Object.keys(paymentStatusMeta) as PaymentStatus[];
export const PURCHASE_ORDER_STATUSES = Object.keys(purchaseOrderStatusMeta) as PurchaseOrderStatus[];
export const REQUEST_STATUSES = Object.keys(requestStatusMeta) as RequestStatus[];
export const REVIEW_STATUSES = Object.keys(reviewStatusMeta) as ReviewStatus[];
export const ORDER_SOURCES = Object.keys(orderSourceLabel) as OrderSource[];
export const ROLES = Object.keys(roleLabel) as Role[];
export const DELIVERY_METHODS = Object.keys(deliveryMethodLabel) as DeliveryMethod[];
export const PAYMENT_METHODS = Object.keys(paymentMethodLabel) as PaymentMethod[];
export const REQUEST_KINDS = Object.keys(requestKindLabel) as CallbackKind[];

/** Statuses that count as "open" work for the dashboard and the default order views */
export const OPEN_ORDER_STATUSES: OrderStatus[] = ["new", "confirmed", "sourcing", "in_transit", "on_hold"];

/** Statuses whose money counts as revenue in reports */
export const REVENUE_ORDER_STATUSES: OrderStatus[] = ["confirmed", "sourcing", "in_transit", "delivered", "completed"];
