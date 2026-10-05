import type { Metadata } from "next";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSearchResults, MIN_QUERY_LENGTH } from "@/lib/admin/queries/search";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { SearchResults } from "@/components/admin/search/SearchResults";

export const metadata: Metadata = { title: "Пошук" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await requireUser("orders:read");
  const sp = await searchParams;
  const query = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const db = await getDb();
  const data = await getSearchResults(db, query);

  let body;
  if (query.length === 0) {
    body = (
      <EmptyState
        icon={<Search />}
        title="Почніть пошук"
        text="Введіть номер замовлення, телефон, артикул або імʼя клієнта у рядку пошуку вгорі."
      />
    );
  } else if (data.tooShort) {
    body = (
      <EmptyState
        icon={<Search />}
        title="Замало символів"
        text={`Введіть щонайменше ${MIN_QUERY_LENGTH} символи для пошуку.`}
      />
    );
  } else if (data.empty) {
    body = (
      <EmptyState
        icon={<Search />}
        title="Нічого не знайдено"
        text={`За запитом «${query}» нічого не знайдено. Перевірте написання або спробуйте інший запит.`}
      />
    );
  } else {
    body = <SearchResults data={data} />;
  }

  return (
    <div>
      <PageHeader
        title="Пошук"
        description={query ? `Результати за запитом «${query}»` : "Замовлення, клієнти, товари, закупівлі та заявки."}
      />
      {body}
    </div>
  );
}
