import type { ReactNode } from "react";
import { Info, ListChecks } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { site } from "@/lib/site";

/** Page heading of an information page: h1 + intro + optional revision date. */
export function InfoHeader({
  title,
  lead,
  updated,
}: {
  title: string;
  lead?: ReactNode;
  updated?: string;
}) {
  return (
    <header className="border-b border-line-soft pb-6">
      <h1 className="page-title">{title}</h1>
      {lead ? <p className="lead mt-3">{lead}</p> : null}
      {updated ? <p className="mt-4 text-[13px] text-ink-3">Редакція від {formatDate(updated)}</p> : null}
    </header>
  );
}

/** In-page «Зміст» with anchor links to the section ids. */
export function TableOfContents({
  items,
  className,
}: {
  items: { id: string; label: string }[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Зміст сторінки"
      className={cn("rounded-card border border-line-soft bg-mist-soft p-5 sm:p-6", className)}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <ListChecks aria-hidden className="size-[18px] text-brand-700" strokeWidth={1.75} />
        Зміст
      </p>
      <ol className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {items.map((item, index) => (
          <li key={item.id} className="flex gap-2.5 text-[15px] leading-snug">
            <span aria-hidden className="tabular pt-px text-[13px] font-semibold text-silver-500">
              {String(index + 1).padStart(2, "0")}
            </span>
            <a href={`#${item.id}`} className="text-brand-700 underline-offset-2 hover:underline">
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** A titled, anchorable content section. Children are stacked blocks: <Prose>, cards, callouts. */
export function InfoSection({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-28", className)}>
      <h2
        id={`${id}-title`}
        className="text-[1.3125rem] font-bold leading-snug tracking-tight text-ink sm:text-[1.375rem]"
      >
        {title}
      </h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

/** Long-form text wrapper (handles paragraphs, lists, tables, bold, links). */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("prose-af", className)}>{children}</div>;
}

/** Highlighted note. `tone` keeps to brand/neutral surfaces — no semantic colours. */
export function InfoCallout({
  children,
  title,
  icon,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  title?: string;
  icon?: ReactNode;
  tone?: "brand" | "mist";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-card border p-4 sm:p-5",
        tone === "brand" ? "border-brand-100 bg-brand-50" : "border-line-soft bg-mist-soft",
        className,
      )}
    >
      <span className={cn("mt-0.5 shrink-0 [&>svg]:size-5", tone === "brand" ? "text-brand-700" : "text-ink-3")}>
        {icon ?? <Info aria-hidden strokeWidth={1.75} />}
      </span>
      <div className="min-w-0">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        <div className={cn("text-[15px] leading-relaxed text-ink-2", title && "mt-1")}>{children}</div>
      </div>
    </div>
  );
}

/** Seller details from site.legal — used on the contacts and public-offer pages. */
export function SellerDetails({ className }: { className?: string }) {
  const rows: { label: string; value: string; mono?: boolean; wrap?: boolean }[] = [
    { label: "Продавець", value: site.legal.entity },
    { label: "Ідентифікаційний код", value: site.legal.taxId, mono: true },
    { label: "Адреса", value: site.legal.address },
    { label: "IBAN", value: site.legal.iban, mono: true, wrap: true },
  ];
  return (
    <dl className={cn("card grid gap-4 p-5 sm:grid-cols-2 sm:p-6", className)}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-sm text-ink-3">{row.label}</dt>
          <dd className={cn("mt-0.5 font-medium text-ink", row.mono && "tabular", row.wrap && "break-all")}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Icon + title + text tile, used in grids (payment methods, delivery, benefits). */
export function InfoCard({
  icon,
  title,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card p-5", className)}>
      <span className="grid size-10 place-content-center rounded-btn bg-brand-50 text-brand-700 [&>svg]:size-5">
        {icon}
      </span>
      <p className="mt-3 font-semibold text-ink">{title}</p>
      {children ? <div className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{children}</div> : null}
    </div>
  );
}
