"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useToastStore, type Toast } from "@/lib/store";

const LIFETIME_MS = 4500;

function ToastCard({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  const Icon = toast.tone === "error" ? CircleAlert : CircleCheck;

  return (
    <div className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-card border border-line-soft bg-white p-4 shadow-pop">
      <Icon aria-hidden className={toast.tone === "error" ? "mt-0.5 size-5 text-danger" : "mt-0.5 size-5 text-ok"} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{toast.title}</p>
        {toast.description && <p className="mt-0.5 line-clamp-2 text-sm text-ink-3">{toast.description}</p>}
        {toast.action && (
          <Link
            href={toast.action.href}
            onClick={() => dismiss(toast.id)}
            className="link mt-1.5 inline-block text-sm font-semibold"
          >
            {toast.action.label}
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Закрити сповіщення"
        className="-mt-1 -mr-1 grid size-8 shrink-0 place-content-center rounded-full text-ink-3 transition-colors hover:bg-mist hover:text-ink"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/** Mounted once in the root layout; push with `toast({ title })` from "@/lib/store". */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:items-end lg:px-0"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} toast={item} dismiss={dismiss} />
      ))}
    </div>
  );
}
