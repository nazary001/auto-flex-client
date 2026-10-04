import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface AccordionItem {
  title: string;
  content: ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  /** Give a name to make the group exclusive (one open item at a time) */
  name?: string;
  className?: string;
}

/** Built on <details>, works without JavaScript */
export function Accordion({ items, name, className }: AccordionProps) {
  return (
    <div className={cn("divide-y divide-line-soft rounded-card border border-line-soft bg-white", className)}>
      {items.map((item) => (
        <details key={item.title} name={name} className="group">
          <summary className="flex items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold text-ink transition-colors hover:text-brand-700 sm:text-base">
            {item.title}
            <ChevronDown
              aria-hidden
              className="size-5 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <div className="px-5 pb-5 text-[15px] leading-relaxed text-ink-2">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
