"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { Pill } from "@/components/admin/ui";
import type { ProductBadge } from "@/lib/types";
import type { ProductSource } from "@/lib/server/db/collections";
import type { AdminProductRow } from "@/lib/admin/queries/catalog";
import { InlineNumber, InlineStock } from "./inline";
import { ProductRowMenu } from "./ProductRowMenu";
import { BulkBar } from "./BulkBar";

const badgeLabel: Record<ProductBadge, string> = { new: "Новинка", sale: "Акція", hit: "Хіт" };

function SourcePill({ source }: { source: ProductSource }) {
  if (source === "ddtuning") return <Pill tone="blue" withDot={false}>DD</Pill>;
  if (source === "manual") return <Pill tone="violet" withDot={false}>Вручну</Pill>;
  return <Pill tone="slate" withDot={false}>Демо</Pill>;
}

function StateMarkers({ row }: { row: AdminProductRow }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      <SourcePill source={row.source} />
      {row.edited && <Pill tone="amber" size="sm" withDot={false}>Змінено</Pill>}
      {row.retired ? (
        <Pill tone="red" size="sm" withDot={false}>Знято</Pill>
      ) : row.hidden ? (
        <Pill tone="slate" size="sm" withDot={false}>Приховано</Pill>
      ) : null}
    </span>
  );
}

function Thumb({ row }: { row: AdminProductRow }) {
  if (row.image) {
    return (
      <Image
        src={row.image}
        alt=""
        width={40}
        height={40}
        unoptimized
        className="size-10 shrink-0 rounded-md border border-line-soft object-cover"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local decorative SVG illustration
    <img
      src={`/illustrations/${row.illustration}.svg`}
      alt=""
      width={40}
      height={40}
      className="size-10 shrink-0 rounded-md border border-line-soft bg-mist-soft object-contain p-1"
    />
  );
}

function Margin({ row }: { row: AdminProductRow }) {
  if (row.cost == null) return <span className="text-ink-3">—</span>;
  return (
    <span className="tabular">
      <span className="text-ink">{formatPrice(row.cost)}</span>
      {row.marginPercent != null && (
        <span className={cn("ml-1.5 font-semibold", row.marginPercent < 0 ? "text-danger" : "text-ok")}>
          {row.marginPercent > 0 ? "+" : ""}
          {row.marginPercent}%
        </span>
      )}
    </span>
  );
}

function Badges({ badges }: { badges: ProductBadge[] }) {
  if (badges.length === 0) return <span className="text-ink-3">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((b) => (
        <Pill key={b} size="sm" tone={b === "sale" ? "red" : b === "hit" ? "violet" : "green"} withDot={false}>
          {badgeLabel[b]}
        </Pill>
      ))}
    </span>
  );
}

interface ProductsTableProps {
  rows: AdminProductRow[];
  canWrite: boolean;
}

export function ProductsTable({ rows, canWrite }: ProductsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));
  }

  const allChecked = rows.length > 0 && selected.size === rows.length;

  return (
    <div>
      {/* Desktop table */}
      <div className="adm-scroll-x hidden rounded-card border border-line-soft bg-white md:block">
        <table className="adm-table adm-table-hover">
          <thead>
            <tr>
              {canWrite && (
                <th scope="col" style={{ width: "2.5rem" }}>
                  <input
                    type="checkbox"
                    className="check"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="Обрати всі"
                  />
                </th>
              )}
              <th scope="col">Товар</th>
              <th scope="col" className="hidden lg:table-cell">
                Категорія
              </th>
              <th scope="col" className="text-right">
                Ціна
              </th>
              <th scope="col">Наявність</th>
              <th scope="col" className="hidden text-right xl:table-cell">
                Собівартість / маржа
              </th>
              <th scope="col" className="hidden md:table-cell">
                Бейджі
              </th>
              <th scope="col">Джерело</th>
              <th scope="col" aria-label="Дії" style={{ width: "2.5rem" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={cn(selected.has(row.id) && "bg-brand-50/50")}>
                {canWrite && (
                  <td>
                    <input
                      type="checkbox"
                      className="check"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                      aria-label={`Обрати ${row.name}`}
                    />
                  </td>
                )}
                <td>
                  <div className="flex items-center gap-3">
                    <Thumb row={row} />
                    <div className="min-w-0">
                      <Link href={`/admin/products/${row.id}`} className="line-clamp-2 font-medium text-ink hover:text-brand-700">
                        {row.name}
                      </Link>
                      <div className="tabular mt-0.5 text-[12px] text-ink-3">
                        {row.sku} · {row.brandName}
                        {row.variants > 0 && <span className="text-ink-3"> · {row.variants} вар.</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden text-ink-2 lg:table-cell">{row.categoryName}</td>
                <td className="text-right">
                  <div className="flex flex-col items-end">
                    {canWrite ? <InlineNumber id={row.id} field="price" value={row.price} /> : <span className="tabular">{formatPrice(row.price)}</span>}
                    {row.oldPrice ? <span className="tabular text-[12px] text-ink-3 line-through">{formatPrice(row.oldPrice)}</span> : null}
                  </div>
                </td>
                <td>{canWrite ? <InlineStock id={row.id} value={row.stock} /> : row.stock}</td>
                <td className="hidden text-right xl:table-cell">
                  <Margin row={row} />
                </td>
                <td className="hidden md:table-cell">
                  <Badges badges={row.badges} />
                </td>
                <td>
                  <StateMarkers row={row} />
                </td>
                <td>
                  <ProductRowMenu id={row.id} slug={row.slug} source={row.source} edited={row.edited} hidden={row.hidden} canWrite={canWrite} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2.5 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-card border border-line-soft bg-white p-3.5">
            <div className="flex items-start gap-3">
              {canWrite && (
                <input
                  type="checkbox"
                  className="check mt-1"
                  checked={selected.has(row.id)}
                  onChange={() => toggle(row.id)}
                  aria-label={`Обрати ${row.name}`}
                />
              )}
              <Thumb row={row} />
              <div className="min-w-0 flex-1">
                <Link href={`/admin/products/${row.id}`} className="font-medium text-ink">
                  {row.name}
                </Link>
                <div className="tabular mt-0.5 text-[12px] text-ink-3">
                  {row.sku} · {row.brandName} · {row.categoryName}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="tabular font-semibold text-ink">{formatPrice(row.price)}</span>
                  {row.oldPrice ? <span className="tabular text-[12px] text-ink-3 line-through">{formatPrice(row.oldPrice)}</span> : null}
                  <StateMarkers row={row} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {canWrite ? <InlineStock id={row.id} value={row.stock} /> : <span className="text-sm text-ink-2">{row.stock}</span>}
                  <ProductRowMenu id={row.id} slug={row.slug} source={row.source} edited={row.edited} hidden={row.hidden} canWrite={canWrite} />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {canWrite && selected.size > 0 && <BulkBar ids={[...selected]} onClear={() => setSelected(new Set())} />}
    </div>
  );
}
