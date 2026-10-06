"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/store";
import type { AdminUser, Role } from "@/lib/admin/types";
import { ROLES, roleHint, roleLabel } from "@/lib/admin/labels";
import { resetPasswordAction, updateUserAction } from "@/lib/admin/actions/users";

interface UserRowActionsProps {
  user: AdminUser;
  isSelf: boolean;
  /** The only active owner left — role / activity are locked */
  isLastActiveOwner: boolean;
}

export function UserRowActions({ user, isSelf, isLastActiveOwner }: UserRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  if (isSelf) {
    return (
      <Link
        href="/admin/users/me"
        className="relative z-10 text-sm font-medium text-brand-700 hover:underline"
      >
        Це ви · профіль
      </Link>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
        Редагувати
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
        Скинути пароль
      </Button>
      <EditDialog
        user={user}
        isLastActiveOwner={isLastActiveOwner}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      <ResetDialog user={user} open={resetOpen} onClose={() => setResetOpen(false)} />
    </div>
  );
}

function EditDialog({
  user,
  isLastActiveOwner,
  open,
  onClose,
}: {
  user: AdminUser;
  isLastActiveOwner: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.active);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateUserAction({ id: user.id, name, email, role, active });
      if (result.ok) {
        toast({ title: "Користувача оновлено" });
        onClose();
        router.refresh();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={`Користувач ${user.email}`}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label="Ім'я" htmlFor="edit-user-name" required error={fieldErrors.name}>
          <Input id="edit-user-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Електронна адреса" htmlFor="edit-user-email" required error={fieldErrors.email}>
          <Input
            id="edit-user-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field
          label="Роль"
          htmlFor="edit-user-role"
          error={fieldErrors.role}
          hint={isLastActiveOwner ? "Це останній активний власник — роль змінити не можна." : roleHint[role]}
        >
          <Select
            id="edit-user-role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            disabled={isLastActiveOwner}
          >
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {roleLabel[value]}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-ink">
          <input
            type="checkbox"
            className="check"
            checked={active}
            disabled={isLastActiveOwner}
            onChange={(event) => setActive(event.target.checked)}
          />
          Активний обліковий запис
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Скасувати
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
            Зберегти
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetDialog({ user, open, onClose }: { user: AdminUser; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      const result = await resetPasswordAction({ id: user.id, password });
      if (result.ok) {
        toast({ title: "Пароль змінено. Користувача розлогінено." });
        setPassword("");
        onClose();
        router.refresh();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Скинути пароль"
      description={`Новий пароль для ${user.email}. Активні сесії буде завершено.`}
    >
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field
          label="Новий пароль"
          htmlFor="reset-password"
          required
          error={fieldErrors.password}
          hint="Щонайменше 8 символів, літери й цифри."
        >
          <Input
            id="reset-password"
            type="text"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Скасувати
          </Button>
          <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
            Скинути пароль
          </Button>
        </div>
      </form>
    </Modal>
  );
}
