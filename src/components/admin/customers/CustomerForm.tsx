"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Field";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Button } from "@/components/ui/Button";
import { formatPhone } from "@/lib/format";
import { toast } from "@/lib/store";
import type { Customer } from "@/lib/admin/types";
import { createCustomerAction, updateCustomerAction } from "@/lib/admin/actions/customers";

interface CustomerFormProps {
  mode: "create" | "edit";
  customer?: Customer;
}

type Errors = Record<string, string>;

function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const tag = raw.trim();
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      out.push(tag);
    }
  }
  return out;
}

/** Create / edit a customer. In edit mode the notes field lives in its own card, so it is omitted here. */
export function CustomerForm({ mode, customer }: CustomerFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Errors>({});
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(customer?.firstName ?? "");
  const [lastName, setLastName] = useState(customer?.lastName ?? "");
  const [phone, setPhone] = useState(customer ? formatPhone(customer.phone) : "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [city, setCity] = useState(customer?.city ?? "");
  const [tags, setTags] = useState(customer?.tags.join(", ") ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [doNotCall, setDoNotCall] = useState(customer?.doNotCall ?? false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setDuplicateId(null);

    const base = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone,
      email: email.trim() || undefined,
      city: city.trim() || undefined,
      tags: parseTags(tags),
      doNotCall,
    };

    startTransition(async () => {
      if (mode === "create") {
        const result = await createCustomerAction({ ...base, notes: notes.trim() || undefined });
        if (result.ok) {
          toast({ title: "Клієнта створено" });
          router.push(`/admin/customers/${result.data.id}`);
        } else {
          setErrors(result.fieldErrors ?? {});
          setDuplicateId(result.fieldErrors?._duplicateId || null);
          toast({ title: result.error, tone: "error" });
        }
        return;
      }

      const result = await updateCustomerAction({ id: customer!.id, ...base });
      if (result.ok) {
        toast({ title: "Зміни збережено" });
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setDuplicateId(result.fieldErrors?._duplicateId || null);
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Імʼя" htmlFor="firstName" required error={errors.firstName}>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            aria-invalid={errors.firstName ? true : undefined}
            aria-describedby={errors.firstName ? "firstName-note" : undefined}
          />
        </Field>
        <Field label="Прізвище" htmlFor="lastName" error={errors.lastName}>
          <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Телефон" htmlFor="phone" required error={errors.phone}>
          <PhoneInput
            id="phone"
            value={phone}
            onChange={setPhone}
            aria-invalid={errors.phone ? true : undefined}
            aria-describedby={errors.phone ? "phone-note" : undefined}
          />
          {duplicateId && (
            <Link href={`/admin/customers/${duplicateId}`} className="link mt-1 inline-block text-sm font-medium">
              Відкрити картку клієнта
            </Link>
          )}
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-note" : undefined}
          />
        </Field>
      </div>

      <Field label="Місто" htmlFor="city" error={errors.city}>
        <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
      </Field>

      <Field label="Теги" htmlFor="tags" hint="Через кому, напр. опт, постійний" error={errors.tags}>
        <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="опт, постійний" />
      </Field>

      {mode === "create" && (
        <Field label="Нотатки" htmlFor="notes" error={errors.notes}>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </Field>
      )}

      <Checkbox
        label="Не телефонувати"
        description="Клієнт просив не турбувати дзвінками"
        checked={doNotCall}
        onChange={(e) => setDoNotCall(e.target.checked)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
          {mode === "create" ? "Створити клієнта" : "Зберегти зміни"}
        </Button>
        {mode === "create" && (
          <Link href="/admin/customers" className="btn btn-ghost">
            Скасувати
          </Link>
        )}
      </div>
    </form>
  );
}
