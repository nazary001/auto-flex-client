"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, House, LayoutGrid, ShoppingCart, User, type LucideProps } from "lucide-react";
import { cn } from "@/lib/cn";
import { useCart, useFavorites } from "@/lib/store";

interface Tab {
  href: string;
  label: string;
  icon: ComponentType<LucideProps>;
  badge?: "cart" | "favorites";
}

const tabs: Tab[] = [
  { href: "/", label: "Головна", icon: House },
  { href: "/catalog", label: "Каталог", icon: LayoutGrid },
  { href: "/favorites", label: "Обране", icon: Heart, badge: "favorites" },
  { href: "/cart", label: "Кошик", icon: ShoppingCart, badge: "cart" },
  { href: "/account", label: "Кабінет", icon: User },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Fixed bottom navigation on phones (< lg). Hidden on desktop. */
export function BottomTabBar() {
  const pathname = usePathname();
  const { count: cartCount } = useCart();
  const { count: favCount } = useFavorites();

  return (
    <nav
      aria-label="Швидка навігація"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-white/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid h-16 grid-cols-5">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          const count = tab.badge === "cart" ? cartCount : tab.badge === "favorites" ? favCount : 0;
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-brand-700" : "text-ink-3 hover:text-ink",
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-6" strokeWidth={active ? 2 : 1.75} />
                  {count > 0 && (
                    <span key={count} className="animate-bump tabular absolute -top-1.5 -right-2.5 grid h-[17px] min-w-[17px] place-content-center rounded-full bg-brand-600 px-1 text-[10px] leading-none font-bold text-white ring-2 ring-white">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
