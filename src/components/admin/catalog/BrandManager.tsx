"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ActionButton, Pill } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/store";
import type { AdminBrandRow } from "@/lib/admin/queries/catalog";
import { saveBrandAction, setBrandHiddenAction } from "@/lib/admin/actions/catalog";
import { slugify } from "./slug";

interface EditState {
  id?: string;
  name: string;
  country: string;
  description: string;
  popular: boolean;
}

export function BrandManager({ brands, canWrite }: { brands: AdminBrandRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (!edit) return;
    start(async () => {
      const result = await saveBrandAction({
        id: edit.id,
        name: edit.name,
        country: edit.country,
        description: edit.description,
        popular: edit.popular,
      });
      if (result.ok) {
        toast({ title: "Бренд збережено" });
        setEdit(null);
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <div>
      {canWrite && (
        <div className="mb-3 flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setEdit({ name: "", country: "", description: "", popular: false })}
          >
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
            Бренд
          </Button>
        </div>
      )}

      <div className="adm-scroll-x rounded-card border border-line-soft bg-white">
        <table className="adm-table adm-table-hover">
          <thead>
            <tr>
              <th scope="col">Назва</th>
              <th scope="col">Слаг</th>
              <th scope="col" className="hidden sm:table-cell">
                Країна
              </th>
              <th scope="col" className="text-right">
                Товарів
              </th>
              <th scope="col">Стан</th>
              <th scope="col" aria-label="Дії" />
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => (
              <tr key={brand.id}>
                <td>
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-ink">{brand.name}</span>
                    {brand.popular && (
                      <Pill tone="violet" size="sm" withDot={false}>
                        Популярний
                      </Pill>
                    )}
                    {brand.hidden && (
                      <Pill tone="slate" size="sm">
                        Приховано
                      </Pill>
                    )}
                  </span>
                </td>
                <td className="tabular text-ink-3">{brand.slug}</td>
                <td className="hidden text-ink-2 sm:table-cell">{brand.country || "—"}</td>
                <td className="tabular text-right text-ink-2">{brand.productCount}</td>
                <td>{brand.edited ? <Pill tone="amber">Змінено</Pill> : <span className="text-ink-3">—</span>}</td>
                <td className="text-right">
                  {canWrite && (
                    <span className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEdit({
                            id: brand.id,
                            name: brand.name,
                            country: brand.country,
                            description: brand.description,
                            popular: brand.popular,
                          })
                        }
                      >
                        Змінити
                      </Button>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        action={() => setBrandHiddenAction({ id: brand.id, hidden: !brand.hidden })}
                        successMessage={brand.hidden ? "Бренд показано" : "Бренд приховано"}
                      >
                        {brand.hidden ? "Показати" : "Приховати"}
                      </ActionButton>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit?.id ? "Редагувати бренд" : "Новий бренд"}>
        {edit && (
          <div className="grid gap-4">
            <Field label="Назва" htmlFor="brand-name" required>
              <Input id="brand-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            {!edit.id && <p className="tabular text-[13px] text-ink-3">Слаг: {slugify(edit.name) || "—"}</p>}
            <Field label="Країна" htmlFor="brand-country">
              <Input id="brand-country" value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })} />
            </Field>
            <Field label="Опис" htmlFor="brand-desc">
              <Textarea id="brand-desc" rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <Checkbox label="Популярний бренд" checked={edit.popular} onChange={(e) => setEdit({ ...edit, popular: e.target.checked })} />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEdit(null)} disabled={pending}>
                Скасувати
              </Button>
              <Button onClick={save} disabled={pending || !edit.name.trim()} aria-busy={pending || undefined}>
                Зберегти
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
