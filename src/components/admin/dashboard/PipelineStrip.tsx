import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { orderStatusMeta, type BadgeTone } from "@/lib/admin/labels";
import type { OrderStatus } from "@/lib/admin/types";
import type { StatusCounts } from "@/lib/server/db/repos/orders";
import { Pill } from "@/components/admin/ui";

/*
 * The pipeline strip — the one bold element of the dashboard. The order flow reads left to right
 * as connected, soft-tinted blocks that double as status filters; the off-flow statuses
 * (on hold / cancelled / returned) sit below as small pills. Scrolls horizontally with snap on
 * phones.
 */

const FLOW: OrderStatus[] = ["new", "confirmed", "sourcing", "in_transit", "delivered", "completed"];
const ASIDE: OrderStatus[] = ["on_hold", "cancelled", "returned"];

const softTone: Record<BadgeTone, string> = {
  blue: "bg-brand-50 text-brand-700",
  teal: "bg-teal-soft text-teal",
  violet: "bg-violet-soft text-violet",
  amber: "bg-warn-soft text-warn",
  green: "bg-ok-soft text-ok",
  slate: "bg-mist text-ink-2",
  red: "bg-danger-soft text-danger",
  rose: "bg-rose-soft text-rose",
};

interface PipelineStripProps {
  counts: StatusCounts;
  /** Optional caption shown under the strip, e.g. a total */
  totalLabel?: string;
}

export function PipelineStrip({ counts, totalLabel }: PipelineStripProps) {
  return (
    <div>
      <div className="adm-scroll-x -mx-1 snap-x px-1">
        <ol className="flex min-w-max items-stretch gap-1 sm:min-w-0">
          {FLOW.map((status, i) => {
            const meta = orderStatusMeta[status];
            const { count, total } = counts[status];
            return (
              <Fragment key={status}>
                <li className="w-[7.5rem] shrink-0 snap-start sm:w-auto sm:flex-1">
                  <Link
                    href={`/admin/orders?status=${status}`}
                    className={cn(
                      "flex h-full flex-col gap-0.5 rounded-lg px-3 py-2.5 transition-shadow hover:shadow-card",
                      softTone[meta.tone],
                    )}
                  >
                    <span className="text-[12.5px] leading-4 font-medium">{meta.label}</span>
                    <span className="tabular text-[20px] leading-6 font-semibold">{count}</span>
                    <span className="tabular text-[12px] leading-4 opacity-75">{formatPrice(total)}</span>
                  </Link>
                </li>
                {i < FLOW.length - 1 && (
                  <li aria-hidden className="flex shrink-0 items-center">
                    <span className="h-0.5 w-2 rounded-full bg-line-soft" />
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ASIDE.map((status) => {
          const meta = orderStatusMeta[status];
          return (
            <Link key={status} href={`/admin/orders?status=${status}`} className="rounded-full transition-opacity hover:opacity-80">
              <Pill tone={meta.tone} withDot>
                {meta.label}
                <span className="tabular font-semibold">{counts[status].count}</span>
              </Pill>
            </Link>
          );
        })}
        {totalLabel && <span className="ml-auto text-[12.5px] text-ink-3">{totalLabel}</span>}
      </div>
    </div>
  );
}
