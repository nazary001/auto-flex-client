import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { BadgeTone } from "@/lib/admin/labels";
import { DateTime } from "./DateTime";

type TimelineTone = BadgeTone | "neutral";

const dotClass: Record<TimelineTone, string> = {
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

export interface TimelineItem {
  id: string;
  /** ISO-8601 timestamp */
  at: string;
  title: ReactNode;
  text?: ReactNode;
  actor?: string;
  tone?: TimelineTone;
  icon?: ReactNode;
}

interface TimelineProps {
  items: TimelineItem[];
  /** "asc" oldest first (default), "desc" newest first */
  order?: "asc" | "desc";
}

/** Vertical activity feed with a connecting rail; one dot (or icon) per entry. */
export function Timeline({ items, order = "asc" }: TimelineProps) {
  const ordered = order === "desc" ? [...items].reverse() : items;
  return (
    <ol className="space-y-4">
      {ordered.map((item, index) => {
        const last = index === ordered.length - 1;
        return (
          <li key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              {item.icon ? (
                <span className="grid size-5 shrink-0 place-content-center rounded-full bg-mist text-ink-3 [&>svg]:size-3.5">
                  {item.icon}
                </span>
              ) : (
                <span
                  aria-hidden
                  className={cn("mt-1 size-2.5 shrink-0 rounded-full ring-4 ring-white", dotClass[item.tone ?? "neutral"])}
                />
              )}
              {!last && <span aria-hidden className="mt-1 w-px flex-1 bg-line-soft" />}
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-medium text-ink">{item.title}</p>
                <DateTime iso={item.at} mode="relative" className="shrink-0 text-[12.5px] text-ink-3" />
              </div>
              {item.text && <div className="mt-0.5 text-[13px] text-ink-2">{item.text}</div>}
              {item.actor && <p className="mt-0.5 text-[12.5px] text-ink-3">{item.actor}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
