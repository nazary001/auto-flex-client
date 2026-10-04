import { Truck } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { site } from "@/lib/site";

/**
 * Honest delivery line for the cart and checkout summaries.
 * With site.freeDeliveryFrom > 0 it shows progress to free delivery;
 * otherwise it states that delivery is paid by the buyer at carrier rates.
 */
export function DeliveryNote({ total, className }: { total: number; className?: string }) {
  const threshold = site.freeDeliveryFrom;

  if (threshold > 0) {
    const reached = total >= threshold;
    const left = Math.max(0, threshold - total);
    const percent = Math.min(100, Math.round((total / threshold) * 100));
    return (
      <div className={cn("grid gap-2 rounded-btn bg-mist-soft p-3", className)}>
        <p className={cn("flex items-start gap-2 text-sm", reached ? "text-ok" : "text-ink-2")}>
          <Truck aria-hidden className="mt-px size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
          {reached ? (
            <span>Ви отримали безкоштовну доставку Новою Поштою.</span>
          ) : (
            <span>
              Додайте товарів ще на <span className="tabular font-semibold text-ink">{formatPrice(left)}</span> — і
              доставка Новою Поштою буде безкоштовною.
            </span>
          )}
        </p>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-line-soft"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={threshold}
          aria-valuenow={Math.min(total, threshold)}
        >
          <span className="block h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }

  return (
    <p className={cn("flex items-start gap-2 rounded-btn bg-mist-soft p-3 text-sm text-ink-2", className)}>
      <Truck aria-hidden className="mt-px size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
      <span>Доставку оплачує одержувач за тарифами перевізника — Нова Пошта або Укрпошта.</span>
    </p>
  );
}
