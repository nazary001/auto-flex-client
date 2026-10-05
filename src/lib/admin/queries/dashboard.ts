import type { Db } from "mongodb";
import { OPEN_ORDER_STATUSES } from "@/lib/admin/labels";
import { marginPercent } from "@/lib/admin/domain/money";
import { daysAgoIso } from "@/lib/server/db/util";
import {
  countOrders,
  countOrdersByStatus,
  findOrders,
  getOrders,
  listRecentOrderEvents,
  salesByDay,
  summarizePeriod,
  topProducts,
  type DaySales,
  type StatusCounts,
  type TopProduct,
} from "@/lib/server/db/repos/orders";
import { listOverduePurchaseOrders } from "@/lib/server/db/repos/purchase-orders";
import { countRequestsByStatus } from "@/lib/server/db/repos/requests";
import { countPendingReviews } from "@/lib/server/db/repos/reviews";
import { getSettings } from "@/lib/server/db/repos/settings";
import { listSuppliers } from "@/lib/server/db/repos/suppliers";

/*
 * One read query for the whole dashboard. Independent counts and aggregates run together with
 * Promise.all; the two derived steps (overdue purchase orders need the supplier lead-time map,
 * recent activity needs the order numbers of the events) run after, also in parallel.
 */

export interface DashboardKpis {
  ordersToday: number;
  ordersYesterday: number;
  revenue7: number;
  revenuePrev7: number;
  margin30: number;
  /** Revenue over the 30 days whose cost is known (basis for the margin %) */
  marginKnownRevenue30: number;
  revenue30: number;
  averageOrder30: number;
}

/** A row of the «Потребують уваги» card; only non-zero rows are returned. */
export interface AttentionItem {
  key: string;
  label: string;
  count: number;
  href: string;
  /** Soft urgency; "warn" rows are tinted on the dashboard */
  tone: "warn" | "default";
}

export interface ActivityItem {
  id: string;
  text: string;
  actorName: string;
  at: string;
  orderId: string;
  orderNumber?: string;
}

export interface DashboardData {
  kpis: DashboardKpis;
  statusCounts: StatusCounts;
  attention: AttentionItem[];
  sales: DaySales[];
  top: TopProduct[];
  activity: ActivityItem[];
}

export async function getDashboardData(db: Db): Promise<DashboardData> {
  const settings = await getSettings(db);
  const now = Date.now();
  const staleNewCutoff = new Date(now - settings.orders.staleNewHours * 3_600_000).toISOString();
  const staleTransitCutoff = new Date(now - settings.orders.staleTransitDays * 86_400_000).toISOString();

  const [
    statusCounts,
    ordersToday,
    ordersYesterday,
    summary7,
    summaryPrev7,
    summary30,
    sales,
    top,
    events,
    staleNew,
    inTransitLong,
    openOrders,
    suppliers,
    requestCounts,
    pendingReviews,
  ] = await Promise.all([
    countOrdersByStatus(db),
    countOrders(db, { from: daysAgoIso(0) }),
    countOrders(db, { from: daysAgoIso(1), to: daysAgoIso(0) }),
    summarizePeriod(db, daysAgoIso(6)),
    summarizePeriod(db, daysAgoIso(13), daysAgoIso(6)),
    summarizePeriod(db, daysAgoIso(29)),
    salesByDay(db, 30),
    topProducts(db, 30, 8),
    listRecentOrderEvents(db, 12),
    countOrders(db, { status: ["new"], to: staleNewCutoff }),
    countOrders(db, { status: ["in_transit"], to: staleTransitCutoff }),
    findOrders(db, { status: OPEN_ORDER_STATUSES }, 3000),
    listSuppliers(db),
    countRequestsByStatus(db),
    countPendingReviews(db),
  ]);

  const leadBySupplier = new Map(suppliers.map((s) => [s.id, s.leadDays[1]]));
  const orderIds = [...new Set(events.map((e) => e.orderId))];
  const [overdue, eventOrders] = await Promise.all([
    listOverduePurchaseOrders(db, leadBySupplier),
    getOrders(db, orderIds),
  ]);

  // derived from the single open-orders read
  const needsSourcing = openOrders.filter((o) =>
    o.lines.some((l) => l.fulfillment === "pending" && !l.purchaseOrderId),
  ).length;
  const awaitingPayment = openOrders.filter(
    (o) => o.payment.status === "unpaid" && o.payment.method !== "cod",
  ).length;
  const lowMargin = openOrders.filter((o) => {
    const pct = marginPercent(o);
    return pct !== null && pct < settings.orders.lowMarginPercent;
  }).length;

  const rows: AttentionItem[] = [
    { key: "staleNew", label: `Нові без обробки > ${settings.orders.staleNewHours} год`, count: staleNew, href: "/admin/orders?status=new", tone: "warn" },
    { key: "needsSourcing", label: "Очікують закупівлі", count: needsSourcing, href: "/admin/purchases/new", tone: "warn" },
    { key: "overdue", label: "Прострочені закупівлі", count: overdue.length, href: "/admin/purchases", tone: "warn" },
    { key: "inTransit", label: `В дорозі > ${settings.orders.staleTransitDays} дн`, count: inTransitLong, href: "/admin/orders?status=in_transit", tone: "default" },
    { key: "onHold", label: "Очікують рішення", count: statusCounts.on_hold.count, href: "/admin/orders?status=on_hold", tone: "default" },
    { key: "payment", label: "Очікують оплати", count: awaitingPayment, href: "/admin/orders?paymentStatus=unpaid", tone: "default" },
    { key: "lowMargin", label: `Низька маржа < ${settings.orders.lowMarginPercent}%`, count: lowMargin, href: "/admin/orders", tone: "warn" },
    { key: "requests", label: "Нові заявки", count: requestCounts.new, href: "/admin/requests", tone: "warn" },
    { key: "reviews", label: "Відгуки на модерації", count: pendingReviews, href: "/admin/reviews", tone: "default" },
  ];

  const numberById = new Map(eventOrders.map((o) => [o.id, o.number]));
  const activity: ActivityItem[] = events.map((e) => ({
    id: e.id,
    text: e.text,
    actorName: e.actorName,
    at: e.at,
    orderId: e.orderId,
    orderNumber: numberById.get(e.orderId),
  }));

  const kpis: DashboardKpis = {
    ordersToday,
    ordersYesterday,
    revenue7: summary7.revenue,
    revenuePrev7: summaryPrev7.revenue,
    margin30: summary30.margin,
    marginKnownRevenue30: summary30.marginKnownRevenue,
    revenue30: summary30.revenue,
    averageOrder30: summary30.averageOrder,
  };

  return {
    kpis,
    statusCounts,
    attention: rows.filter((r) => r.count > 0),
    sales,
    top,
    activity,
  };
}
