import Link from "next/link";
import { Check } from "lucide-react";

export interface FitRow {
  makeSlug: string;
  makeName: string;
  modelSlug: string;
  modelName: string;
  years: string;
  note?: string;
}

interface CompatibilityTableProps {
  rows: FitRow[];
  universal: boolean;
}

/** The «Сумісність» table — make, model (links to /avto/[make]/[model]), years, engine note. */
export function CompatibilityTable({ rows, universal }: CompatibilityTableProps) {
  if (universal) {
    return (
      <div className="flex items-start gap-3 rounded-card border border-line-soft bg-mist-soft p-4">
        <span className="grid size-9 shrink-0 place-content-center rounded-full bg-white text-brand-700 shadow-card">
          <Check aria-hidden className="size-5" strokeWidth={2} />
        </span>
        <div>
          <p className="font-semibold text-ink">Універсальний товар</p>
          <p className="mt-0.5 text-sm text-ink-2">
            Підходить до більшості автомобілів. Перед замовленням звірте параметри з вимогами виробника вашого авто —
            за потреби надішліть VIN, і ми безкоштовно перевіримо підбір.
          </p>
        </div>
      </div>
    );
  }

  const hasNotes = rows.some((row) => row.note);

  return (
    <div className="overflow-x-auto rounded-card border border-line-soft">
      <table className="w-full min-w-[32rem] text-sm">
        <thead>
          <tr className="bg-mist text-left text-ink">
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Марка
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold">
              Модель
            </th>
            <th scope="col" className="px-4 py-2.5 font-semibold whitespace-nowrap">
              Роки випуску
            </th>
            {hasNotes && (
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Двигун
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.modelSlug}-${index}`} className="border-t border-line-soft">
              <td className="px-4 py-2.5 align-top text-ink-2">{row.makeName}</td>
              <td className="px-4 py-2.5 align-top">
                <Link href={`/avto/${row.makeSlug}/${row.modelSlug}`} className="link font-medium">
                  {row.modelName}
                </Link>
              </td>
              <td className="tabular px-4 py-2.5 align-top whitespace-nowrap text-ink-2">{row.years}</td>
              {hasNotes && <td className="px-4 py-2.5 align-top text-ink-2">{row.note ?? "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
