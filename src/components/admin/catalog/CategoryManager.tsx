"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { ActionButton, Pill } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { CategoryIcon } from "@/components/icons";
import { toast } from "@/lib/store";
import type { AdminCategoryGroup, AdminCategoryLeaf } from "@/lib/admin/queries/catalog";
import { saveCategoryAction, setCategoryHiddenAction } from "@/lib/admin/actions/catalog";
import { slugify } from "./slug";

// The 22 DD Tuning supplier group keys first, then the legacy spare-parts keys.
const ICON_KEYS = [
  "fluids", "soundproofing", "chrome", "bullbar", "roofrack", "bodykit", "mats", "mudflaps",
  "hubcaps", "covers", "badges", "accessories", "deflectors", "interior", "lighting", "underbody",
  "plastic", "electronics", "body", "wheels", "lamps", "offroad",
  "brakes", "engine", "filters", "suspension", "transmission", "electrics", "cooling", "exhaust",
];

interface EditState {
  mode: "group" | "leaf" | "new";
  group: AdminCategoryGroup;
  leaf?: AdminCategoryLeaf;
  name: string;
  description: string;
  icon: string;
  illustration: string;
}

interface CategoryManagerProps {
  groups: AdminCategoryGroup[];
  illustrationKeys: string[];
  canWrite: boolean;
}

export function CategoryManager({ groups, illustrationKeys, canWrite }: CategoryManagerProps) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [pending, start] = useTransition();

  function openGroup(group: AdminCategoryGroup) {
    setEdit({ mode: "group", group, name: group.name, description: group.description ?? "", icon: group.icon ?? "accessories", illustration: "" });
  }
  function openLeaf(group: AdminCategoryGroup, leaf: AdminCategoryLeaf) {
    setEdit({ mode: "leaf", group, leaf, name: leaf.name, description: "", icon: "", illustration: leaf.illustration });
  }
  function openNew(group: AdminCategoryGroup) {
    setEdit({ mode: "new", group, name: "", description: "", icon: "", illustration: illustrationKeys[0] ?? "" });
  }

  function save() {
    if (!edit) return;
    const input =
      edit.mode === "group"
        ? { id: edit.group.id, name: edit.name, description: edit.description, icon: edit.icon }
        : edit.mode === "leaf"
          ? { id: edit.leaf!.id, name: edit.name, illustration: edit.illustration }
          : { parentId: edit.group.id, name: edit.name, illustration: edit.illustration };
    start(async () => {
      const result = await saveCategoryAction(input);
      if (result.ok) {
        toast({ title: "Категорію збережено" });
        setEdit(null);
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <section key={group.id} className="rounded-card border border-line-soft bg-white">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-content-center rounded-card bg-mist text-brand-700 [&>svg]:size-5">
                <CategoryIcon name={group.icon} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[15px] font-semibold text-ink">{group.name}</h2>
                  {group.hidden && <Pill tone="slate" size="sm">Приховано</Pill>}
                  {group.edited && <Pill tone="amber" size="sm">Змінено</Pill>}
                </div>
                {group.description && <p className="mt-0.5 max-w-2xl text-[13px] text-ink-3">{group.description}</p>}
                <p className="tabular mt-0.5 text-[12px] text-ink-3">{group.productCount} товарів</p>
              </div>
            </div>
            {canWrite && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => openGroup(group)}>
                  <Pencil aria-hidden className="size-4" strokeWidth={1.75} />
                  Редагувати
                </Button>
                <Button variant="secondary" size="sm" onClick={() => openNew(group)}>
                  <Plus aria-hidden className="size-4" strokeWidth={1.75} />
                  Категорію
                </Button>
              </div>
            )}
          </header>
          <ul className="divide-y divide-line-soft">
            {group.leaves.map((leaf) => (
              <li key={leaf.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-ink">{leaf.name}</span>
                  <span className="tabular ml-2 text-[12px] text-ink-3">{leaf.slug}</span>
                  {leaf.hidden && (
                    <Pill tone="slate" size="sm" className="ml-2">
                      Приховано
                    </Pill>
                  )}
                  {leaf.edited && (
                    <Pill tone="amber" size="sm" className="ml-2">
                      Змінено
                    </Pill>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular text-[13px] text-ink-3">{leaf.productCount}</span>
                  {canWrite && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => openLeaf(group, leaf)}>
                        Змінити
                      </Button>
                      {leaf.hidden ? (
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          action={() => setCategoryHiddenAction({ id: leaf.id, hidden: false })}
                          successMessage="Категорію показано"
                        >
                          Показати
                        </ActionButton>
                      ) : (
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          action={() => setCategoryHiddenAction({ id: leaf.id, hidden: true })}
                          successMessage="Категорію приховано"
                          confirm={{
                            title: "Приховати категорію?",
                            text: "Категорія зникне з сайту. Товари не видаляються — вони залишаться в каталозі.",
                          }}
                        >
                          Приховати
                        </ActionButton>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Modal
        open={edit !== null}
        onClose={() => setEdit(null)}
        title={edit?.mode === "group" ? "Редагувати групу" : edit?.mode === "leaf" ? "Редагувати категорію" : "Нова категорія"}
      >
        {edit && (
          <div className="grid gap-4">
            <Field label="Назва" htmlFor="cat-name" required>
              <Input id="cat-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            {edit.mode === "new" && (
              <p className="tabular text-[13px] text-ink-3">Слаг: {slugify(edit.name) || "—"}</p>
            )}
            {edit.mode === "group" && (
              <>
                <Field label="Опис" htmlFor="cat-desc">
                  <Textarea id="cat-desc" rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                </Field>
                <Field label="Іконка" htmlFor="cat-icon">
                  <Select id="cat-icon" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })}>
                    {ICON_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
            {edit.mode !== "group" && (
              <Field label="Ілюстрація" htmlFor="cat-illu" hint="Файл у /illustrations">
                <Select id="cat-illu" value={edit.illustration} onChange={(e) => setEdit({ ...edit, illustration: e.target.value })}>
                  {illustrationKeys.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
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
