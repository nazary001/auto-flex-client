import Link from "next/link";

export interface SpecRow {
  label: string;
  value: string;
  /** When set, the value renders as a link (brand / category) */
  href?: string;
  /** Render the value with tabular figures (SKU, numbers) */
  tabular?: boolean;
}

/** The «Характеристики» table: a two-column list of label → value rows. */
export function SpecsTable({ rows }: { rows: SpecRow[] }) {
  return (
    <div className="overflow-hidden rounded-card border border-line-soft">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.label} className={index % 2 === 1 ? "bg-mist-soft" : "bg-white"}>
              <th scope="row" className="w-1/2 px-4 py-2.5 text-left align-top font-medium text-ink-3 sm:w-[42%]">
                {row.label}
              </th>
              <td className={`px-4 py-2.5 align-top text-ink ${row.tabular ? "tabular" : ""}`}>
                {row.href ? (
                  <Link href={row.href} className="link font-medium">
                    {row.value}
                  </Link>
                ) : (
                  row.value
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
