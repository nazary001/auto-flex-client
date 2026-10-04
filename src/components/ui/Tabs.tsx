"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Rendered on the server and passed in; hidden panels stay mounted */
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultId?: string;
  className?: string;
  /** Extra element on the right side of the tab list (e.g. a «Усі товари» link) */
  aside?: ReactNode;
}

export function Tabs({ items, defaultId, className, aside }: TabsProps) {
  const [active, setActive] = useState(defaultId ?? items[0]?.id);
  const baseId = useId();
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.id === active);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    setActive(items[next].id);
    tabRefs.current[items[next].id]?.focus();
  }

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-4 border-b border-line-soft">
        <div
          role="tablist"
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          className="scrollbar-none -mb-px flex gap-1 overflow-x-auto sm:gap-2"
        >
          {items.map((item) => {
            const selected = item.id === active;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[item.id] = node;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${item.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${item.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(item.id)}
                className={cn(
                  "border-b-2 px-3 pt-2 pb-3 text-[15px] font-semibold whitespace-nowrap transition-colors sm:px-4 sm:text-base",
                  selected
                    ? "border-brand-600 text-ink"
                    : "border-transparent text-ink-3 hover:border-line hover:text-ink",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {aside && <div className="hidden shrink-0 pb-3 sm:block">{aside}</div>}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== active}
          tabIndex={-1}
          className="pt-6"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
