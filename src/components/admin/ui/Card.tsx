import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Pad the body (default). Set false for edge-to-edge content such as a table. */
  padded?: boolean;
  footer?: ReactNode;
}

/** White surface with a hairline border; the header shows only when a title or actions are given. */
export function Card({ title, description, actions, children, className, padded = true, footer }: CardProps) {
  const hasHeader = Boolean(title || actions);
  return (
    <section className={cn("rounded-card border border-line-soft bg-white", className)}>
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line-soft px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] leading-5 font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && "px-4 py-4 sm:px-5")}>{children}</div>
      {footer && <footer className="border-t border-line-soft px-4 py-3 sm:px-5">{footer}</footer>}
    </section>
  );
}
