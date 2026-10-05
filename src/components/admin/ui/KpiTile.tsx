import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

type KpiTone = "default" | "warn" | "danger" | "ok";

const valueTone: Record<KpiTone, string> = {
  default: "text-ink",
  warn: "text-warn",
  danger: "text-danger",
  ok: "text-ok",
};

interface KpiTileProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  /** Change vs. the previous period; positive is green, negative red */
  delta?: { value: number; label?: string };
  href?: string;
  tone?: KpiTone;
}

/** A single metric: big tabular value, optional signed delta and a muted note. No gradient. */
export function KpiTile({ label, value, hint, delta, href, tone = "default" }: KpiTileProps) {
  const note = delta?.label ?? hint;
  const inner = (
    <>
      <p className="text-[13px] font-medium text-ink-3">{label}</p>
      <p className={cn("tabular mt-1.5 text-[28px] leading-8 font-semibold", valueTone[tone])}>{value}</p>
      {(delta?.value || note) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
          {delta && delta.value !== 0 && (
            <span
              className={cn(
                "tabular inline-flex items-center gap-0.5 font-semibold",
                delta.value > 0 ? "text-ok" : "text-danger",
              )}
            >
              {delta.value > 0 ? (
                <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={2} />
              ) : (
                <ArrowDownRight aria-hidden className="size-3.5" strokeWidth={2} />
              )}
              {formatNumber(Math.abs(delta.value))}
            </span>
          )}
          {note && <span className="text-ink-3">{note}</span>}
        </div>
      )}
    </>
  );

  const base = "block rounded-card border border-line-soft bg-white px-4 py-3.5";
  if (href) {
    return (
      <Link href={href} className={cn(base, "transition-colors hover:border-line hover:bg-mist-soft")}>
        {inner}
      </Link>
    );
  }
  return <div className={base}>{inner}</div>;
}
