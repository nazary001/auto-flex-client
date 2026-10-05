"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Field";
import { Card } from "@/components/admin/ui";
import { toast } from "@/lib/store";
import type { Supplier } from "@/lib/admin/types";
import { createSupplierAction, updateSupplierAction } from "@/lib/admin/actions/purchasing";

interface SupplierFormProps {
  supplier?: Supplier;
}

/** Create or edit a supplier card. On create it navigates to the new supplier's page. */
export function SupplierForm({ supplier }: SupplierFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = Boolean(supplier);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      ...(supplier ? { id: supplier.id } : {}),
      code: String(form.get("code") ?? ""),
      name: String(form.get("name") ?? ""),
      active: form.get("active") === "on",
      shipsDirect: form.get("shipsDirect") === "on",
      phone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      telegram: String(form.get("telegram") ?? ""),
      site: String(form.get("site") ?? ""),
      manager: String(form.get("manager") ?? ""),
      leadMin: String(form.get("leadMin") ?? "0"),
      leadMax: String(form.get("leadMax") ?? "0"),
      paymentTerms: String(form.get("paymentTerms") ?? ""),
      deliveryTerms: String(form.get("deliveryTerms") ?? ""),
      defaultMarkupPercent: String(form.get("defaultMarkupPercent") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };
    startTransition(async () => {
      setErrors({});
      const result = isEdit ? await updateSupplierAction(input) : await createSupplierAction(input);
      if (result.ok) {
        toast({ title: isEdit ? "Постачальника збережено" : "Постачальника створено" });
        if (isEdit) router.refresh();
        else router.push(`/admin/suppliers/${result.data.id}`);
      } else {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  const c = supplier?.contacts;

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Card title="Основне">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Код" htmlFor="code" required error={errors.code} hint="Коротко, напр. ELIT">
            <Input id="code" name="code" defaultValue={supplier?.code} maxLength={20} autoCapitalize="characters" required />
          </Field>
          <Field label="Назва" htmlFor="name" required error={errors.name}>
            <Input id="name" name="name" defaultValue={supplier?.name} maxLength={120} required />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          <Checkbox label="Активний" name="active" defaultChecked={supplier?.active ?? true} />
          <Checkbox
            label="Відправляє напряму покупцю"
            name="shipsDirect"
            defaultChecked={supplier?.shipsDirect ?? false}
          />
        </div>
      </Card>

      <Card title="Контакти">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Телефон" htmlFor="phone">
            <Input id="phone" name="phone" defaultValue={c?.phone} inputMode="tel" />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={c?.email} />
          </Field>
          <Field label="Telegram" htmlFor="telegram">
            <Input id="telegram" name="telegram" defaultValue={c?.telegram} placeholder="@manager" />
          </Field>
          <Field label="Сайт" htmlFor="site">
            <Input id="site" name="site" defaultValue={c?.site} placeholder="https://" />
          </Field>
          <Field label="Контактна особа" htmlFor="manager" className="sm:col-span-2">
            <Input id="manager" name="manager" defaultValue={c?.manager} />
          </Field>
        </div>
      </Card>

      <Card title="Умови">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Термін доставки, днів (від)" htmlFor="leadMin">
            <Input id="leadMin" name="leadMin" type="number" min={0} max={365} defaultValue={supplier?.leadDays[0] ?? 1} />
          </Field>
          <Field label="Термін доставки, днів (до)" htmlFor="leadMax">
            <Input id="leadMax" name="leadMax" type="number" min={0} max={365} defaultValue={supplier?.leadDays[1] ?? 3} />
          </Field>
          <Field label="Націнка за замовчуванням, %" htmlFor="defaultMarkupPercent" className="sm:col-span-2">
            <Input
              id="defaultMarkupPercent"
              name="defaultMarkupPercent"
              type="number"
              min={0}
              max={1000}
              step="0.1"
              defaultValue={supplier?.defaultMarkupPercent ?? ""}
            />
          </Field>
          <Field label="Умови оплати" htmlFor="paymentTerms">
            <Input id="paymentTerms" name="paymentTerms" defaultValue={supplier?.paymentTerms} />
          </Field>
          <Field label="Умови доставки" htmlFor="deliveryTerms">
            <Input id="deliveryTerms" name="deliveryTerms" defaultValue={supplier?.deliveryTerms} />
          </Field>
          <Field label="Нотатки" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={supplier?.notes} rows={3} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {isEdit ? "Зберегти зміни" : "Створити постачальника"}
        </Button>
      </div>
    </form>
  );
}
