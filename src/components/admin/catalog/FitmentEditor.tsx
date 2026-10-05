"use client";

import { useCallback, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { listModelsAction } from "@/lib/admin/actions/catalog";

export interface FitmentDraft {
  makeId: string;
  modelId: string;
  years: string;
  note: string;
}

type Model = { id: string; makeId: string; name: string };

interface FitmentEditorProps {
  rows: FitmentDraft[];
  onChange: (rows: FitmentDraft[]) => void;
  makes: { id: string; name: string }[];
  /** Models of the makes already referenced; the rest load on demand */
  initialModels: Model[];
}

function seed(initialModels: Model[]): Record<string, Model[]> {
  const map: Record<string, Model[]> = {};
  for (const m of initialModels) (map[m.makeId] ??= []).push(m);
  return map;
}

export function FitmentEditor({ rows, onChange, makes, initialModels }: FitmentEditorProps) {
  const [modelsByMake, setModelsByMake] = useState<Record<string, Model[]>>(() => seed(initialModels));
  const requestedRef = useRef<Set<string> | null>(null);
  if (requestedRef.current === null) requestedRef.current = new Set(Object.keys(modelsByMake));

  // Fetch a make's models once (on selection). Models for the product's existing fitment are
  // already seeded from `initialModels`, so no load is needed on mount.
  const loadModels = useCallback(async (makeId: string) => {
    const requested = requestedRef.current!;
    if (!makeId || requested.has(makeId)) return;
    requested.add(makeId);
    const result = await listModelsAction({ makeId });
    if (result.ok) setModelsByMake((prev) => ({ ...prev, [makeId]: result.data.models }));
  }, []);

  function update(index: number, patch: Partial<FitmentDraft>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="grid gap-2.5">
      {rows.length === 0 && <p className="text-sm text-ink-3">Сумісність не вказано. Додайте марку й модель.</p>}
      {rows.map((row, index) => {
        const forMake = modelsByMake[row.makeId] ?? [];
        const isLoading = Boolean(row.makeId) && !modelsByMake[row.makeId];
        return (
          <div key={index} className="grid gap-2 rounded-card border border-line-soft p-2.5 sm:grid-cols-[1fr_1fr_auto]">
            <select
              value={row.makeId}
              onChange={(e) => {
                update(index, { makeId: e.target.value, modelId: "" });
                void loadModels(e.target.value);
              }}
              aria-label="Марка"
              className="field field-sm"
            >
              <option value="">Марка…</option>
              {makes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={row.modelId}
              onChange={(e) => update(index, { modelId: e.target.value })}
              aria-label="Модель"
              disabled={!row.makeId || isLoading}
              className="field field-sm"
            >
              <option value="">{isLoading ? "Завантаження…" : "Модель…"}</option>
              {forMake.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              aria-label="Прибрати рядок сумісності"
              className="grid size-9 place-content-center self-start rounded-btn text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
            </button>
            <input
              value={row.years}
              onChange={(e) => update(index, { years: e.target.value })}
              placeholder="Роки, напр. 2013–2020"
              aria-label="Роки"
              className="field field-sm sm:col-span-1"
            />
            <input
              value={row.note}
              onChange={(e) => update(index, { note: e.target.value })}
              placeholder="Двигуни / примітка"
              aria-label="Примітка"
              className="field field-sm sm:col-span-2"
            />
          </div>
        );
      })}
      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...rows, { makeId: "", modelId: "", years: "", note: "" }])}
        >
          <Plus aria-hidden className="size-4" strokeWidth={1.75} />
          Додати сумісність
        </Button>
      </div>
    </div>
  );
}
