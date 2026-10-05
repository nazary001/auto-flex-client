"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { can } from "@/lib/admin/permissions";
import type { AdminUser } from "@/lib/admin/types";
import type { SidebarCounts } from "@/lib/server/db/repos/stats";
import { NAV_GROUPS } from "./nav";
import { navIcon } from "./nav-icons";

interface SidebarNavProps {
  user: AdminUser;
  counts: SidebarCounts;
  /** Called after a link is clicked, e.g. to close the mobile drawer */
  onNavigate?: () => void;
}

/** Grouped navigation with active state, permission filtering and badge counts. */
export function SidebarNav({ user, counts, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean): boolean {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="space-y-5 px-3 py-4">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) => !item.permission || can(user, item.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.title}>
            <p className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.04em] text-white/35">{group.title}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const Icon = navIcon(item.icon);
                const active = isActive(item.href, item.exact);
                const badge = item.badge ? counts[item.badge] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-btn px-2.5 py-2 text-sm font-medium transition-colors",
                        active ? "bg-white/10 text-brand-300" : "text-white/70 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon
                        aria-hidden
                        className={cn(
                          "size-[1.1rem] shrink-0",
                          active ? "text-brand-300" : "text-white/55 group-hover:text-white/80",
                        )}
                        strokeWidth={1.75}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge > 0 && (
                        <span
                          className={cn(
                            "tabular grid h-5 min-w-5 place-content-center rounded-full px-1.5 text-[11px] font-semibold",
                            active ? "bg-brand-500 text-white" : "bg-white/10 text-white/80",
                          )}
                        >
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
