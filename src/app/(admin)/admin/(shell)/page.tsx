import type { Metadata } from "next";
import { Card, KpiTile, PageHeader } from "@/components/admin/ui";
import { countUk, formatPrice } from "@/lib/format";
import { getDashboardData } from "@/lib/admin/queries/dashboard";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { AttentionList } from "@/components/admin/dashboard/AttentionList";
import { PipelineStrip } from "@/components/admin/dashboard/PipelineStrip";
import { RecentActivity } from "@/components/admin/dashboard/RecentActivity";
import { SalesChart } from "@/components/admin/dashboard/SalesChart";
import { StatusMixChart } from "@/components/admin/dashboard/StatusMixChart";
import { TopProducts } from "@/components/admin/dashboard/TopProducts";

export const metadata: Metadata = { title: "Дашборд" };

const ORDERS_FORMS: [string, string, string] = ["замовлення", "замовлення", "замовлень"];

export default async function DashboardPage() {
  await requireUser("orders:read");
  const db = await getDb();
  const data = await getDashboardData(db);
  const { kpis, statusCounts } = data;

  const ordersDelta = kpis.ordersToday - kpis.ordersYesterday;
  const revTrend =
    kpis.revenuePrev7 > 0 ? Math.round(((kpis.revenue7 - kpis.revenuePrev7) / kpis.revenuePrev7) * 100) : null;
  const revDelta = revTrend !== null && revTrend !== 0 ? { value: revTrend, label: "% до попередніх 7 днів" } : undefined;
  const revHint =
    revTrend === null ? "немає даних за попередній тиждень" : revTrend === 0 ? "без змін" : undefined;
  const marginKnownPct = kpis.revenue30 > 0 ? Math.round((kpis.marginKnownRevenue30 / kpis.revenue30) * 100) : 0;
  const totalOrders = Object.values(statusCounts).reduce((sum, s) => sum + s.count, 0);

  return (
    <div>
      <PageHeader title="Дашборд" description="Операційний огляд магазину" />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Замовлення сьогодні"
          value={kpis.ordersToday}
          delta={{ value: ordersDelta, label: "проти вчора" }}
          href="/admin/orders?status=new"
        />
        <KpiTile label="Виручка за 7 днів" value={formatPrice(kpis.revenue7)} delta={revDelta} hint={revHint} />
        <KpiTile
          label="Маржа за 30 днів"
          value={formatPrice(kpis.margin30)}
          hint={`відомо для ${marginKnownPct}% виручки`}
        />
        <KpiTile label="Середній чек, 30 днів" value={formatPrice(kpis.averageOrder30)} hint="за 30 днів" />
      </div>

      <Card
        title="Конвеєр замовлень"
        description="Етапи обробки — натисніть, щоб відкрити список"
        className="mt-4"
      >
        <PipelineStrip counts={statusCounts} totalLabel={`Всього ${countUk(totalOrders, ORDERS_FORMS)}`} />
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-4">
          <Card title="Продажі за 30 днів">
            <SalesChart data={data.sales} />
          </Card>
          <Card title="Відкриті замовлення" description="Розподіл за статусом">
            <StatusMixChart counts={statusCounts} />
          </Card>
          <Card title="Топ товарів за 30 днів" padded={false}>
            <TopProducts items={data.top} />
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card title="Потребують уваги" padded={false}>
            <AttentionList items={data.attention} />
          </Card>
          <Card title="Остання активність" padded={false}>
            <RecentActivity items={data.activity} />
          </Card>
        </div>
      </div>
    </div>
  );
}
