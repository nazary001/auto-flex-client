import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/admin/ui";
import { can } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/server/auth/dal";
import { SupplierForm } from "@/components/admin/purchasing/SupplierForm";

export const metadata: Metadata = { title: "Новий постачальник" };

export default async function NewSupplierPage() {
  const user = await requireUser("purchases:read");
  const canWrite = can(user, "purchases:write");

  return (
    <div>
      <PageHeader
        title="Новий постачальник"
        description="Заповніть картку постачальника"
        back={{ href: "/admin/suppliers", label: "До постачальників" }}
      />
      {canWrite ? (
        <SupplierForm />
      ) : (
        <Alert tone="warning" title="Лише перегляд">
          У вас немає прав додавати постачальників.
        </Alert>
      )}
    </div>
  );
}
