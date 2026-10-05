"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { Alert, Card } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/store";
import { importPricesAction } from "@/lib/admin/actions/catalog";

/** Collapsible price-list import. CSV columns: sku;price;oldPrice;stock (matched by normalised SKU). */
export function ImportPrices() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ updated: number; skipped: number; total: number } | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      const outcome = await importPricesAction(data);
      if (outcome.ok) {
        setResult(outcome.data);
        toast({ title: `Оновлено ${outcome.data.updated}, пропущено ${outcome.data.skipped}` });
        formRef.current?.reset();
        router.refresh();
      } else {
        toast({ title: outcome.error, tone: "error" });
      }
    });
  }

  return (
    <div className="mb-4">
      <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Upload aria-hidden className="size-4" strokeWidth={1.75} />
        Імпорт цін
        <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} strokeWidth={1.75} />
      </Button>

      {open && (
        <Card className="mt-3" title="Імпорт прайс-листа">
          <form ref={formRef} onSubmit={onSubmit} className="grid gap-3">
            <p className="text-sm text-ink-3">
              Файл CSV із колонками <code className="tabular">sku;price;oldPrice;stock</code>. Товари знаходяться за
              артикулом (без урахування пробілів, крапок і дефісів). Порожня стара ціна очищає знижку. Статуси
              наявності: in_stock, low_stock, preorder, out_of_stock.
            </p>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              aria-label="CSV-файл із цінами"
              className="field"
            />
            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={pending} aria-busy={pending || undefined}>
                {pending ? "Імпортуємо…" : "Імпортувати"}
              </Button>
            </div>
            {result && (
              <Alert tone={result.updated > 0 ? "success" : "warning"}>
                Оброблено рядків: {result.total}. Оновлено товарів: {result.updated}. Пропущено: {result.skipped}.
              </Alert>
            )}
          </form>
        </Card>
      )}
    </div>
  );
}
