import { isValidUaPhone, normalizePhone } from "@/lib/format";

/*
 * Login identifiers of the storefront account. Pure helpers shared by the forms (hints) and the
 * Server Actions (authoritative validation).
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

export type Identifier = { kind: "phone"; value: string } | { kind: "email"; value: string };

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  const email = normalizeEmail(input);
  return email.length <= 120 && EMAIL_RE.test(email);
}

/**
 * "+38 (097) 123-45-67" → phone 380971234567, " Ivan@Mail.com" → email ivan@mail.com,
 * anything else → null.
 */
export function parseIdentifier(input: string): Identifier | null {
  const raw = input.trim();
  if (!raw) return null;
  if (raw.includes("@")) return isValidEmail(raw) ? { kind: "email", value: normalizeEmail(raw) } : null;
  return isValidUaPhone(raw) ? { kind: "phone", value: normalizePhone(raw) } : null;
}

/** Returns a message when the password is not acceptable, otherwise null */
export function passwordIssue(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Пароль має містити щонайменше ${PASSWORD_MIN_LENGTH} символів.`;
  if (password.length > PASSWORD_MAX_LENGTH) return "Пароль задовгий.";
  if (password.trim() !== password) return "Пароль не може починатися або закінчуватися пробілом.";
  return null;
}
