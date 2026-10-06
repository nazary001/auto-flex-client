import type { CallbackKind, DeliveryMethod, PaymentMethod, Review } from "@/lib/types";

/*
 * Domain model of the back office. Plain JSON-serialisable data: every type here can be
 * stored in MongoDB as-is (the repositories map `id` ↔ `_id`) and passed to Client Components.
 * All timestamps are ISO-8601 strings in UTC; all money is integer UAH.
 */

// ── Users & sessions ────────────────────────────────────────

export type Role = "owner" | "manager" | "viewer";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

/** Who performed an action; `id` is null for system actors (storefront, seed, cron) */
export interface Actor {
  id: string | null;
  name: string;
}

export const SYSTEM_ACTOR: Actor = { id: null, name: "Система" };
export const STOREFRONT_ACTOR: Actor = { id: null, name: "Сайт" };

// ── Orders ──────────────────────────────────────────────────

export type OrderStatus =
  | "new"
  | "confirmed"
  | "sourcing"
  | "in_transit"
  | "delivered"
  | "completed"
  | "on_hold"
  | "cancelled"
  | "returned";

export type PaymentStatus = "unpaid" | "prepaid" | "paid" | "refunded" | "partially_refunded";

export type OrderSource = "website" | "phone" | "manual" | "quick_order";

export type LineFulfillment = "pending" | "ordered" | "shipped" | "delivered" | "cancelled";

export type Carrier = "nova_poshta" | "ukrposhta" | "other";

export interface OrderLine {
  id: string;
  /** null for a custom line typed in by a manager */
  productId: string | null;
  sku: string;
  name: string;
  optionLabel?: string;
  /** Sale price per unit */
  price: number;
  qty: number;
  /** Absolute discount for the whole line */
  discount: number;
  /** Supplier cost per unit, when known */
  costPrice?: number;
  supplierId?: string;
  purchaseOrderId?: string;
  fulfillment: LineFulfillment;
  note?: string;
}

export interface OrderCustomer {
  customerId?: string;
  firstName: string;
  lastName: string;
  /** Normalised 380XXXXXXXXX */
  phone: string;
  email?: string;
}

export interface TrackingSnapshot {
  status: string;
  statusCode?: string;
  checkedAt: string;
  scheduledDeliveryDate?: string;
  warehouse?: string;
  /** Hand-over moment as the carrier reports it, "dd-mm-yyyy hh:mm:ss" */
  receivedAt?: string;
}

export interface OrderDelivery {
  method: DeliveryMethod;
  city: string;
  address: string;
  carrier?: Carrier;
  trackingNumber?: string;
  tracking?: TrackingSnapshot;
  shippedAt?: string;
  deliveredAt?: string;
  /** Delivery cost, when the shop pays or charges it */
  cost?: number;
  costPayer?: "customer" | "shop";
}

export interface OrderPayment {
  method: PaymentMethod;
  status: PaymentStatus;
  paidAmount: number;
  paidAt?: string;
  paymentLink?: string;
  invoiceNumber?: string;
}

