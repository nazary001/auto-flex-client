# AutoFlex Admin — design & implementation spec

Date: 2026-10-05. Status: **implemented** (all three phases of §6 done on 2026-10-05; storage switched
from the initially assumed SQLite to MongoDB Atlas at the owner's request before implementation).

Implementation notes (deviations from the text below):
- Order numbers use the daily sequence of the order's own creation date (seeded history keeps real stamps).
- Bulk selection in the orders list is desktop-only (mobile cards have no checkboxes).
- Manual orders in the admin offer every delivery/payment method; the checkout settings gate the storefront only.
- Server Actions accept uploads up to 8 MB (`experimental.serverActions.bodySizeLimit`); CSV imports refuse larger files.
- Supplier price lists do not touch the catalog overlay; only product/brand/category/review writes bump the catalog version.

## 0. Brief, assumptions, non-goals

**Brief (from the owner).** Build a complete, powerful back office for the AutoFlex storefront: orders
end to end (the shop is dropshipping — every order is sourced from a supplier and shipped by carrier),
purchasing from suppliers, customers, request inbox, catalog management, content, settings, users,
audit. Visually simple and comfortable; functionally deep. Minimal review ceremony.

**What exists.** Next.js 16.3 App Router, React 19, Tailwind 4, TypeScript strict. Storefront in
Ukrainian. Catalog is deterministic static demo data (`src/data/*`) read only through
`src/lib/catalog.ts` (sync, index built at module load). Orders go to `/api/orders`, which re-prices
from the catalog and sends Telegram/webhook; nothing is persisted. Requests (`/api/callback`) likewise.
Cart/favourites/account live in `localStorage`. No DB, no auth, no tests.

**Assumptions made because the session is autonomous (the owner can override any of them later):**

1. **Storage: MongoDB Atlas** (owner's decision, 2026-10-05) through the official `mongodb` driver (v7),
   connection string in `MONGODB_URI`, database name in `MONGODB_DB` (default `autoflex`). Document
   collections map 1:1 onto the domain aggregates below. Works on Vercel (Atlas + pooled client cached
   on `globalThis`). **Local development and tests without Atlas:** when `MONGODB_URI` is absent and
   `NODE_ENV !== "production"`, the server starts `mongodb-memory-server` with a persistent data
   directory `data/mongo` (git-ignored), so the admin works out of the box and keeps its data between
   restarts; in production a missing URI is a startup error.
2. **Auth: own users table + DB sessions**, scrypt password hashes, httpOnly cookie, roles
   owner/manager/viewer. No third-party auth service (nothing to provision).
3. **Admin UI language: Ukrainian** (matches the storefront). Code and docs in English.
4. **Catalog**: static demo data stays as the base; the admin stores *overrides and additions* in the DB
   and the storefront reads the merged view. Editing is therefore real and reflected on the site.
5. **Secrets stay in env** (Telegram token, webhook). The admin shows channel status and can send a
   test message; Nova Poshta API key is a setting (optional, tracking works without it via link).
6. Carrier integration limited to **manual TTN entry + tracking status refresh** (Nova Poshta public
   tracking). Creating waybills via API is out of scope.
7. No online payments integration exists; payment is tracked manually (status, amount, link).

**Non-goals:** customer accounts on the storefront, online payment gateways, multi-warehouse stock,
supplier EDI/feeds (CSV import covers price lists), i18n of the admin.

## 1. Architecture

### 1.1 Routing: one root layout, two shells

```
src/app/layout.tsx                 root: <html lang="uk">, fonts, globals.css, base metadata (unchanged otherwise)
src/app/not-found.tsx              branded 404; now renders <Header/> and <Footer/> itself
src/app/robots.ts                  + disallow /admin
src/app/sitemap.ts, icon.svg       unchanged
src/app/api/**                     public API (unchanged location)

src/app/(store)/layout.tsx         skip-link, <Header/>, <main id="main"><PageTransition/></main>, <Footer/>, <Toaster/>
src/app/(store)/**                 every existing storefront page moved here with `git mv` (incl. the (info) group)

src/app/(admin)/admin/layout.tsx          metadata: noindex, title template "%s — Адмінка AutoFlex"; imports admin.css
src/app/(admin)/admin/login/page.tsx      login (+ first-run owner setup when no users exist)
src/app/(admin)/admin/(shell)/layout.tsx  requireUser() → sidebar + topbar + <Toaster/>; redirects to login
src/app/(admin)/admin/(shell)/**          all admin pages (see §4)
src/proxy.ts                              matcher /admin/:path*: cookie presence check → redirect to login; x-robots-tag
```

Moving storefront pages into `(store)` is a pure `git mv`; imports use `@/` aliases so nothing changes
inside the files. Uncommitted owner changes (motion polish) are preserved by the move.

### 1.2 Data layer (MongoDB)

```
src/lib/server/db/client.ts       getDb(): Promise<Db> — MongoClient singleton cached on globalThis (HMR/serverless safe);
                                  resolves MONGODB_URI, or starts mongodb-memory-server (dev only, dbPath data/mongo);
                                  runs ensureIndexes + bootstrap (owner from env) + seed (dev) once per process
src/lib/server/db/collections.ts  typed accessors: col.orders(db) → Collection<OrderDoc> …, index definitions
src/lib/server/db/util.ts         newId(), nowIso(), toDoc/fromDoc (`_id` ↔ `id`), nextNumber(counterKey) via findOneAndUpdate $inc
src/lib/server/db/repos/*.ts      one module per aggregate (users, sessions, orders, customers, suppliers, offers,
                                  purchase-orders, requests, reviews, catalog, content, settings, audit, meta) — all async
src/lib/server/db/seed.ts         demo data (deterministic PRNG, dates relative to now); runs once when `meta.seededAt` is absent
src/lib/server/db/testing.ts      startTestDb()/stopTestDb() for vitest (mongodb-memory-server, fresh DB per file)
```

Collections (documents use string `_id` = `crypto.randomUUID()`; timestamps are ISO-8601 UTC strings;
repositories expose `id` instead of `_id`):

| collection | document (beyond the domain type in §2) | indexes |
| --- | --- | --- |
| `meta` | `{ _id: key, value }` — `catalogVersion`, `seededAt` | — |
| `counters` | `{ _id: "order:260105", seq }` — atomic `$inc` for numbering | — |
| `users` | `AdminUser` + `passwordHash`, `emailLower` | `emailLower` unique |
| `sessions` | `{ _id: sha256(token), userId, expiresAt, createdAt, userAgent }` | `userId`; TTL on `expiresAt` |
| `customers` | `Customer` | `phone` unique; text-ish: `lastName`, `email` |
| `orders` | `Order` (lines/payment/delivery embedded) + `customerPhone`, `search` (lower-cased number/name/phone/skus joined) | `number` unique; `status, createdAt`; `createdAt`; `customerPhone`; `assigneeId`; `lines.purchaseOrderId` |
| `order_events` | `OrderEvent` | `orderId, at` |
| `suppliers` | `Supplier` | `code` unique |
| `supplier_offers` | `SupplierOffer` | `supplierId, sku` unique; `sku`; `productId` |
| `purchase_orders` | `PurchaseOrder` | `number` unique; `status`; `supplierId`; `lines.orderId` |
| `requests` | `CustomerRequest` | `status, createdAt`; `phone` |
| `reviews` | `ModeratedReview` | `status`; `productId` |
| `catalog_products` / `catalog_brands` / `catalog_categories` | `{ _id, kind: "override"\|"custom", hidden, updatedAt, data }` | — |
| `promos`, `faq` | `{ _id, active, sort, updatedAt, data }` | `sort` |
| `settings` | `{ _id: "store", value: StoreSettings, updatedAt }` | — |
| `audit_log` | `AuditEntry` | `at`; `entity, entityId` |

No multi-document transactions are required (the local memory server is a standalone instance):
aggregates are updated with single-document operations; an order update and its timeline event are two
writes, and the UI tolerates a missing event. Numbering uses `counters` so it is race-free.

Every catalog-affecting write (products/brands/categories/review approval) increments
`meta.catalogVersion`.

### 1.3 Catalog overlay (`src/lib/catalog.ts`)

The public (sync) API of `catalog.ts` is unchanged, so its ~24 consumers keep working. Internally the
index-building code becomes `buildIndex(source)`; module state holds the current index plus the
overlay version it was built from. One new export, `ensureCatalog(): Promise<void>`, is awaited at the
top of every storefront page, the `(store)` layout (for the header), `sitemap.ts` and every API route
that reads the catalog:

- first call: load the overlay from Mongo (products/brands/categories overrides + approved reviews +
  `catalogVersion`) and rebuild the index; concurrent callers share the same in-flight promise;
- later calls: at most once per 15 s re-read `catalogVersion` and rebuild when it changed;
- `invalidateCatalog()` (called by admin catalog actions) forces the next `ensureCatalog()` to reload;
- when the DB is unreachable (e.g. a build machine without `MONGODB_URI`), the static data is used and
  a warning is logged once.

Merged source (`src/lib/server/catalog-source.ts`): products = static products, replaced by override
rows with the same id, plus custom rows, minus hidden ones (same for brands and categories); reviews =
static reviews ∪ approved DB reviews. Ratings/counters are derived from the merged list (copies, never
mutating the static arrays).

Admin catalog actions call `invalidateCatalog()` and `revalidatePath("/", "layout")` after writing, so
prerendered storefront pages pick up changes; other server instances converge within the 15 s window.

### 1.4 Auth

- `src/lib/server/auth/password.ts` — `hashPassword` (scrypt N=16384,r=8,p=1, 16-byte salt, 32-byte key,
  format `scrypt$N$r$p$salt$hash`), `verifyPassword` (timingSafeEqual).
- `src/lib/server/auth/session.ts` — `createSession(userId)` (32 random bytes → base64url token; DB
  stores sha256), `readSessionUser(token)`, `destroySession(token)`, cookie name `af_admin`,
  httpOnly, sameSite=lax, secure in production, path `/admin`, maxAge 30 days.
- `src/lib/server/auth/dal.ts` — `getCurrentUser()` (React `cache`d per request), `requireUser(permission?)`
  for pages (redirects to `/admin/login?next=…`) and `requireActor(permission)` for actions/route
  handlers (throws `AuthError`). `can(user, permission)`.
- Login rate limit: in-memory, 8 attempts / 15 min per IP+email.
- First run: when `users` is empty, `/admin/login` renders the owner setup form; `ADMIN_EMAIL` +
  `ADMIN_PASSWORD` env create the owner on init instead.

Permissions (`src/lib/admin/permissions.ts`):

| permission | viewer | manager | owner |
| --- | --- | --- | --- |
| `*:read`, `export` | ✓ | ✓ | ✓ |
| `orders:write` `purchases:write` `customers:write` `requests:write` `catalog:write` `content:write` | | ✓ | ✓ |
| `settings:write` `users:write` | | | ✓ |

### 1.5 Server actions

All mutations are Server Actions in `src/lib/admin/actions/<module>.ts` (`"use server"` files),
validated with **zod v4**, authorised with `requireActor`, audited, returning

```ts
type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };
```

Helper `runAction({ permission, schema, input, run })` in `src/lib/admin/actions/_action.ts` does
parse → auth → run → catch (AuthError → "Сесія завершилась, увійдіть знову"; ZodError → fieldErrors;
other → logged + generic message). Client components call actions inside `useTransition`, toast the
result with `toast()` from `@/lib/store`, and `router.refresh()` on success. Forms use
`useActionState` where progressive enhancement matters (login, settings).

### 1.6 Storefront integration

- `/api/orders`: after validation and re-pricing → `orders.create()` (status `new`, source `website`,
  customer upsert by normalised phone, cost snapshot from the best supplier offer per line) → then
  `notifyManagers` best-effort (failure recorded as an order event `notify_failed`, order still
  accepted). Validates that the chosen delivery/payment methods are enabled in settings.
- `/api/callback`: persists a `requests` row (kind, phone, name, product, comment); when the comment
  starts with `Відгук, оцінка N/5` a `reviews` row with `status='pending'` is created as well; then
  notifies best-effort.
- `checkout/page.tsx` passes enabled delivery/payment methods (from settings) to `CheckoutForm`.
- `promos`/`faq` consumers `await getPromos()` / `await getFaq()` from `src/lib/content.ts` (DB-backed,
  seeded from the static files, falls back to static if the DB is unavailable).
- Every storefront page / layout / API route that reads the catalog starts with `await ensureCatalog()`.

## 2. Domain model (`src/lib/admin/types.ts`)

```ts
export type Role = "owner" | "manager" | "viewer";
export interface AdminUser { id: string; email: string; name: string; role: Role; active: boolean; createdAt: string; lastLoginAt?: string }

export type OrderStatus = "new" | "confirmed" | "sourcing" | "in_transit" | "delivered" | "completed" | "on_hold" | "cancelled" | "returned";
export type PaymentStatus = "unpaid" | "prepaid" | "paid" | "refunded" | "partially_refunded";
export type OrderSource = "website" | "phone" | "manual" | "quick_order";
export type LineFulfillment = "pending" | "ordered" | "shipped" | "delivered" | "cancelled";
export type Carrier = "nova_poshta" | "ukrposhta" | "other";

export interface OrderLine { id: string; productId: string | null; sku: string; name: string; optionLabel?: string;
  price: number; qty: number; discount: number; costPrice?: number; supplierId?: string; purchaseOrderId?: string;
  fulfillment: LineFulfillment; note?: string }
export interface OrderCustomer { customerId?: string; firstName: string; lastName: string; phone: string; email?: string }
export interface TrackingSnapshot { status: string; statusCode?: string; checkedAt: string; scheduledDeliveryDate?: string; warehouse?: string }
export interface OrderDelivery { method: DeliveryMethod; city: string; address: string; carrier?: Carrier; trackingNumber?: string;
  tracking?: TrackingSnapshot; shippedAt?: string; deliveredAt?: string; cost?: number; costPayer?: "customer" | "shop" }
export interface OrderPayment { method: PaymentMethod; status: PaymentStatus; paidAmount: number; paidAt?: string; paymentLink?: string; invoiceNumber?: string }
export interface Order { id: string; number: string; status: OrderStatus; source: OrderSource; customer: OrderCustomer;
  delivery: OrderDelivery; payment: OrderPayment; lines: OrderLine[]; subtotal: number; discount: number; total: number;
  costTotal: number; margin: number; marginKnown: boolean; comment?: string; vehicle?: string; doNotCall: boolean;
  managerNote?: string; assigneeId?: string; tags: string[]; cancelReason?: string;
  createdAt: string; updatedAt: string; confirmedAt?: string; shippedAt?: string; completedAt?: string; cancelledAt?: string }
export type OrderEventType = "created" | "status_changed" | "payment_changed" | "lines_changed" | "delivery_changed" | "customer_changed"
  | "note" | "call" | "po_created" | "po_updated" | "tracking_checked" | "notified" | "notify_failed" | "message_sent";
export interface OrderEvent { id: string; orderId: string; type: OrderEventType; at: string; actorId: string | null; actorName: string; text: string; data?: Record<string, unknown> }

export interface Customer { id: string; phone: string; firstName: string; lastName: string; email?: string; city?: string; tags: string[];
  notes: string; doNotCall: boolean; ordersCount: number; totalSpent: number; firstOrderAt?: string; lastOrderAt?: string; createdAt: string; updatedAt: string }

export interface Supplier { id: string; code: string; name: string; active: boolean; contacts: { phone?: string; email?: string; telegram?: string; site?: string; manager?: string };
  leadDays: [number, number]; paymentTerms?: string; deliveryTerms?: string; shipsDirect: boolean; defaultMarkupPercent?: number; notes?: string; createdAt: string; updatedAt: string }
export type OfferAvailability = "in_stock" | "on_order" | "none";
export interface SupplierOffer { id: string; supplierId: string; productId: string | null; sku: string; cost: number; availability: OfferAvailability; qty?: number; leadDays?: [number, number]; updatedAt: string }

export type PurchaseOrderStatus = "draft" | "sent" | "confirmed" | "shipped" | "received" | "cancelled";
export interface PurchaseOrderLine { id: string; orderId: string; orderNumber: string; orderLineId: string; productId: string | null; sku: string; name: string; qty: number; cost: number }
export interface PurchaseOrder { id: string; number: string; supplierId: string; status: PurchaseOrderStatus; lines: PurchaseOrderLine[]; totalCost: number; shipDirect: boolean;
  supplierRef?: string; trackingNumber?: string; expectedAt?: string; notes?: string; createdBy: string; createdAt: string; updatedAt: string; sentAt?: string; confirmedAt?: string; shippedAt?: string; receivedAt?: string }

export type RequestStatus = "new" | "in_progress" | "done" | "spam";
export interface CustomerRequest { id: string; kind: CallbackKind; status: RequestStatus; phone: string; name?: string; productId?: string; productName?: string; productSku?: string;
  comment?: string; assigneeId?: string; resultNote?: string; orderId?: string; createdAt: string; updatedAt: string }

export type ReviewStatus = "pending" | "approved" | "rejected";
export interface ModeratedReview extends Review { status: ReviewStatus; source: "site" | "admin"; createdAt: string }

export interface StoreSettings {
  checkout: { delivery: Record<DeliveryMethod, { enabled: boolean; note?: string }>; payment: Record<PaymentMethod, { enabled: boolean; note?: string }> };
  orders: { defaultMarkupPercent: number; lowMarginPercent: number; staleNewHours: number; staleSourcingDays: number; staleTransitDays: number };
  notifications: { telegramNewOrder: boolean; telegramNewRequest: boolean };
  novaPoshta: { apiKey?: string };
  templates: MessageTemplate[]; // { id, name, body } — placeholders {{number}} {{name}} {{total}} {{ttn}} {{items}}
}
export interface AuditEntry { id: string; at: string; actorId: string | null; actorName: string; action: string; entity: string; entityId: string; summary: string; data?: Record<string, unknown> }
```

Derived numbers: `subtotal = Σ price·qty`, `total = subtotal − discount`, `costTotal = Σ costPrice·qty`
(lines without cost count 0 and set `marginKnown=false`), `margin = total − costTotal − (costPayer==="shop" ? cost : 0)`.

### 2.1 Order state machine (`src/lib/admin/domain/order-status.ts`)

```
new        → confirmed | on_hold | cancelled
confirmed  → sourcing | in_transit | on_hold | cancelled
sourcing   → in_transit | on_hold | cancelled
in_transit → delivered | returned
delivered  → completed | returned
completed  → returned
on_hold    → new | confirmed | sourcing | cancelled
cancelled  → new            (reopen)
returned   → (terminal; refunds tracked in payment status)
```
Side effects: `confirmed` sets `confirmedAt`; `in_transit` sets `shippedAt` (warns if no TTN);
`completed` sets `completedAt` and, for COD orders, offers to mark payment `paid`; `cancelled` requires a
reason, sets `cancelledAt`, sets pending/ordered lines to `cancelled`. Creating a PO moves a
`new`/`confirmed` order to `sourcing` and its lines to `ordered`; PO `shipped` → lines `shipped`;
PO `received` → lines `delivered` only when `shipDirect`. The manager advances the order itself; the
UI suggests the next step ("Усі позиції відправлені — позначити замовлення відправленим?").

Numbering: orders `AF-YYMMDD-NNNN` (NNNN = 1000 + today's count, retried on UNIQUE collision — keeps the
storefront's `/^AF-\d{6}-\d{3,5}$/` check valid); purchase orders `PO-YYMMDD-NN`.

### 2.2 Labels (`src/lib/admin/labels.ts`)

Every enum has a Ukrainian label and a badge tone, used by one `StatusBadge` component everywhere:

| tone | use |
| --- | --- |
| blue | order new, PO sent, request new |
| teal | order confirmed, PO confirmed |
| violet | order sourcing, line ordered |
| amber | order in_transit, PO shipped, payment prepaid/partially_refunded, request in_progress, review pending |
| green | delivered/completed, PO received, payment paid, request done, review approved |
| slate | on_hold, draft, unpaid, pending line, spam |
| red | cancelled, refunded, rejected |
| rose | returned |

Order: Нове / Підтверджено / У постачальника / Відправлено / Доставлено / Виконано / Очікує / Скасовано / Повернення.
Payment: Не оплачено / Передплата / Оплачено / Повернено / Частково повернено.
PO: Чернетка / Надіслано / Підтверджено / Відправлено / Отримано / Скасовано.
Request: Нова / В роботі / Опрацьовано / Спам. Review: На модерації / Опубліковано / Відхилено.
Fulfillment: Очікує закупівлі / Замовлено / Відправлено / Доставлено / Скасовано.
Source: Сайт / Телефон / Вручну / Швидке замовлення. Roles: Власник / Менеджер / Перегляд.

## 3. Visual design

**Subject & job.** An operations console for one or two people who process every order by hand:
call the buyer, order the part from a supplier, enter the waybill, get paid. Density and scanability
over marketing polish; the brand (navy / royal blue / silver) carries over so it feels like the same
product as the storefront.

**Palette.** Canvas `mist-soft #f6f8fa`, surfaces white with `line-soft` borders, sidebar `navy-900
#001026` with `brand-300` for the active item, primary actions `brand-600 #0054c6`. Status tones from
§2.2; three tokens are added to `globals.css` (`teal`, `violet`, `rose` + soft variants). Text `ink`
scale as on the site.

**Type.** Inter only; `tabular` on every number, money, code and date. Exo 2 italic appears once — the
wordmark on the login screen. Scale: page title 22/28 semibold, section 15/20 semibold, body 14/20,
table 13.5/18, KPI value 28/32 semibold.

**Layout.**
```
┌──────────┬───────────────────────────────────────────────────────────────┐
│ ▣ AutoFlex│ ☰  [🔍 Пошук: номер, телефон, артикул…]   + Замовлення   ◉ Ім'я │
│          ├───────────────────────────────────────────────────────────────┤
│ Операції │  Замовлення                               [Експорт] [+ Нове] │
│ • Дашборд│  ┌ Усі 128 │ Потребують дії 7 │ У постачальника 12 │ … ┐    │
│ • Замовл.│  [статус ▾] [оплата ▾] [доставка ▾] [дата] [пошук…]          │
│ • Закупів│  ┌──────────────────────────────────────────────────────────┐ │
│ • Заявки │  │ № · дата   клієнт        склад        сума    статус  ▸ │ │
│ Довідники│  │ …                                                       │ │
│ …        │  └──────────────────────────────────────────────────────────┘ │
│ ◉ Ім'я ⏻ │                                     ‹ 1 2 3 ›                 │
└──────────┴───────────────────────────────────────────────────────────────┘
```
Left-aligned content, max width 1440 px, 24 px gutters (16 on phones). Detail pages are two columns
(`minmax(0,1fr) 22rem`): the work (lines, timeline) on the left, facts and actions (status, payment,
delivery, customer) on the right; single column under 1024 px. Lists collapse to stacked cards under
768 px (orders, requests, POs).

**The one bold element.** The order pipeline strip (dashboard and top of the orders list): a
horizontal band of stages with count and money, acting as filters, with a thin flow line connecting
them. Everything else is quiet: no decorative gradients, no entrance animations; the only motion is
feedback (toast, row flash after an update, drawer/menu open).

**Principles.** Every row offers its primary next action without opening it. One status component,
one set of colours. Codes/money/dates in tabular numerals, right-aligned where columnar. Empty states
say what to do. Errors say what happened and what to do next.

## 4. Modules & pages

| path | content |
| --- | --- |
| `/admin` | Dashboard: KPI tiles (orders today/7d, revenue 30d, margin 30d, average order), pipeline strip, "Потребують уваги" list (stale new orders, lines without PO, overdue POs, long transit, new requests, pending reviews, low-margin orders), 30-day sales bar chart with margin line, status donut, top products, recent activity. |
| `/admin/orders` | Saved views (Усі / Потребують дії / Нові / У постачальника / В дорозі / Очікують оплати / Завершені / Скасовані), filters (status, payment, delivery method, supplier, assignee, date range, text q over number/phone/name/sku), sort, pagination, bulk: assign, set status (where allowed), export CSV. Row: number, date, customer (phone), lines summary, total/margin, payment badge, status badge, inline primary action. |
| `/admin/orders/new` | Manual order: customer lookup by phone (autofill from customers), product picker (search sku/name → line), qty/price/discount, delivery, payment, comment, source. |
| `/admin/orders/[id]` | Header (number, status, source, created, assignee). Left: lines table (sku, name, option, qty, price, cost, supplier, fulfillment, PO link; actions: create PO for pending lines, edit lines), customer comment / vehicle, timeline with note/call composer. Right: status card (allowed transitions as buttons, cancel with reason, on-hold), payment card (status, amount, link, invoice), delivery card (method, address, carrier, TTN + "Перевірити" tracking, shipped/delivered dates), customer card (link, phone tel:, copy, do-not-call, tags, history count), messages card (templates → rendered text → copy/open Telegram/Viber), danger: duplicate, print. |
| `/admin/orders/[id]/edit` | Edit customer, delivery, payment method, lines (add via picker/custom, qty, price, discount, cost/supplier), comment, manager note, tags, assignee. |
| `/admin/orders/[id]/print` | Invoice/packing slip, print stylesheet (shell hidden in print). |
| `/admin/purchases` | PO list with filters (status, supplier, date), overdue indicator; `/admin/purchases/new?order=…` groups pending lines by suggested supplier (best offer) → create one PO per supplier; `/admin/purchases/[id]` detail: lines, status actions (sent/confirmed/shipped/received/cancelled), supplier ref, tracking, expected date, notes, copy "order text" for the supplier (sku · qty). |
| `/admin/suppliers` | List + detail: contacts, terms, lead time, ships-direct, active; offers tab (table, inline edit cost/availability, CSV import `sku;cost;availability;qty;lead_min;lead_max`, template download); open POs; margin stats. |
| `/admin/requests` | Inbox tabs (Нові / В роботі / Опрацьовані / Спам) with kind filter; row actions: take, done with result note, mark spam, call tel:, convert quick order → `/admin/orders/new?request=…` prefilled. |
| `/admin/customers` | Search (phone/name/email), tags, do-not-call; detail: profile edit, tags, notes, orders list, LTV, requests; merge not required. |
| `/admin/products` | Table with search (sku/name/OE), filters (category, brand, stock, hidden, badges, has-cost), sort; inline price/stock edit; bulk: markup %, set stock, hide/show; CSV export; price import `sku;price;oldPrice;stock`. `/admin/products/new`, `/admin/products/[id]`: full `Product` editor (name, slug, sku, OE numbers, brand, category, prices, stock, delivery days, images URLs, badges, short/long description, specs, fitment (make/model picker), universal, option values, warranty) + supplier offers for this SKU + "Переглянути на сайті". |
| `/admin/categories`, `/admin/brands` | Tree/list with product counts; edit name/description/icon/illustration; add leaf category / brand; hide. |
| `/admin/reviews` | Moderation queue: approve/reject/edit text; filter by status; link to product. |
| `/admin/promos`, `/admin/faq` | CRUD with ordering and active toggle; promo preview card. |
| `/admin/settings` | Tabs: Оформлення (delivery/payment methods on/off + notes), Замовлення (markup, low-margin threshold, stale thresholds), Сповіщення (channel status from env, toggles, send test), Нова Пошта (API key), Шаблони повідомлень (CRUD, placeholders help). |
| `/admin/users` | List, invite (create with password), role, deactivate, reset password; self-service password change. |
| `/admin/audit` | Filterable log (entity, actor, date), expandable JSON details. |
| `/admin/search?q=` | Global results: orders, customers, products, POs, requests. |
| `/admin/export/{orders,customers,products,offers}` | Route handlers returning CSV (UTF-8 BOM, `;` separator), honouring list filters. |

Sidebar groups: Операції (Дашборд, Замовлення, Закупівлі, Заявки) · Довідники (Товари, Категорії,
Бренди, Постачальники, Клієнти) · Контент (Відгуки, Акції, FAQ) · Система (Налаштування, Користувачі,
Журнал). Badges: new orders, new requests, pending reviews (server-rendered; a `RefreshOnFocus` client
component calls `router.refresh()` when the tab regains focus).

Keyboard: `/` focuses the global search; `Esc` closes dialogs (native `<dialog>`).

## 5. Shared admin code (foundation, written before module work)

```
src/lib/admin/types.ts, labels.ts, permissions.ts
src/lib/admin/domain/{order-status.ts, numbering.ts, money.ts, csv.ts, templates.ts}
src/lib/admin/actions/_action.ts          runAction helper, ActionResult, AuthError mapping
src/lib/server/auth/*                     password, session, dal, rate-limit (login)
src/lib/server/db/*                       client, collections, util, repos/*, seed, testing
src/lib/server/catalog-source.ts          overlay loader (products/brands/categories/reviews + catalogVersion)
src/lib/server/nova-poshta.ts             trackDocument()
src/components/admin/shell/*              AdminShell, Sidebar, SidebarNav (nav config), Topbar, GlobalSearch, UserMenu, MobileSidebar, RefreshOnFocus
src/components/admin/ui/*                 PageHeader, Card, KpiTile, StatusBadge, DataTable, FilterBar (+AutoSubmit), Toolbar,
                                          Money, DateTime, PhoneLink, CopyText, ActionButton, SubmitButton, ConfirmDialog,
                                          Dropdown, SegmentedLinks, Timeline, Pill, Stat, Description list (DL)
src/app/(admin)/admin/admin.css           admin-only component classes (tables, scroll areas, print)
```

Repository function surface (all async, throw on invariant violations):

- `users`: `countUsers, listUsers, getUserById, getUserByEmail, createUser, updateUser, setPassword, touchLogin`
- `sessions`: `createSession, getSession, deleteSession, deleteUserSessions, purgeExpired`
- `orders`: `createOrder(input, actor)`, `getOrder(id)`, `getOrderByNumber`, `updateOrder(id, patch, actor, event)`, `listOrders(filter, page)`,
  `countByStatus`, `addEvent`, `listEvents(orderId)`, `salesByDay(days)`, `topProducts(days)`, `attention(settings)`
- `customers`: `upsertFromOrder, getCustomer, getByPhone, searchCustomers, updateCustomer, recomputeStats`
- `suppliers`/`offers`: `listSuppliers, getSupplier, createSupplier, updateSupplier, listOffers(filter), upsertOffers(rows), bestOfferFor(productId|sku), offersForSku`
- `purchase-orders`: `createPurchaseOrder, getPurchaseOrder, listPurchaseOrders, updatePurchaseOrder, setStatus`
- `requests`: `createRequest, getRequest, listRequests, updateRequest, countNew`
- `reviews`: `createReview, listReviews, setReviewStatus, updateReview, approvedForProduct, countPending`
- `catalog`: `upsertProduct(product, kind), hideProduct, listOverrides, upsertBrand, upsertCategory, bumpCatalogVersion, getCatalogVersion`
- `content`: `listPromos, savePromo, deletePromo, listFaq, saveFaq, deleteFaq`
- `settings`: `getSettings()` (defaults merged), `saveSettings(patch)`
- `audit`: `record(entry)`, `listAudit(filter, page)`

## 6. Implementation plan

**Phase 1 — foundation (single author, sequential):** deps (`zod`, `vitest`, `@types/node@24`),
route restructure, root/store/admin layouts, DB layer + schema + repos + seed, auth + proxy + login,
catalog overlay, content module, storefront API integration, checkout settings, admin shell + UI kit,
action helper, labels/permissions/domain, vitest config + core tests (state machine, numbering,
password/session, orders repo, catalog overlay). Exit criteria: `tsc`, `eslint`, `vitest`, `next build`
all green; `/admin/login` → dashboard placeholder renders with seeded data.

**Phase 2 — modules (parallel agents, each owns its directories only):**
1. Orders (list, new, detail, edit, print, tracking, messages, exports/orders)
2. Purchasing (POs, suppliers, offers, CSV import, exports/offers)
3. Customers + Requests (+ exports/customers)
4. Catalog admin (products, categories, brands, reviews, price import, exports/products)
5. Content + Settings + Users + Audit (promos, faq, settings tabs, users, audit, notifications test)
6. Dashboard + global search (charts via the `dataviz` guidance)

Shared files are frozen during Phase 2 (types, labels, repos, UI kit, nav config). An agent that needs
a new repo query adds it under `src/lib/admin/queries/<module>.ts`; a missing UI primitive goes in
`src/components/admin/<module>/`.

**Phase 3 — integration:** typecheck + lint + tests + build; fix; smoke-run `next start` and request
every admin page; one focused security review of auth/actions/route handlers (the only review pass).

## 7. Testing

Vitest; repository tests run against `mongodb-memory-server` (fresh database per test file). Unit:
order state machine, numbering, money/margin, CSV parse/serialise, templates, password hashing, session
lifecycle, permissions. Repository: orders create/list/filter, customers upsert stats, offers upsert +
best offer, PO creation updates lines, catalog overlay merge + version bump, settings defaults. No
browser e2e in this iteration (manual smoke in Phase 3).

## 8. Operations notes (go into README)

- `MONGODB_URI` — Atlas connection string (`mongodb+srv://…`); `MONGODB_DB` — database name (default
  `autoflex`). Without `MONGODB_URI` in development the app starts a local MongoDB
  (`mongodb-memory-server`, data kept in `data/mongo`); in production the URI is required.
- Demo seed runs automatically when the database is empty in development; `ADMIN_SEED_DEMO=true` forces
  it elsewhere, `ADMIN_SEED_DEMO=false` disables it.
- First admin: open `/admin/login` on an empty database and create the owner, or set `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` before first start.
- Vercel: add the Atlas integration (or paste the URI) as `MONGODB_URI`; nothing else is needed.
