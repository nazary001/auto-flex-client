import Link from "next/link";
import { DateTime } from "@/components/admin/ui";
import type { ActivityItem } from "@/lib/admin/queries/dashboard";

/* The latest order-timeline events across every order, newest first. */

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-ink-3 sm:px-5">Поки немає подій.</p>;
  }

  return (
    <ul className="divide-y divide-line-soft">
      {items.map((a) => (
        <li key={a.id} className="px-4 py-2.5 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-[13px] text-ink-2">{a.text}</p>
            <DateTime iso={a.at} mode="relative" className="shrink-0 text-[12px] text-ink-3" />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-3">
            {a.orderNumber && (
              <Link href={`/admin/orders/${a.orderId}`} className="link tabular font-medium">
                {a.orderNumber}
              </Link>
            )}
            <span>· {a.actorName}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
