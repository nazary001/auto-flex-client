"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/store";

/** Desktop header action «Обране» with a hydration-safe count badge (hidden at 0). */
export function FavoritesLink() {
  const { count } = useFavorites();
  return (
    <Link
      href="/favorites"
      aria-label={count > 0 ? `Обране, ${count}` : "Обране"}
      className="group flex w-[4.25rem] flex-col items-center gap-1 rounded-btn px-1 py-1.5 text-[11px] font-medium text-ink-2 transition-colors hover:bg-mist hover:text-brand-700"
    >
      <span className="relative">
        <Heart aria-hidden className="size-6" strokeWidth={1.75} />
        {count > 0 && (
          <span className="tabular absolute -top-2 -right-2.5 grid h-[18px] min-w-[18px] place-content-center rounded-full bg-brand-600 px-1 text-[11px] leading-none font-bold text-white ring-2 ring-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      Обране
    </Link>
  );
}
