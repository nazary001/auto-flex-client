"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast, useFavorites } from "@/lib/store";

interface FavoriteButtonProps {
  productId: string;
  /** Product name for the accessible label and the toast */
  name: string;
  /** "icon" — round icon button (cards); "labeled" — icon with «В обране» text (product page) */
  variant?: "icon" | "labeled";
  className?: string;
}

export function FavoriteButton({ productId, name, variant = "icon", className }: FavoriteButtonProps) {
  const { has, toggle } = useFavorites();
  const active = has(productId);

  function onClick() {
    toggle(productId);
    if (!active) {
      toast({ title: "Додано в обране", description: name, action: { label: "Перейти до обраного", href: "/favorites" } });
    }
  }

  if (variant === "labeled") {
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-2 text-sm font-semibold transition-colors",
          active ? "text-brand-700" : "text-ink-2 hover:text-brand-700",
          className,
        )}
      >
        <Heart aria-hidden className={cn("size-5", active && "fill-brand-600 text-brand-600")} strokeWidth={1.75} />
        {active ? "В обраному" : "В обране"}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Прибрати з обраного: ${name}` : `Додати в обране: ${name}`}
      onClick={onClick}
      className={cn(
        "grid size-9 place-content-center rounded-full bg-white/90 text-ink-3 shadow-[0_1px_3px_rgb(0_16_38/0.12)] backdrop-blur-sm transition-colors hover:text-brand-600",
        active && "text-brand-600",
        className,
      )}
    >
      <Heart aria-hidden className={cn("size-[18px]", active && "fill-brand-600")} strokeWidth={1.75} />
    </button>
  );
}
