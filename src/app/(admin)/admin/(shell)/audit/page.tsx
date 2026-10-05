import type { Metadata } from "next";
import Link from "next/link";
import {
  type Column,
  DataTable,
  DateTime,
  FilterBar,
  FilterDateRange,
  FilterSelect,
  PageHeader,
} from "@/components/admin/ui";
import { Pagination } from "@/components/ui/Pagination";
import type { AuditEntry } from "@/lib/admin/types";
import { normalizePaging } from "@/lib/admin/types";
import {
  AUDIT_ENTITY_OPTIONS,
  auditEntityHref,
  auditEntityLabel,
  listAuditActions,
  parseAuditActor,
  queryAudit,
} from "@/lib/admin/queries/audit";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { listUsers } from "@/lib/server/db/repos/users";

export const metadata: Metadata = { title: "Журнал" };

const PER_PAGE = 50;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

function prettyJson(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser("audit:read");
  const db = await getDb();
  const sp = await searchParams;

  const entity = first(sp.entity);
  const actor = first(sp.actor);
  const action = first(sp.action);
  const from = first(sp.from);
  const to = first(sp.to);
  const page = Number(first(sp.page)) || 1;

  const [result, users, actions] = await Promise.all([
    queryAudit(
      db,
      { entity, action, from, to, ...parseAuditActor(actor) },
      normalizePaging({ page, perPage: PER_PAGE }, PER_PAGE),
    ),
    listUsers(db),
    listAuditActions(db),
  ]);

  const actorOptions = [
    { value: "system", label: "Система" },
    { value: "site", label: "Сайт" },
    ...users.map((user) => ({ value: user.id, label: user.name })),
  ];
  const actionOptions = actions.map((code) => ({ value: code, label: code }));

  const hasFilter = Boolean(entity || actor || action || from || to);
  const query: SearchParams = { entity, actor, action, from, to };

  const columns: Column<AuditEntry>[] = [
    {
      key: "at",
      header: "Час",
      width: "11rem",
      render: (row) => <DateTime iso={row.at} mode="datetime" className="text-ink-2" />,
    },
    { key: "actor", header: "Хто", hideBelow: "md", render: (row) => row.actorName },
    {
      key: "action",
      header: "Дія",
      hideBelow: "lg",
      render: (row) => (
        <code className="tabular rounded bg-mist px-1.5 py-0.5 text-[12px] text-ink-2">{row.action}</code>
      ),
    },
    {
      key: "entity",
      header: "Обʼєкт",
      render: (row) => {
        const href = auditEntityHref(row.entity, row.entityId);
        const label = auditEntityLabel(row.entity);
        return href ? (
          <Link href={href} className="relative z-10 font-medium text-brand-700 hover:underline">
            {label}
          </Link>
        ) : (
          <span className="text-ink-2">{label}</span>
        );
      },
    },
    { key: "summary", header: "Подія", render: (row) => <span className="text-ink">{row.summary}</span> },
    {
      key: "details",
      header: "Деталі",
      align: "right",
      render: (row) =>
        row.data && Object.keys(row.data).length > 0 ? (
          <details className="relative z-10 text-left">
            <summary className="cursor-pointer list-none text-[13px] text-ink-3 hover:text-brand-700 [&::-webkit-details-marker]:hidden">
              Показати
            </summary>
            <pre className="adm-scroll-x mt-2 max-w-md rounded-card border border-line-soft bg-mist-soft p-3 text-left text-[12px] whitespace-pre text-ink-2">
              {prettyJson(row.data)}
            </pre>
          </details>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
  ];

  const mobileCard = (row: AuditEntry) => {
    const href = auditEntityHref(row.entity, row.entityId);
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <code className="tabular rounded bg-mist px-1.5 py-0.5 text-[12px] text-ink-2">{row.action}</code>
          <DateTime iso={row.at} mode="datetime" className="text-[12.5px] text-ink-3" />
        </div>
        <p className="text-sm text-ink">{row.summary}</p>
        <p className="text-[12.5px] text-ink-3">
          {row.actorName}
          {" · "}
          {href ? (
            <Link href={href} className="text-brand-700 hover:underline">
              {auditEntityLabel(row.entity)}
            </Link>
          ) : (
            auditEntityLabel(row.entity)
          )}
        </p>
        {row.data && Object.keys(row.data).length > 0 && (
          <details>
            <summary className="cursor-pointer list-none text-[13px] text-ink-3 [&::-webkit-details-marker]:hidden">
              Деталі
            </summary>
            <pre className="adm-scroll-x mt-1.5 rounded-card border border-line-soft bg-mist-soft p-2.5 text-[12px] whitespace-pre text-ink-2">
              {prettyJson(row.data)}
            </pre>
          </details>
        )}
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Журнал дій" description="Усі зміни в адмінці та події з сайту.">
        <FilterBar action="/admin/audit" resetHref={hasFilter ? "/admin/audit" : undefined}>
          <FilterSelect name="entity" value={entity} options={AUDIT_ENTITY_OPTIONS} allLabel="Усі обʼєкти" ariaLabel="Обʼєкт" />
          <FilterSelect name="actor" value={actor} options={actorOptions} allLabel="Будь-хто" ariaLabel="Хто" />
          <FilterSelect name="action" value={action} options={actionOptions} allLabel="Усі дії" ariaLabel="Дія" />
          <FilterDateRange from={from} to={to} />
        </FilterBar>
      </PageHeader>

      <DataTable
        columns={columns}
        rows={result.items}
        rowKey={(row) => row.id}
        mobileCard={mobileCard}
        caption="Журнал дій"
        empty={
          <p className="px-1 py-10 text-center text-sm text-ink-3">
            {hasFilter ? "За цими фільтрами записів немає." : "Журнал поки порожній."}
          </p>
        }
      />

      {result.pageCount > 1 && (
        <Pagination page={result.page} pageCount={result.pageCount} pathname="/admin/audit" query={query} className="mt-5" />
      )}
    </div>
  );
}
