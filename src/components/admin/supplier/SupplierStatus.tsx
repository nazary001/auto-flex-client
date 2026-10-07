"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, RefreshCw, X } from "lucide-react";
import { Alert, Card, Pill, type PillTone } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/store";
import {
  cancelSupplierSyncAction,
  continueSupplierSyncAction,
  getSupplierStatusAction,
  rebuildPricesAction,
  startSupplierSyncAction,
  type SyncRunView,
} from "@/lib/admin/actions/supplier";

const phaseLabels: Record<string, string> = {
  rates: "Курси валют",
  categories: "Категорії",
  retail: "Роздрібні ціни",
  wholesale: "Оптові ціни",
  build: "Збірка товарів",
  taxonomy: "Довідники",
  offers: "Прайс постачальника",
  finalize: "Завершення",
  done: "Готово",
};

const statusMeta: Record<SyncRunView["status"], { label: string; tone: PillTone }> = {
  running: { label: "Виконується", tone: "blue" },
  paused: { label: "Пауза", tone: "amber" },
  done: { label: "Завершено", tone: "green" },
  failed: { label: "Помилка", tone: "red" },
  cancelled: { label: "Скасовано", tone: "slate" },
};

const counterLabels: Record<string, string> = {
  totalResults: "Позицій у постачальника",
  retailItems: "Отримано роздрібних",
  wholesaleRows: "Оптових рядків",
  costed: "Із собівартістю",
  categories: "Категорій",
  products: "Товарів зібрано",
  groups: "Груп з варіантами",
  brands: "Брендів",
  makes: "Марок авто",
  models: "Моделей авто",
  offers: "Позицій прайсу",
  retired: "Знято з продажу",
};

function isActive(run: SyncRunView | null): boolean {
  return Boolean(run && (run.status === "running" || run.status === "paused"));
}

interface SupplierStatusProps {
  initialRun: SyncRunView | null;
  canWrite: boolean;
  configured: boolean;
}

export function SupplierStatus({ initialRun, canWrite, configured }: SupplierStatusProps) {
  const router = useRouter();
  const [run, setRun] = useState<SyncRunView | null>(initialRun);
  const [syncing, setSyncing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildDone, setRebuildDone] = useState<number | null>(null);
  const busyRef = useRef(false);
  const pollingRef = useRef(false);

  // Poll the live run every 3 s while one is active and we are not driving it ourselves.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (busyRef.current || pollingRef.current) return;
      if (!isActive(run)) return;
      pollingRef.current = true;
      try {
        const res = await getSupplierStatusAction();
        if (res.ok) setRun(res.data.run);
      } finally {
        pollingRef.current = false;
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [run]);

  async function runSync() {
    busyRef.current = true;
    setSyncing(true);
    try {
      const started = await startSupplierSyncAction();
      if (!started.ok) {
        toast({ title: started.error, tone: "error" });
        return;
      }
      let current = started.data.run;
      setRun(current);
      while (current.status === "paused") {
        const cont = await continueSupplierSyncAction();
        if (!cont.ok) {
          toast({ title: cont.error, tone: "error" });
          break;
        }
        if (!cont.data.run) break;
        current = cont.data.run;
        setRun(current);
      }
      if (current.status === "done") toast({ title: "Синхронізацію завершено" });
      else if (current.status === "failed") toast({ title: `Помилка синхронізації: ${current.error ?? ""}`, tone: "error" });
    } finally {
      busyRef.current = false;
      setSyncing(false);
      router.refresh();
    }
  }

  async function cancel() {
    const res = await cancelSupplierSyncAction();
    if (res.ok) {
      toast({ title: res.data.cancelled ? "Синхронізацію скасовано" : "Немає активної синхронізації" });
      const status = await getSupplierStatusAction();
      if (status.ok) setRun(status.data.run);
      router.refresh();
    } else {
      toast({ title: res.error, tone: "error" });
    }
  }

  async function reprice() {
    busyRef.current = true;
    setRebuilding(true);
    setRebuildDone(null);
    try {
      let offset = 0;
      let processed = 0;
      for (;;) {
        const res = await rebuildPricesAction({ offset });
        if (!res.ok) {
          toast({ title: res.error, tone: "error" });
          break;
        }
        processed += res.data.processed;
        offset = res.data.offset;
        setRebuildDone(processed);
        if (res.data.complete) {
          toast({ title: `Ціни перераховано: ${processed}` });
          break;
        }
      }
    } finally {
      busyRef.current = false;
      setRebuilding(false);
      router.refresh();
    }
  }

  const active = isActive(run);
  const busy = syncing || rebuilding;
  // buildAfter* keys are resume positions of the build phase, not figures to show
  const counters = run ? Object.entries(run.counters).filter(([key, v]) => typeof v === "number" && !key.startsWith("buildAfter")) : [];

  return (
    <Card
      title="Синхронізація"
      actions={
        canWrite ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={runSync} disabled={!configured || busy}>
              {syncing ? <Loader2 aria-hidden className="size-4 animate-spin" strokeWidth={1.75} /> : <Play aria-hidden className="size-4" strokeWidth={1.75} />}
              {syncing ? "Синхронізуємо…" : "Синхронізувати зараз"}
            </Button>
            {active && (
              <Button variant="ghost" size="sm" onClick={cancel} disabled={rebuilding}>
                <X aria-hidden className="size-4" strokeWidth={1.75} />
                Скасувати
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={reprice} disabled={busy}>
              {rebuilding ? <Loader2 aria-hidden className="size-4 animate-spin" strokeWidth={1.75} /> : <RefreshCw aria-hidden className="size-4" strokeWidth={1.75} />}
              {rebuilding ? "Перераховуємо…" : "Перерахувати ціни"}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!configured && (
        <div className="mb-3">
          <Alert tone="warning">
            Токен DD Tuning не налаштовано (DDTUNING_API_TOKEN). Без токена сайт працює на демо-каталозі.
          </Alert>
        </div>
      )}

      {rebuildDone != null && rebuilding && (
        <p className="mb-3 text-[13px] text-ink-3">Перераховано товарів: {rebuildDone}…</p>
      )}

      {run ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Pill tone={statusMeta[run.status].tone}>{statusMeta[run.status].label}</Pill>
            <span className="text-ink-2">
              Фаза: <span className="font-medium text-ink">{phaseLabels[run.phase] ?? run.phase}</span>
            </span>
            {run.status === "running" || run.status === "paused" ? (
              <span className="tabular text-ink-3">позиція {run.offset}</span>
            ) : null}
          </div>

          {run.error && <p className="rounded-card bg-danger-soft px-3 py-2 text-[13px] text-danger">{run.error}</p>}

          {counters.length > 0 && (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {counters.map(([key, value]) => (
                <div key={key} className="rounded-card border border-line-soft px-3 py-2">
                  <dt className="text-[12px] text-ink-3">{counterLabels[key] ?? key}</dt>
                  <dd className="tabular text-[15px] font-semibold text-ink">{value.toLocaleString("uk-UA")}</dd>
                </div>
              ))}
            </dl>
          )}

          {run.log.length > 0 && (
            <div className="rounded-card border border-line-soft bg-mist-soft p-3">
              <ul className="grid gap-1 font-mono text-[12px] text-ink-2">
                {run.log.map((entry, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 text-ink-3">{new Date(entry.at).toLocaleTimeString("uk-UA")}</span>
                    <span>{entry.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink-3">Синхронізацій ще не було. Натисніть «Синхронізувати зараз», щоб завантажити каталог постачальника.</p>
      )}
    </Card>
  );
}
