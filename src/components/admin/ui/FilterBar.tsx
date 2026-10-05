import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { AutoSubmit } from "./AutoSubmit";

interface FilterBarProps {
  /** GET endpoint, e.g. "/admin/orders" */
  action: string;
  children: ReactNode;
  /** Link that clears every filter */
  resetHref?: string;
  /** Params to carry through untouched (e.g. a saved view) */
  hidden?: Record<string, string>;
  className?: string;
}

/** A GET form that lays its fields out in a wrapping row with apply/reset controls. */
export function FilterBar({ action, children, resetHref, hidden, className }: FilterBarProps) {
  return (
    <form method="get" action={action} className={cn("flex flex-wrap items-center gap-2", className)}>
      {hidden &&
        Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" size="sm">
          Застосувати
        </Button>
        {resetHref && (
          <Link
            href={resetHref}
            className="px-1 text-sm font-medium text-ink-3 transition-colors hover:text-brand-700"
          >
            Скинути
          </Link>
        )}
      </div>
    </form>
  );
}

interface FilterSelectProps {
  name: string;
  value?: string;
  options: { value: string; label: string }[];
  /** Label for the "any" option; omit to require a choice */
  allLabel?: string;
  autoSubmit?: boolean;
  ariaLabel?: string;
}

export function FilterSelect({ name, value, options, allLabel, autoSubmit, ariaLabel }: FilterSelectProps) {
  const select = (
    <select
      name={name}
      defaultValue={value ?? ""}
      aria-label={ariaLabel ?? allLabel ?? name}
      className="field field-sm w-auto min-w-36"
    >
      {allLabel !== undefined && <option value="">{allLabel}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
  return autoSubmit ? <AutoSubmit>{select}</AutoSubmit> : select;
}

interface FilterInputProps {
  name: string;
  value?: string;
  placeholder?: string;
  type?: string;
  ariaLabel?: string;
  className?: string;
}

export function FilterInput({ name, value, placeholder, type = "search", ariaLabel, className }: FilterInputProps) {
  return (
    <input
      type={type}
      name={name}
      defaultValue={value}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder ?? name}
      className={cn("field field-sm w-auto min-w-48", className)}
    />
  );
}

export function FilterDateRange({ from, to }: { from?: string; to?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="date" name="from" defaultValue={from} aria-label="Дата від" className="field field-sm w-auto" />
      <span aria-hidden className="text-ink-3">
        –
      </span>
      <input type="date" name="to" defaultValue={to} aria-label="Дата до" className="field field-sm w-auto" />
    </div>
  );
}
