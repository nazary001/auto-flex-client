"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import { buttonClass } from "@/components/ui/Button";
import { deleteOrderAction } from "@/lib/admin/actions/orders";
import { useOrderAction } from "./use-order-action";

/** Owner-only: removes a test / duplicate order with its history and purchase lines (real orders are cancelled instead) */
export function OrderDeleteButton({ id, number }: { id: string; number: string }) {
  const router = useRouter();
  const { pending, run } = useOrderAction();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className={buttonClass({ variant: "ghost", size: "sm", className: "text-danger" })}
      >
        <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
        Видалити
      </button>
      <ConfirmDialog
        open={open}
        title="Видалити замовлення?"
        text={
          <>
            Замовлення <b className="tabular">{number}</b> зникне разом з історією, а його позиції буде прибрано з
            закупівель. Дію не можна скасувати. Для звичайних замовлень використовуйте статус «Скасовано».
          </>
        }
        confirmLabel="Видалити назавжди"
        tone="danger"
        pending={pending}
        onClose={() => setOpen(false)}
        onConfirm={() =>
          run(() => deleteOrderAction({ id }), {
            success: `Замовлення ${number} видалено`,
            refresh: false,
            onSuccess: () => router.push("/admin/orders"),
          })
        }
      />
    </>
  );
}
