import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { buildListingHref, RESET_FILTERS_PATCH, type RawSearchParams } from "@/components/listing/params";

/** Default empty state inside a listing (0 results); pages may pass their own via the `empty` prop. */
export function ListingEmpty({
  pathname,
  searchParams,
  hasFilters,
}: {
  pathname: string;
  searchParams: RawSearchParams;
  hasFilters: boolean;
}) {
  if (hasFilters) {
    return (
      <EmptyState
        icon={<PackageSearch />}
        title="За фільтрами нічого не знайшли"
        text="Спробуйте прибрати частину фільтрів, розширити діапазон ціни або обрати іншого виробника."
        action={
          <Link
            href={buildListingHref(pathname, searchParams, RESET_FILTERS_PATCH)}
            scroll={false}
            className={buttonClass({ variant: "secondary" })}
          >
            Скинути фільтри
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={<PackageSearch />}
      title="Тут поки немає товарів"
      text="Ми щодня додаємо нові позиції. Перегляньте інші категорії або скористайтеся пошуком за артикулом."
      action={
        <Link href="/catalog" className={buttonClass({ variant: "secondary" })}>
          До каталогу
        </Link>
      }
    />
  );
}
