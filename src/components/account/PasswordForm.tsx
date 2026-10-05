"use client";

import { useActionState, useId } from "react";
import { FormAlert, PasswordInput, SubmitButton } from "@/components/account/FormBits";
import { Field } from "@/components/ui/Field";
import { changePasswordAction, type AccountFormState } from "@/lib/account/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/account/identity";

export function PasswordForm() {
  const id = useId();
  const [state, action] = useActionState<AccountFormState | undefined, FormData>(changePasswordAction, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="max-w-md">
      <p className="text-[15px] text-ink-3">
        Після зміни пароля на інших пристроях потрібно буде увійти знову; цей браузер залишиться в кабінеті.
      </p>

      <div className="mt-5 grid gap-4">
        {state?.error && <FormAlert tone="danger">{state.error}</FormAlert>}
        {state?.success && <FormAlert tone="success">{state.success}</FormAlert>}

        <Field label="Поточний пароль" htmlFor={`${id}-current`} error={errors.current} required>
          <PasswordInput
            id={`${id}-current`}
            name="current"
            autoComplete="current-password"
            required
            maxLength={200}
            aria-invalid={errors.current ? true : undefined}
            aria-describedby={errors.current ? `${id}-current-note` : undefined}
          />
        </Field>
        <Field
          label="Новий пароль"
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
        <Field label="Повторіть новий пароль" htmlFor={`${id}-confirm`} error={errors.confirm} required>
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
      </div>

      <div className="mt-6">
        <SubmitButton block={false} pendingText="Змінюємо…">
          Змінити пароль
        </SubmitButton>
      </div>
    </form>
  );
}
