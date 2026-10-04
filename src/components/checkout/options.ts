import type { DeliveryMethod, PaymentMethod } from "@/lib/types";

/*
 * Shared labels and copy for the checkout form and the order history in the
 * cabinet. Server-safe plain data (no "use client"); kept here so the form
 * radios, the order summary and the account order cards stay in sync.
 */

export interface DeliveryOption {
  value: DeliveryMethod;
  label: string;
  /** Hint under the radio label */
  hint: string;
  /** Label of the second field (branch number / locker / address / index) */
  addressLabel: string;
  addressPlaceholder: string;
  /** autocomplete attribute for the second field */
  addressAutoComplete?: string;
}

export const deliveryOptions: DeliveryOption[] = [
  {
    value: "np_branch",
    label: "Нова Пошта — відділення",
    hint: "Отримання у відділенні у вашому місті",
    addressLabel: "Номер відділення",
    addressPlaceholder: "Напр., відділення 12",
  },
  {
    value: "np_locker",
    label: "Нова Пошта — поштомат",
    hint: "Самостійне отримання з поштомата цілодобово",
    addressLabel: "Номер поштомата",
    addressPlaceholder: "Напр., поштомат 30125",
  },
  {
    value: "np_courier",
    label: "Нова Пошта — кур'єр",
    hint: "Доставка кур'єром за вашою адресою",
    addressLabel: "Адреса доставки",
    addressPlaceholder: "Вулиця, будинок, квартира",
    addressAutoComplete: "street-address",
  },
  {
    value: "ukrposhta",
    label: "Укрпошта",
    hint: "Доставка у відділення Укрпошти",
    addressLabel: "Індекс і відділення Укрпошти",
    addressPlaceholder: "Напр., 01001, відділення 1",
    addressAutoComplete: "postal-code",
  },
];

export const deliveryLabels: Record<DeliveryMethod, string> = {
  np_branch: "Нова Пошта — відділення",
  np_locker: "Нова Пошта — поштомат",
  np_courier: "Нова Пошта — кур'єр",
  ukrposhta: "Укрпошта",
};

export interface PaymentOption {
  value: PaymentMethod;
  label: string;
  description: string;
}

export const paymentOptions: PaymentOption[] = [
  {
    value: "cod",
    label: "При отриманні",
    description: "Оплата у відділенні перевізника під час отримання.",
  },
  {
    value: "card_online",
    label: "Карткою онлайн",
    description: "Менеджер надішле посилання на оплату після підтвердження замовлення.",
  },
  {
    value: "installments",
    label: "Частинами",
    description: "Оформлення оплати частинами через менеджера.",
  },
  {
    value: "invoice",
    label: "За рахунком",
    description: "Безготівковий рахунок для ФОП і компаній.",
  },
];

export const paymentLabels: Record<PaymentMethod, string> = {
  cod: "Оплата при отриманні",
  card_online: "Карткою онлайн",
  installments: "Оплата частинами",
  invoice: "Оплата за рахунком",
};

export function deliveryOption(method: DeliveryMethod): DeliveryOption {
  return deliveryOptions.find((option) => option.value === method) ?? deliveryOptions[0];
}
