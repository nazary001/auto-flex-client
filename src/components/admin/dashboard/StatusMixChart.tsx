import { OPEN_ORDER_STATUSES, orderStatusMeta } from "@/lib/admin/labels";
import type { OrderStatus } from "@/lib/admin/types";
import type { StatusCounts } from "@/lib/server/db/repos/orders";

/*
 * Open orders by status as one horizontal stacked bar (part-to-whole). Inline SVG, responsive via
 * the viewBox; the legend list carries the labels + counts (identity never rests on colour alone)
 * and an sr-only table carries the numbers.
 *
 * Solid fills, validated for CVD + contrast in light mode. `on_hold` (the off-flow bucket) is set
 * apart by a wider gap, which also keeps the amber↔slate pair from touching.
 */

const fill: Record<string, string> = {
  new: "#0054c6", // brand-600
  confirmed: "#0f766e", // teal
  sourcing: "#6d28d9", // violet
  in_transit: "#96590a", // warn (amber)
  on_hold: "#5a6072", // ink-3 (slate)
};

const VBW = 720;
const VBH = 24;
const GAP_SMALL = 2;
const GAP_BIG = 8;

export function StatusMixChart({ counts }: { counts: StatusCounts }) {
  const open = OPEN_ORDER_STATUSES;
  const total = open.reduce((sum, s) => sum + counts[s].count, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-ink-3">Немає відкритих замовлень.</p>;
  }

  const bars = open.filter((s) => counts[s].count > 0);
  const gaps = bars.map((s, i): number => (i === 0 ? 0 : s === "on_hold" ? GAP_BIG : GAP_SMALL));
  const avail = VBW - gaps.reduce((a, b) => a + b, 0);
  const segments: { status: OrderStatus; x: number; w: number }[] = [];
  let cursor = 0;
  bars.forEach((status, i) => {
    cursor += gaps[i];
    const w = (avail * counts[status].count) / total;
    segments.push({ status, x: cursor, w });
    cursor += w;
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        className="h-6 w-full"
        role="img"
        aria-label="Розподіл відкритих замовлень за статусом"
        preserveAspectRatio="none"
      >
        {segments.map(({ status, x, w }) => {
          const meta = orderStatusMeta[status];
          const pct = Math.round((counts[status].count / total) * 100);
          return (
            <rect key={status} x={x} y={0} width={Math.max(0, w)} height={VBH} rx={4} fill={fill[status]}>
              <title>{`${meta.label}: ${counts[status].count} (${pct}%)`}</title>
            </rect>
          );
        })}
      </svg>

      <ul className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {open.map((status) => {
          const meta = orderStatusMeta[status];
          const count = counts[status].count;
          const pct = Math.round((count / total) * 100);
          return (
            <li key={status} className="flex items-center gap-2 text-[13px]">
              <span aria-hidden className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: fill[status] }} />
              <span className="min-w-0 flex-1 truncate text-ink-2">{meta.label}</span>
              <span className="tabular font-semibold text-ink">{count}</span>
              <span className="tabular w-9 text-right text-ink-3">{pct}%</span>
            </li>
          );
        })}
      </ul>

      <table className="sr-only">
        <caption>Відкриті замовлення за статусом</caption>
        <thead>
          <tr>
            <th scope="col">Статус</th>
            <th scope="col">Кількість</th>
            <th scope="col">Частка</th>
          </tr>
        </thead>
        <tbody>
          {open.map((status) => (
            <tr key={status}>
              <th scope="row">{orderStatusMeta[status].label}</th>
              <td>{counts[status].count}</td>
              <td>{Math.round((counts[status].count / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
