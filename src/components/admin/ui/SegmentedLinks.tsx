import Link from "next/link";
import { cn } from "@/lib/cn";

interface SegItem {
  label: string;
  href: string;
  count?: number;
  active?: boolean;
}

interface SegmentedLinksProps {
  items: SegItem[];
  ariaLabel?: string;
}

/** Saved views / tabs rendered as links; scrolls horizontally on phones. */
export function SegmentedLinks({ items, ariaLabel }: SegmentedLinksProps) {
  return (
    <nav aria-label={ariaLabel} className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1 py-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-btn px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
            item.active ? "bg-navy-900 text-white" : "text-ink-2 hover:bg-mist hover:text-ink",
          )}
        >
          {item.label}
          {typeof item.count === "number" && (
            <span className={cn("tabular text-[12px]", item.active ? "text-white/65" : "text-ink-3")}>
              {item.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
