"use client";

import { useActionState, useId } from "react";
import Link from "next/link";
import { FormAlert, PasswordInput, SubmitButton } from "@/components/account/FormBits";
import { Field, Input } from "@/components/ui/Field";
import { loginAction, type AccountFormState } from "@/lib/account/actions";
import { site } from "@/lib/site";

export function LoginForm({ next }: { next?: string }) {
  const id = useId();
  const [state, action] = useActionState<AccountFormState | undefined, FormData>(loginAction, undefined);
  const errors = state?.fieldErrors ?? {};
  const registerHref = next ? `/account/register?next=${encodeURIComponent(next)}` : "/account/register";

  return (
    <form action={action} noValidate className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      {state?.error && <FormAlert tone="danger">{state.error}</FormAlert>}

      <Field
        label="Телефон або e-mail"
        htmlFor={`${id}-identifier`}
        error={errors.identifier}
        hint={errors.identifier ? undefined : "Будь-який із двох, що ви вказали під час реєстрації"}
      >
        <Input
          id={`${id}-identifier`}
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={120}
          required
          defaultValue={state?.values?.identifier ?? ""}
          placeholder="+38 (0__) ___-__-__ або you@example.com"
          aria-invalid={errors.identifier ? true : undefined}
          aria-describedby={`${id}-identifier-note`}
        />
      </Field>

      <Field label="Пароль" htmlFor={`${id}-password`} error={errors.password}>
        <PasswordInput
          id={`${id}-password`}
          name="password"
          autoComplete="current-password"
          required
          maxLength={200}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? `${id}-password-note` : undefined}
        />
      </Field>

      <SubmitButton pendingText="Входимо…">Увійти</SubmitButton>

      <p className="text-center text-sm text-ink-3">
        Немає акаунта?{" "}
        <Link href={registerHref} className="font-semibold text-brand-700 hover:underline">
          Зареєструватися
        </Link>
      </p>
      <p className="text-center text-[13px] leading-relaxed text-ink-3">
        Забули пароль? Зателефонуйте{" "}
        <a href={site.phone.href} className="tabular font-medium text-ink-2 hover:underline">
          {site.phone.label}
        </a>{" "}
        — менеджер допоможе відновити доступ.
      </p>
    </form>
  );
}
