import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Tabs } from "@/components/ui/Tabs";
import { Pagination } from "@/components/ui/Pagination";
import {
  Alert,
  Card,
  DataTable,
  DateTime,
  DescriptionList,
  FilterBar,
  FilterInput,
  FilterSelect,
  Money,
  PageHeader,
  Pill,
  StatusBadge,
  type Column,
} from "@/components/admin/ui";
import { can } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { getProductsByIds } from "@/lib/catalog";
import { formatDeliveryDays, formatPhone } from "@/lib/format";
import { availabilityMeta } from "@/lib/admin/labels";
import type { OfferAvailability, PurchaseOrder } from "@/lib/admin/types";
import { getSupplier } from "@/lib/server/db/repos/suppliers";
import { listOffers } from "@/lib/server/db/repos/offers";
import { findPurchaseOrders } from "@/lib/server/db/repos/purchase-orders";
import { SupplierForm } from "@/components/admin/purchasing/SupplierForm";
import { OffersTable, type OfferRow } from "@/components/admin/purchasing/OffersTable";
import { OfferImportForm } from "@/components/admin/purchasing/OfferImportForm";

export const metadata: Metadata = { title: "Постачальник" };

const PER_PAGE = 25;
const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

const AVAILABILITY_OPTIONS = (Object.keys(availabilityMeta) as OfferAvailability[]).map((value) => ({
  value,
  label: availabilityMeta[value].label,
}));

