export type StockStatus = "in_stock" | "low_stock" | "preorder" | "out_of_stock";

export type ProductBadge = "new" | "sale" | "hit";

export interface Category {
  /** Same value as `slug` */
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  /** Key of the line illustration used when a product/category has no photo */
  illustration: string;
  /** Icon key for top-level categories, see `CategoryIcon` */
  icon?: string;
  /** One or two sentences shown under the category title */
  description?: string;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  country: string;
  description: string;
  popular?: boolean;
}

export interface Make {
  id: string;
  slug: string;
  name: string;
  country: string;
  popular?: boolean;
}

export interface CarModel {
  id: string;
  slug: string;
  makeId: string;
  /** Model with generation, e.g. "Octavia A7" */
  name: string;
  yearFrom: number;
  /** null — still in production */
  yearTo: number | null;
  body: string;
}

export interface ProductSpec {
  name: string;
  value: string;
}

export interface ProductFitment {
  makeId: string;
  modelId: string;
  /** e.g. "2013–2020" */
  years: string;
  /** e.g. "1.6 TDI, 2.0 TDI" */
  note?: string;
}

export interface ProductOptionValue {
  id: string;
  label: string;
  /** Added to the base price, UAH */
  priceDelta: number;
}

export interface ProductOption {
  id: string;
  /** e.g. "Сторона встановлення" */
  name: string;
  values: ProductOptionValue[];
}

export interface Product {
  id: string;
  slug: string;
  /** Артикул */
  sku: string;
  /** OE / cross-reference numbers */
  oemNumbers: string[];
  name: string;
  brandId: string;
  /** Leaf category id */
  categoryId: string;
  /** UAH, integer */
  price: number;
  oldPrice?: number;
  stock: StockStatus;
  /** Days until dispatch from the supplier warehouse: [min, max] */
  deliveryDays: [number, number];
  /** Photo URLs. Empty → the category illustration is rendered instead */
  images: string[];
  badges: ProductBadge[];
  /** 0–5, one decimal */
  rating: number;
  reviewsCount: number;
  shortDescription: string;
  /** Paragraphs */
  description: string[];
  specs: ProductSpec[];
  fitment: ProductFitment[];
  /** Fits any vehicle (oils, accessories…) */
  universal: boolean;
  option?: ProductOption;
  warrantyMonths: number;
  /** ISO date */
  createdAt: string;
  /** Higher — more popular */
  popularity: number;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: number;
  /** ISO date */
  date: string;
  text: string;
  /** e.g. "Skoda Octavia A7" */
  car?: string;
}

export type ProductSort = "popular" | "price_asc" | "price_desc" | "new" | "rating";

export interface ProductQuery {
  /** Category id; products of all descendant categories are included */
  categoryId?: string;
  brandIds?: string[];
  makeId?: string;
  modelId?: string;
  /** With makeId/modelId: also return universal products. Default false. */
  includeUniversal?: boolean;
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  badge?: ProductBadge;
  /** Free-text search over name, sku, OE numbers, brand */
  q?: string;
  sort?: ProductSort;
  /** 1-based */
  page?: number;
  perPage?: number;
}

export interface FacetCount<T> {
  item: T;
  count: number;
}

export interface ProductQueryResult {
  items: Product[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  facets: {
    /** Brands present in the result before the brand filter is applied */
    brands: FacetCount<Brand>[];
    /** Leaf categories present in the result before the category filter is narrowed */
    categories: FacetCount<Category>[];
    /** Min/max price of the result before the price filter is applied */
    priceRange: [number, number];
    inStockCount: number;
  };
}

/** Everything a product card needs; plain data, safe to pass to Client Components */
export interface ProductCardData {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brandName: string;
  categoryName: string;
  illustration: string;
  image?: string;
  price: number;
  oldPrice?: number;
  stock: StockStatus;
  deliveryDays: [number, number];
  badges: ProductBadge[];
  rating: number;
  reviewsCount: number;
  option?: ProductOption;
  /** Set on vehicle listings: which of the buyer's models the product fits, e.g. "Škoda Octavia A7" */
  fitLabel?: string;
}

/** Snapshot stored in the cart so it renders without a catalog lookup */
export interface CartItem {
  /** `${productId}` or `${productId}:${optionValueId}` */
  key: string;
  productId: string;
  slug: string;
  name: string;
  sku: string;
  brandName: string;
  illustration: string;
  image?: string;
  price: number;
  oldPrice?: number;
  optionLabel?: string;
  qty: number;
}

export type DeliveryMethod = "np_branch" | "np_locker" | "np_courier" | "ukrposhta";

export type PaymentMethod = "cod" | "card_online" | "installments" | "invoice";

export interface OrderPayload {
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
  delivery: {
    method: DeliveryMethod;
    city: string;
    /** Branch / locker number or street address for courier */
    address: string;
  };
  payment: PaymentMethod;
  comment?: string;
  /** VIN or car description to double-check fitment before dispatch */
  vehicle?: string;
  doNotCall: boolean;
  /** Prices here are informational: the server re-prices every line from the catalog */
  items: Pick<CartItem, "key" | "productId" | "name" | "sku" | "price" | "qty" | "optionLabel">[];
  total: number;
}

// ── Editorial content ───────────────────────────────────────

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  /** Highlighted note */
  | { type: "tip"; title: string; text: string }
  | { type: "table"; head: string[]; rows: string[][] };

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date */
  date: string;
  readMinutes: number;
  /** Rubric, e.g. "Поради з вибору" */
  topic: string;
  /** Illustration key used as cover art (file name in /public/illustrations) */
  illustration: string;
  /** Catalog category slugs the article links to */
  relatedCategories: string[];
  body: ArticleBlock[];
}

export interface Promo {
  slug: string;
  title: string;
  text: string;
  /** e.g. "до 31 жовтня" */
  period: string;
  /** Where the promo leads, usually a filtered catalog page */
  href: string;
  cta: string;
  illustration: string;
  tone: "navy" | "blue" | "light";
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * callback — «Замовити дзвінок»; quick_order — «Швидке замовлення» of one product by phone;
 * question — question about a product / contact form / review awaiting moderation;
 * notify_stock — «Повідомити про наявність» for an out-of-stock product
 */
export type CallbackKind = "callback" | "quick_order" | "question" | "notify_stock";

/** POST /api/callback */
export interface CallbackPayload {
  kind: CallbackKind;
  phone: string;
  name?: string;
  /** For quick orders and product questions */
  productId?: string;
  comment?: string;
}

/** GET /api/search?q= */
export interface SearchResponse {
  products: ProductCardData[];
  categories: { slug: string; name: string }[];
  brands: { slug: string; name: string }[];
  /** Number of matching products (not limited) */
  total: number;
}
