"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { postJson } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatPhone, isValidUaPhone } from "@/lib/format";
import { useAccount } from "@/lib/store";
import type { CallbackKind, CallbackPayload } from "@/lib/types";

interface LeadFormProps {
  /** What the manager receives: callback / quick_order / question / notify_stock */
  kind: CallbackKind;
  /** Required for quick_order and notify_stock, optional for question */
  productId?: string;
  /** Name field: hidden, optional or required */
  name?: "hidden" | "optional" | "required";
  /** Message field: hidden, optional or required */
  comment?: "hidden" | "optional" | "required";
  commentLabel?: string;
  commentPlaceholder?: string;
  /** Prepended to the message, e.g. "Відгук, оцінка 5/5" or "Співпраця: СТО" */
  commentPrefix?: string;
  submitLabel: string;
  successTitle: string;
  successText?: ReactNode;
  /** Extra controls rendered above the submit button (e.g. a rating picker) */
  children?: ReactNode;
  onSuccess?: () => void;
  className?: string;
}

/**
 * Phone-first request form used for call-backs, quick orders, stock notifications,
 * product questions and contact forms. Posts to /api/callback and shows its own success state.
 */
export function LeadForm({
  kind,
  productId,
  name: nameMode = "optional",
  comment: commentMode = "hidden",
  commentLabel = "Коментар",
  commentPlaceholder,
  commentPrefix,
  submitLabel,
  successTitle,
  successText,
  children,
  onSuccess,
  className,
}: LeadFormProps) {
  const id = useId();
  const { profile } = useAccount();
  // null = untouched: fall back to the saved profile
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; comment?: string }>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [serverError, setServerError] = useState("");

  const nameValue = name ?? profile.firstName;
  const phoneValue = phone ?? (profile.phone ? formatPhone(profile.phone) : "");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    const nextErrors: typeof errors = {};
    if (nameMode === "required" && nameValue.trim().length < 2) nextErrors.name = "Вкажіть ваше ім'я.";
    if (!isValidUaPhone(phoneValue)) nextErrors.phone = "Вкажіть номер у форматі +38 (0XX) XXX-XX-XX.";
    if (commentMode === "required" && comment.trim().length < 5) nextErrors.comment = "Напишіть кілька слів.";
    setErrors(nextErrors);
    setServerError("");

    const firstInvalid = (["name", "phone", "comment"] as const).find((key) => nextErrors[key]);
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLElement>(`#${CSS.escape(`${id}-${firstInvalid}`)}`)?.focus();
      return;
    }

    setStatus("sending");
    const text = [commentPrefix, comment.trim()].filter(Boolean).join(" — ");
    const payload: CallbackPayload = {
      kind,
      phone: phoneValue,
      name: nameMode === "hidden" ? undefined : nameValue.trim() || undefined,
      productId,
      comment: text || undefined,
    };
    const result = await postJson("/api/callback", payload);
    if (result.ok) {
      setStatus("sent");
      onSuccess?.();
    } else {
      setStatus("idle");
      setServerError(result.error);
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className={cn("grid justify-items-center gap-2 py-4 text-center", className)}>
        <CircleCheck aria-hidden className="size-12 text-ok" strokeWidth={1.5} />
        <p className="text-lg font-bold text-ink">{successTitle}</p>
        {successText && <p className="max-w-sm text-[15px] text-ink-3">{successText}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn("grid gap-4", className)}>
      {nameMode !== "hidden" && (
        <Field label="Ім'я" htmlFor={`${id}-name`} required={nameMode === "required"} error={errors.name}>
          <Input
            id={`${id}-name`}
            autoComplete="given-name"
            maxLength={60}
            value={nameValue}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${id}-name-note` : undefined}
          />
        </Field>
      )}

      <Field label="Телефон" htmlFor={`${id}-phone`} required error={errors.phone}>
        <PhoneInput
          id={`${id}-phone`}
          value={phoneValue}
          onChange={setPhone}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? `${id}-phone-note` : undefined}
        />
      </Field>

      {commentMode !== "hidden" && (
        <Field label={commentLabel} htmlFor={`${id}-comment`} required={commentMode === "required"} error={errors.comment}>
          <Textarea
            id={`${id}-comment`}
            rows={3}
            maxLength={600}
            placeholder={commentPlaceholder}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            aria-invalid={errors.comment ? true : undefined}
            aria-describedby={errors.comment ? `${id}-comment-note` : undefined}
          />
        </Field>
      )}

      {children}

      {serverError && (
        <p role="alert" className="rounded-btn bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          {serverError}
        </p>
      )}

      <Button type="submit" block disabled={status === "sending"}>
        {status === "sending" ? "Надсилаємо…" : submitLabel}
      </Button>

      <p className="text-center text-xs text-ink-3">
        Надсилаючи форму, ви погоджуєтеся з{" "}
        <Link href="/polityka-konfidentsiinosti" className="underline underline-offset-2 hover:text-brand-700">
          політикою конфіденційності
        </Link>
        .
      </p>
    </form>
  );
}
