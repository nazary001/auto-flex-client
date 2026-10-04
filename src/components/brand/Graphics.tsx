import { cn } from "@/lib/cn";

/*
 * Decorative brand graphics from the brandbook («Фірмова графіка»).
 * All of them are aria-hidden; position them with utility classes.
 */

/** The logo swoosh: a blue arc with two silver arcs */
export function Swoosh({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const blue = onDark ? "#0C80E8" : "#0463B4";
  const silver = onDark ? "#B4B8BF" : "#A6A9AE";
  return (
    <svg viewBox="96 -1 64 30" fill="none" aria-hidden className={cn("block", className)}>
      <path
        d="M99 4.15955C115.187 0.101557 154.642 0.355397 144.272 10.5C167.794 -1.41993 124.039 -2.68825 99 4.15955Z"
        fill={blue}
      />
      <path
        d="M105 4.26069C116.825 2.65828 139.971 3.45971 144.5 8C141.481 1.32274 115.315 1.58987 105 4.26069Z"
        fill={silver}
      />
      <path d="M109 28C123.008 24.815 157.378 9.184 151.775 3.5C168.785 12.516 130.346 23.59 109 28Z" fill={silver} />
    </svg>
  );
}

/** Diagonal speed stripes: blue, deep blue and silver lanes rising to the right */
export function SpeedStripes({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <svg viewBox="0 0 300 120" fill="none" aria-hidden preserveAspectRatio="none" className={cn("block", className)}>
      <path d="M0 120H64L300 0h-58L0 120Z" fill={onDark ? "#0C80E8" : "#0054C6"} />
      <path d="M92 120h38L300 32V12L92 120Z" fill={onDark ? "#0054C6" : "#003072"} />
      <path d="M154 120h24l122-62V46L154 120Z" fill={onDark ? "#B4B8BF" : "#A6A9AE"} />
    </svg>
  );
}

/** Two slanted bars echoing the logo italics — the marker in front of section titles */
export function SlashMark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 gap-[3px]", className)}>
      <i className={cn("block h-[1em] w-[0.28em] -skew-x-[18deg] rounded-[1px]", onDark ? "bg-brand-400" : "bg-brand-600")} />
      <i className="block h-[1em] w-[0.16em] -skew-x-[18deg] rounded-[1px] bg-silver-500" />
    </span>
  );
}
