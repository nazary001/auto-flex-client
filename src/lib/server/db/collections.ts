import type { Collection, Db } from "mongodb";
import type { Brand, CarModel, Category, FaqItem, Make, Product, Promo, StockStatus } from "@/lib/types";
import type {
  AdminUser,
  AuditEntry,
  ContentEntry,
  Customer,
  CustomerRequest,
  ModeratedReview,
  Order,
  OrderEvent,
  PurchaseOrder,
  StoreSettings,
  Supplier,
  SupplierOffer,
} from "@/lib/admin/types";
import type { Doc } from "./util";

/*
 * Typed collection accessors and index definitions. Every repository goes through `cols(db)`
 * so collection names and document shapes are defined exactly once.
 */

export type UserDoc = Doc<AdminUser> & { passwordHash: string; emailLower: string };

export interface SessionDoc {
  /** sha256(token), hex */
  _id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
}

/** Storefront account of a customer: login identifiers + password; profile data lives on the customer */
export interface AccountDoc {
  _id: string;
  customerId: string;
  /** Normalised 380XXXXXXXXX, unique */
  phone: string;
  /** Lower-cased, unique */
  email: string;
  passwordHash: string;
  status: "active" | "blocked";
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  passwordChangedAt?: string;
}

export interface AccountSessionDoc {
  /** sha256(token), hex */
  _id: string;
  accountId: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
}

export type OrderDoc = Doc<Order> & {
  /** Denormalised for indexes */
  customerPhone: string;
  /** Lower-cased number, customer name, phone and SKUs for the text filter */
  search: string;
};

export type OrderEventDoc = Doc<OrderEvent>;
export type CustomerDoc = Doc<Customer>;
export type SupplierDoc = Doc<Supplier>;
export type SupplierOfferDoc = Doc<SupplierOffer>;
export type PurchaseOrderDoc = Doc<PurchaseOrder>;
export type RequestDoc = Doc<CustomerRequest>;
export type ReviewDoc = Doc<ModeratedReview>;
export type AuditDoc = Doc<AuditEntry>;
export type ContentDoc<T> = Doc<ContentEntry<T>>;

// ── catalog ─────────────────────────────────────────────────

export type ProductSource = "ddtuning" | "manual" | "demo";

/** One supplier item (a standalone product or a variant of a group), kept compact */
export interface SupplierItem {
  id: number;
  sku: string;
  title: string;
  short?: string;
  /** Retail price, UAH */
  price: number;
  salePrice?: number;
  saleStart?: string;
  saleEnd?: string;
  qty: number;
  warehouse?: string;
  images: string[];
  manufacturer?: string;
  country?: string;
  material?: string;
  installation?: string;
  kit?: string;
  color?: string;
  type?: string;
  place?: string;
  /** Wholesale price as published by the supplier */
  cost?: { amount: number; currency: "EUR" | "USD" | "UAH" };
}

/** Fields the admin may override; re-applied on top of the supplier data after every sync */
export interface ProductLocal {
  name?: string;
  slug?: string;
  /** Fixed sale price (wins over the supplier price and the global markup) */
  price?: number;
  /** Markup over the supplier price, percent (ignored when `price` is set) */
  markupPercent?: number;
  oldPrice?: number | null;
  stock?: StockStatus;
  shortDescription?: string;
  description?: string[];
  specs?: Product["specs"];
  images?: string[];
  badges?: Product["badges"];
  categoryId?: string;
  brandId?: string;
  deliveryDays?: [number, number];
  warrantyMonths?: number;
  popularity?: number;
  oemNumbers?: string[];
  fitment?: Product["fitment"];
  universal?: boolean;
}

export type ProductDoc = Doc<Product> & {
  source: ProductSource;
  /** Hidden by the admin or retired by the supplier: never shown on the storefront */
  hidden: boolean;
  retired?: boolean;
  /** 0 in_stock · 1 low_stock · 2 preorder · 3 out_of_stock — for sorting */
  stockRank: 0 | 1 | 2 | 3;
  /** Folded name + skus + brand + vehicle + category, feeds the text index */
  search: string;
  /** Every supplier sku of the product (all variants) */
  skus: string[];
  supplier?: {
    code: "DDT";
    groupId?: number;
    items: SupplierItem[];
    syncedAt: string;
    /** Cost of the base variant, UAH, when known */
    costPrice?: number;
    costCurrency?: "EUR" | "USD" | "UAH";
    costOriginal?: number;
  };
  local?: ProductLocal;
  updatedAt: string;
};

