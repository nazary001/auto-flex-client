"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { FormAlert, PasswordInput, SubmitButton } from "@/components/account/FormBits";
import { Field, Input } from "@/components/ui/Field";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { registerAction, type AccountFormState } from "@/lib/account/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/account/identity";

export function RegisterForm({ next }: { next?: string }) {
  const id = useId();
  const [state, action] = useActionState<AccountFormState | undefined, FormData>(registerAction, undefined);
  // the phone keeps its mask between submits (controlled), the other fields come back through `state.values`
  const [phone, setPhone] = useState("");
  const errors = state?.fieldErrors ?? {};
  const loginHref = next ? `/account/login?next=${encodeURIComponent(next)}` : "/account/login";

  return (
    <form action={action} noValidate className="grid gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      {state?.error && <FormAlert tone="danger">{state.error}</FormAlert>}

      <Field label="Номер телефону" htmlFor={`${id}-phone`} error={errors.phone} required>
        <PhoneInput
          id={`${id}-phone`}
          name="phone"
          value={phone}
          onChange={setPhone}
          required
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? `${id}-phone-note` : undefined}
        />
      </Field>

      <Field label="Електронна пошта" htmlFor={`${id}-email`} error={errors.email} required>
        <Input
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={120}
          required
          defaultValue={state?.values?.email ?? ""}
          placeholder="you@example.com"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? `${id}-email-note` : undefined}
        />
      </Field>

      <Field
        label="Пароль"
        htmlFor={`${id}-password`}
        error={errors.password}
        hint={errors.password ? undefined : `Щонайменше ${PASSWORD_MIN_LENGTH} символів`}
        required
      >
        <PasswordInput
          id={`${id}-password`}
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={200}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={`${id}-password-note`}
        />
      </Field>

      <Field label="Повторіть пароль" htmlFor={`${id}-confirm`} error={errors.confirm} required>
        <PasswordInput
          id={`${id}-confirm`}
          name="confirm"
          autoComplete="new-password"
          required
          maxLength={200}
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={errors.confirm ? `${id}-confirm-note` : undefined}
        />
      </Field>

      <SubmitButton pendingText="Створюємо акаунт…">Зареєструватися</SubmitButton>

      <p className="text-[13px] leading-relaxed text-ink-3">
        Реєструючись, ви погоджуєтеся з{" "}
        <Link href="/dohovir-oferty" className="underline hover:text-ink">
          договором оферти
        </Link>{" "}
        та{" "}
        <Link href="/polityka-konfidentsiinosti" className="underline hover:text-ink">
          політикою конфіденційності
        </Link>
        .
      </p>
      <p className="text-center text-sm text-ink-3">
        Уже є акаунт?{" "}
        <Link href={loginHref} className="font-semibold text-brand-700 hover:underline">
          Увійти
        </Link>
      </p>
    </form>
  );
}
