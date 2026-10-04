"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, CreditCard, Loader2, MapPin, MessageSquare, ShoppingCart, UserRound } from "lucide-react";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { deliveryOption, deliveryOptions, paymentOptions } from "@/components/checkout/options";
import { Button, buttonClass } from "@/components/ui/Button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { postJson } from "@/lib/api";
import { formatPhone, isValidUaPhone, normalizePhone } from "@/lib/format";
import { useAccount, useCart, useVehicle, type LocalOrder } from "@/lib/store";
import type { DeliveryMethod, OrderPayload, PaymentMethod } from "@/lib/types";

type FieldKey = "firstName" | "lastName" | "phone" | "email" | "city" | "address";
const FIELD_ORDER: FieldKey[] = ["firstName", "lastName", "phone", "email", "city", "address"];
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function addressRequiredMessage(method: DeliveryMethod): string {
  switch (method) {
    case "np_branch":
      return "Вкажіть номер відділення.";
    case "np_locker":
      return "Вкажіть номер поштомата.";
    case "np_courier":
      return "Вкажіть адресу доставки.";
    case "ukrposhta":
      return "Вкажіть індекс і відділення Укрпошти.";
  }
}

export function CheckoutForm() {
  const id = useId();
  const router = useRouter();
  const { hydrated, items, count, total, clear } = useCart();
  const { profile, setProfile, addOrder } = useAccount();
  const { vehicle } = useVehicle();

  // null = untouched → fall back to the saved profile / remembered vehicle
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [vehicleText, setVehicleText] = useState<string | null>(null);
  const [method, setMethod] = useState<DeliveryMethod>("np_branch");
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [comment, setComment] = useState("");
  const [doNotCall, setDoNotCall] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [redirecting, setRedirecting] = useState(false);
  const [serverError, setServerError] = useState("");

  const v = {
    firstName: firstName ?? profile.firstName,
    lastName: lastName ?? profile.lastName,
    phone: phone ?? (profile.phone ? formatPhone(profile.phone) : ""),
    email: email ?? profile.email,
    city: city ?? profile.city,
    address: address ?? profile.address,
    vehicle: vehicleText ?? vehicle?.label ?? "",
  };

  function fieldError(key: FieldKey): string | undefined {
    switch (key) {
      case "firstName":
        return v.firstName.trim().length < 2 ? "Вкажіть ім'я." : undefined;
      case "lastName":
        return v.lastName.trim().length < 2 ? "Вкажіть прізвище." : undefined;
      case "phone":
        return isValidUaPhone(v.phone) ? undefined : "Вкажіть номер у форматі +38 (0XX) XXX-XX-XX.";
      case "email":
        return v.email.trim() && !emailRe.test(v.email.trim()) ? "Перевірте адресу електронної пошти." : undefined;
      case "city":
        return v.city.trim().length < 2 ? "Вкажіть населений пункт." : undefined;
      case "address":
        return v.address.trim().length < 1 ? addressRequiredMessage(method) : undefined;
    }
  }

  const blur = (key: FieldKey) => () => setErrors((prev) => ({ ...prev, [key]: fieldError(key) }));
  const clearError = (key: FieldKey) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting" || redirecting) return;

    const nextErrors: Partial<Record<FieldKey, string>> = {};
    for (const key of FIELD_ORDER) nextErrors[key] = fieldError(key);
    setErrors(nextErrors);
    setServerError("");

    const firstInvalid = FIELD_ORDER.find((key) => nextErrors[key]);
    if (firstInvalid) {
      document.getElementById(`${id}-${firstInvalid}`)?.focus();
      return;
    }

    const payload: OrderPayload = {
      customer: {
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        phone: v.phone,
        email: v.email.trim() || undefined,
      },
      delivery: { method, city: v.city.trim(), address: v.address.trim() },
      payment,
      comment: comment.trim() || undefined,
      vehicle: v.vehicle.trim() || undefined,
      doNotCall,
      items: items.map((i) => ({
        key: i.key,
        productId: i.productId,
        name: i.name,
        sku: i.sku,
        price: i.price,
        qty: i.qty,
        optionLabel: i.optionLabel,
      })),
      total,
    };

    setStatus("submitting");
    const result = await postJson<{ orderNumber: string; total: number }>("/api/orders", payload);
    if (!result.ok) {
      setStatus("idle");
      setServerError(result.error);
      return;
    }

    const order: LocalOrder = {
      number: result.orderNumber,
      createdAt: new Date().toISOString(),
      payload: { ...payload, total: result.total },
    };
    addOrder(order);
    setProfile({
      firstName: payload.customer.firstName,
      lastName: payload.customer.lastName,
      phone: normalizePhone(v.phone),
      email: payload.customer.email ?? "",
      city: payload.delivery.city,
      address: payload.delivery.address,
    });
    setRedirecting(true);
    clear();
    router.push(`/checkout/success?order=${encodeURIComponent(result.orderNumber)}`);
  }

  if (!hydrated) return <CheckoutSkeleton />;

  if (redirecting) {
    return (
      <div className="grid justify-items-center gap-3 py-24 text-center" role="status">
        <Loader2 aria-hidden className="size-8 animate-spin text-brand-600" />
        <p className="text-[15px] text-ink-2">Оформлюємо замовлення…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        icon={<ShoppingCart aria-hidden strokeWidth={1.75} />}
        title="Кошик порожній"
        text="Щоб оформити замовлення, спершу додайте товари до кошика. Підкажемо із сумісністю, якщо напишете марку авто або VIN."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/catalog" className={buttonClass()}>
              Перейти до каталогу
            </Link>
            <Link href="/avto" className={buttonClass({ variant: "secondary" })}>
              Підібрати за авто
            </Link>
          </div>
        }
      />
    );
  }

  const address2 = deliveryOption(method);

  return (
    <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_23rem] lg:gap-10">
      <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:gap-10">
        {/* 1 — Contact */}
        <Section step={1} icon={<UserRound aria-hidden strokeWidth={1.75} />} title="Контактні дані" headingId={`${id}-contact`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ім'я" htmlFor={`${id}-firstName`} required error={errors.firstName}>
              <Input
                id={`${id}-firstName`}
                autoComplete="given-name"
                maxLength={60}
                value={v.firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  clearError("firstName");
                }}
                onBlur={blur("firstName")}
                aria-invalid={errors.firstName ? true : undefined}
                aria-describedby={errors.firstName ? `${id}-firstName-note` : undefined}
              />
            </Field>
            <Field label="Прізвище" htmlFor={`${id}-lastName`} required error={errors.lastName}>
              <Input
                id={`${id}-lastName`}
                autoComplete="family-name"
                maxLength={60}
                value={v.lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  clearError("lastName");
                }}
                onBlur={blur("lastName")}
                aria-invalid={errors.lastName ? true : undefined}
                aria-describedby={errors.lastName ? `${id}-lastName-note` : undefined}
              />
            </Field>
            <Field label="Телефон" htmlFor={`${id}-phone`} required error={errors.phone}>
              <PhoneInput
                id={`${id}-phone`}
                value={v.phone}
                onChange={(value) => {
                  setPhone(value);
                  clearError("phone");
                }}
                onBlur={blur("phone")}
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={errors.phone ? `${id}-phone-note` : undefined}
              />
            </Field>
            <Field
              label="E-mail"
              htmlFor={`${id}-email`}
              error={errors.email}
              hint={errors.email ? undefined : "Необов'язково — надішлемо підтвердження замовлення"}
            >
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
                  clearError("email");
                }}
                onBlur={blur("email")}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? `${id}-email-note` : `${id}-email-note`}
              />
            </Field>
          </div>
        </Section>

        {/* 2 — Delivery */}
        <Section step={2} icon={<MapPin aria-hidden strokeWidth={1.75} />} title="Доставка" headingId={`${id}-delivery`}>
          <div role="radiogroup" aria-labelledby={`${id}-delivery`} className="grid gap-2.5 sm:grid-cols-2">
            {deliveryOptions.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-3 rounded-card border p-3.5 transition-colors ${
                  method === option.value ? "border-brand-600 bg-brand-50/60" : "border-line hover:border-silver-500"
                }`}
              >
                <input
                  type="radio"
                  name="delivery"
                  value={option.value}
                  checked={method === option.value}
                  onChange={() => {
                    setMethod(option.value);
                    clearError("address");
                  }}
                  className="radio mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-ink">{option.label}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-3">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Населений пункт" htmlFor={`${id}-city`} required error={errors.city}>
              <Input
                id={`${id}-city`}
                autoComplete="address-level2"
                maxLength={80}
                placeholder="Напр., Київ"
                value={v.city}
                onChange={(e) => {
                  setCity(e.target.value);
                  clearError("city");
                }}
                onBlur={blur("city")}
                aria-invalid={errors.city ? true : undefined}
                aria-describedby={errors.city ? `${id}-city-note` : undefined}
              />
            </Field>
            <Field label={address2.addressLabel} htmlFor={`${id}-address`} required error={errors.address}>
              <Input
                id={`${id}-address`}
                autoComplete={address2.addressAutoComplete}
                maxLength={160}
                placeholder={address2.addressPlaceholder}
                value={v.address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  clearError("address");
                }}
                onBlur={blur("address")}
                aria-invalid={errors.address ? true : undefined}
                aria-describedby={errors.address ? `${id}-address-note` : undefined}
              />
            </Field>
          </div>
        </Section>

        {/* 3 — Payment */}
        <Section step={3} icon={<CreditCard aria-hidden strokeWidth={1.75} />} title="Оплата" headingId={`${id}-payment`}>
          <div role="radiogroup" aria-labelledby={`${id}-payment`} className="grid gap-2.5">
            {paymentOptions.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-3 rounded-card border p-3.5 transition-colors ${
                  payment === option.value ? "border-brand-600 bg-brand-50/60" : "border-line hover:border-silver-500"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={option.value}
                  checked={payment === option.value}
                  onChange={() => setPayment(option.value)}
                  className="radio mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold text-ink">{option.label}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-3">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </Section>

        {/* 4 — Vehicle */}
        <Section step={4} icon={<Car aria-hidden strokeWidth={1.75} />} title="Авто для перевірки сумісності" headingId={`${id}-vehicle`}>
          <Field
            label="VIN або марка, модель і рік"
            htmlFor={`${id}-vehicle`}
            hint="Необов'язково. Менеджер перевірить, чи підійдуть запчастини саме вашому авто, перед відправкою."
          >
            <Input
              id={`${id}-vehicle`}
              maxLength={160}
              placeholder="Напр., WAUZZZ8V... або Audi A3 8P, 2012, 1.6 TDI"
              value={v.vehicle}
              onChange={(e) => setVehicleText(e.target.value)}
            />
          </Field>
        </Section>

        {/* 5 — Comment + options */}
        <Section step={5} icon={<MessageSquare aria-hidden strokeWidth={1.75} />} title="Коментар до замовлення" headingId={`${id}-comment`}>
          <Field label="Коментар" htmlFor={`${id}-comment`} hint="Необов'язково — побажання щодо доставки чи оплати">
            <Textarea
              id={`${id}-comment`}
              rows={3}
              maxLength={600}
              placeholder="Напишіть, якщо є додаткові побажання"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <div className="mt-4">
            <Checkbox
              checked={doNotCall}
              onChange={(e) => setDoNotCall(e.target.checked)}
              label="Не телефонуйте мені для підтвердження замовлення"
              description="Ми підтвердимо замовлення в месенджері або листом. Врахуйте: без дзвінка складніше уточнити сумісність."
            />
          </div>
        </Section>

        {serverError && (
          <p role="alert" className="rounded-btn bg-danger-soft px-4 py-3 text-sm text-danger">
            {serverError}
          </p>
        )}

        <div className="grid gap-3">
          <Button type="submit" size="lg" block disabled={status === "submitting"}>
            {status === "submitting" ? "Підтверджуємо замовлення…" : "Підтвердити замовлення"}
          </Button>
          <p className="text-center text-[13px] text-ink-3">
            Підтверджуючи замовлення, ви погоджуєтеся з{" "}
            <Link href="/dohovir-oferty" className="link">
              договором оферти
            </Link>{" "}
            і{" "}
            <Link href="/polityka-konfidentsiinosti" className="link">
              політикою конфіденційності
            </Link>
            .
          </p>
        </div>
      </form>

      <CheckoutSummary items={items} count={count} total={total} />
    </div>
  );
}

function Section({
  step,
  icon,
  title,
  headingId,
  children,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  headingId: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="flex items-center gap-3 text-lg font-bold text-ink">
        <span className="grid size-8 shrink-0 place-content-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 tabular">
          {step}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="text-brand-700 [&>svg]:size-5">{icon}</span>
          {title}
        </span>
      </h2>
      <div className="mt-4 pl-0 sm:pl-11">{children}</div>
    </section>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_23rem] lg:gap-10" aria-hidden>
      <div className="grid gap-8">
        {[0, 1, 2].map((s) => (
          <div key={s} className="grid gap-4">
            <div className="h-6 w-56 animate-pulse rounded bg-mist" />
            <div className="grid gap-4 sm:grid-cols-2 sm:pl-11">
              <div className="h-11 animate-pulse rounded-btn bg-mist" />
              <div className="h-11 animate-pulse rounded-btn bg-mist" />
            </div>
          </div>
        ))}
        <div className="h-13 w-full animate-pulse rounded-btn bg-mist" />
      </div>
      <div className="card h-72 animate-pulse bg-mist" />
    </div>
  );
}
