import { cn } from "@/lib/cn";
import type { TocEntry } from "@/components/blog/toc";

/** Auto-generated «Зміст» with in-page jump links to the article's h2 sections. */
export function ArticleToc({ toc, className }: { toc: TocEntry[]; className?: string }) {
  if (toc.length < 2) return null;

  return (
    <nav aria-label="Зміст статті" className={cn("rounded-card border border-line-soft bg-mist-soft p-5", className)}>
      <p className="text-sm font-semibold text-ink">Зміст</p>
      <ol className="mt-3 space-y-2 text-[15px]">
        {toc.map((entry, i) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className="group flex gap-2.5 text-ink-2 transition-colors hover:text-brand-700">
              <span className="tabular shrink-0 pt-px text-[13px] font-semibold text-brand-600">{i + 1}.</span>
              <span className="underline-offset-2 group-hover:underline">{entry.text}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
