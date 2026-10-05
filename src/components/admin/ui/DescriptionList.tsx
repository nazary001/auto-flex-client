import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface DescriptionListProps {
  items: { label: ReactNode; value: ReactNode }[];
  columns?: 1 | 2;
  className?: string;
}

/** Label/value pairs for the facts panels on a detail page. */
export function DescriptionList({ items, columns = 1, className }: DescriptionListProps) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 2 && "sm:grid-cols-2", className)}>
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-baseline gap-3">
          <dt className="text-[13px] text-ink-3">{item.label}</dt>
          <dd className="min-w-0 text-sm text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
