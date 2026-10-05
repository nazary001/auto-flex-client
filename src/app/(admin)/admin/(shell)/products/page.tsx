import type { Metadata } from "next";
import Link from "next/link";
import { Download, Package, Plus } from "lucide-react";
import { FilterBar, FilterInput, FilterSelect, PageHeader } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { can } from "@/lib/admin/permissions";
import { getProductFilterOptions, listAdminProducts, type ProductFilter } from "@/lib/admin/queries/catalog";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { ImportPrices } from "@/components/admin/catalog/ImportPrices";
import { ProductsTable } from "@/components/admin/catalog/ProductsTable";

export const metadata: Metadata = { title: "Товари" };

type Search = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const STOCK_OPTIONS = [
  { value: "in_stock", label: "В наявності" },
  { value: "low_stock", label: "Закінчується" },
  { value: "preorder", label: "Під замовлення" },
  { value: "out_of_stock", label: "Немає в наявності" },
];

const BADGE_OPTIONS = [
  { value: "new", label: "Новинка" },
  { value: "sale", label: "Акція" },
  { value: "hit", label: "Хіт" },
];

const STATE_OPTIONS = [
  { value: "hidden", label: "Приховані" },
  { value: "edited", label: "Змінені" },
  { value: "new", label: "Нові від постачальника" },
  { value: "manual", label: "Додані вручну" },
  { value: "no_cost", label: "Без собівартості" },
  { value: "retired", label: "Знято з продажу" },
];

const SORT_OPTIONS = [
  { value: "popular", label: "За популярністю" },
  { value: "name", label: "За назвою" },
  { value: "price_asc", label: "Ціна ↑" },
  { value: "price_desc", label: "Ціна ↓" },
  { value: "newest", label: "Найновіші" },
];

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser("catalog:read");
  const db = await getDb();
  const canWrite = can(user, "catalog:write");

  const sp = await searchParams;
  const filter: ProductFilter = {
    q: first(sp.q)?.trim() || undefined,
    category: first(sp.category) || undefined,
    brand: first(sp.brand) || undefined,
    stock: first(sp.stock) || undefined,
    badge: first(sp.badge) || undefined,
    state: first(sp.state) || undefined,
    sort: first(sp.sort) || "popular",
  };
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const [result, options] = await Promise.all([listAdminProducts(db, filter, page), getProductFilterOptions()]);

  const activeFilter = Boolean(filter.q || filter.category || filter.brand || filter.stock || filter.badge || filter.state);

  const queryEntries = Object.entries({
    q: filter.q,
    category: filter.category,
    brand: filter.brand,
    stock: filter.stock,
    badge: filter.badge,
    state: filter.state,
    sort: filter.sort && filter.sort !== "popular" ? filter.sort : undefined,
  }).filter(([, v]) => Boolean(v)) as [string, string][];
  const exportQuery = new URLSearchParams(queryEntries).toString();
  const paginationQuery: Search = Object.fromEntries(queryEntries);

  return (
    <div>
      <PageHeader
        title="Товари"
        description={`Усього у вибірці: ${result.total}`}
        actions={
          <>
            <a
              href={`/admin/export/products${exportQuery ? `?${exportQuery}` : ""}`}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              <Download aria-hidden className="size-4" strokeWidth={1.75} />
              Експорт CSV
            </a>
            {canWrite && (
              <Link href="/admin/products/new" className={buttonClass({ variant: "primary", size: "sm" })}>
                <Plus aria-hidden className="size-4" strokeWidth={1.75} />
                Товар
              </Link>
            )}
          </>
        }
      >
        <FilterBar action="/admin/products" resetHref="/admin/products">
          <FilterInput name="q" value={filter.q} placeholder="Назва, артикул, OE-номер" />
          <select
            name="category"
            defaultValue={filter.category ?? ""}
            aria-label="Категорія"
            className="field field-sm w-auto min-w-44"
          >
            <option value="">Усі категорії</option>
            {options.groups.map((g) => (
              <optgroup key={g.id} label={g.name}>
                <option value={g.id}>Уся група: {g.name}</option>
                {g.leaves.map((leaf) => (
                  <option key={leaf.id} value={leaf.id}>
                    {leaf.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <FilterSelect
            name="brand"
            value={filter.brand}
            allLabel="Усі бренди"
            options={options.brands.map((b) => ({ value: b.id, label: b.name }))}
          />
          <FilterSelect name="stock" value={filter.stock} allLabel="Будь-яка наявність" options={STOCK_OPTIONS} />
          <FilterSelect name="badge" value={filter.badge} allLabel="Усі бейджі" options={BADGE_OPTIONS} />
          <FilterSelect name="state" value={filter.state} allLabel="Усі товари" options={STATE_OPTIONS} />
          <FilterSelect name="sort" value={filter.sort} options={SORT_OPTIONS} ariaLabel="Сортування" />
        </FilterBar>
      </PageHeader>

      {canWrite && <ImportPrices />}

      {result.items.length === 0 ? (
        activeFilter ? (
          <p className="rounded-card border border-line-soft bg-white px-4 py-10 text-center text-sm text-ink-3">
            За вашим запитом товарів не знайдено.
          </p>
        ) : (
          <EmptyState
            icon={<Package />}
            title="Ще немає товарів"
            text="Запустіть синхронізацію з постачальником на сторінці «Постачальник DD» або додайте товар вручну."
            action={
              canWrite ? (
                <Link href="/admin/products/new" className={buttonClass({ variant: "primary" })}>
                  Додати товар
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <ProductsTable rows={result.items} canWrite={canWrite} />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            pathname="/admin/products"
            query={paginationQuery}
            className="mt-6"
          />
        </>
      )}
    </div>
  );
}
