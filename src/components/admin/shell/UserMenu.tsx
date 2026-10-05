"use client";

import { useTransition } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { roleLabel } from "@/lib/admin/labels";
import { logoutAction } from "@/lib/admin/actions/auth";
import type { AdminUser } from "@/lib/admin/types";
import { Dropdown } from "@/components/admin/ui";
import { initials } from "./nav";

/** Topbar account menu: profile link and logout. */
export function UserMenu({ user }: { user: AdminUser }) {
  const [, startTransition] = useTransition();

  return (
    <Dropdown
      ariaLabel="Меню користувача"
      align="right"
      className="flex items-center gap-2 rounded-btn py-1 pr-2 pl-1 transition-colors hover:bg-mist"
      trigger={
        <>
          <span className="grid size-8 shrink-0 place-content-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-700">
            {initials(user.name)}
          </span>
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block max-w-40 truncate text-[13px] leading-4 font-medium text-ink">{user.name}</span>
            <span className="block text-[11px] text-ink-3">{roleLabel[user.role]}</span>
          </span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={1.75} />
        </>
      }
      items={[
        { label: "Мій профіль", href: "/admin/users/me", icon: <UserRound /> },
        {
          label: "Вийти",
          icon: <LogOut />,
          tone: "danger",
          onSelect: () => startTransition(() => void logoutAction()),
        },
      ]}
    />
  );
}
