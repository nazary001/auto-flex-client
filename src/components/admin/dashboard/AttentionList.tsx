import Link from "next/link";
import {
  ChevronRight,
  CircleCheck,
  Clock,
  CreditCard,
  Inbox,
  PackageSearch,
  PauseCircle,
  Star,
  Timer,
  TrendingDown,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { AttentionItem } from "@/lib/admin/queries/dashboard";

/*
 * «Потребують уваги»: the operator's to-do list. Zero rows are filtered out by the query, so an
 * empty list means nothing is pressing.
 */

const iconFor: Record<string, LucideIcon> = {
  staleNew: Clock,
  needsSourcing: PackageSearch,
  overdue: Timer,
  inTransit: Truck,
  onHold: PauseCircle,
  payment: CreditCard,
  lowMargin: TrendingDown,
  requests: Inbox,
  reviews: Star,
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 px-4 py-4 text-sm text-ink-2 sm:px-5">
        <CircleCheck aria-hidden className="size-4 shrink-0 text-ok" strokeWidth={1.75} />
        Усе під контролем — нічого термінового.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line-soft">
      {items.map((item) => {
        const Icon = iconFor[item.key] ?? Clock;
        const warn = item.tone === "warn";
        const body = (
          <>
            <Icon
              aria-hidden
              strokeWidth={1.75}
              className={cn("size-4 shrink-0", warn ? "text-warn" : "text-ink-3")}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{item.label}</span>
            <span className={cn("tabular text-sm font-semibold", warn ? "text-warn" : "text-ink")}>{item.count}</span>
            {item.href && <ChevronRight aria-hidden className="size-4 shrink-0 text-silver-400" strokeWidth={1.75} />}
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link
                href={item.href}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-mist-soft sm:px-5"
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
