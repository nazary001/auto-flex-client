"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";
import { toast } from "@/lib/store";
import type { ActionResult } from "@/lib/admin/actions/_action";
import { ConfirmDialog } from "./ConfirmDialog";

interface ActionButtonProps {
  /** A bound server action returning an ActionResult (not a redirecting action) */
  action: () => Promise<ActionResult<unknown>>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  confirm?: { title: string; text?: string; confirmLabel?: string; tone?: "danger" | "primary" };
  successMessage?: string;
  /** Refresh the route after a successful action (default true) */
  refresh?: boolean;
  onSuccess?: (data: unknown) => void;
}

/** Runs a server action inside a transition, confirms first if asked, and toasts the outcome. */
export function ActionButton({
  action,
  children,
  variant,
  size,
  className,
  disabled,
  confirm,
  successMessage,
  refresh = true,
  onSuccess,
}: ActionButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function run() {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          if (successMessage) toast({ title: successMessage });
          onSuccess?.(result.data);
          if (refresh) router.refresh();
        } else {
          toast({ title: result.error, tone: "error" });
        }
      } catch {
        toast({ title: "Не вдалося виконати дію. Спробуйте ще раз.", tone: "error" });
      } finally {
        setConfirmOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        onClick={() => (confirm ? setConfirmOpen(true) : run())}
      >
        {children}
      </Button>
      {confirm && (
        <ConfirmDialog
          open={confirmOpen}
          title={confirm.title}
          text={confirm.text}
          confirmLabel={confirm.confirmLabel}
          tone={confirm.tone}
          pending={pending}
          onConfirm={run}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}
