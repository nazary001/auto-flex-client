"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLockBodyScroll } from "@/lib/hooks";

const sides = {
  left: "top-0 bottom-0 left-0 right-auto h-dvh max-h-none w-[min(88vw,22.5rem)] open:animate-slide-in-left",
  right: "top-0 bottom-0 right-0 left-auto h-dvh max-h-none w-[min(88vw,22.5rem)] open:animate-slide-in-right",
  bottom: "top-auto bottom-0 left-0 right-0 max-h-[88dvh] w-full rounded-t-2xl open:animate-slide-in-up",
} as const;

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: keyof typeof sides;
  children: ReactNode;
  /** Pinned to the bottom edge (e.g. an «Показати товари» button) */
  footer?: ReactNode;
  className?: string;
}

/** Off-canvas panel on a native <dialog>: focus trap, Esc and backdrop click close it. */
export function Drawer({ open, onClose, title, side = "left", children, footer, className }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLockBodyScroll(open);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "fixed m-0 max-w-none bg-white p-0 text-ink shadow-pop backdrop:bg-navy-950/60 backdrop:backdrop-blur-[2px]",
        sides[side],
        className,
      )}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line-soft px-4 py-3">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрити"
              className="-mr-1.5 grid size-10 place-content-center rounded-full text-ink-3 transition-colors hover:bg-mist hover:text-ink"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {footer && <div className="shrink-0 border-t border-line-soft p-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
