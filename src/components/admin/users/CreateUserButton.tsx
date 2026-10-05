"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/store";
import type { Role } from "@/lib/admin/types";
import { ROLES, roleHint, roleLabel } from "@/lib/admin/labels";
import { createUserAction } from "@/lib/admin/actions/users";

export function CreateUserButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<Role>("manager");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setFieldErrors({});
    startTransition(async () => {
      const result = await createUserAction({
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") ?? ""),
        role: data.get("role"),
        password: String(data.get("password") ?? ""),
      });
      if (result.ok) {
        toast({ title: "Користувача створено" });
        setOpen(false);
        form.reset();
        setRole("manager");
        router.refresh();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" strokeWidth={1.75} />
        Користувач
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Новий користувач">
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="Ім'я" htmlFor="new-user-name" required error={fieldErrors.name}>
            <Input id="new-user-name" name="name" autoComplete="off" required />
          </Field>
          <Field label="Електронна адреса" htmlFor="new-user-email" required error={fieldErrors.email}>
            <Input id="new-user-email" name="email" type="email" autoComplete="off" required />
          </Field>
          <Field label="Роль" htmlFor="new-user-role" error={fieldErrors.role} hint={roleHint[role]}>
            <Select
              id="new-user-role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {roleLabel[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Пароль"
            htmlFor="new-user-password"
            required
            error={fieldErrors.password}
            hint="Щонайменше 8 символів, літери й цифри."
          >
            <Input id="new-user-password" name="password" type="text" autoComplete="off" required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Скасувати
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
              Створити
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
