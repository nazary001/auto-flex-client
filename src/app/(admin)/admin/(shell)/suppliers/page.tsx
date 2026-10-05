import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, PageHeader, PhoneLink, Pill, type Column } from "@/components/admin/ui";
import { can } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { formatDeliveryDays } from "@/lib/format";
import type { Supplier } from "@/lib/admin/types";
import { listSuppliers } from "@/lib/server/db/repos/suppliers";
import { countOffersBySupplier } from "@/lib/server/db/repos/offers";
import { openPurchaseOrderCountsBySupplier } from "@/lib/admin/queries/purchasing";

export const metadata: Metadata = { title: "Постачальники" };

export default async function SuppliersPage() {
  const user = await requireUser("purchases:read");
  const db = await getDb();
  const canWrite = can(user, "purchases:write");

  const [suppliers, offerCounts, openPoCounts] = await Promise.all([
    listSuppliers(db),
    countOffersBySupplier(db),
    openPurchaseOrderCountsBySupplier(db),
  ]);

  const columns: Column<Supplier>[] = [
    {
      key: "name",
      header: "Назва",
      render: (s) => (
        <div className="grid gap-0.5">
          <span className="font-semibold">{s.name}</span>
          <span className="tabular text-[12.5px] text-ink-3">{s.code}</span>
        </div>
      ),
    },
    {
      key: "contacts",
      header: "Контакти",
      hideBelow: "md",
      render: (s) =>
        s.contacts.phone ? (
          <span className="relative z-10 inline-flex">
            <PhoneLink phone={s.contacts.phone} />
          </span>
        ) : s.contacts.email ? (
          <span className="text-ink-2">{s.contacts.email}</span>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    { key: "lead", header: "Термін", hideBelow: "lg", render: (s) => <span className="tabular text-ink-2">{formatDeliveryDays(s.leadDays)}</span> },
    {
      key: "shipsDirect",
      header: "Доставка",
      hideBelow: "lg",
      render: (s) => (s.shipsDirect ? <Pill tone="teal">Напряму</Pill> : <span className="text-ink-3">—</span>),
    },
    { key: "offers", header: "Прайс", align: "right", render: (s) => <span className="tabular text-ink-2">{offerCounts.get(s.id) ?? 0}</span> },
    {
      key: "openPo",
      header: "Відкриті",
      align: "right",
      hideBelow: "sm",
      render: (s) => {
        const n = openPoCounts.get(s.id) ?? 0;
        return <span className={n > 0 ? "tabular font-medium text-ink" : "tabular text-ink-3"}>{n}</span>;
      },
    },
    {
      key: "active",
      header: "Статус",
      render: (s) => (s.active ? <Pill tone="green">Активний</Pill> : <Pill tone="slate">Вимкнено</Pill>),
    },
  ];

  const mobileCard = (s: Supplier) => (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{s.name}</span>
        {s.active ? <Pill tone="green" size="sm">Активний</Pill> : <Pill tone="slate" size="sm">Вимкнено</Pill>}
      </div>
      <div className="flex items-center justify-between gap-2 text-[12.5px] text-ink-3">
        <span className="tabular">{s.code}</span>
        <span>
          {offerCounts.get(s.id) ?? 0} у прайсі · {openPoCounts.get(s.id) ?? 0} відкритих
        </span>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Постачальники"
        description="Контакти, умови та прайс-листи постачальників"
        actions={
          canWrite && (
            <Link href="/admin/suppliers/new" className={buttonClass({ size: "sm" })}>
              <Plus aria-hidden className="size-4" strokeWidth={2} />
              Постачальник
            </Link>
          )
        }
      />

      <DataTable
        columns={columns}
        rows={suppliers}
        rowKey={(s) => s.id}
        rowHref={(s) => `/admin/suppliers/${s.id}`}
        mobileCard={mobileCard}
        empty={
          <EmptyState
            icon={<Truck />}
            title="Постачальників ще немає"
            text="Додайте першого постачальника, щоб вести прайс-листи й закупівлі."
            action={
              canWrite ? (
                <Link href="/admin/suppliers/new" className={buttonClass({})}>
                  Додати постачальника
                </Link>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