export type CategoryDoc = Doc<Category> & {
  nameRu?: string;
  supplierIds: number[];
  productCount: number;
  sort: number;
  hidden: boolean;
  local?: Partial<Pick<Category, "name" | "description" | "icon" | "illustration">>;
  updatedAt: string;
};

export type BrandDoc = Doc<Brand> & {
  productCount: number;
  hidden: boolean;
  local?: Partial<Pick<Brand, "name" | "description" | "country" | "popular">>;
  updatedAt: string;
};

export type MakeDoc = Doc<Make> & { productCount: number; updatedAt: string };

export type ModelDoc = Doc<CarModel> & { productCount: number; supplierNames: string[]; updatedAt: string };

export type SyncPhase = "rates" | "categories" | "wholesale" | "retail" | "build" | "taxonomy" | "offers" | "finalize" | "done";

export interface SyncRunDoc {
  _id: string;
  supplier: "DDT";
  status: "running" | "paused" | "done" | "failed" | "cancelled";
  phase: SyncPhase;
  /** Page offset / cursor inside the current phase */
  offset: number;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  rates: { EUR: number; USD: number; source: "nbu" | "manual" };
  counters: Record<string, number>;
  log: { at: string; text: string }[];
  error?: string;
}

/** Transient per-run copy of the supplier items, dropped after the build phase */
export interface StagingDoc {
  _id: number;
  runId: string;
  parentId: number | null;
  parentTitle?: string;
  mark: string;
  model: string;
  category: string;
  subcategory: string;
  item: SupplierItem;
}

export interface MetaDoc {
  _id: string;
  value: unknown;
}

export interface CounterDoc {
  _id: string;
  seq: number;
}

export interface SettingsDoc {
  _id: "store";
  value: StoreSettings;
  updatedAt: string;
}

export interface Collections {
  meta: Collection<MetaDoc>;
  counters: Collection<CounterDoc>;
  users: Collection<UserDoc>;
  sessions: Collection<SessionDoc>;
  customers: Collection<CustomerDoc>;
  accounts: Collection<AccountDoc>;
  accountSessions: Collection<AccountSessionDoc>;
  orders: Collection<OrderDoc>;
  orderEvents: Collection<OrderEventDoc>;
  suppliers: Collection<SupplierDoc>;
  offers: Collection<SupplierOfferDoc>;
  purchaseOrders: Collection<PurchaseOrderDoc>;
  requests: Collection<RequestDoc>;
  reviews: Collection<ReviewDoc>;
  products: Collection<ProductDoc>;
  categories: Collection<CategoryDoc>;
  brands: Collection<BrandDoc>;
  makes: Collection<MakeDoc>;
  models: Collection<ModelDoc>;
  syncRuns: Collection<SyncRunDoc>;
  staging: Collection<StagingDoc>;
  promos: Collection<ContentDoc<Promo>>;
  faq: Collection<ContentDoc<FaqItem>>;
  settings: Collection<SettingsDoc>;
  audit: Collection<AuditDoc>;
}

export function cols(db: Db): Collections {
  return {
    meta: db.collection<MetaDoc>("meta"),
    counters: db.collection<CounterDoc>("counters"),
    users: db.collection<UserDoc>("users"),
    sessions: db.collection<SessionDoc>("sessions"),
    customers: db.collection<CustomerDoc>("customers"),
    accounts: db.collection<AccountDoc>("accounts"),
    accountSessions: db.collection<AccountSessionDoc>("account_sessions"),
    orders: db.collection<OrderDoc>("orders"),
    orderEvents: db.collection<OrderEventDoc>("order_events"),
    suppliers: db.collection<SupplierDoc>("suppliers"),
    offers: db.collection<SupplierOfferDoc>("supplier_offers"),
    purchaseOrders: db.collection<PurchaseOrderDoc>("purchase_orders"),
    requests: db.collection<RequestDoc>("requests"),
    reviews: db.collection<ReviewDoc>("reviews"),
    products: db.collection<ProductDoc>("products"),
    categories: db.collection<CategoryDoc>("categories"),
    brands: db.collection<BrandDoc>("brands"),
    makes: db.collection<MakeDoc>("makes"),
    models: db.collection<ModelDoc>("models"),
    syncRuns: db.collection<SyncRunDoc>("sync_runs"),
    staging: db.collection<StagingDoc>("dd_staging"),
    promos: db.collection<ContentDoc<Promo>>("promos"),
    faq: db.collection<ContentDoc<FaqItem>>("faq"),
    settings: db.collection<SettingsDoc>("settings"),
    audit: db.collection<AuditDoc>("audit_log"),
  };
}

