import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert, PageHeader } from "@/components/admin/ui";
import { can } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import type { Order, SupplierOffer } from "@/lib/admin/types";
import { findOrders, getOrders } from "@/lib/server/db/repos/orders";
import { normalizeSku, offersForMany, rankOffers } from "@/lib/server/db/repos/offers";
import { listSuppliers } from "@/lib/server/db/repos/suppliers";
import {
  PurchaseOrderBuilder,
  type BuilderLine,
  type BuilderOffer,
} from "@/components/admin/purchasing/PurchaseOrderBuilder";

export const metadata: Metadata = { title: "Нова закупівля" };

const asArray = (v?: string | string[]) => (Array.isArray(v) ? v : v ? [v] : []);

export default async function NewPurchaseOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const user = await requireUser("purchases:read");
  const db = await getDb();
  const sp = await searchParams;
  const canWrite = can(user, "purchases:write");

  const orderIds = asArray(sp.order);
  const orders: Order[] = orderIds.length > 0 ? await getOrders(db, orderIds) : await findOrders(db, { needsSourcing: true }, 200);

  // candidate lines: pending and not yet attached to a purchase order
  const candidates: { order: Order; line: Order["lines"][number] }[] = [];
  for (const order of orders) {
    for (const line of order.lines) {
      if (line.fulfillment === "pending" && !line.purchaseOrderId) candidates.push({ order, line });
    }
  }

  const [allSuppliers, offersMap] = await Promise.all([
    listSuppliers(db),
    offersForMany(
      db,
      candidates.map(({ line }) => ({ productId: line.productId, sku: line.sku })),
    ),
  ]);
  const supplierMap = new Map(allSuppliers.map((s) => [s.id, s]));
  const activeSuppliers = allSuppliers.filter((s) => s.active);

  const builderLines: BuilderLine[] = candidates.map(({ order, line }) => {
    const merged = new Map<string, SupplierOffer>();
    const seed = [
      ...(line.productId ? offersMap.get(line.productId) ?? [] : []),
      ...(offersMap.get(normalizeSku(line.sku)) ?? []),
    ];
    for (const offer of seed) merged.set(offer.id, offer);
    const offers: BuilderOffer[] = rankOffers([...merged.values()]).map((offer) => {
      const supplier = supplierMap.get(offer.supplierId);
      return {
        supplierId: offer.supplierId,
        code: supplier?.code ?? "—",
        name: supplier?.name ?? offer.supplierId,
        cost: offer.cost,
        availability: offer.availability,
        shipsDirect: supplier?.shipsDirect ?? false,
      };
    });
    return {
      orderId: order.id,
      orderNumber: order.number,
      customerName: `${order.customer.firstName} ${order.customer.lastName}`.trim(),
      customerCity: order.delivery.city,
      orderLineId: line.id,
      sku: line.sku,
      name: line.name,
      qty: line.qty,
      defaultCost: line.costPrice ?? 0,
      offers,
    };
  });

  return (
    <div>
      <PageHeader
        title="Нова закупівля"
        description="Оберіть позиції замовлень і згрупуйте їх за постачальниками"
        back={{ href: "/admin/purchases", label: "До закупівель" }}
      />

      {!canWrite ? (
        <Alert tone="warning" title="Лише перегляд">
          У вас немає прав створювати закупівлі.
        </Alert>
      ) : builderLines.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck />}
          title="Немає позицій для закупівлі"
          text="Усі позиції вже замовлені в постачальників або відсутні замовлення, що очікують на закупівлю."
          action={
            <Link href="/admin/orders" className={buttonClass({ variant: "secondary" })}>
              До замовлень
            </Link>
          }
        />
      ) : (
        <PurchaseOrderBuilder
          lines={builderLines}
          suppliers={activeSuppliers.map((s) => ({ id: s.id, code: s.code, name: s.name, shipsDirect: s.shipsDirect }))}
        />
      )}
    </div>
  );
}
