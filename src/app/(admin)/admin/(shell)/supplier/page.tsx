import type { Metadata } from "next";
import { Alert, Card, DateTime, PageHeader, Pill, type PillTone } from "@/components/admin/ui";
import { can } from "@/lib/admin/permissions";
import { getSupplierCatalogStats } from "@/lib/admin/queries/catalog";
import { getSupplierStatusAction } from "@/lib/admin/actions/supplier";
import { toRunView } from "@/lib/admin/supplier-run-view";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import type { SyncRunDoc } from "@/lib/server/db/collections";
import { getSettings } from "@/lib/server/db/repos/settings";
import { checkConnection, isDdConfigured } from "@/lib/server/suppliers/ddtuning/client";
import { listSyncRuns } from "@/lib/server/suppliers/ddtuning/sync";
import { SupplierPricingForm } from "@/components/admin/supplier/SupplierPricingForm";
import { SupplierStatus } from "@/components/admin/supplier/SupplierStatus";

export const metadata: Metadata = { title: "Постачальник DD" };
/** A full catalog sync runs in 240 s slices driven from the client; allow up to 5 minutes per call. */
export const maxDuration = 300;

const historyStatus: Record<SyncRunDoc["status"], { label: string; tone: PillTone }> = {
  running: { label: "Виконується", tone: "blue" },
  paused: { label: "Пауза", tone: "amber" },
  done: { label: "Завершено", tone: "green" },
  failed: { label: "Помилка", tone: "red" },
  cancelled: { label: "Скасовано", tone: "slate" },
};

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-card border border-line-soft px-3 py-2.5">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className={`tabular text-[17px] font-semibold ${tone === "warn" && value > 0 ? "text-warn" : "text-ink"}`}>
        {value.toLocaleString("uk-UA")}
      </div>
    </div>
  );
}

export default async function SupplierPage() {
  const user = await requireUser("settings:read");
  const db = await getDb();
  const canWrite = can(user, "settings:write");
  const configured = isDdConfigured();

  const [stats, settings, history, statusRes, connection] = await Promise.all([
    getSupplierCatalogStats(db),
    getSettings(db),
    listSyncRuns(db, 10),
    getSupplierStatusAction(),
    configured ? checkConnection() : Promise.resolve(null),
  ]);
  // the live run while one is active, otherwise the most recent finished run
  const initialRun = (statusRes.ok ? statusRes.data.run : null) ?? toRunView(history[0]);

  return (
    <div>
      <PageHeader
        title="Постачальник DD"
        description="Імпорт каталогу DD Tuning, політика цін та курси валют"
        meta={configured ? <Pill tone="green">Токен налаштовано</Pill> : <Pill tone="amber">Без токена</Pill>}
      />

      <div className="grid gap-4">
        {/* Token / connection */}
        <Card title="Підключення до API">
          {!configured ? (
            <Alert tone="warning" title="Токен не налаштовано">
              Додайте змінну середовища <code className="tabular">DDTUNING_API_TOKEN</code>. Поки токена немає, сайт
              використовує демонстраційний каталог.
            </Alert>
          ) : connection?.ok ? (
            <Alert tone="success" title="Зʼєднання встановлено">
              API постачальника доступне. Позицій у прайсі: {connection.totalResults.toLocaleString("uk-UA")}.
            </Alert>
          ) : (
            <Alert tone="danger" title="Немає зʼєднання">
              {connection?.error ?? "Не вдалося звʼязатися з API постачальника."}
            </Alert>
          )}
        </Card>

        {/* Catalog counts */}
        <Card title="Каталог">
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat label="Усього товарів" value={stats.total} />
            <Stat label="Від DD Tuning" value={stats.ddtuning} />
            <Stat label="Додані вручну" value={stats.manual} />
            <Stat label="Демо" value={stats.demo} />
            <Stat label="Приховані" value={stats.hidden} />
            <Stat label="Знято з продажу" value={stats.retired} />
            <Stat label="Із собівартістю" value={stats.withCost} />
            <Stat label="Без собівартості" value={stats.withoutCost} tone="warn" />
          </dl>
        </Card>

        {/* Sync controls + live progress */}
        <SupplierStatus initialRun={initialRun} canWrite={canWrite} configured={configured} />

        {/* Pricing policy */}
        <SupplierPricingForm initial={settings.supplier} canWrite={canWrite} />

        {/* History */}
        <Card title="Історія синхронізацій" padded={false}>
          {history.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-3 sm:px-5">Синхронізацій ще не було.</p>
          ) : (
            <div className="adm-scroll-x">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col">Початок</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Завершено</th>
                    <th scope="col" className="text-right">Товарів</th>
                    <th scope="col" className="hidden text-right sm:table-cell">Прайс</th>
                    <th scope="col" className="hidden text-right sm:table-cell">Знято</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((runDoc) => (
                    <tr key={runDoc._id}>
                      <td>
                        <DateTime iso={runDoc.startedAt} />
                      </td>
                      <td>
                        <Pill tone={historyStatus[runDoc.status].tone} size="sm">
                          {historyStatus[runDoc.status].label}
                        </Pill>
                      </td>
                      <td className="text-ink-2">{runDoc.finishedAt ? <DateTime iso={runDoc.finishedAt} /> : "—"}</td>
                      <td className="tabular text-right text-ink-2">{(runDoc.counters.products ?? 0).toLocaleString("uk-UA")}</td>
                      <td className="tabular hidden text-right text-ink-2 sm:table-cell">{(runDoc.counters.offers ?? 0).toLocaleString("uk-UA")}</td>
                      <td className="tabular hidden text-right text-ink-2 sm:table-cell">{(runDoc.counters.retired ?? 0).toLocaleString("uk-UA")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Cron hint */}
        <p className="text-[13px] text-ink-3">
          Автоматична синхронізація: налаштуйте Vercel Cron на щоденний виклик{" "}
          <code className="tabular">GET /api/cron/ddtuning-sync</code> із заголовком{" "}
          <code className="tabular">Authorization: Bearer &lt;CRON_SECRET&gt;</code> (змінна середовища{" "}
          <code className="tabular">CRON_SECRET</code>) — кожен виклик працює до 4 хвилин і продовжує незавершений імпорт.
        </p>
      </div>
    </div>
  );
}
