import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import { Toaster } from "@/components/ui/Toaster";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { getSidebarCounts } from "@/lib/server/db/repos/stats";

/** Authenticated area: resolves the user and sidebar counts, then renders the shell. */
export default async function ShellLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const db = await getDb();
  const counts = await getSidebarCounts(db);

  return (
    <>
      <AdminShell user={user} counts={counts}>
        {children}
      </AdminShell>
      <Toaster />
    </>
  );
}