interface SearchParams {
  tab?: string | string[];
  q?: string | string[];
  availability?: string | string[];
  page?: string | string[];
}

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser("purchases:read");
  const db = await getDb();
  const { id } = await params;
  const sp = await searchParams;

  const supplier = await getSupplier(db, id);
  if (!supplier) notFound();

  const canWrite = can(user, "purchases:write");
  const rawTab = first(sp.tab) ?? "card";
  const tab = new Set(["card", "price", "import", "pos"]).has(rawTab) ? rawTab : "card";
  const q = first(sp.q)?.trim() ?? "";
  const availability = first(sp.availability) ?? "";
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const [offerPage, pos] = await Promise.all([
    listOffers(
      db,
      { supplierId: id, q: q || undefined, availability: availability ? [availability as OfferAvailability] : undefined },
      { page, perPage: PER_PAGE },
    ),
    findPurchaseOrders(db, { supplierId: id }, 200),
  ]);

  const offerProductIds = [...new Set(offerPage.items.map((o) => o.productId).filter((v): v is string => Boolean(v)))];
  const offerProducts = await getProductsByIds(offerProductIds);
  const productNameById = new Map(offerProducts.map((p) => [p.id, p.name]));

  const offerRows: OfferRow[] = offerPage.items.map((offer) => ({
    id: offer.id,
    sku: offer.sku,
    productName: offer.productId ? productNameById.get(offer.productId) ?? null : null,
    cost: offer.cost,
    availability: offer.availability,
    qty: offer.qty,
    leadDays: offer.leadDays,
    updatedAt: offer.updatedAt,
  }));

  // ── tab: card ──
  const cardTab = canWrite ? (
    <SupplierForm supplier={supplier} />
  ) : (
    <Card title="Картка постачальника">
      <DescriptionList
        columns={2}
        items={[
          { label: "Код", value: supplier.code },
          { label: "Назва", value: supplier.name },
          { label: "Статус", value: supplier.active ? "Активний" : "Вимкнено" },
          { label: "Доставка напряму", value: supplier.shipsDirect ? "Так" : "Ні" },
          { label: "Телефон", value: supplier.contacts.phone ? formatPhone(supplier.contacts.phone) : "—" },
          { label: "Email", value: supplier.contacts.email ?? "—" },
          { label: "Telegram", value: supplier.contacts.telegram ?? "—" },
          { label: "Сайт", value: supplier.contacts.site ?? "—" },
          { label: "Контактна особа", value: supplier.contacts.manager ?? "—" },
          { label: "Термін доставки", value: formatDeliveryDays(supplier.leadDays) },
          { label: "Націнка", value: supplier.defaultMarkupPercent != null ? `${supplier.defaultMarkupPercent}%` : "—" },
          { label: "Умови оплати", value: supplier.paymentTerms ?? "—" },
          { label: "Умови доставки", value: supplier.deliveryTerms ?? "—" },
          { label: "Нотатки", value: supplier.notes ?? "—" },
        ]}
      />
    </Card>
  );

  // ── tab: price list ──
  const priceHasFilter = Boolean(q || availability);
  const priceTab = (
    <div className="grid gap-4">
      <FilterBar
        action={`/admin/suppliers/${id}`}
        hidden={{ tab: "price" }}
        resetHref={`/admin/suppliers/${id}?tab=price`}
      >
        <FilterInput name="q" value={q} placeholder="Артикул" />
        <FilterSelect name="availability" value={availability} allLabel="Будь-яка наявність" ariaLabel="Наявність" options={AVAILABILITY_OPTIONS} />
      </FilterBar>

      {offerRows.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-ink-3">
            {priceHasFilter ? "Нічого не знайдено за фільтром." : "Прайс-лист порожній. Додайте позиції через вкладку «Імпорт CSV»."}
          </p>
        </Card>
      ) : (
        <OffersTable supplierId={id} offers={offerRows} canWrite={canWrite} />
      )}

      {offerPage.pageCount > 1 && (
        <Pagination
          page={offerPage.page}
          pageCount={offerPage.pageCount}
          pathname={`/admin/suppliers/${id}`}
          query={{ tab: "price", q: q || undefined, availability: availability || undefined }}
        />
      )}
    </div>
  );

  // ── tab: import ──
  const importTab = canWrite ? (
    <Card title="Імпорт прайс-листа">
      <OfferImportForm supplierId={id} />
    </Card>
  ) : (
    <Alert tone="warning" title="Лише перегляд">
      У вас немає прав імпортувати прайс-листи.
    </Alert>
  );

  // ── tab: purchase orders ──
  const poColumns: Column<PurchaseOrder>[] = [
    {
      key: "number",
      header: "№ / дата",
      render: (po) => (
        <div className="grid gap-0.5">
          <span className="tabular font-semibold">{po.number}</span>
          <DateTime iso={po.createdAt} className="text-[12.5px] text-ink-3" />
        </div>
      ),
    },
    { key: "status", header: "Статус", render: (po) => <StatusBadge kind="po" value={po.status} /> },
    { key: "lines", header: "Поз.", align: "right", render: (po) => <span className="tabular text-ink-2">{po.lines.length}</span> },
    { key: "total", header: "Сума", align: "right", render: (po) => <Money value={po.totalCost} /> },
  ];
  const poTab = (
    <DataTable
      columns={poColumns}
      rows={pos}
      rowKey={(po) => po.id}
      rowHref={(po) => `/admin/purchases/${po.id}`}
      empty={<p className="px-1 py-10 text-center text-sm text-ink-3">У цього постачальника ще немає закупівель.</p>}
    />
  );

  return (
    <div>
      <PageHeader
        title={supplier.name}
        meta={
          <>
            <Pill tone="neutral">{supplier.code}</Pill>
            {supplier.shipsDirect && <Pill tone="teal">Напряму</Pill>}
            {supplier.active ? <Pill tone="green">Активний</Pill> : <Pill tone="slate">Вимкнено</Pill>}
          </>
        }
        back={{ href: "/admin/suppliers", label: "До постачальників" }}
      />

      <Tabs
        defaultId={tab}
        items={[
          { id: "card", label: "Картка", content: cardTab },
          { id: "price", label: "Прайс-лист", content: priceTab },
          { id: "import", label: "Імпорт CSV", content: importTab },
          { id: "pos", label: "Закупівлі", content: poTab },
        ]}
      />
    </div>
  );
}