/** Idempotent: createIndex is a no-op when the index already exists */
export async function ensureIndexes(db: Db): Promise<void> {
  const c = cols(db);
  await Promise.all([
    c.users.createIndex({ emailLower: 1 }, { unique: true }),
    c.sessions.createIndex({ userId: 1 }),
    c.sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.customers.createIndex({ phone: 1 }, { unique: true }),
    c.customers.createIndex({ lastName: 1, firstName: 1 }),
    c.customers.createIndex({ lastOrderAt: -1 }),
    c.accounts.createIndex({ phone: 1 }, { unique: true }),
    c.accounts.createIndex({ email: 1 }, { unique: true }),
    c.accounts.createIndex({ customerId: 1 }, { unique: true }),
    c.accountSessions.createIndex({ accountId: 1 }),
    c.accountSessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    c.orders.createIndex({ number: 1 }, { unique: true }),
    c.orders.createIndex({ status: 1, createdAt: -1 }),
    c.orders.createIndex({ createdAt: -1 }),
    c.orders.createIndex({ updatedAt: -1 }),
    c.orders.createIndex({ customerPhone: 1 }),
    c.orders.createIndex({ "customer.customerId": 1 }),
    c.orders.createIndex({ assigneeId: 1 }),
    c.orders.createIndex({ "lines.purchaseOrderId": 1 }),
    c.orders.createIndex({ "lines.supplierId": 1 }),
    c.orderEvents.createIndex({ orderId: 1, at: 1 }),
    c.orderEvents.createIndex({ at: -1 }),
    c.suppliers.createIndex({ code: 1 }, { unique: true }),
    c.offers.createIndex({ supplierId: 1, sku: 1 }, { unique: true }),
    c.offers.createIndex({ sku: 1 }),
    c.offers.createIndex({ productId: 1 }),
    c.purchaseOrders.createIndex({ number: 1 }, { unique: true }),
    c.purchaseOrders.createIndex({ status: 1, createdAt: -1 }),
    c.purchaseOrders.createIndex({ supplierId: 1 }),
    c.purchaseOrders.createIndex({ "lines.orderId": 1 }),
    c.requests.createIndex({ status: 1, createdAt: -1 }),
    c.requests.createIndex({ phone: 1 }),
    c.reviews.createIndex({ status: 1, createdAt: -1 }),
    c.reviews.createIndex({ productId: 1 }),
    // catalog
    c.products.createIndex({ slug: 1 }, { unique: true }),
    c.products.createIndex({ hidden: 1, groupId: 1, stockRank: 1, popularity: -1 }),
    c.products.createIndex({ hidden: 1, categoryId: 1, stockRank: 1, price: 1 }),
    c.products.createIndex({ hidden: 1, brandId: 1 }),
    c.products.createIndex({ hidden: 1, "fitment.modelId": 1 }),
    c.products.createIndex({ hidden: 1, "fitment.makeId": 1 }),
    c.products.createIndex({ hidden: 1, createdAt: -1 }),
    c.products.createIndex({ hidden: 1, popularity: -1 }),
    c.products.createIndex({ skus: 1 }),
    c.products.createIndex({ sku: 1 }),
    c.products.createIndex({ source: 1, "supplier.syncedAt": 1 }),
    c.products.createIndex({ "supplier.items.id": 1 }),
    c.products.createIndex({ search: "text", name: "text" }, { default_language: "none", weights: { name: 5, search: 1 } }),
    c.categories.createIndex({ parentId: 1, sort: 1 }),
    c.categories.createIndex({ supplierIds: 1 }),
    c.brands.createIndex({ name: 1 }),
    c.models.createIndex({ makeId: 1, name: 1 }),
    c.syncRuns.createIndex({ startedAt: -1 }),
    c.staging.createIndex({ runId: 1, parentId: 1, _id: 1 }),
    c.promos.createIndex({ sort: 1 }),
    c.faq.createIndex({ sort: 1 }),
    c.audit.createIndex({ at: -1 }),
    c.audit.createIndex({ entity: 1, entityId: 1, at: -1 }),
    c.audit.createIndex({ actorId: 1, at: -1 }),
  ]);
}
