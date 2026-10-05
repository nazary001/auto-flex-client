"use client";

import { useState, type ReactNode } from "react";
import type { AdminUser } from "@/lib/admin/types";
import type { SidebarCounts } from "@/lib/server/db/repos/stats";
import { MobileSidebar } from "./MobileSidebar";
import { RefreshOnFocus } from "./RefreshOnFocus";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AdminShellProps {
  user: AdminUser;
  counts: SidebarCounts;
  children: ReactNode;
}

/** The back-office frame: fixed sidebar (drawer on small screens), topbar and content area. */
export function AdminShell({ user, counts, children }: AdminShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="adm-shell flex w-full flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 self-start lg:block">
        <Sidebar user={user} counts={counts} />
      </aside>

      <MobileSidebar open={menuOpen} onClose={() => setMenuOpen(false)} user={user} counts={counts} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onOpenMenu={() => setMenuOpen(true)} />
        <main className="adm-content mx-auto w-full max-w-[90rem] flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        <RefreshOnFocus />
      </div>
    </div>
  );
}
