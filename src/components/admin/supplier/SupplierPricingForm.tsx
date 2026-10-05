"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { toast } from "@/lib/store";
import type { StoreSettings } from "@/lib/admin/types";
import { saveSupplierSettingsAction } from "@/lib/admin/actions/supplier";

interface SupplierPricingFormProps {
  initial: StoreSettings["supplier"];
  canWrite: boolean;
}

export function SupplierPricingForm({ initial, canWrite }: SupplierPricingFormProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [priceSource, setPriceSource] = useState(initial.priceSource);
  const [markupPercent, setMarkupPercent] = useState(String(initial.markupPercent));
  const [roundTo, setRoundTo] = useState(String(initial.roundTo));
  const [ratesSource, setRatesSource] = useState(initial.rates.source);
  const [eur, setEur] = useState(String(initial.rates.EUR));
  const [usd, setUsd] = useState(String(initial.rates.USD));
  const [autoSync, setAutoSync] = useState(initial.autoSyncEnabled);

  function save() {
    start(async () => {
      const res = await saveSupplierSettingsAction({
        priceSource,
        markupPercent: Number(markupPercent) || 0,
        roundTo: Number(roundTo) || 0,
        ratesSource,
        eur: Number(eur) || 0,
        usd: Number(usd) || 0,
        autoSyncEnabled: autoSync,
      });
      if (res.ok) {
        toast({ title: "Політику цін збережено" });
        router.refresh();
      } else {
        toast({ title: res.error, tone: "error" });
      }
    });
  }

  return (
    <Card title="Політика цін і курси">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Джерело ціни" htmlFor="sp-source" hint="Як формується ціна на сайті">
          <Select id="sp-source" value={priceSource} disabled={!canWrite} onChange={(e) => setPriceSource(e.target.value as typeof priceSource)}>
            <option value="retail">Роздрібна ціна постачальника</option>
            <option value="cost_markup">Від собівартості з націнкою</option>
          </Select>
        </Field>
        <Field label="Націнка, %" htmlFor="sp-markup" hint="Додається до базової ціни">
          <Input id="sp-markup" type="number" min={0} value={markupPercent} disabled={!canWrite} onChange={(e) => setMarkupPercent(e.target.value)} />
        </Field>
        <Field label="Округлення, ₴" htmlFor="sp-round" hint="0 — автоматично (кроки 5 / 10 ₴)">
          <Input id="sp-round" type="number" min={0} value={roundTo} disabled={!canWrite} onChange={(e) => setRoundTo(e.target.value)} />
        </Field>
        <Field label="Курси валют" htmlFor="sp-rates-source" hint="Для перерахунку собівартості">
          <Select id="sp-rates-source" value={ratesSource} disabled={!canWrite} onChange={(e) => setRatesSource(e.target.value as typeof ratesSource)}>
            <option value="nbu">Автоматично (НБУ)</option>
            <option value="manual">Вручну</option>
          </Select>
        </Field>
        <Field label="EUR, ₴" htmlFor="sp-eur" hint={ratesSource === "nbu" ? "Запасне значення, якщо НБУ недоступний" : undefined}>
          <Input id="sp-eur" type="number" min={0} step="0.01" value={eur} disabled={!canWrite} onChange={(e) => setEur(e.target.value)} />
        </Field>
        <Field label="USD, ₴" htmlFor="sp-usd" hint={ratesSource === "nbu" ? "Запасне значення, якщо НБУ недоступний" : undefined}>
          <Input id="sp-usd" type="number" min={0} step="0.01" value={usd} disabled={!canWrite} onChange={(e) => setUsd(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            label="Автоматична синхронізація за розкладом"
            description="Дозволяє крону (Vercel Cron) запускати синхронізацію"
            checked={autoSync}
            disabled={!canWrite}
            onChange={(e) => setAutoSync(e.target.checked)}
          />
        </div>
      </div>
      {initial.rates.updatedAt && (
        <p className="mt-3 text-[12.5px] text-ink-3">Курси оновлено: {new Date(initial.rates.updatedAt).toLocaleString("uk-UA")}</p>
      )}
      {canWrite && (
        <div className="mt-4">
          <Button onClick={save} disabled={pending} aria-busy={pending || undefined}>
            {pending ? "Зберігаємо…" : "Зберегти політику"}
          </Button>
        </div>
      )}
    </Card>
  );
}
