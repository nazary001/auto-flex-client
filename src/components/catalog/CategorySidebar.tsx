import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { CategoryIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { getCategory, getSubcategories, getTopCategories } from "@/lib/catalog";

interface CategorySidebarProps {
  /** Slug of the category being viewed: its group is expanded and the item highlighted */
  activeSlug?: string;
  title?: string;
  className?: string;
}

/** Catalog tree: 12 groups, each expandable to its subcategories. Works without JavaScript. */
export async function CategorySidebar({ activeSlug, title = "Категорії", className }: CategorySidebarProps) {
  const active = activeSlug ? await getCategory(activeSlug) : undefined;
  const activeGroupId = active ? (active.parentId ?? active.id) : undefined;
  const groups = await getTopCategories();
  const groupsWithSubs = await Promise.all(
    groups.map(async (group) => ({ group, subs: await getSubcategories(group.id) })),
  );

  return (
    <nav aria-label={title} className={cn("card overflow-hidden", className)}>
      <p className="bg-navy-900 px-4 py-3 text-[15px] font-semibold text-white">{title}</p>
      <ul className="divide-y divide-line-soft">
        {groupsWithSubs.map(({ group, subs }) => {
          const open = group.id === activeGroupId;
          return (
            <li key={group.id}>
              <details open={open} className="group/cat">
                <summary
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 text-[15px] font-medium transition-colors hover:bg-mist-soft hover:text-brand-700",
                    open ? "text-brand-700" : "text-ink",
                  )}
                >
                  <CategoryIcon name={group.icon} className="size-5 shrink-0 text-brand-700" />
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open/cat:rotate-180"
                  />
                </summary>
                <ul className="grid gap-0.5 bg-mist-soft px-2 py-2">
                  <li>
                    <Link
                      href={`/catalog/${group.slug}`}
                      aria-current={activeSlug === group.slug ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-white hover:text-brand-700",
                        activeSlug === group.slug ? "bg-white font-semibold text-brand-700" : "text-ink-2",
                      )}
                    >
                      Усі товари групи
                    </Link>
                  </li>
                  {subs.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/catalog/${sub.slug}`}
                        aria-current={activeSlug === sub.slug ? "page" : undefined}
                        className={cn(
                          "block rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-white hover:text-brand-700",
                          activeSlug === sub.slug ? "bg-white font-semibold text-brand-700" : "text-ink-2",
                        )}
                      >
                        {sub.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
