"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { infoNavGroups, infoPages } from "@/components/info/pages";

/**
 * Navigation for the information pages. On desktop — a sticky, grouped side list
 * with the current page highlighted; on phones — a horizontal pill scroller.
 */
export function InfoNav() {
  const pathname = usePathname();

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      {/* Phones: horizontal scroller */}
      <nav aria-label="Інформаційні сторінки" className="lg:hidden">
        <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {infoPages.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors",
                    active
                      ? "border-brand-600 bg-brand-600 font-semibold text-white"
                      : "border-line bg-white text-ink-2 hover:border-brand-300 hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: grouped list */}
      <nav aria-label="Інформаційні сторінки" className="hidden lg:block">
        <div className="space-y-6">
          {infoNavGroups.map((group) => (
            <div key={group.title}>
              <p className="px-3 text-[13px] font-semibold text-ink-3">{group.title}</p>
              <ul className="mt-2 space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative block rounded-btn px-3 py-2 text-[14px] transition-colors",
                          active
                            ? "bg-brand-50 font-semibold text-brand-700"
                            : "text-ink-2 hover:bg-mist hover:text-ink",
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-600"
                          />
                        )}
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}
