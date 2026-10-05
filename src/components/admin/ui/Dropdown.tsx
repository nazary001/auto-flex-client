"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useEscape } from "@/lib/hooks";
import { useOutsidePointer } from "@/components/layout/use-dismiss";

export interface DropdownItem {
  label: string;
  href?: string;
  onSelect?: () => void;
  tone?: "default" | "danger";
  icon?: ReactNode;
  disabled?: boolean;
}

interface DropdownProps {
  /** Content of the trigger button */
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
  ariaLabel?: string;
  /** Classes for the trigger button */
  className?: string;
}

/** Keyboard-accessible menu: Esc closes, arrows move, outside pointer dismisses. */
export function Dropdown({ trigger, items, align = "right", ariaLabel, className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);

  useOutsidePointer(open, () => setOpen(false), [rootRef]);
  useEscape(open, () => {
    setOpen(false);
    triggerRef.current?.focus();
  });

  function focusItem(index: number) {
    if (items.length === 0) return;
    const next = (index + items.length) % items.length;
    itemRefs.current[next]?.focus();
  }

  function openMenu() {
    setOpen(true);
    requestAnimationFrame(() => focusItem(0));
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(items.length - 1);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={className}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "animate-drop-in absolute z-50 mt-1.5 min-w-52 overflow-hidden rounded-card border border-line-soft bg-white p-1 shadow-pop",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => {
            const base = cn(
              "flex w-full items-center gap-2.5 rounded-btn px-2.5 py-2 text-left text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
              item.tone === "danger"
                ? "text-danger hover:bg-danger-soft"
                : "text-ink-2 hover:bg-mist hover:text-ink",
            );
            const inner = (
              <>
                {item.icon && (
                  <span className="grid size-4 shrink-0 place-content-center text-ink-3 [&>svg]:size-4">{item.icon}</span>
                )}
                <span className="flex-1 truncate">{item.label}</span>
              </>
            );
            if (item.href && !item.disabled) {
              return (
                <Link
                  key={index}
                  href={item.href}
                  role="menuitem"
                  tabIndex={-1}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={base}
                  onClick={() => setOpen(false)}
                >
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={index}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                className={base}
                onClick={() => {
                  item.onSelect?.();
                  setOpen(false);
                }}
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
