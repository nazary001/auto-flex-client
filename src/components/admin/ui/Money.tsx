import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";

interface MoneyProps {
  value: number;
  className?: string;
  muted?: boolean;
}

/** Hryvnia amount in tabular figures, e.g. "1 965 ₴". */
export function Money({ value, className, muted }: MoneyProps) {
  return (
    <span className={cn("tabular whitespace-nowrap", muted ? "text-ink-3" : "text-ink", className)}>
      {formatPrice(value)}
    </span>
  );
}
