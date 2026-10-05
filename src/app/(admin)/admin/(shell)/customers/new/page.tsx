import type { Metadata } from "next";
import { Alert, Card, PageHeader } from "@/components/admin/ui";
import { CustomerForm } from "@/components/admin/customers/CustomerForm";
import { can } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/server/auth/dal";

export const metadata: Metadata = { title: "Новий клієнт" };

export default async function NewCustomerPage() {
  const user = await requireUser("customers:read");
  const canWrite = can(user, "customers:write");

  return (
    <div>
      <PageHeader title="Новий клієнт" back={{ href: "/admin/customers", label: "До клієнтів" }} />
      {canWrite ? (
        <Card className="max-w-2xl">
          <CustomerForm mode="create" />
        </Card>
      ) : (
        <Alert tone="warning" title="Немає доступу">
          У вас немає прав створювати клієнтів. Зверніться до власника магазину.
        </Alert>
      )}
    </div>
  );
}
