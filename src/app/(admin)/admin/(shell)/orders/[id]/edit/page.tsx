import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { OrderForm } from "@/components/admin/orders/OrderForm";
import { formFromOrder } from "@/components/admin/orders/order-form-model";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { getOrder } from "@/lib/server/db/repos/orders";
import { getSettings } from "@/lib/server/db/repos/settings";
import { listSuppliers } from "@/lib/server/db/repos/suppliers";
import { listUsers } from "@/lib/server/db/repos/users";

export const metadata: Metadata = { title: "Редагування замовлення" };

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("orders:write");
  const db = await getDb();
  const { id } = await params;
  const order = await getOrder(db, id);
  if (!order) notFound();

  const [suppliers, users, settings] = await Promise.all([listSuppliers(db, { activeOnly: true }), listUsers(db), getSettings(db)]);
  const locked = order.lines.some((line) => line.purchaseOrderId);

  return (
    <div>
      <PageHeader
        back={{ href: `/admin/orders/${order.id}`, label: `До замовлення ${order.number}` }}
        title={`Редагування ${order.number}`}
        description={locked ? "Позиції із закупівлі заблоковані для видалення." : undefined}
      />
      <OrderForm
        mode="edit"
        orderId={order.id}
        initial={formFromOrder(order, "edit")}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        assignees={users.map((u) => ({ id: u.id, name: u.name }))}
        defaultMarkupPercent={settings.orders.defaultMarkupPercent}
      />
    </div>
  );
}
