"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/store";
import { stockMeta } from "@/lib/format";
import type { StockStatus } from "@/lib/types";
import { bulkHideAction, bulkMarkupAction, bulkStockAction } from "@/lib/admin/actions/catalog";

const STOCKS: StockStatus[] = ["in_stock", "low_stock", "preorder", "out_of_stock"];

interface BulkBarProps {
  ids: string[];
  onClear: () => void;
}

/** Floating action bar shown while products are selected in the table. */
export function BulkBar({ ids, onClear }: BulkBarProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [markup, setMarkup] = useState("25");
  const [stock, setStock] = useState<StockStatus>("in_stock");

  function done(message: string) {
    toast({ title: message });
    router.refresh();
    onClear();
  }

  function reprice() {
    const markupPercent = Number(markup);
    if (!Number.isFinite(markupPercent) || markupPercent < 0) {
      toast({ title: "Вкажіть коректну націнку.", tone: "error" });
      return;
    }
    start(async () => {
      const result = await bulkMarkupAction({ ids, markupPercent });
      if (result.ok) done(`Переоцінено ${result.data.updated}, пропущено ${result.data.skipped}`);
      else toast({ title: result.error, tone: "error" });
    });
  }

  function applyStock() {
    start(async () => {
      const result = await bulkStockAction({ ids, stock });
      if (result.ok) done(`Наявність оновлено для ${result.data.updated} товарів`);
      else toast({ title: result.error, tone: "error" });
    });
  }

  function hide(hidden: boolean) {
    start(async () => {
      const result = await bulkHideAction({ ids, hidden });
      if (result.ok) done(hidden ? `Приховано ${result.data.updated}` : `Показано ${result.data.updated}`);
      else toast({ title: result.error, tone: "error" });
    });
  }

  return (
    <div className="sticky bottom-3 z-30 mt-3">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-line-soft bg-white px-4 py-3 shadow-pop">
        <span className="text-sm font-semibold text-ink">Обрано {ids.length}</span>

        <div className="flex items-center gap-1.5">
          <label htmlFor="bulk-markup" className="text-[13px] text-ink-3">
            Націнка до ціни постачальника +
          </label>
          <input
            id="bulk-markup"
            type="number"
            min={0}
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            className="field field-sm w-16 text-right tabular"
          />
          <span className="text-[13px] text-ink-3">%</span>
          <Button variant="secondary" size="sm" onClick={reprice} disabled={pending}>
            Застосувати
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={stock}
            onChange={(e) => setStock(e.target.value as StockStatus)}
            aria-label="Наявність"
            className="field field-sm w-auto"
          >
            {STOCKS.map((s) => (
              <option key={s} value={s}>
                {stockMeta[s].label}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" onClick={applyStock} disabled={pending}>
            Наявність
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => hide(true)} disabled={pending}>
            Приховати
          </Button>
          <Button variant="ghost" size="sm" onClick={() => hide(false)} disabled={pending}>
            Показати
          </Button>
        </div>

        <button
          type="button"
          onClick={onClear}
          aria-label="Зняти виділення"
          className="ml-auto grid size-8 place-content-center rounded-btn text-ink-3 transition-colors hover:bg-mist hover:text-ink"
        >
          <X aria-hidden className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
