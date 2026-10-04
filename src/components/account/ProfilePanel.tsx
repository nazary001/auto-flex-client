"use client";

import { useId, useState, type FormEvent } from "react";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { formatPhone, isValidUaPhone, normalizePhone } from "@/lib/format";
import { toast, useAccount } from "@/lib/store";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ProfilePanel() {
  const id = useId();
  const { hydrated, profile, setProfile } = useAccount();

  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ phone?: string; email?: string }>({});
  const [saved, setSaved] = useState(false);

  if (!hydrated) return <ProfileSkeleton />;

  const v = {
    firstName: firstName ?? profile.firstName,
    lastName: lastName ?? profile.lastName,
    phone: phone ?? (profile.phone ? formatPhone(profile.phone) : ""),
    email: email ?? profile.email,
    city: city ?? profile.city,
    address: address ?? profile.address,
  };

  function touched() {
    setSaved(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (v.phone.trim() && !isValidUaPhone(v.phone)) nextErrors.phone = "Вкажіть номер у форматі +38 (0XX) XXX-XX-XX.";
    if (v.email.trim() && !emailRe.test(v.email.trim())) nextErrors.email = "Перевірте адресу електронної пошти.";
    setErrors(nextErrors);
    if (nextErrors.phone) {
      document.getElementById(`${id}-phone`)?.focus();
      return;
    }
    if (nextErrors.email) {
      document.getElementById(`${id}-email`)?.focus();
      return;
    }

    setProfile({
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      phone: v.phone.trim() ? normalizePhone(v.phone) : "",
      email: v.email.trim(),
      city: v.city.trim(),
      address: v.address.trim(),
    });
    setSaved(true);
    toast({ title: "Дані збережено", description: "Ми підставимо їх під час оформлення замовлення." });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <p className="text-[15px] text-ink-3">
        Ці дані ми підставимо у форму під час оформлення замовлення, щоб ви не вводили їх щоразу.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Ім'я" htmlFor={`${id}-firstName`}>
          <Input
            id={`${id}-firstName`}
            autoComplete="given-name"
            maxLength={60}
            value={v.firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              touched();
            }}
          />
        </Field>
        <Field label="Прізвище" htmlFor={`${id}-lastName`}>
          <Input
            id={`${id}-lastName`}
            autoComplete="family-name"
            maxLength={60}
            value={v.lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              touched();
            }}
          />
        </Field>
        <Field label="Телефон" htmlFor={`${id}-phone`} error={errors.phone}>
          <PhoneInput
            id={`${id}-phone`}
            value={v.phone}
            onChange={(value) => {
              setPhone(value);
              setErrors((prev) => ({ ...prev, phone: undefined }));
              touched();
            }}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? `${id}-phone-note` : undefined}
          />
        </Field>
        <Field label="E-mail" htmlFor={`${id}-email`} error={errors.email}>
          <Input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={120}
            placeholder="you@example.com"
            value={v.email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((prev) => ({ ...prev, email: undefined }));
              touched();
            }}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `${id}-email-note` : undefined}
          />
        </Field>
        <Field label="Населений пункт" htmlFor={`${id}-city`}>
          <Input
            id={`${id}-city`}
            autoComplete="address-level2"
            maxLength={80}
            placeholder="Напр., Київ"
            value={v.city}
            onChange={(e) => {
              setCity(e.target.value);
              touched();
            }}
          />
        </Field>
        <Field label="Відділення або адреса" htmlFor={`${id}-address`}>
          <Input
            id={`${id}-address`}
            autoComplete="street-address"
            maxLength={160}
            placeholder="Напр., відділення 12"
            value={v.address}
            onChange={(e) => {
              setAddress(e.target.value);
              touched();
            }}
          />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="submit">Зберегти дані</Button>
        {saved && (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-ok">
            <CircleCheck aria-hidden className="size-4" strokeWidth={2} />
            Збережено
          </span>
        )}
      </div>
    </form>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl" aria-hidden>
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-mist" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-mist" />
            <div className="h-11 w-full animate-pulse rounded-btn bg-mist" />
          </div>
        ))}
      </div>
      <div className="mt-6 h-11 w-36 animate-pulse rounded-btn bg-mist" />
    </div>
  );
}
