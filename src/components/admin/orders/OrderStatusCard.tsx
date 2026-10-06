"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/Field";
import { Card, StatusBadge } from "@/components/admin/ui";
import { allowedTransitions, suggestNextStep } from "@/lib/admin/domain/order-status";
import { orderStatusMeta } from "@/lib/admin/labels";
import type { Order, OrderStatus } from "@/lib/admin/types";
import { changeOrderStatusAction } from "@/lib/admin/actions/orders";
import { useOrderAction } from "./use-order-action";

interface OrderStatusCardProps {
  order: Order;
  canWrite: boolean;
}

/** Status card: highlighted next step, other allowed transitions, cancel-with-reason and the
 * COD "payment received?" prompt when completing. */
export function OrderStatusCard({ order, canWrite }: OrderStatusCardProps) {
  const { pending, run } = useOrderAction();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [completeOpen, setCompleteOpen] = useState(false);
  const [markPaid, setMarkPaid] = useState(true);

  const meta = orderStatusMeta[order.status];
  const next = suggestNextStep(order);
  const transitions = allowedTransitions(order.status);
  const isCodUnpaid = order.payment.method === "cod" && order.payment.status !== "paid";

  function go(to: OrderStatus) {
    if (to === "completed" && isCodUnpaid) {
      setCompleteOpen(true);
      return;
    }
    run(() => changeOrderStatusAction({ id: order.id, to }), { success: "Статус оновлено" });
  }

  function confirmComplete() {
    run(() => changeOrderStatusAction({ id: order.id, to: "completed", markPaid }), { success: "Замовлення закрито" });
    setCompleteOpen(false);
  }

  function confirmCancel() {
    if (reason.trim().length === 0) return;
    run(() => changeOrderStatusAction({ id: order.id, to: "cancelled", reason: reason.trim() }), { success: "Замовлення скасовано" });
    setCancelOpen(false);
  }

  const secondary = transitions.filter((t) => t !== next?.status && t !== "cancelled");

  return (
    <Card title="Статус">
      <div className="flex items-center gap-2">
        <StatusBadge kind="order" value={order.status} />
      </div>
      {meta.hint && <p className="mt-2 text-[13px] text-ink-3">{meta.hint}</p>}
      {order.status === "cancelled" && order.cancelReason && (
        <p className="mt-2 text-[13px] text-danger">Причина: {order.cancelReason}</p>
      )}

      {canWrite && (
        <div className="mt-4 space-y-2">
          {next && (
            <Button block disabled={pending} onClick={() => go(next.status)}>
              {next.label}
            </Button>
          )}
          {order.status === "confirmed" && !next && (
            <p className="text-[13px] text-ink-3">Спершу створіть закупівлю для позицій, що очікують.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {secondary.length > 0 && (
              <Select
                aria-label="Інший статус"
                value=""
                disabled={pending}
                onChange={(e) => {
                  const to = e.target.value as OrderStatus | "";
                  if (to) go(to);
                }}
                className="h-9 w-auto py-0 text-sm"
              >
                <option value="">Інший статус…</option>
                {secondary.map((t) => (
                  <option key={t} value={t}>
                    {orderStatusMeta[t].label}
                  </option>
                ))}
              </Select>
            )}
            {transitions.includes("cancelled") && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => setCancelOpen(true)} className="text-danger">
                Скасувати
              </Button>
            )}
          </div>
        </div>
      )}

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Скасувати замовлення" className="max-w-md">
        <Field label="Причина скасування" htmlFor="cancel-reason" required>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Напр.: покупець передумав, немає в наявності"
          />
        </Field>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={pending}>
            Назад
          </Button>
          <button
            type="button"
            className="btn adm-btn-danger"
            onClick={confirmCancel}
            disabled={pending || reason.trim().length === 0}
            aria-busy={pending || undefined}
          >
            Скасувати замовлення
          </button>
        </div>
      </Modal>

      <Modal open={completeOpen} onClose={() => setCompleteOpen(false)} title="Закрити замовлення" className="max-w-md">
        <p className="text-[15px] text-ink-2">Це замовлення з оплатою при отриманні. Позначити оплату як отриману?</p>
        <div className="mt-4">
          <Checkbox label="Оплату отримано" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCompleteOpen(false)} disabled={pending}>
            Назад
          </Button>
          <Button onClick={confirmComplete} disabled={pending} aria-busy={pending || undefined}>
            Закрити замовлення
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
