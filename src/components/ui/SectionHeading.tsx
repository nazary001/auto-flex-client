import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SlashMark } from "@/components/brand/Graphics";
import { cn } from "@/lib/cn";

interface SectionHeadingProps {
  title: string;
  description?: ReactNode;
  /** Link on the right, e.g. { label: "Усі категорії", href: "/catalog" } */
  action?: { label: string; href: string };
  as?: "h1" | "h2" | "h3";
  onDark?: boolean;
  className?: string;
}

/** Section title with the slanted brand mark */
export function SectionHeading({ title, description, action, as: Tag = "h2", onDark = false, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-2", className)}>
      <div className="min-w-0">
        <Tag
          className={cn(
            "flex items-center gap-3 text-[1.375rem] leading-tight font-bold tracking-tight sm:text-[1.625rem]",
            onDark ? "text-white" : "text-ink",
          )}
        >
          <SlashMark onDark={onDark} className="text-[0.95em]" />
          {title}
        </Tag>
        {description && (
          <p className={cn("mt-2 max-w-2xl text-[15px]", onDark ? "text-white/70" : "text-ink-3")}>{description}</p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className={cn(
            "group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors",
            onDark ? "text-brand-300 hover:text-white" : "text-brand-600 hover:text-brand-800",
          )}
        >
          {action.label}
          <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
