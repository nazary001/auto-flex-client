"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Card, SubmitButton } from "@/components/admin/ui";
import { Field, Input } from "@/components/ui/Field";
import { roleLabel } from "@/lib/admin/labels";
import { toast } from "@/lib/store";
import type { ActionResult } from "@/lib/admin/actions/_action";
import type { Role } from "@/lib/admin/types";
import { updateProfileAction } from "@/lib/admin/actions/users";

interface ProfileFormProps {
  name: string;
  email: string;
  role: Role;
}

export function ProfileForm({ name, email, role }: ProfileFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(async (_prev, formData) => {
    const result = await updateProfileAction({ name: String(formData.get("name") ?? "") });
    if (result.ok) {
      toast({ title: "Профіль оновлено" });
      router.refresh();
    } else {
      toast({ title: result.error, tone: "error" });
    }
    return result;
  }, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction}>
      <Card title="Профіль" description="Ваше ім'я показується в журналі дій і підписах.">
        <div className="grid gap-4">
          <Field label="Ім'я" htmlFor="profile-name" required error={fe?.name}>
            <Input id="profile-name" name="name" defaultValue={name} maxLength={80} required />
          </Field>
          <Field label="Електронна адреса" htmlFor="profile-email" hint="Адресу для входу змінює власник магазину.">
            <Input id="profile-email" value={email} disabled readOnly />
          </Field>
          <Field label="Роль" htmlFor="profile-role">
            <Input id="profile-role" value={roleLabel[role]} disabled readOnly />
          </Field>
        </div>
        <div className="mt-5">
          <SubmitButton pendingText="Зберігаємо…">Зберегти</SubmitButton>
        </div>
      </Card>
    </form>
  );
}
