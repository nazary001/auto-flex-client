import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  text?: ReactNode;
  /** Usually a button-styled link */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, text, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative isolate grid justify-items-center gap-3 overflow-hidden rounded-card border border-line-soft bg-mist-soft px-6 py-14 text-center",
        className,
      )}
    >
      <span aria-hidden className="halftone absolute -right-2 -bottom-2 -z-10 size-56 text-brand-300" />
      <span className="grid size-14 place-content-center rounded-full bg-white text-brand-700 shadow-card [&>svg]:size-6">
        {icon}
      </span>
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      {text && <p className="max-w-md text-[15px] text-ink-3">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
