import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons / links shown on the right; they wrap under the title on phones */
  actions?: ReactNode;
  back?: { href: string; label: string };
  /** Status chips or badges shown next to the title */
  meta?: ReactNode;
  /** Secondary row under the header, e.g. saved views or a filter bar */
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, back, meta, children, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-5", className)}>
      {back && (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 transition-colors hover:text-brand-700"
        >
          <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-balance text-ink">{title}</h1>
            {meta}
          </div>
          {description && <p className="mt-1 max-w-2xl text-sm text-ink-3">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
