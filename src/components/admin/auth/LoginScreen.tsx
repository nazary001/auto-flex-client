"use client";

import { useActionState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Field, Input } from "@/components/ui/Field";
import { Alert, SubmitButton } from "@/components/admin/ui";
import { loginAction, setupOwnerAction, type LoginState } from "@/lib/admin/actions/auth";

interface LoginScreenProps {
  mode: "login" | "setup";
  next?: string;
}

/** Split layout: a navy brand panel beside the form; stacks to one column on phones. */
export function LoginScreen({ mode, next }: LoginScreenProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="bg-stripes-navy relative hidden flex-col justify-between p-10 text-white lg:flex">
        <Logo variant="dark" className="h-8 w-auto" />
        <div>
          <p className="display text-[3.25rem] leading-none text-white">Адмінка</p>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">
            Внутрішній кабінет AutoFlex: замовлення, закупівлі, клієнти та каталог — в одному місці.
          </p>
        </div>
        <p className="text-[13px] text-white/40">AutoFlex — автозапчастини</p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo className="h-8 w-auto" />
          </div>
          {mode === "login" ? <LoginForm next={next} /> : <SetupForm />}
        </div>
      </main>
    </div>
  );
}

function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<LoginState | undefined, FormData>(loginAction, undefined);
  const emailError = state?.fieldErrors?.email;
  const passwordError = state?.fieldErrors?.password;

  return (
    <form action={action} className="space-y-5">
      <header>
        <h1 className="text-[22px] leading-7 font-semibold text-ink">Вхід до адмінки</h1>
        <p className="mt-1 text-sm text-ink-3">Увійдіть, щоб керувати магазином.</p>
      </header>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Електронна адреса" htmlFor="email" error={emailError}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-note" : undefined}
        />
      </Field>
      <Field label="Пароль" htmlFor="password" error={passwordError}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordError ? "password-note" : undefined}
        />
      </Field>
      <SubmitButton block pendingText="Входимо…">
        Увійти
      </SubmitButton>
    </form>
  );
}

function SetupForm() {
  const [state, action] = useActionState<LoginState | undefined, FormData>(setupOwnerAction, undefined);
  const fe = state?.fieldErrors;

  return (
    <form action={action} className="space-y-5">
      <header>
        <h1 className="text-[22px] leading-7 font-semibold text-ink">Створіть обліковий запис власника</h1>
        <p className="mt-1 text-sm text-ink-3">Це перший запуск. Далі ви зможете додати менеджерів.</p>
      </header>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Ім'я" htmlFor="name" error={fe?.name}>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          aria-invalid={fe?.name ? true : undefined}
          aria-describedby={fe?.name ? "name-note" : undefined}
        />
      </Field>
      <Field label="Електронна адреса" htmlFor="email" error={fe?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={fe?.email ? true : undefined}
          aria-describedby={fe?.email ? "email-note" : undefined}
        />
      </Field>
      <Field label="Пароль" htmlFor="password" error={fe?.password} hint="Щонайменше 8 символів.">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={fe?.password ? true : undefined}
          aria-describedby="password-note"
        />
      </Field>
      <Field label="Повторіть пароль" htmlFor="confirm" error={fe?.confirm}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={fe?.confirm ? true : undefined}
          aria-describedby={fe?.confirm ? "confirm-note" : undefined}
        />
      </Field>
      <SubmitButton block pendingText="Створюємо…">
        Створити й увійти
      </SubmitButton>
    </form>
  );
}
