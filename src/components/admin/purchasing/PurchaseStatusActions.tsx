"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/admin/ui";
import { toast } from "@/lib/store";
import type { PurchaseOrderStatus } from "@/lib/admin/types";
import { setPurchaseOrderStatusAction } from "@/lib/admin/actions/purchasing";

/** Verb shown on the button that moves a purchase order to the given status. */
const TO_LABEL: Record<PurchaseOrderStatus, string> = {
  draft: "Повернути в чернетку",
  sent: "Надіслати постачальнику",
  confirmed: "Підтверджено постачальником",
  shipped: "Відправлено",
  received: "Отримано",
  cancelled: "Скасувати",
};

interface PurchaseStatusActionsProps {
  id: string;
  transitions: PurchaseOrderStatus[];
  trackingNumber?: string;
}

/** Status transition buttons for the detail page: shipping asks for a TTN, cancelling confirms. */
export function PurchaseStatusActions({ id, transitions, trackingNumber }: PurchaseStatusActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shipOpen, setShipOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [ttn, setTtn] = useState(trackingNumber ?? "");

  function run(to: PurchaseOrderStatus, extra?: { trackingNumber?: string }) {
    startTransition(async () => {
      const result = await setPurchaseOrderStatusAction({ id, to, ...extra });
      if (result.ok) {
        toast({ title: "Статус закупівлі оновлено" });
        setShipOpen(false);
        setCancelOpen(false);
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  if (transitions.length === 0) {
    return <p className="text-[13px] text-ink-3">Статус закупівлі остаточний.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {transitions.map((to) => {
        const danger = to === "cancelled";
        const primary = to === "sent" || to === "confirmed" || to === "shipped" || to === "received";
        const onClick = () => {
          if (to === "shipped") setShipOpen(true);
          else if (to === "cancelled") setCancelOpen(true);
          else run(to);
        };
        if (danger) {
          return (
            <button
              key={to}
              type="button"
              onClick={onClick}
              disabled={pending}
              className={cn("btn btn-sm adm-btn-danger justify-center")}
            >
              {TO_LABEL[to]}
            </button>
          );
        }
        return (
          <Button
            key={to}
            size="sm"
            variant={primary ? "primary" : "secondary"}
            block
            disabled={pending}
            onClick={onClick}
          >
            {TO_LABEL[to]}
          </Button>
        );
      })}

      <Modal open={shipOpen} onClose={() => setShipOpen(false)} title="Відправлення закупівлі" className="max-w-sm">
        <Field label="Номер ТТН" htmlFor="po-ship-ttn" hint="Можна залишити порожнім і додати пізніше.">
          <Input
            id="po-ship-ttn"
            value={ttn}
            onChange={(e) => setTtn(e.target.value)}
            placeholder="20450000000000"
            inputMode="numeric"
          />
        </Field>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShipOpen(false)} disabled={pending}>
            Скасувати
          </Button>
          <Button onClick={() => run("shipped", { trackingNumber: ttn.trim() || undefined })} disabled={pending} aria-busy={pending || undefined}>
            Позначити відправленою
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        title="Скасувати закупівлю?"
        text="Позиції замовлень знову стануть «Очікує закупівлі», їх можна буде додати до іншої закупівлі."
        confirmLabel="Скасувати закупівлю"
        tone="danger"
        pending={pending}
        onConfirm={() => run("cancelled")}
        onClose={() => setCancelOpen(false)}
      />
    </div>
  );
}
