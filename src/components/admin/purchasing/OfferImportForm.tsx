"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/admin/ui";
import { toast } from "@/lib/store";
import { importOffersAction } from "@/lib/admin/actions/purchasing";

interface ImportResult {
  inserted: number;
  updated: number;
  skipped: { row: number; reason: string }[];
}

interface OfferImportFormProps {
  supplierId: string;
}

/** Uploads a CSV price list (sku;cost;availability;qty;lead_min;lead_max) to importOffersAction. */
export function OfferImportForm({ supplierId }: OfferImportFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportResult | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("supplierId", supplierId);
    startTransition(async () => {
      setResult(null);
      const res = await importOffersAction(formData);
      if (res.ok) {
        setResult(res.data);
        toast({ title: `Імпортовано: +${res.data.inserted}, оновлено ${res.data.updated}` });
        formRef.current?.reset();
        router.refresh();
      } else {
        toast({ title: res.error, tone: "error" });
      }
    });
  }

  return (
    <div className="grid gap-4">
      <form ref={formRef} onSubmit={onSubmit} className="grid gap-3">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          aria-label="Файл прайсу CSV"
          className="field cursor-pointer file:mr-3 file:rounded-btn file:border-0 file:bg-mist file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-2"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
            <Upload aria-hidden className="size-4" strokeWidth={1.75} />
            Імпортувати прайс
          </Button>
          <Link
            href={`/admin/export/offers?supplier=${supplierId}&template=1`}
            prefetch={false}
            className="link text-sm font-medium"
          >
            Завантажити шаблон CSV
          </Link>
        </div>
      </form>

      <p className="text-[13px] text-ink-3">
        Колонки: <code className="rounded bg-mist px-1">sku</code>, <code className="rounded bg-mist px-1">cost</code>,{" "}
        <code className="rounded bg-mist px-1">availability</code> (in_stock / on_order / none, або «є», «під
        замовлення», «немає»), <code className="rounded bg-mist px-1">qty</code>,{" "}
        <code className="rounded bg-mist px-1">lead_min</code>, <code className="rounded bg-mist px-1">lead_max</code>.
        Роздільник «;» або «,».
      </p>

      {result && (
        <Alert
          tone={result.skipped.length > 0 ? "warning" : "success"}
          title={`Додано ${result.inserted}, оновлено ${result.updated}, пропущено ${result.skipped.length}`}
        >
          {result.skipped.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[13px]">
              {result.skipped.slice(0, 20).map((s) => (
                <li key={s.row}>
                  Рядок {s.row}: {s.reason}
                </li>
              ))}
              {result.skipped.length > 20 && <li>…ще {result.skipped.length - 20}</li>}
            </ul>
          )}
        </Alert>
      )}
    </div>
  );
}
