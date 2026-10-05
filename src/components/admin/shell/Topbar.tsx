"use client";

import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { can } from "@/lib/admin/permissions";
import type { AdminUser } from "@/lib/admin/types";
import { buttonClass } from "@/components/ui/Button";
import { GlobalSearch } from "./GlobalSearch";
import { UserMenu } from "./UserMenu";

interface TopbarProps {
  user: AdminUser;
  onOpenMenu: () => void;
}

export function Topbar({ user, onOpenMenu }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line-soft bg-white px-4 sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Відкрити меню"
        className="grid size-9 shrink-0 place-content-center rounded-btn text-ink-2 transition-colors hover:bg-mist lg:hidden"
      >
        <Menu aria-hidden className="size-5" strokeWidth={1.75} />
      </button>

      <div className="min-w-0 flex-1">
        <GlobalSearch />
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {can(user, "orders:write") && (
          <Link href="/admin/orders/new" className={buttonClass({ size: "sm" })}>
            <Plus aria-hidden className="size-4" strokeWidth={2} />
            <span className="hidden sm:inline">Замовлення</span>
          </Link>
        )}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
