"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  text?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** A small confirm/cancel dialog on top of the shared Modal. */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = "Підтвердити",
  tone = "primary",
  pending,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-sm">
      {text && <div className="text-[15px] leading-6 text-ink-2">{text}</div>}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={pending}>
          Скасувати
        </Button>
        {tone === "danger" ? (
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending || undefined}
            className={cn("btn adm-btn-danger")}
          >
            {confirmLabel}
          </button>
        ) : (
          <Button onClick={onConfirm} disabled={pending} aria-busy={pending || undefined}>
            {confirmLabel}
          </Button>
        )}
      </div>
    </Modal>
  );
}
