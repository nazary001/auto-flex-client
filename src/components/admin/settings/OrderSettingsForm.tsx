"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Card, SubmitButton } from "@/components/admin/ui";
import { Field, Input } from "@/components/ui/Field";
import { toast } from "@/lib/store";
import type { ActionResult } from "@/lib/admin/actions/_action";
import type { StoreSettings } from "@/lib/admin/types";
import { saveOrderSettingsAction } from "@/lib/admin/actions/settings";

export function OrderSettingsForm({ orders }: { orders: StoreSettings["orders"] }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(async (_prev, formData) => {
    const result = await saveOrderSettingsAction({
      defaultMarkupPercent: Number(formData.get("defaultMarkupPercent")),
      lowMarginPercent: Number(formData.get("lowMarginPercent")),
      staleNewHours: Number(formData.get("staleNewHours")),
      staleSourcingDays: Number(formData.get("staleSourcingDays")),
      staleTransitDays: Number(formData.get("staleTransitDays")),
    });
    if (result.ok) {
      toast({ title: "Налаштування збережено" });
      router.refresh();
    } else {
      toast({ title: result.error, tone: "error" });
    }
    return result;
  }, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction}>
      <Card
        title="Параметри замовлень"
        description="Використовуються для розрахунку маржі та позначок «потребують уваги» на дашборді."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Націнка за замовчуванням, %"
            htmlFor="defaultMarkupPercent"
            error={fe?.defaultMarkupPercent}
            hint="Підказка ціни для позицій, доданих вручну."
          >
            <Input
              id="defaultMarkupPercent"
              name="defaultMarkupPercent"
              type="number"
              min={0}
              max={500}
              step={1}
              defaultValue={orders.defaultMarkupPercent}
              required
            />
          </Field>
          <Field
            label="Поріг низької маржі, %"
            htmlFor="lowMarginPercent"
            error={fe?.lowMarginPercent}
            hint="Замовлення з меншою маржею позначаються на дашборді."
          >
            <Input
              id="lowMarginPercent"
              name="lowMarginPercent"
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={orders.lowMarginPercent}
              required
            />
          </Field>
          <Field
            label="Нове замовлення «застаріло» через, год"
            htmlFor="staleNewHours"
            error={fe?.staleNewHours}
          >
            <Input
              id="staleNewHours"
              name="staleNewHours"
              type="number"
              min={1}
              max={240}
              step={1}
              defaultValue={orders.staleNewHours}
              required
            />
          </Field>
          <Field
            label="У постачальника «застаріло» через, дн"
            htmlFor="staleSourcingDays"
            error={fe?.staleSourcingDays}
          >
            <Input
              id="staleSourcingDays"
              name="staleSourcingDays"
              type="number"
              min={1}
              max={120}
              step={1}
              defaultValue={orders.staleSourcingDays}
              required
            />
          </Field>
          <Field
            label="В дорозі «застаріло» через, дн"
            htmlFor="staleTransitDays"
            error={fe?.staleTransitDays}
          >
            <Input
              id="staleTransitDays"
              name="staleTransitDays"
              type="number"
              min={1}
              max={120}
              step={1}
              defaultValue={orders.staleTransitDays}
              required
            />
          </Field>
        </div>
        <div className="mt-5">
          <SubmitButton pendingText="Зберігаємо…">Зберегти</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
