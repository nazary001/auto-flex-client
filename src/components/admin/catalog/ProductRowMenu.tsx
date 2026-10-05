"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Dropdown, type DropdownItem } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import { toast } from "@/lib/store";
import type { ActionResult } from "@/lib/admin/actions/_action";
import {
  deleteProductAction,
  resetProductOverridesAction,
  setProductHiddenAction,
} from "@/lib/admin/actions/catalog";
import type { ProductSource } from "@/lib/server/db/collections";

interface ProductRowMenuProps {
  id: string;
  slug: string;
  source: ProductSource;
  edited: boolean;
  hidden: boolean;
  canWrite: boolean;
}

export function ProductRowMenu({ id, slug, source, edited, hidden, canWrite }: ProductRowMenuProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function run(action: () => Promise<ActionResult<unknown>>, success: string) {
    start(async () => {
      const result = await action();
      if (result.ok) {
        toast({ title: success });
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  const items: DropdownItem[] = [
    { label: "Редагувати", href: `/admin/products/${id}` },
    { label: "Переглянути на сайті", onSelect: () => window.open(`/product/${slug}`, "_blank", "noopener") },
  ];
  if (canWrite) {
    items.push({
      label: hidden ? "Показати" : "Приховати",
      onSelect: () => run(() => setProductHiddenAction({ id, hidden: !hidden }), hidden ? "Товар показано" : "Товар приховано"),
    });
    if (source === "ddtuning" && edited) {
      items.push({
        label: "Скинути зміни",
        onSelect: () => run(() => resetProductOverridesAction({ id }), "Зміни скинуто"),
      });
    }
    if (source !== "ddtuning") {
      items.push({ label: "Видалити", tone: "danger", onSelect: () => setConfirmOpen(true) });
    }
  }

  return (
    <>
      <Dropdown
        ariaLabel="Дії з товаром"
        className="grid size-8 place-content-center rounded-btn text-ink-3 transition-colors hover:bg-mist hover:text-ink"
        trigger={<MoreHorizontal aria-hidden className="size-4" strokeWidth={1.75} />}
        items={items}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Видалити товар?"
        text="Товар буде видалено назавжди. Цю дію не можна скасувати."
        confirmLabel="Видалити"
        tone="danger"
        pending={pending}
        onConfirm={() => run(() => deleteProductAction({ id }), "Товар видалено")}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
