"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, SubmitButton } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { toast } from "@/lib/store";
import type { ActionResult } from "@/lib/admin/actions/_action";
import { saveNovaPoshtaSettingsAction } from "@/lib/admin/actions/settings";

export function NovaPoshtaSettingsForm({ hasKey }: { hasKey: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(async (_prev, formData) => {
    const result = await saveNovaPoshtaSettingsAction({
      change: true,
      apiKey: String(formData.get("apiKey") ?? "").trim(),
    });
    if (result.ok) {
      toast({ title: "Ключ оновлено" });
      setEditing(false);
      router.refresh();
    } else {
      toast({ title: result.error, tone: "error" });
    }
    return result;
  }, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Card
      title="Нова Пошта"
      description="Відстеження ТТН працює без ключа через публічне посилання. Власний ключ API знімає обмеження на кількість запитів."
    >
      {!editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-ink-3">Ключ API:</span>
            {hasKey ? (
              <span className="tabular font-medium text-ink">•••••••••••••</span>
            ) : (
              <span className="text-ink-3">не задано</span>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            {hasKey ? "Змінити ключ" : "Додати ключ"}
          </Button>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <Field
            label="Ключ API Нової Пошти"
            htmlFor="np-apiKey"
            error={fe?.apiKey}
            hint="Залиште порожнім, щоб видалити ключ і повернутися до публічного відстеження."
          >
            <Input id="np-apiKey" name="apiKey" type="text" autoComplete="off" maxLength={200} placeholder="напр. 1a2b3c…" />
          </Field>
          <div className="flex items-center gap-2">
            <SubmitButton pendingText="Зберігаємо…">Зберегти</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Скасувати
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
