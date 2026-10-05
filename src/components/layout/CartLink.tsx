"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/cn";
import { countUk } from "@/lib/format";
import { useCart } from "@/lib/store";

const CART_FORMS: [string, string, string] = ["товар", "товари", "товарів"];

/** Mobile header cart icon → /cart with a hydration-safe count badge. */
export function CartLink({ className }: { className?: string }) {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Кошик, ${countUk(count, CART_FORMS)}` : "Кошик порожній"}
      className={cn(
        "relative grid size-10 place-content-center rounded-full text-ink transition-colors hover:bg-mist hover:text-brand-700",
        className,
      )}
    >
      <ShoppingCart aria-hidden className="size-6" strokeWidth={1.75} />
      {count > 0 && (
        <span key={count} className="animate-bump tabular absolute top-0.5 right-0.5 grid h-[18px] min-w-[18px] place-content-center rounded-full bg-brand-600 px-1 text-[11px] leading-none font-bold text-white ring-2 ring-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
