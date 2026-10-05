"use client";

import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ActionButton } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/Button";
import {
  deleteProductAction,
  resetProductOverridesAction,
  setProductHiddenAction,
} from "@/lib/admin/actions/catalog";
import type { ProductSource } from "@/lib/server/db/collections";

interface ProductHeaderActionsProps {
  id: string;
  slug: string;
  source: ProductSource;
  edited: boolean;
  hidden: boolean;
  canWrite: boolean;
}

export function ProductHeaderActions({ id, slug, source, edited, hidden, canWrite }: ProductHeaderActionsProps) {
  const router = useRouter();

  return (
    <>
      <a href={`/product/${slug}`} target="_blank" rel="noopener" className={buttonClass({ variant: "secondary", size: "sm" })}>
        <ExternalLink aria-hidden className="size-4" strokeWidth={1.75} />
        Переглянути на сайті
      </a>
      {canWrite && (
        <ActionButton
          variant="secondary"
          size="sm"
          action={() => setProductHiddenAction({ id, hidden: !hidden })}
          successMessage={hidden ? "Товар показано" : "Товар приховано"}
        >
          {hidden ? "Показати" : "Приховати"}
        </ActionButton>
      )}
      {canWrite && source === "ddtuning" && edited && (
        <ActionButton
          variant="ghost"
          size="sm"
          action={() => resetProductOverridesAction({ id })}
          successMessage="Зміни скинуто"
          confirm={{ title: "Скинути зміни?", text: "Товар повернеться до даних постачальника." }}
        >
          Скинути зміни
        </ActionButton>
      )}
      {canWrite && source !== "ddtuning" && (
        <ActionButton
          variant="ghost"
          size="sm"
          action={() => deleteProductAction({ id })}
          successMessage="Товар видалено"
          refresh={false}
          confirm={{ title: "Видалити товар?", text: "Товар буде видалено назавжди.", tone: "danger", confirmLabel: "Видалити" }}
          onSuccess={() => router.push("/admin/products")}
        >
          Видалити
        </ActionButton>
      )}
    </>
  );
}
