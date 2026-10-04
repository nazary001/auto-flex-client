import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { stockMeta, type StockTone } from "@/lib/format";
import type { ProductBadge, StockStatus } from "@/lib/types";

const badgeTone = {
  new: "bg-brand-600 text-white",
  sale: "bg-sale text-white",
  hit: "bg-navy-900 text-white",
  neutral: "bg-mist text-ink-2",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof badgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold tracking-[0.01em] whitespace-nowrap",
        badgeTone[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const productBadgeLabel: Record<ProductBadge, string> = { new: "Новинка", sale: "Знижка", hit: "Хіт продажу" };

/** Badge of a product flag; pass `discount` to show "−15%" instead of «Знижка» */
export function ProductBadgeLabel({ badge, discount }: { badge: ProductBadge; discount?: number }) {
  return <Badge tone={badge}>{badge === "sale" && discount ? `−${discount}%` : productBadgeLabel[badge]}</Badge>;
}

const stockTone: Record<StockTone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  info: "text-brand-700",
  muted: "text-ink-3",
};

const stockDot: Record<StockTone, string> = {
  ok: "bg-ok",
  warn: "bg-[#e09a1a]",
  info: "bg-brand-600",
  muted: "bg-silver-400",
};

/** «В наявності» / «Закінчується» / «Під замовлення» / «Немає в наявності» with a status dot */
export function StockLabel({ stock, className }: { stock: StockStatus; className?: string }) {
  const { label, tone } = stockMeta[stock];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium", stockTone[tone], className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", stockDot[tone])} />
      {label}
    </span>
  );
}