export interface Order {
  id: string;
  /** AF-YYMMDD-NNNN */
  number: string;
  status: OrderStatus;
  source: OrderSource;
  customer: OrderCustomer;
  delivery: OrderDelivery;
  payment: OrderPayment;
  lines: OrderLine[];
  /** Σ price·qty */
  subtotal: number;
  /** Extra discount on the whole order, on top of per-line discounts */
  orderDiscount: number;
  /** Σ line discounts + orderDiscount (what the buyer actually saved) */
  discount: number;
  /** subtotal − discount */
  total: number;
  /** Σ costPrice·qty over lines with a known cost */
  costTotal: number;
  /** total − costTotal − delivery cost paid by the shop */
  margin: number;
  /** false when at least one active line has no cost price */
  marginKnown: boolean;
  /** Buyer's comment from checkout */
  comment?: string;
  /** VIN / car description from checkout */
  vehicle?: string;
  doNotCall: boolean;
  /** Pinned internal note */
  managerNote?: string;
  assigneeId?: string;
  tags: string[];
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  shippedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export type OrderEventType =
  | "created"
  | "status_changed"
  | "payment_changed"
  | "lines_changed"
  | "delivery_changed"
  | "customer_changed"
  | "note"
  | "call"
  | "po_created"
  | "po_updated"
  | "tracking_checked"
  | "notified"
  | "notify_failed"
  | "message_sent";

export interface OrderEvent {
  id: string;
  orderId: string;
  type: OrderEventType;
  at: string;
  actorId: string | null;
  actorName: string;
  text: string;
  data?: Record<string, unknown>;
}

/** Input accepted by `createOrder` (storefront checkout, manual order, converted request) */
export interface OrderCreateInput {
  source: OrderSource;
  customer: OrderCustomer;
  delivery: Pick<OrderDelivery, "method" | "city" | "address" | "carrier" | "cost" | "costPayer">;
  payment: Pick<OrderPayment, "method"> & Partial<Pick<OrderPayment, "status" | "paidAmount" | "paymentLink">>;
  lines: Array<
    Pick<OrderLine, "productId" | "sku" | "name" | "optionLabel" | "price" | "qty"> &
      Partial<Pick<OrderLine, "discount" | "costPrice" | "supplierId" | "note">>
  >;
  orderDiscount?: number;
  comment?: string;
  vehicle?: string;
  doNotCall?: boolean;
  managerNote?: string;
  assigneeId?: string;
  tags?: string[];
  status?: OrderStatus;
}

export type OrderSort = "newest" | "oldest" | "total_desc" | "total_asc" | "updated";

export interface OrderListFilter {
  status?: OrderStatus[];
  paymentStatus?: PaymentStatus[];
  deliveryMethod?: DeliveryMethod[];
  source?: OrderSource[];
  supplierId?: string;
  assigneeId?: string;
  customerId?: string;
  /** Free text over number, customer name, phone, SKU */
  q?: string;
  /** ISO dates, inclusive */
  from?: string;
  to?: string;
  tag?: string;
  /** Only orders with at least one line awaiting a purchase order */
  needsSourcing?: boolean;
  sort?: OrderSort;
}

// ── Customers ───────────────────────────────────────────────

export interface Customer {
  id: string;
  /** Normalised 380XXXXXXXXX, unique */
  phone: string;
  firstName: string;
  lastName: string;
  email?: string;
  city?: string;
  /** Default delivery branch / street address from the storefront account */
  address?: string;
  tags: string[];
  notes: string;
  doNotCall: boolean;
  ordersCount: number;
  totalSpent: number;
  firstOrderAt?: string;
  lastOrderAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Storefront account of a customer: signs in with the phone or the e-mail */
export interface CustomerAccount {
  id: string;
  customerId: string;
  /** Normalised 380XXXXXXXXX */
  phone: string;
  /** Lower-cased */
  email: string;
  status: "active" | "blocked";
  createdAt: string;
  lastLoginAt?: string;
}

export interface CustomerListFilter {
  q?: string;
  tag?: string;
  doNotCall?: boolean;
  sort?: "recent" | "spent" | "orders" | "name";
}

// ── Suppliers & offers ──────────────────────────────────────

export interface SupplierContacts {
  phone?: string;
  email?: string;
  telegram?: string;
  site?: string;
  manager?: string;
}

export interface Supplier {
  id: string;
  /** Short unique code, e.g. "ELIT" */
  code: string;
  name: string;
  active: boolean;
  contacts: SupplierContacts;
  /** Days from purchase order to dispatch: [min, max] */
  leadDays: [number, number];
  paymentTerms?: string;
  deliveryTerms?: string;
  /** Supplier ships straight to the buyer (true dropshipping) */
  shipsDirect: boolean;
  defaultMarkupPercent?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type OfferAvailability = "in_stock" | "on_order" | "none";

export interface SupplierOffer {
  id: string;
  supplierId: string;
  /** Resolved catalog product id, null when the SKU is unknown to the catalog */
  productId: string | null;
  sku: string;
  /** Cost per unit */
  cost: number;
  availability: OfferAvailability;
  qty?: number;
  leadDays?: [number, number];
  updatedAt: string;
}

export interface OfferListFilter {
  supplierId?: string;
  productId?: string;
  sku?: string;
  q?: string;
  availability?: OfferAvailability[];
}

// ── Purchase orders (dropshipping) ──────────────────────────

export type PurchaseOrderStatus = "draft" | "sent" | "confirmed" | "shipped" | "received" | "cancelled";

export interface PurchaseOrderLine {
  id: string;
  orderId: string;
  orderNumber: string;
  orderLineId: string;
  productId: string | null;
  sku: string;
  name: string;
  qty: number;
  /** Cost per unit */
  cost: number;
}

export interface PurchaseOrder {
  id: string;
  /** PO-YYMMDD-NN */
  number: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  totalCost: number;
  /** Supplier ships straight to the buyer */
  shipDirect: boolean;
  /** Supplier's own order / invoice reference */
  supplierRef?: string;
  trackingNumber?: string;
  expectedAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  confirmedAt?: string;
  shippedAt?: string;
  receivedAt?: string;
  cancelledAt?: string;
}

export interface PurchaseOrderListFilter {
  status?: PurchaseOrderStatus[];
  supplierId?: string;
  orderId?: string;
  q?: string;
  from?: string;
  to?: string;
  /** Sent/confirmed longer ago than the supplier's max lead time */
  overdue?: boolean;
}

// ── Requests (call-backs, quick orders, questions, stock alerts) ──

export type RequestStatus = "new" | "in_progress" | "done" | "spam";

export interface CustomerRequest {
  id: string;
  kind: CallbackKind;
  status: RequestStatus;
  /** Normalised 380XXXXXXXXX */
  phone: string;
  name?: string;
  productId?: string;
  productName?: string;
  productSku?: string;
  comment?: string;
  assigneeId?: string;
  resultNote?: string;
  /** Set when a quick order was converted into an order */
  orderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestListFilter {
  status?: RequestStatus[];
  kind?: CallbackKind[];
  q?: string;
  assigneeId?: string;
}

// ── Reviews (moderation) ────────────────────────────────────

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface ModeratedReview extends Review {
  status: ReviewStatus;
  source: "site" | "admin";
  createdAt: string;
}

// ── Catalog overrides ───────────────────────────────────────

export type CatalogEntryKind = "override" | "custom";

export interface CatalogEntry<T> {
  id: string;
  kind: CatalogEntryKind;
  hidden: boolean;
  updatedAt: string;
  data: T;
}

export interface ProductListFilter {
  q?: string;
  categoryId?: string;
  brandId?: string;
  stock?: string[];
  badge?: string;
  /** "custom" | "override" | "static" | "hidden" */
  state?: string;
  hasCost?: boolean;
  sort?: "name" | "price_asc" | "price_desc" | "newest" | "popular";
}

// ── Content ─────────────────────────────────────────────────

export interface ContentEntry<T> {
  id: string;
  active: boolean;
  sort: number;
  updatedAt: string;
  data: T;
}

// ── Settings ────────────────────────────────────────────────

export interface MethodSetting {
  enabled: boolean;
  /** Short note shown to the buyer under the option (optional) */
  note?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  /** Placeholders: {{number}} {{name}} {{total}} {{ttn}} {{items}} {{city}} {{address}} */
  body: string;
}

export interface StoreSettings {
  checkout: {
    delivery: Record<DeliveryMethod, MethodSetting>;
    payment: Record<PaymentMethod, MethodSetting>;
  };
  orders: {
    /** Suggested markup over supplier cost when pricing custom lines */
    defaultMarkupPercent: number;
    /** Orders with a lower margin are flagged on the dashboard */
    lowMarginPercent: number;
    /** A "new" order older than this needs attention */
    staleNewHours: number;
    /** A "sourcing" order older than this needs attention */
    staleSourcingDays: number;
    /** An "in_transit" order older than this needs attention */
    staleTransitDays: number;
  };
  notifications: {
    telegramNewOrder: boolean;
    telegramNewRequest: boolean;
  };
  novaPoshta: {
    apiKey?: string;
  };
  templates: MessageTemplate[];
  /** DD Tuning feed: pricing policy and exchange rates used to derive our prices and cost prices */
  supplier: {
    /** "retail" sells at the supplier retail price (+ markup); "cost_markup" prices from the wholesale cost */
    priceSource: "retail" | "cost_markup";
    markupPercent: number;
    /** Round prices to a multiple of this value; 0 = automatic (5 / 10 ₴ steps) */
    roundTo: number;
    rates: { EUR: number; USD: number; updatedAt?: string; source: "nbu" | "manual" };
    autoSyncEnabled: boolean;
  };
}

// ── Audit ───────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string | null;
  actorName: string;
  /** Verb, e.g. "order.status", "product.update", "user.create" */
  action: string;
  /** Entity kind, e.g. "order" */
  entity: string;
  entityId: string;
  /** Human sentence, e.g. "Замовлення AF-… → Підтверджено" */
  summary: string;
  data?: Record<string, unknown>;
}

export interface AuditListFilter {
  entity?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
}

// ── Paging ──────────────────────────────────────────────────

export interface Paging {
  /** 1-based */
  page: number;
  perPage: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export function emptyPage<T>(perPage = 25): Page<T> {
  return { items: [], total: 0, page: 1, perPage, pageCount: 1 };
}

export function normalizePaging(input: Partial<Paging> | undefined, defaultPerPage = 25, maxPerPage = 200): Paging {
  const perPage = Math.min(maxPerPage, Math.max(1, Math.round(input?.perPage ?? defaultPerPage) || defaultPerPage));
  const page = Math.max(1, Math.round(input?.page ?? 1) || 1);
  return { page, perPage };
}
