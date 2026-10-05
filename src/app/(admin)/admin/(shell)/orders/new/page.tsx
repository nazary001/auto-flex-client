import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { OrderForm } from "@/components/admin/orders/OrderForm";
import { emptyForm, formFromCustomer, formFromOrder, formFromRequest, type FormState } from "@/components/admin/orders/order-form-model";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { getOrder } from "@/lib/server/db/repos/orders";
import { getCustomer } from "@/lib/server/db/repos/customers";
import { getRequest } from "@/lib/server/db/repos/requests";
import { getSettings } from "@/lib/server/db/repos/settings";
import { listSuppliers } from "@/lib/server/db/repos/suppliers";
import { listUsers } from "@/lib/server/db/repos/users";

export const metadata: Metadata = { title: "Нове замовлення" };

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await requireUser("orders:write");
  const db = await getDb();
  const sp = await searchParams;

  const duplicateId = first(sp.duplicate);
  const requestId = first(sp.request);
  const customerId = first(sp.customer);

  let initial: FormState = emptyForm();
  let linkedRequestId: string | undefined;

  if (duplicateId) {
    const order = await getOrder(db, duplicateId);
    if (order) initial = formFromOrder(order, "duplicate");
  } else if (requestId) {
    const request = await getRequest(db, requestId);
    if (request) {
      initial = formFromRequest(request);
      linkedRequestId = request.id;
    }
  } else if (customerId) {
    const customer = await getCustomer(db, customerId);
    if (customer) initial = formFromCustomer(customer);
  }

  const [suppliers, users, settings] = await Promise.all([listSuppliers(db, { activeOnly: true }), listUsers(db), getSettings(db)]);

  return (
    <div>
      <PageHeader back={{ href: "/admin/orders", label: "До замовлень" }} title="Нове замовлення" description="Створення замовлення вручну" />
      <OrderForm
        mode="create"
        initial={initial}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        assignees={users.map((u) => ({ id: u.id, name: u.name }))}
        defaultMarkupPercent={settings.orders.defaultMarkupPercent}
        requestId={linkedRequestId}
      />
    </div>
  );
}
