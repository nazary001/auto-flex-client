import type { CartItem } from "@/lib/types";

/*
 * GA4 + Google Ads eCommerce events through the GTM dataLayer (container in the storefront
 * layout). Follows the marketer's spec «ТЗ на Налаштування eCommerce подій»:
 *
 *   view_item · add_to_cart · remove_from_cart · view_cart · begin_checkout · purchase
 *
 * Every ecommerce push is preceded by { ecommerce: null } so GA4 never merges two events. The
 * duplicated top-level `value` (string, 2 decimals) + `items[{ id, google_business_vertical }]`
 * are what Google Ads remarketing reads; `user_data` on purchase feeds enhanced conversions.
 * Builders are pure (unit-tested); only pushEvent touches window.
 */

export interface AnalyticsItem {
  /** Catalog product id — the same id a Merchant Center feed must use */
  item_id: string;
  item_name: string;
  price: number;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  quantity: number;
}

export type DataLayerEvent = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

const CURRENCY = "UAH";
const round2 = (n: number) => Math.round(n * 100) / 100;
const asMoney = (n: number) => round2(n).toFixed(2);
const sum = (items: AnalyticsItem[]) => round2(items.reduce((total, item) => total + item.price * item.quantity, 0));

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== "")) as T;
}

export function cartItemToAnalytics(item: CartItem): AnalyticsItem {
  return compact({
    item_id: item.productId,
    item_name: item.name,
    price: round2(item.price),
    item_brand: item.brandName || undefined,
    item_category: item.categoryName || undefined,
    item_variant: item.optionLabel,
    quantity: item.qty,
  });
}

function ecommerce(items: AnalyticsItem[], extra: Record<string, unknown> = {}) {
  return { currency: CURRENCY, value: sum(items), items: items.map(compact), ...extra };
}

/** Google Ads remarketing block (retail vertical) */
function adsBlock(items: AnalyticsItem[], total = sum(items)) {
  return { value: asMoney(total), items: items.map((item) => ({ id: item.item_id, google_business_vertical: "retail" })) };
}

export const viewItemEvent = (items: AnalyticsItem[]): DataLayerEvent => ({
  event: "view_item",
  ecommerce: ecommerce(items),
  ...adsBlock(items),
});

export const addToCartEvent = (items: AnalyticsItem[]): DataLayerEvent => ({
  event: "add_to_cart",
  ecommerce: ecommerce(items),
  ...adsBlock(items),
});

export const removeFromCartEvent = (items: AnalyticsItem[]): DataLayerEvent => ({
  event: "remove_from_cart",
  ecommerce: ecommerce(items),
});

export const viewCartEvent = (items: AnalyticsItem[]): DataLayerEvent => ({
  event: "view_cart",
  ecommerce: ecommerce(items),
});

export const beginCheckoutEvent = (items: AnalyticsItem[]): DataLayerEvent => ({
  event: "begin_checkout",
  ecommerce: ecommerce(items),
});

export interface PurchaseInput {
  transactionId: string;
  /** Order total as the server confirmed it */
  total: number;
  items: AnalyticsItem[];
  customer: { firstName: string; lastName: string; phone: string; email?: string };
  delivery: { city: string; address: string };
}

export function purchaseEvent(input: PurchaseInput): DataLayerEvent {
  const digits = input.customer.phone.replace(/\D/g, "");
  return {
    event: "purchase",
    user_data: compact({
      email: input.customer.email || undefined,
      phone_number: digits ? `+${digits}` : undefined,
      address: compact({
        first_name: input.customer.firstName,
        last_name: input.customer.lastName,
        street: input.delivery.address,
        city: input.delivery.city,
        country: "UA",
      }),
    }),
    ecommerce: {
      transaction_id: input.transactionId,
      affiliation: "online_store",
      value: round2(input.total),
      currency: CURRENCY,
      items: input.items.map(compact),
    },
    ...adsBlock(input.items, input.total),
  };
}

/** Pushes to the dataLayer (clearing the previous ecommerce object first); `layer` is for tests */
export function pushEvent(event: DataLayerEvent, layer?: unknown[]): void {
  const target = layer ?? (typeof window === "undefined" ? undefined : (window.dataLayer ??= []));
  if (!target) return;
  if ("ecommerce" in event) target.push({ ecommerce: null });
  target.push(event);
}

/** Non-ecommerce events (form submits, phone clicks, …): dataLayer.push({ event, …params }) */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  pushEvent({ event: name, ...compact(params) });
}

export const trackViewItem = (item: AnalyticsItem) => pushEvent(viewItemEvent([item]));
export const trackAddToCart = (item: AnalyticsItem) => pushEvent(addToCartEvent([item]));
export const trackRemoveFromCart = (items: AnalyticsItem | AnalyticsItem[]) =>
  pushEvent(removeFromCartEvent(Array.isArray(items) ? items : [items]));
export const trackViewCart = (items: AnalyticsItem[]) => pushEvent(viewCartEvent(items));
export const trackBeginCheckout = (items: AnalyticsItem[]) => pushEvent(beginCheckoutEvent(items));
export const trackPurchase = (input: PurchaseInput) => pushEvent(purchaseEvent(input));
