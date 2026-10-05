"use client";

import { useActionState, useId, useState } from "react";
import { FormAlert, SubmitButton } from "@/components/account/FormBits";
import { Field, Input } from "@/components/ui/Field";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { updateProfileAction, type AccountFormState } from "@/lib/account/actions";
import { formatPhone } from "@/lib/format";

export interface ProfileValues {
  firstName: string;
  lastName: string;
  /** Normalised 380XXXXXXXXX */
  phone: string;
  email: string;
  city: string;
  address: string;
}

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const id = useId();
  const [state, action] = useActionState<AccountFormState | undefined, FormData>(updateProfileAction, undefined);
  const [phone, setPhone] = useState(formatPhone(initial.phone));
  const errors = state?.fieldErrors ?? {};
  const values = { ...initial, ...state?.values };

  return (
    <form action={action} noValidate className="max-w-2xl">
      <p className="text-[15px] text-ink-3">
        Ці дані підставляються у форму замовлення. Телефон і електронна пошта — також ваші логіни для входу.
      </p>

      <div className="mt-5 grid gap-4">
        {state?.error && <FormAlert tone="danger">{state.error}</FormAlert>}
        {state?.success && <FormAlert tone="success">{state.success}</FormAlert>}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Ім'я" htmlFor={`${id}-firstName`} error={errors.firstName}>
          <Input
            id={`${id}-firstName`}
            name="firstName"
            autoComplete="given-name"
            maxLength={60}
            defaultValue={values.firstName}
            aria-invalid={errors.firstName ? true : undefined}
            aria-describedby={errors.firstName ? `${id}-firstName-note` : undefined}
          />
        </Field>
        <Field label="Прізвище" htmlFor={`${id}-lastName`} error={errors.lastName}>
          <Input
            id={`${id}-lastName`}
            name="lastName"
            autoComplete="family-name"
            maxLength={60}
            defaultValue={values.lastName}
            aria-invalid={errors.lastName ? true : undefined}
            aria-describedby={errors.lastName ? `${id}-lastName-note` : undefined}
          />
        </Field>
        <Field label="Телефон" htmlFor={`${id}-phone`} error={errors.phone} required>
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
        <Field label="E-mail" htmlFor={`${id}-email`} error={errors.email} required>
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
            defaultValue={values.email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `${id}-email-note` : undefined}
          />
        </Field>
        <Field label="Населений пункт" htmlFor={`${id}-city`} error={errors.city}>
          <Input
            id={`${id}-city`}
            name="city"
            autoComplete="address-level2"
            maxLength={80}
            placeholder="Напр., Київ"
            defaultValue={values.city}
            aria-invalid={errors.city ? true : undefined}
            aria-describedby={errors.city ? `${id}-city-note` : undefined}
          />
        </Field>
        <Field label="Відділення або адреса" htmlFor={`${id}-address`} error={errors.address}>
          <Input
            id={`${id}-address`}
            name="address"
            autoComplete="street-address"
            maxLength={160}
            placeholder="Напр., відділення 12"
            defaultValue={values.address}
            aria-invalid={errors.address ? true : undefined}
            aria-describedby={errors.address ? `${id}-address-note` : undefined}
          />
        </Field>
      </div>

      <div className="mt-6">
        <SubmitButton block={false} pendingText="Зберігаємо…">
          Зберегти дані
        </SubmitButton>
      </div>
    </form>
  );
}
