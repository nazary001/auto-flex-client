import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { FilterBar, FilterInput, PageHeader, SegmentedLinks } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { can } from "@/lib/admin/permissions";
import type { ReviewStatus } from "@/lib/admin/types";
import { listAdminReviews, reviewStatusCounts } from "@/lib/admin/queries/catalog";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { ReviewsBoard } from "@/components/admin/catalog/ReviewsBoard";

export const metadata: Metadata = { title: "Відгуки" };

type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

const STATUSES: ReviewStatus[] = ["pending", "approved", "rejected"];

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser("content:read");
  const db = await getDb();

  const sp = await searchParams;
  const statusParam = first(sp.status);
  const status = statusParam && STATUSES.includes(statusParam as ReviewStatus) ? (statusParam as ReviewStatus) : undefined;
  const q = first(sp.q)?.trim() || undefined;
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const [counts, result] = await Promise.all([reviewStatusCounts(db), listAdminReviews(db, { status, q }, page)]);
  const total = counts.pending + counts.approved + counts.rejected;

  const tab = (label: string, value?: ReviewStatus, count?: number) => ({
    label,
    href: value ? `/admin/reviews?status=${value}` : "/admin/reviews",
    count,
    active: status === value,
  });

  return (
    <div>
      <PageHeader title="Відгуки" description="Модерація відгуків про товари">
        <div className="grid gap-3">
          <SegmentedLinks
            ariaLabel="Статус відгуків"
            items={[
              tab("На модерації", "pending", counts.pending),
              tab("Опубліковані", "approved", counts.approved),
              tab("Відхилені", "rejected", counts.rejected),
              tab("Усі", undefined, total),
            ]}
          />
          <FilterBar action="/admin/reviews" resetHref={status ? `/admin/reviews?status=${status}` : "/admin/reviews"} hidden={status ? { status } : undefined}>
            <FilterInput name="q" value={q} placeholder="Автор, текст, авто" />
          </FilterBar>
        </div>
      </PageHeader>

      {result.items.length === 0 ? (
        q ? (
          <p className="rounded-card border border-line-soft bg-white px-4 py-10 text-center text-sm text-ink-3">
            За вашим запитом відгуків не знайдено.
          </p>
        ) : (
          <EmptyState icon={<MessageSquare />} title="Відгуків немає" text="Нові відгуки з сайту зʼявляться тут на модерації." />
        )
      ) : (
        <>
          <ReviewsBoard rows={result.items} canWrite={can(user, "content:write")} />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            pathname="/admin/reviews"
            query={{ status, q }}
            className="mt-6"
          />
        </>
      )}
    </div>
  );
}
