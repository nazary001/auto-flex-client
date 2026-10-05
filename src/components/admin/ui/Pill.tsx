import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { BadgeTone } from "@/lib/admin/labels";

export type PillTone = BadgeTone | "neutral";

/* One soft tint per status tone: a tinted background with dark, legible text. */
const toneClass: Record<PillTone, string> = {
  blue: "bg-brand-50 text-brand-700",
  teal: "bg-teal-soft text-teal",
  violet: "bg-violet-soft text-violet",
  amber: "bg-warn-soft text-warn",
  green: "bg-ok-soft text-ok",
  slate: "bg-mist text-ink-2",
  red: "bg-danger-soft text-danger",
  rose: "bg-rose-soft text-rose",
  neutral: "bg-mist text-ink-2",
};

const dotClass: Record<PillTone, string> = {
  blue: "bg-brand-500",
  teal: "bg-teal",
  violet: "bg-violet",
  amber: "bg-warn",
  green: "bg-ok",
  slate: "bg-silver-400",
  red: "bg-danger",
  rose: "bg-rose",
  neutral: "bg-silver-400",
};

interface PillProps {
  tone?: PillTone;
  size?: "sm" | "md";
  withDot?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}

/** Status chip used by StatusBadge and anywhere a small tinted label fits. */
export function Pill({ tone = "neutral", size = "md", withDot = false, title, className, children }: PillProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-xs",
        toneClass[tone],
        className,
      )}
    >
      {withDot && <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dotClass[tone])} />}
      {children}
    </span>
  );
}
