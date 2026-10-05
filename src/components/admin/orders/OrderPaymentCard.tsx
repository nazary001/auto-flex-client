"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Card, Money, StatusBadge } from "@/components/admin/ui";
import { PAYMENT_STATUSES, paymentMethodLabel, paymentStatusMeta } from "@/lib/admin/labels";
import type { Order, PaymentStatus } from "@/lib/admin/types";
import { updatePaymentAction } from "@/lib/admin/actions/orders";
import { useOrderAction } from "./use-order-action";

interface OrderPaymentCardProps {
  order: Order;
  canWrite: boolean;
}

/** Payment card: status, paid amount, link and invoice; a quick "mark paid" shortcut. */
export function OrderPaymentCard({ order, canWrite }: OrderPaymentCardProps) {
  const { pending, run } = useOrderAction();
  const [status, setStatus] = useState<PaymentStatus>(order.payment.status);
  const [paidAmount, setPaidAmount] = useState(String(order.payment.paidAmount || ""));
  const [paymentLink, setPaymentLink] = useState(order.payment.paymentLink ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(order.payment.invoiceNumber ?? "");

  function save() {
    run(
      () =>
        updatePaymentAction({
          id: order.id,
          status,
          paidAmount: paidAmount ? Number(paidAmount) : 0,
          paymentLink: paymentLink.trim() || undefined,
          invoiceNumber: invoiceNumber.trim() || undefined,
        }),
      { success: "Оплату оновлено" },
    );
  }

  return (
    <Card
      title="Оплата"
      actions={<StatusBadge kind="payment" value={order.payment.status} size="sm" />}
    >
      <p className="text-[13px] text-ink-3">
        {paymentMethodLabel[order.payment.method]}
        {order.payment.paidAmount > 0 && (
          <>
            {" · сплачено "}
            <Money value={order.payment.paidAmount} />
          </>
        )}
      </p>

      {!canWrite ? (
        <div className="mt-3 space-y-1 text-sm">
          {order.payment.invoiceNumber && <p className="text-ink-2">Рахунок: {order.payment.invoiceNumber}</p>}
          {order.payment.paymentLink && (
            <a href={order.payment.paymentLink} className="link break-all" target="_blank" rel="noopener noreferrer">
              Посилання на оплату
            </a>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Field label="Статус оплати" htmlFor="pay-status">
            <Select id="pay-status" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {paymentStatusMeta[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Сплачено, ₴" htmlFor="pay-amount">
            <Input
              id="pay-amount"
              type="number"
              min={0}
              inputMode="numeric"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
          </Field>
          <Field label="Посилання на оплату" htmlFor="pay-link">
            <Input id="pay-link" type="url" value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Номер рахунку" htmlFor="pay-invoice">
            <Input id="pay-invoice" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={pending} onClick={save}>
              Зберегти
            </Button>
            {order.payment.status !== "paid" && (
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => updatePaymentAction({ id: order.id, status: "paid", paidAmount: order.total }), {
                    success: "Позначено оплаченим",
                  })
                }
              >
                Позначити оплаченим
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
