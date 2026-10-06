import { formatDate, formatPrice } from "@/lib/format";
import type { DaySales } from "@/lib/server/db/repos/orders";

/*
 * 30-day sales: revenue as columns, margin as a line, both on one hryvnia axis (margin is always
 * <= revenue, so a single scale is honest — never a second y-axis). Inline SVG rendered on the
 * server, responsive through the viewBox; a visually-hidden table carries the numbers for screen
 * readers, and each column has a <title> for hover.
 *
 * Colours (validated for CVD + contrast in light mode): revenue = brand-600 #0054c6,
 * margin line = ok #14784a. Identity is also carried by the legend and the bar/line forms.
 */

const REVENUE = "#0054c6";
const MARGIN = "#14784a";
const GRID = "#e7eaee";
const AXIS_TEXT = "#5a6072";
const SURFACE = "#ffffff";

const W = 800;
const H = 260;
const M = { top: 18, right: 14, bottom: 30, left: 48 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

function niceScale(max: number, tickCount = 4): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 1] };
  const rough = max / tickCount;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = niceNorm * mag;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= niceMax + step / 1000; v += step) ticks.push(Math.round(v));
  return { max: niceMax, ticks };
}

function tickLabel(v: number): string {
  if (v >= 1_000_000) return `${Math.round(v / 100_000) / 10} млн`;
  if (v >= 1000) return `${Math.round(v / 1000)} тис`;
  return String(v);
}

function dayShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

function topRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

export function SalesChart({ data }: { data: DaySales[] }) {
  const maxVal = Math.max(0, ...data.map((d) => Math.max(d.revenue, d.margin)));
  const { max: scaleMax, ticks } = niceScale(maxVal);
  const n = Math.max(1, data.length);
  const band = PLOT_W / n;
  const barW = Math.min(16, band * 0.6);

  const xCenter = (i: number) => M.left + band * i + band / 2;
  const yFor = (v: number) => M.top + PLOT_H * (1 - v / scaleMax);

  // The axis floor is 0; a loss day (margin < 0) is clamped to the baseline so the line stays in
  // the plot instead of spilling over the x-axis labels. The true value still shows in the tooltip.
  const marginPoints = data.map((d, i) => `${xCenter(i).toFixed(1)},${yFor(Math.max(0, d.margin)).toFixed(1)}`).join(" ");
  const lastIndex = data.length - 1;

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[2px]" style={{ backgroundColor: REVENUE }} />
          Виручка
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded-full" style={{ backgroundColor: MARGIN }} />
          Маржа
        </span>
        <span className="ml-auto">₴ за день</span>
      </figcaption>

      {maxVal === 0 ? (
        <p className="py-10 text-center text-sm text-ink-3">Ще немає продажів за останні 30 днів.</p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="Виручка та маржа за 30 днів"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* gridlines + y ticks */}
          {ticks.map((t) => {
            const y = yFor(t);
            return (
              <g key={t}>
                <line x1={M.left} y1={y} x2={W - M.right} y2={y} stroke={GRID} strokeWidth={1} />
                <text x={M.left - 8} y={y + 3.5} textAnchor="end" fontSize={11} fill={AXIS_TEXT}>
                  {tickLabel(t)}
                </text>
              </g>
            );
          })}

          {/* revenue columns */}
          {data.map((d, i) => {
            if (d.revenue <= 0) return null;
            const h = PLOT_H * (d.revenue / scaleMax);
            const x = xCenter(i) - barW / 2;
            const y = M.top + PLOT_H - h;
            return <path key={d.day} d={topRectPath(x, y, barW, h, 4)} fill={REVENUE} />;
          })}

          {/* margin line */}
          <polyline points={marginPoints} fill="none" stroke={MARGIN} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {lastIndex >= 0 && data[lastIndex].margin > 0 && (
            <circle cx={xCenter(lastIndex)} cy={yFor(data[lastIndex].margin)} r={4} fill={MARGIN} stroke={SURFACE} strokeWidth={2} />
          )}

          {/* x week ticks */}
          {data.map((d, i) =>
            i % 7 === 0 || i === lastIndex ? (
              <text key={`x-${d.day}`} x={xCenter(i)} y={H - 10} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                {dayShort(d.day)}
              </text>
            ) : null,
          )}

          {/* hover hit targets with per-day titles */}
          {data.map((d, i) => (
            <rect key={`hit-${d.day}`} x={M.left + band * i} y={M.top} width={band} height={PLOT_H} fill="transparent">
              <title>{`${formatDate(d.day)}\nВиручка: ${formatPrice(d.revenue)}\nМаржа: ${formatPrice(d.margin)}`}</title>
            </rect>
          ))}
        </svg>
      )}

      {/* sr-only on the <table> itself leaves it 700+px tall (tables ignore height: 1px) and that
          overflow extends the page scroll; a hidden wrapper clips it for real */}
      <div className="sr-only">
        <table>
          <caption>Виручка та маржа за день, останні 30 днів</caption>
          <thead>
            <tr>
              <th scope="col">Дата</th>
              <th scope="col">Виручка</th>
              <th scope="col">Маржа</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.day}>
                <th scope="row">{formatDate(d.day)}</th>
                <td>{formatPrice(d.revenue)}</td>
                <td>{formatPrice(d.margin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
