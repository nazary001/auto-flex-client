import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { FilterBar, FilterInput, FilterSelect, PageHeader, SegmentedLinks } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { RequestCard } from "@/components/admin/requests/RequestCard";
import { can } from "@/lib/admin/permissions";
import { REQUEST_KINDS, requestKindLabel } from "@/lib/admin/labels";
import { normalizePaging, type RequestListFilter, type RequestStatus } from "@/lib/admin/types";
import type { CallbackKind } from "@/lib/types";
import { getProductsByIds } from "@/lib/catalog";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { countRequestsByStatus, getRequest, listRequests } from "@/lib/server/db/repos/requests";
import { listUsers } from "@/lib/server/db/repos/users";

export const metadata: Metadata = { title: "Заявки" };

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

const STATUS_VALUES = ["new", "in_progress", "done", "spam", "all"] as const;
type StatusView = (typeof STATUS_VALUES)[number];

const TABS: { value: StatusView; label: string }[] = [
  { value: "new", label: "Нові" },
  { value: "in_progress", label: "В роботі" },
  { value: "done", label: "Опрацьовані" },
  { value: "spam", label: "Спам" },
  { value: "all", label: "Усі" },
];

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("requests:read");
  const db = await getDb();

  const sp = await searchParams;
  const focus = first(sp.focus);
  const statusParam = first(sp.status);
  const kindRaw = first(sp.kind) ?? "";
  const qRaw = first(sp.q) ?? "";
  const assigneeRaw = first(sp.assignee) ?? "";

  const status: StatusView = STATUS_VALUES.includes(statusParam as StatusView)
    ? (statusParam as StatusView)
    : focus
      ? "all"
      : "new";

  const filter: RequestListFilter = {};
  if (status !== "all") filter.status = [status as RequestStatus];
  if (kindRaw && REQUEST_KINDS.includes(kindRaw as CallbackKind)) filter.kind = [kindRaw as CallbackKind];
  if (qRaw) filter.q = qRaw;
  if (assigneeRaw) filter.assigneeId = assigneeRaw;

  const paging = normalizePaging({ page: Number(first(sp.page)) || 1 });

  const [counts, pageData, users] = await Promise.all([
    countRequestsByStatus(db),
    listRequests(db, filter, paging),
    listUsers(db),
  ]);

  // A deep-link (?focus=…) from e.g. a customer card may target a request that is not on this page
  // (older than the newest 25). Fetch it so it can be pinned above the list instead of silently missing.
  const focusInPage = focus ? pageData.items.some((r) => r.id === focus) : true;
  const pinned = focus && !focusInPage ? await getRequest(db, focus) : null;

  const productIds = [
    ...new Set(
      [...pageData.items, ...(pinned ? [pinned] : [])].map((r) => r.productId).filter((v): v is string => Boolean(v)),
    ),
  ];
  const products = await getProductsByIds(productIds);
  const slugById = new Map(products.map((p) => [p.id, p.slug]));

  const canWrite = can(user, "requests:write");
  const activeUsers = users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const allCount = counts.new + counts.in_progress + counts.done + counts.spam;

  function tabHref(value: StatusView): string {
    const params = new URLSearchParams();
    if (value !== "new") params.set("status", value);
    if (kindRaw) params.set("kind", kindRaw);
    if (qRaw) params.set("q", qRaw);
    if (assigneeRaw) params.set("assignee", assigneeRaw);
    const qs = params.toString();
    return qs ? `/admin/requests?${qs}` : "/admin/requests";
  }

  const tabItems = TABS.map((tab) => ({
    label: tab.label,
    href: tabHref(tab.value),
    count: tab.value === "all" ? allCount : counts[tab.value],
    active: status === tab.value,
  }));

  const resetHref = status === "new" ? "/admin/requests" : `/admin/requests?status=${status}`;

  return (
    <div>
      <PageHeader title="Заявки" description="Дзвінки, швидкі замовлення, питання та запити наявності">
        <div className="grid gap-3">
          <SegmentedLinks items={tabItems} ariaLabel="Статус заявок" />
          <FilterBar action="/admin/requests" resetHref={resetHref} hidden={status === "new" ? undefined : { status }}>
            <FilterInput name="q" value={qRaw} placeholder="Імʼя, телефон, товар, коментар" ariaLabel="Пошук заявок" />
            <FilterSelect
              name="kind"
              value={kindRaw}
              options={REQUEST_KINDS.map((kind) => ({ value: kind, label: requestKindLabel[kind] }))}
              allLabel="Усі типи"
              autoSubmit
            />
            <FilterSelect
              name="assignee"
              value={assigneeRaw}
              options={activeUsers.map((u) => ({ value: u.id, label: u.name }))}
              allLabel="Усі відповідальні"
              autoSubmit
            />
          </FilterBar>
        </div>
      </PageHeader>

      {pinned && (
        <div className="mb-3">
          <RequestCard
            request={pinned}
            assigneeName={pinned.assigneeId ? userName.get(pinned.assigneeId) : undefined}
            productHref={
              pinned.productId && slugById.get(pinned.productId) ? `/product/${slugById.get(pinned.productId)}` : undefined
            }
            users={activeUsers}
            canWrite={canWrite}
            focused
          />
        </div>
      )}

      {pageData.items.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
          title="Заявок немає"
          text="Коли покупець залишить заявку на сайті, вона зʼявиться тут. Спробуйте інший статус або змініть фільтри."
        />
      ) : (
        <>
          <div className="grid gap-3">
            {pageData.items.map((request) => {
              const slug = request.productId ? slugById.get(request.productId) : undefined;
              return (
                <RequestCard
                  key={request.id}
                  request={request}
                  assigneeName={request.assigneeId ? userName.get(request.assigneeId) : undefined}
                  productHref={slug ? `/product/${slug}` : undefined}
                  users={activeUsers}
                  canWrite={canWrite}
                  focused={request.id === focus}
                />
              );
            })}
          </div>
          <Pagination
            page={pageData.page}
            pageCount={pageData.pageCount}
            pathname="/admin/requests"
            query={{ ...sp, focus: undefined }}
            className="mt-5"
          />
          <p className="mt-3 text-[13px] text-ink-3">Знайдено: {pageData.total}</p>
        </>
      )}
    </div>
  );
}
