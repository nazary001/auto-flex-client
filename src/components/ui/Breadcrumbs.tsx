import Link from "next/link";
import { ChevronRight, House } from "lucide-react";
import { cn } from "@/lib/cn";
import { site } from "@/lib/site";

export interface Crumb {
  label: string;
  /** Omit for the current page (last item) */
  href?: string;
}

/** «Головна» is prepended automatically. Emits BreadcrumbList JSON-LD. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const all: Crumb[] = [{ label: "Головна", href: "/" }, ...items];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      ...(crumb.href ? { item: new URL(crumb.href, site.url).toString() } : {}),
    })),
  };

  return (
    <nav aria-label="Навігаційний ланцюжок" className={cn("scrollbar-none -mx-1 overflow-x-auto", className)}>
      <ol className="flex w-max items-center gap-1 px-1 text-[13px] text-ink-3">
        {all.map((crumb, index) => {
          const last = index === all.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight aria-hidden className="size-3.5 text-silver-400" />}
              {crumb.href && !last ? (
                <Link
                  href={crumb.href}
                  className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition-colors hover:text-brand-700"
                >
                  {index === 0 && <House aria-hidden className="size-3.5" />}
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="px-1 py-0.5 text-ink-2">
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </nav>
  );
}
