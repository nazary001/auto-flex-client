"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Card, SubmitButton } from "@/components/admin/ui";
import { toast } from "@/lib/store";
import { DELIVERY_METHODS, PAYMENT_METHODS, deliveryMethodLabel, paymentMethodLabel } from "@/lib/admin/labels";
import type { ActionResult } from "@/lib/admin/actions/_action";
import type { MethodSetting, StoreSettings } from "@/lib/admin/types";
import { saveCheckoutSettingsAction } from "@/lib/admin/actions/settings";

type MethodState = { enabled: boolean; note: string };

function toState<K extends string>(keys: readonly K[], source: Record<K, MethodSetting>): Record<K, MethodState> {
  const out = {} as Record<K, MethodState>;
  for (const key of keys) out[key] = { enabled: source[key]?.enabled ?? true, note: source[key]?.note ?? "" };
  return out;
}

export function CheckoutSettingsForm({ checkout }: { checkout: StoreSettings["checkout"] }) {
  const router = useRouter();
  const [delivery, setDelivery] = useState(() => toState(DELIVERY_METHODS, checkout.delivery));
  const [payment, setPayment] = useState(() => toState(PAYMENT_METHODS, checkout.payment));

  const [, formAction] = useActionState<ActionResult | null, FormData>(async () => {
    const result = await saveCheckoutSettingsAction({ delivery, payment });
    if (result.ok) {
      toast({ title: "Налаштування збережено" });
      router.refresh();
    } else {
      toast({ title: result.error, tone: "error" });
    }
    return result;
  }, null);

  const noDelivery = DELIVERY_METHODS.every((method) => !delivery[method].enabled);
  const noPayment = PAYMENT_METHODS.every((method) => !payment[method].enabled);

  return (
    <form action={formAction} className="space-y-4">
      {(noDelivery || noPayment) && (
        <Alert tone="warning" title="Оформлення замовлення буде заблоковано">
          {noDelivery && <p>Увімкніть хоча б один спосіб доставки.</p>}
          {noPayment && <p>Увімкніть хоча б один спосіб оплати.</p>}
        </Alert>
      )}

      <Card title="Доставка" description="Способи доставки, доступні покупцю при оформленні.">
        <ul className="divide-y divide-line-soft">
          {DELIVERY_METHODS.map((method) => (
            <MethodRow
              key={method}
              label={deliveryMethodLabel[method]}
              value={delivery[method]}
              onChange={(next) => setDelivery((state) => ({ ...state, [method]: next }))}
            />
          ))}
        </ul>
      </Card>

      <Card title="Оплата" description="Способи оплати, доступні покупцю при оформленні.">
        <ul className="divide-y divide-line-soft">
          {PAYMENT_METHODS.map((method) => (
            <MethodRow
              key={method}
              label={paymentMethodLabel[method]}
              value={payment[method]}
              onChange={(next) => setPayment((state) => ({ ...state, [method]: next }))}
            />
          ))}
        </ul>
      </Card>

      <SubmitButton pendingText="Зберігаємо…">Зберегти</SubmitButton>
    </form>
  );
}

interface MethodRowProps {
  label: string;
  value: MethodState;
  onChange: (next: MethodState) => void;
}

function MethodRow({ label, value, onChange }: MethodRowProps) {
  return (
    <li className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      <label className="flex min-w-56 cursor-pointer items-center gap-2.5 text-[15px] text-ink">
        <input
          type="checkbox"
          className="check"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
        {label}
      </label>
      <input
        type="text"
        className="field field-sm flex-1"
        placeholder="Примітка для покупця (необовʼязково)"
        aria-label={`Примітка: ${label}`}
        maxLength={200}
        value={value.note}
        onChange={(event) => onChange({ ...value, note: event.target.value })}
      />
    </li>
  );
}
