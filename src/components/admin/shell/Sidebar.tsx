import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { roleLabel } from "@/lib/admin/labels";
import { logoutAction } from "@/lib/admin/actions/auth";
import type { AdminUser } from "@/lib/admin/types";
import type { SidebarCounts } from "@/lib/server/db/repos/stats";
import { initials } from "./nav";
import { SidebarNav } from "./SidebarNav";

interface SidebarProps {
  user: AdminUser;
  counts: SidebarCounts;
  /** Show the brand header (desktop). Off in the mobile drawer, which has its own header. */
  showBrand?: boolean;
  onNavigate?: () => void;
}

/** Navy navigation column: brand, grouped nav, and a user chip with logout pinned to the bottom. */
export function Sidebar({ user, counts, showBrand = true, onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-navy-900 text-white">
      {showBrand && (
        <div className="flex h-14 shrink-0 items-center px-4">
          <Link
            href="/admin"
            onClick={onNavigate}
            aria-label="AutoFlex — адмінка"
            className="flex items-center gap-2 rounded-btn"
          >
            <Logo variant="dark" title={false} className="h-6 w-auto" />
            <span className="text-[13px] font-semibold text-white/55">Адмінка</span>
          </Link>
        </div>
      )}

      <div className="adm-scroll-y min-h-0 flex-1">
        <SidebarNav user={user} counts={counts} onNavigate={onNavigate} />
      </div>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-content-center rounded-full bg-white/10 text-[13px] font-semibold text-brand-300">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-[12px] text-white/50">{roleLabel[user.role]}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Вийти"
              className="grid size-9 place-content-center rounded-btn text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut aria-hidden className="size-[1.1rem]" strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
