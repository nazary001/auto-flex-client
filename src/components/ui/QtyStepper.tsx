"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { MAX_QTY } from "@/lib/store";

interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  /** Accessible name of the product, used in button labels */
  label?: string;
}

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = MAX_QTY,
  size = "md",
  disabled = false,
  className,
  label = "товару",
}: QtyStepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const box = size === "sm" ? "h-9" : "h-11";
  const btn = size === "sm" ? "w-8" : "w-10";

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-stretch rounded-btn border border-line bg-white",
        disabled && "opacity-60",
        box,
        className,
      )}
    >
      <button
        type="button"
        aria-label={`Зменшити кількість ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
        className={cn(
          "grid place-content-center rounded-l-btn text-ink-2 transition-colors hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:text-silver-300 disabled:hover:bg-transparent",
          btn,
        )}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        aria-label={`Кількість ${label}`}
        disabled={disabled}
        value={value}
        onChange={(event) => {
          const next = Number.parseInt(event.target.value, 10);
          if (!Number.isNaN(next)) onChange(clamp(next));
        }}
        onFocus={(event) => event.target.select()}
        className={cn(
          "tabular w-9 border-x border-line-soft bg-transparent text-center font-semibold text-ink focus:outline-none focus-visible:bg-brand-50",
          size === "sm" ? "text-sm" : "text-[15px]",
        )}
      />
      <button
        type="button"
        aria-label={`Збільшити кількість ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
        className={cn(
          "grid place-content-center rounded-r-btn text-ink-2 transition-colors hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:text-silver-300 disabled:hover:bg-transparent",
          btn,
        )}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
