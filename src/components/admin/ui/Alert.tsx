import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneConfig: Record<AlertTone, { wrap: string; icon: LucideIcon; iconClass: string }> = {
  info: { wrap: "border-brand-100 bg-brand-50", icon: Info, iconClass: "text-brand-600" },
  success: { wrap: "border-ok/20 bg-ok-soft", icon: CircleCheck, iconClass: "text-ok" },
  warning: { wrap: "border-warn/25 bg-warn-soft", icon: TriangleAlert, iconClass: "text-warn" },
  danger: { wrap: "border-danger/20 bg-danger-soft", icon: CircleAlert, iconClass: "text-danger" },
};

interface AlertProps {
  tone: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Inline message that explains what happened and what to do next. */
export function Alert({ tone, title, children, className }: AlertProps) {
  const { wrap, icon: Icon, iconClass } = toneConfig[tone];
  return (
    <div role="note" className={cn("flex gap-3 rounded-card border p-3.5 text-[14px] text-ink-2", wrap, className)}>
      <Icon aria-hidden className={cn("mt-px size-5 shrink-0", iconClass)} strokeWidth={1.75} />
      <div className="min-w-0">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}
