import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { ChangePasswordForm } from "@/components/admin/users/ChangePasswordForm";
import { ProfileForm } from "@/components/admin/users/ProfileForm";
import { can } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/server/auth/dal";

export const metadata: Metadata = { title: "Мій профіль" };

export default async function ProfilePage() {
  const user = await requireUser();
  const canSeeUsers = can(user, "users:read");

  return (
    <div>
      <PageHeader
        title="Мій профіль"
        description="Ваше ім'я та пароль для входу."
        back={canSeeUsers ? { href: "/admin/users", label: "Користувачі" } : undefined}
      />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ProfileForm name={user.name} email={user.email} role={user.role} />
        <ChangePasswordForm />
      </div>
    </div>
  );
}
