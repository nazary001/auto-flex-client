import type { Metadata } from "next";
import { type Column, DataTable, DateTime, PageHeader, Pill } from "@/components/admin/ui";
import { CreateUserButton } from "@/components/admin/users/CreateUserButton";
import { UserRowActions } from "@/components/admin/users/UserRowActions";
import { roleLabel } from "@/lib/admin/labels";
import { can } from "@/lib/admin/permissions";
import type { AdminUser } from "@/lib/admin/types";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { countActiveOwners, listUsers } from "@/lib/server/db/repos/users";

export const metadata: Metadata = { title: "Користувачі" };

export default async function UsersPage() {
  const user = await requireUser("users:read");
  const db = await getDb();
  const [users, activeOwners] = await Promise.all([listUsers(db), countActiveOwners(db)]);
  const canWrite = can(user, "users:write");

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      header: "Ім'я",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{row.name}</p>
          {row.id === user.id && <p className="text-[12px] text-ink-3">це ви</p>}
        </div>
      ),
    },
    { key: "email", header: "Пошта", render: (row) => <span className="tabular text-ink-2">{row.email}</span> },
    { key: "role", header: "Роль", render: (row) => roleLabel[row.role] },
    {
      key: "active",
      header: "Статус",
      render: (row) => (
        <Pill tone={row.active ? "green" : "slate"} size="sm">
          {row.active ? "Активний" : "Вимкнено"}
        </Pill>
      ),
    },
    {
      key: "lastLoginAt",
      header: "Останній вхід",
      hideBelow: "md",
      render: (row) =>
        row.lastLoginAt ? <DateTime iso={row.lastLoginAt} mode="relative" /> : <span className="text-ink-3">—</span>,
    },
  ];

  if (canWrite) {
    columns.push({
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <UserRowActions
          user={row}
          isSelf={row.id === user.id}
          isLastActiveOwner={row.role === "owner" && row.active && activeOwners <= 1}
        />
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title="Користувачі"
        description="Доступ до адмінки, ролі та паролі."
        actions={canWrite && <CreateUserButton />}
      />
      <DataTable columns={columns} rows={users} rowKey={(row) => row.id} caption="Користувачі адмінки" />

    </div>
  );
}
