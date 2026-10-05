import type { Metadata } from "next";
import Link from "next/link";
import { Download, PhoneOff, Plus, Users } from "lucide-react";
import {
  DataTable,
  DateTime,
  FilterBar,
  FilterInput,
  FilterSelect,
  Money,
  PageHeader,
  PhoneLink,
  Pill,
} from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { can } from "@/lib/admin/permissions";
import { formatPhone } from "@/lib/format";
import { normalizePaging, type Customer } from "@/lib/admin/types";
import { customerFilterActive, parseCustomerFilter } from "@/lib/admin/queries/customers";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { listCustomerTags, searchCustomers } from "@/lib/server/db/repos/customers";

export const metadata: Metadata = { title: "Клієнти" };

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

const SORT_OPTIONS = [
  { value: "recent", label: "Нещодавні" },
  { value: "spent", label: "Найбільша сума" },
  { value: "orders", label: "Найбільше замовлень" },
  { value: "name", label: "За прізвищем" },
];

function fullName(c: Customer): string {
  return `${c.firstName} ${c.lastName}`.trim() || "Без імені";
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("customers:read");
  const db = await getDb();

  const sp = await searchParams;
  const qRaw = first(sp.q) ?? "";
  const tagRaw = first(sp.tag) ?? "";
  const dncRaw = first(sp.doNotCall) ?? "";
  const sortRaw = first(sp.sort) ?? "recent";
  const filter = parseCustomerFilter({ q: qRaw, tag: tagRaw, doNotCall: dncRaw, sort: sortRaw });
  const paging = normalizePaging({ page: Number(first(sp.page)) || 1 });

  const [page, tags] = await Promise.all([searchCustomers(db, filter, paging), listCustomerTags(db)]);
  const canWrite = can(user, "customers:write");

  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries({ q: qRaw, tag: tagRaw, doNotCall: dncRaw, sort: sortRaw })) {
    if (value && !(key === "sort" && value === "recent")) exportParams.set(key, value);
  }
  const exportHref = `/admin/export/customers${exportParams.toString() ? `?${exportParams}` : ""}`;

  const columns = [
    {
      key: "name",
      header: "Клієнт",
      render: (c: Customer) => (
        <span>
          {fullName(c)}
          {c.email && <span className="block text-[12.5px] font-normal text-ink-3">{c.email}</span>}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Телефон",
      render: (c: Customer) => (
        <span className="relative z-10">
          <PhoneLink phone={c.phone} />
        </span>
      ),
    },
    { key: "city", header: "Місто", hideBelow: "lg" as const, render: (c: Customer) => c.city ?? "—" },
    { key: "orders", header: "Замовлень", align: "right" as const, render: (c: Customer) => c.ordersCount },
    { key: "spent", header: "Сума", align: "right" as const, render: (c: Customer) => <Money value={c.totalSpent} /> },
    {
      key: "last",
      header: "Останнє",
      hideBelow: "xl" as const,
      render: (c: Customer) => (c.lastOrderAt ? <DateTime iso={c.lastOrderAt} /> : <span className="text-ink-3">—</span>),
    },
    {
      key: "tags",
      header: "Теги",
      hideBelow: "xl" as const,
      render: (c: Customer) =>
        c.tags.length ? (
          <span className="flex flex-wrap gap-1">
            {c.tags.map((tag) => (
              <Pill key={tag} tone="neutral" size="sm" withDot={false}>
                {tag}
              </Pill>
            ))}
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      key: "dnc",
      header: <span className="sr-only">Не телефонувати</span>,
      align: "center" as const,
      width: "2.5rem",
      render: (c: Customer) =>
        c.doNotCall ? (
          <PhoneOff aria-label="Не телефонувати" className="mx-auto size-4 text-danger" strokeWidth={1.75} />
        ) : null,
    },
  ];

  const mobileCard = (c: Customer) => (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-ink">{fullName(c)}</span>
        <Money value={c.totalSpent} className="text-sm font-semibold" />
      </div>
      <div className="tabular mt-1.5 text-sm font-medium text-brand-700">{formatPhone(c.phone)}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
        {c.city && <span>{c.city}</span>}
        <span>{c.ordersCount} замовл.</span>
        {c.lastOrderAt && <DateTime iso={c.lastOrderAt} />}
        {c.doNotCall && (
          <span className="inline-flex items-center gap-1 text-danger">
            <PhoneOff aria-hidden className="size-3.5" strokeWidth={1.75} /> не телефонувати
          </span>
        )}
      </div>
      {c.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {c.tags.map((tag) => (
            <Pill key={tag} tone="neutral" size="sm" withDot={false}>
              {tag}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );

  const showEmptyState = page.total === 0 && !customerFilterActive(filter);

  return (
    <div>
      <PageHeader
        title="Клієнти"
        description="Контакти покупців, теги та історія замовлень"
        actions={
          <>
            <Link href={exportHref} className={buttonClass({ variant: "secondary", size: "sm" })} prefetch={false}>
              <Download aria-hidden className="size-4" strokeWidth={1.75} />
              Експорт CSV
            </Link>
            {canWrite && (
              <Link href="/admin/customers/new" className={buttonClass({ size: "sm" })}>
                <Plus aria-hidden className="size-4" strokeWidth={2} />
                Клієнт
              </Link>
            )}
          </>
        }
      >
        <FilterBar action="/admin/customers" resetHref="/admin/customers">
          <FilterInput name="q" value={qRaw} placeholder="Імʼя, телефон, email, місто" ariaLabel="Пошук клієнтів" />
          <FilterSelect
            name="tag"
            value={tagRaw}
            options={tags.map((tag) => ({ value: tag, label: tag }))}
            allLabel="Усі теги"
            autoSubmit
          />
          <FilterSelect
            name="doNotCall"
            value={dncRaw}
            options={[
              { value: "yes", label: "Не телефонувати" },
              { value: "no", label: "Можна телефонувати" },
            ]}
            allLabel="Дзвінки: усі"
            autoSubmit
          />
          <FilterSelect name="sort" value={sortRaw} options={SORT_OPTIONS} ariaLabel="Сортування" autoSubmit />
        </FilterBar>
      </PageHeader>

      {showEmptyState ? (
        <EmptyState
          icon={<Users />}
          title="Ще немає клієнтів"
          text="Клієнти додаються автоматично із замовлень або вручну."
          action={
            canWrite ? (
              <Link href="/admin/customers/new" className={buttonClass({})}>
                Додати клієнта
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={page.items}
            rowKey={(c) => c.id}
            rowHref={(c) => `/admin/customers/${c.id}`}
            mobileCard={mobileCard}
            caption="Список клієнтів"
          />
          <Pagination
            page={page.page}
            pageCount={page.pageCount}
            pathname="/admin/customers"
            query={sp}
            className="mt-5"
          />
          <p className="mt-3 text-[13px] text-ink-3">Знайдено: {page.total}</p>
        </>
      )}
    </div>
  );
}
