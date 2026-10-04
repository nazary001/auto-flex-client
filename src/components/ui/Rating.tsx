import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { pluralUk } from "@/lib/format";

interface RatingProps {
  /** 0–5 */
  value: number;
  /** Number of reviews; omit to hide the counter */
  count?: number;
  size?: "sm" | "md";
  className?: string;
}

/** Five stars with a fractional fill, e.g. 4.6 */
export function Rating({ value, count, size = "sm", className }: RatingProps) {
  const star = size === "sm" ? "size-3.5" : "size-[18px]";
  const percent = Math.max(0, Math.min(100, (value / 5) * 100));
  const label =
    count === 0 || value === 0
      ? "Ще немає відгуків"
      : `Оцінка ${value.toFixed(1).replace(".", ",")} з 5${
          count ? `, ${count} ${pluralUk(count, ["відгук", "відгуки", "відгуків"])}` : ""
        }`;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} role="img" aria-label={label}>
      <span className="relative inline-flex" aria-hidden>
        <span className="flex gap-0.5 text-line">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} className={star} fill="currentColor" strokeWidth={0} />
          ))}
        </span>
        <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${percent}%` }}>
          <span className="flex w-max gap-0.5 text-[#f2a100]">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className={star} fill="currentColor" strokeWidth={0} />
            ))}
          </span>
        </span>
      </span>
      {count !== undefined && (
        <span aria-hidden className={cn("text-ink-3 tabular", size === "sm" ? "text-xs" : "text-sm")}>
          {count > 0 ? count : "0"}
        </span>
      )}
    </span>
  );
}
