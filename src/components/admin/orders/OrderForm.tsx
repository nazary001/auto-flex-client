"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Card, Money } from "@/components/admin/ui";
import { computeTotals, marginPercent } from "@/lib/admin/domain/money";
import {
  DELIVERY_METHODS,
  ORDER_SOURCES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  carrierLabel,
  deliveryMethodLabel,
  orderSourceLabel,
  paymentMethodLabel,
  paymentStatusMeta,
} from "@/lib/admin/labels";
import { isValidUaPhone } from "@/lib/format";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";
import type { Carrier, OrderLine, OrderSource, PaymentStatus } from "@/lib/admin/types";
import { createOrderAction, lookupCustomerAction, updateOrderAction } from "@/lib/admin/actions/orders";
import { toast } from "@/lib/store";
import { OrderLinesField } from "./OrderLinesField";
import type { FormState } from "./order-form-model";

interface OrderFormProps {
  mode: "create" | "edit";
  orderId?: string;
  initial: FormState;
  suppliers: { id: string; name: string }[];
  assignees: { id: string; name: string }[];
  defaultMarkupPercent: number;
  requestId?: string;
}

const CARRIERS: Carrier[] = ["nova_poshta", "ukrposhta", "other"];

export function OrderForm({ mode, orderId, initial, suppliers, assignees, defaultMarkupPercent, requestId }: OrderFormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(initial);
  const [pending, startTransition] = useTransition();
  const [looking, startLooking] = useTransition();

  const patchCustomer = (p: Partial<FormState["customer"]>) => setState((s) => ({ ...s, customer: { ...s.customer, ...p } }));
  const patchDelivery = (p: Partial<FormState["delivery"]>) => setState((s) => ({ ...s, delivery: { ...s.delivery, ...p } }));
  const patchPayment = (p: Partial<FormState["payment"]>) => setState((s) => ({ ...s, payment: { ...s.payment, ...p } }));

  const pseudoLines: OrderLine[] = state.lines.map((l) => ({
    id: l.id ?? "",
    productId: l.productId,
    sku: l.sku,
    name: l.name,
    price: Number(l.price) || 0,
    qty: Number(l.qty) || 1,
    discount: Number(l.discount) || 0,
    costPrice: l.costPrice ? Number(l.costPrice) : undefined,
    fulfillment: "pending",
  }));
  const totals = computeTotals(pseudoLines, { cost: Number(state.delivery.cost) || undefined, costPayer: state.delivery.costPayer }, Number(state.orderDiscount) || 0);
  const pct = marginPercent({ total: totals.total, margin: totals.margin, marginKnown: totals.marginKnown });

  function lookup() {
    if (!isValidUaPhone(state.customer.phone)) {
      toast({ title: "Введіть коректний номер телефону.", tone: "error" });
      return;
    }
    startLooking(async () => {
      const result = await lookupCustomerAction({ phone: state.customer.phone });
      if (!result.ok) {
        toast({ title: result.error, tone: "error" });
        return;
      }
      if (!result.data.found) {
        toast({ title: "Новий клієнт — заповніть дані." });
        return;
      }
      const d = result.data;
      setState((s) => ({
        ...s,
        customer: {
          customerId: d.customerId,
          firstName: d.firstName ?? s.customer.firstName,
          lastName: d.lastName ?? s.customer.lastName,
          phone: s.customer.phone,
          email: d.email ?? s.customer.email,
        },
        delivery: { ...s.delivery, city: d.city ?? s.delivery.city },
        doNotCall: d.doNotCall ?? s.doNotCall,
      }));
      toast({ title: `Клієнта знайдено · замовлень: ${d.ordersCount ?? 0}` });
    });
  }

  function submit() {
    if (state.lines.length === 0) {
      toast({ title: "Додайте хоча б одну позицію.", tone: "error" });
      return;
    }
    if (!isValidUaPhone(state.customer.phone)) {
      toast({ title: "Введіть коректний номер телефону.", tone: "error" });
      return;
    }
    if (!state.customer.firstName.trim() || !state.customer.lastName.trim()) {
      toast({ title: "Вкажіть імʼя та прізвище покупця.", tone: "error" });
      return;
    }

    const input = {
      ...(mode === "edit" ? { id: orderId } : {}),
      ...(mode === "create" && requestId ? { requestId } : {}),
      source: state.source,
      customer: {
        customerId: state.customer.customerId || undefined,
        firstName: state.customer.firstName.trim(),
        lastName: state.customer.lastName.trim(),
        phone: state.customer.phone,
        email: state.customer.email.trim() || undefined,
      },
      delivery: {
        method: state.delivery.method,
        city: state.delivery.city.trim(),
        address: state.delivery.address.trim(),
        carrier: state.delivery.carrier,
        cost: state.delivery.cost ? Number(state.delivery.cost) : undefined,
        costPayer: state.delivery.costPayer,
      },
      payment: {
        method: state.payment.method,
        status: state.payment.status,
        paidAmount: state.payment.paidAmount ? Number(state.payment.paidAmount) : undefined,
        paymentLink: state.payment.paymentLink.trim() || undefined,
        invoiceNumber: state.payment.invoiceNumber.trim() || undefined,
      },
      lines: state.lines.map((l) => ({
        id: l.id,
        productId: l.productId,
        sku: l.sku.trim(),
        name: l.name.trim(),
        optionLabel: l.optionLabel || undefined,
        price: Number(l.price) || 0,
        qty: Number(l.qty) || 1,
        discount: l.discount ? Number(l.discount) : undefined,
        costPrice: l.costPrice ? Number(l.costPrice) : undefined,
        supplierId: l.supplierId || undefined,
        note: l.note.trim() || undefined,
      })),
      orderDiscount: state.orderDiscount ? Number(state.orderDiscount) : undefined,
      comment: state.comment.trim() || undefined,
      vehicle: state.vehicle.trim() || undefined,
      managerNote: state.managerNote.trim() || undefined,
      doNotCall: state.doNotCall,
      assigneeId: state.assigneeId || undefined,
      tags: state.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };

    startTransition(async () => {
      const result = mode === "edit" ? await updateOrderAction(input) : await createOrderAction(input);
      if (result.ok) {
        toast({ title: mode === "edit" ? "Замовлення збережено" : "Замовлення створено" });
        router.push(`/admin/orders/${result.data.id}`);
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <Card title="Покупець">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Телефон" htmlFor="cust-phone" required className="sm:col-span-2">
              <div className="flex gap-2">
                <PhoneInput id="cust-phone" value={state.customer.phone} onChange={(v) => patchCustomer({ phone: v })} />
                <Button type="button" variant="secondary" disabled={looking} onClick={lookup}>
                  <Search aria-hidden className="size-4" strokeWidth={1.75} />
                  Знайти
                </Button>
              </div>
            </Field>
            <Field label="Імʼя" htmlFor="cust-first" required>
              <Input id="cust-first" value={state.customer.firstName} onChange={(e) => patchCustomer({ firstName: e.target.value })} />
            </Field>
            <Field label="Прізвище" htmlFor="cust-last" required>
              <Input id="cust-last" value={state.customer.lastName} onChange={(e) => patchCustomer({ lastName: e.target.value })} />
            </Field>
            <Field label="E-mail" htmlFor="cust-email" className="sm:col-span-2">
              <Input id="cust-email" type="email" value={state.customer.email} onChange={(e) => patchCustomer({ email: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3">
            <Checkbox label="Не телефонувати для підтвердження" checked={state.doNotCall} onChange={(e) => setState((s) => ({ ...s, doNotCall: e.target.checked }))} />
          </div>
        </Card>

        <Card title="Позиції">
          <OrderLinesField
            lines={state.lines}
            onChange={(lines) => setState((s) => ({ ...s, lines }))}
            suppliers={suppliers}
            markup={defaultMarkupPercent}
          />
        </Card>

        <Card title="Доставка">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Спосіб доставки" htmlFor="del-method">
              <Select id="del-method" value={state.delivery.method} onChange={(e) => patchDelivery({ method: e.target.value as DeliveryMethod })}>
                {DELIVERY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {deliveryMethodLabel[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Перевізник" htmlFor="del-carrier">
              <Select id="del-carrier" value={state.delivery.carrier} onChange={(e) => patchDelivery({ carrier: e.target.value as Carrier })}>
                {CARRIERS.map((c) => (
                  <option key={c} value={c}>
                    {carrierLabel[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Місто" htmlFor="del-city">
              <Input id="del-city" value={state.delivery.city} onChange={(e) => patchDelivery({ city: e.target.value })} />
            </Field>
            <Field label="Відділення / адреса" htmlFor="del-address">
              <Input id="del-address" value={state.delivery.address} onChange={(e) => patchDelivery({ address: e.target.value })} />
            </Field>
            <Field label="Вартість доставки, ₴" htmlFor="del-cost">
              <Input id="del-cost" type="number" min={0} value={state.delivery.cost} onChange={(e) => patchDelivery({ cost: e.target.value })} />
            </Field>
            <Field label="Платник доставки" htmlFor="del-payer">
              <Select id="del-payer" value={state.delivery.costPayer} onChange={(e) => patchDelivery({ costPayer: e.target.value as "customer" | "shop" })}>
                <option value="customer">Покупець</option>
                <option value="shop">Магазин</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Оплата">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Спосіб оплати" htmlFor="pay-method">
              <Select id="pay-method" value={state.payment.method} onChange={(e) => patchPayment({ method: e.target.value as PaymentMethod })}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {paymentMethodLabel[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Статус оплати" htmlFor="pay-status">
              <Select id="pay-status" value={state.payment.status} onChange={(e) => patchPayment({ status: e.target.value as PaymentStatus })}>
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {paymentStatusMeta[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Сплачено, ₴" htmlFor="pay-amount">
              <Input id="pay-amount" type="number" min={0} value={state.payment.paidAmount} onChange={(e) => patchPayment({ paidAmount: e.target.value })} />
            </Field>
            <Field label="Номер рахунку" htmlFor="pay-invoice">
              <Input id="pay-invoice" value={state.payment.invoiceNumber} onChange={(e) => patchPayment({ invoiceNumber: e.target.value })} />
            </Field>
            <Field label="Посилання на оплату" htmlFor="pay-link" className="sm:col-span-2">
              <Input id="pay-link" type="url" value={state.payment.paymentLink} onChange={(e) => patchPayment({ paymentLink: e.target.value })} placeholder="https://" />
            </Field>
          </div>
        </Card>

        <Card title="Інше">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Джерело" htmlFor="other-source">
              <Select id="other-source" value={state.source} onChange={(e) => setState((s) => ({ ...s, source: e.target.value as OrderSource }))}>
                {ORDER_SOURCES.map((src) => (
                  <option key={src} value={src}>
                    {orderSourceLabel[src]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Відповідальний" htmlFor="other-assignee">
              <Select id="other-assignee" value={state.assigneeId} onChange={(e) => setState((s) => ({ ...s, assigneeId: e.target.value }))}>
                <option value="">Без відповідального</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Мітки (через кому)" htmlFor="other-tags" className="sm:col-span-2">
              <Input id="other-tags" value={state.tags} onChange={(e) => setState((s) => ({ ...s, tags: e.target.value }))} placeholder="опт, терміново" />
            </Field>
            <Field label="Авто / VIN" htmlFor="other-vehicle" className="sm:col-span-2">
              <Input id="other-vehicle" value={state.vehicle} onChange={(e) => setState((s) => ({ ...s, vehicle: e.target.value }))} />
            </Field>
            <Field label="Коментар покупця" htmlFor="other-comment" className="sm:col-span-2">
              <Textarea id="other-comment" rows={2} value={state.comment} onChange={(e) => setState((s) => ({ ...s, comment: e.target.value }))} />
            </Field>
            <Field label="Внутрішня нотатка" htmlFor="other-note" className="sm:col-span-2">
              <Textarea id="other-note" rows={2} value={state.managerNote} onChange={(e) => setState((s) => ({ ...s, managerNote: e.target.value }))} />
            </Field>
          </div>
        </Card>
      </div>

      <div>
        <div className="sticky top-4 space-y-4">
          <Card title="Підсумок">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">Сума позицій</dt>
                <dd><Money value={totals.subtotal} /></dd>
              </div>
              <Field label="Знижка на замовлення, ₴" htmlFor="order-discount">
                <Input id="order-discount" type="number" min={0} value={state.orderDiscount} onChange={(e) => setState((s) => ({ ...s, orderDiscount: e.target.value }))} />
              </Field>
              <div className="flex justify-between gap-4 border-t border-line-soft pt-1.5">
                <dt className="font-semibold text-ink">Разом</dt>
                <dd><Money value={totals.total} className="font-semibold" /></dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">Собівартість</dt>
                <dd>{totals.marginKnown ? <Money value={totals.costTotal} muted /> : <span className="text-ink-3">—</span>}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">Маржа</dt>
                <dd className="tabular text-ink-2">{totals.marginKnown ? `${totals.margin} ₴${pct !== null ? ` · ${pct}%` : ""}` : "—"}</dd>
              </div>
            </dl>
            <Button type="button" block className="mt-4" disabled={pending} onClick={submit}>
              {mode === "edit" ? "Зберегти зміни" : "Створити замовлення"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
