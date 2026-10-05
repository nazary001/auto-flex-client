"use client";

import { useActionState, useRef } from "react";
import { Card, SubmitButton } from "@/components/admin/ui";
import { Field, Input } from "@/components/ui/Field";
import { toast } from "@/lib/store";
import type { ActionResult } from "@/lib/admin/actions/_action";
import { changeOwnPasswordAction } from "@/lib/admin/actions/users";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(async (_prev, formData) => {
    const result = await changeOwnPasswordAction({
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
      confirm: String(formData.get("confirm") ?? ""),
    });
    if (result.ok) {
      toast({ title: "Пароль змінено" });
      formRef.current?.reset();
    } else {
      toast({ title: result.error, tone: "error" });
    }
    return result;
  }, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} ref={formRef}>
      <Card title="Зміна пароля" description="Після зміни ви залишаєтесь у системі на цьому пристрої.">
        <div className="grid gap-4">
          <Field label="Поточний пароль" htmlFor="current-password" required error={fe?.currentPassword}>
            <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <Field
            label="Новий пароль"
            htmlFor="new-password"
            required
            error={fe?.newPassword}
            hint="Щонайменше 8 символів, літери й цифри."
          >
            <Input id="new-password" name="newPassword" type="password" autoComplete="new-password" required />
          </Field>
          <Field label="Повторіть новий пароль" htmlFor="confirm-password" required error={fe?.confirm}>
            <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required />
          </Field>
        </div>
        <div className="mt-5">
          <SubmitButton pendingText="Зберігаємо…">Змінити пароль</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
