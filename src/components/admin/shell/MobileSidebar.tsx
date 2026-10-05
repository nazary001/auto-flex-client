"use client";

import { Drawer } from "@/components/ui/Drawer";
import type { AdminUser } from "@/lib/admin/types";
import type { SidebarCounts } from "@/lib/server/db/repos/stats";
import { Sidebar } from "./Sidebar";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  user: AdminUser;
  counts: SidebarCounts;
}

/** The sidebar as an off-canvas drawer below `lg`. */
export function MobileSidebar({ open, onClose, user, counts }: MobileSidebarProps) {
  return (
    <Drawer open={open} onClose={onClose} title="Меню" side="left">
      <Sidebar user={user} counts={counts} showBrand={false} onNavigate={onClose} />
    </Drawer>
  );
}
