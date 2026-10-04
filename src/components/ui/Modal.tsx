"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLockBodyScroll } from "@/lib/hooks";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Width utility, default `max-w-md` */
  className?: string;
}

/** Native <dialog>: focus trap, Esc and backdrop click close it. */
export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
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
        "w-[calc(100vw-2rem)] rounded-2xl bg-white p-0 text-ink shadow-pop backdrop:bg-navy-950/60 backdrop:backdrop-blur-[2px] open:animate-fade-in",
        className ?? "max-w-md",
      )}
    >
      {open && (
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-xl font-bold leading-tight">
                {title}
              </h2>
              {description && <p className="mt-1.5 text-[15px] text-ink-3">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрити"
              className="-mt-1 -mr-2 grid size-9 shrink-0 place-content-center rounded-full text-ink-3 transition-colors hover:bg-mist hover:text-ink"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <div className="mt-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}
