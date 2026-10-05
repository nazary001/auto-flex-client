"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isValidEmail, normalizeEmail, parseIdentifier, passwordIssue } from "@/lib/account/identity";
import { isValidUaPhone, normalizePhone } from "@/lib/format";
import { getCurrentAccount, safeAccountNext } from "@/lib/server/account/dal";
import { clearAccountCookies, readAccountToken, setAccountCookies } from "@/lib/server/account/session";
import { clearLoginFailures, loginBlockedFor, recordLoginFailure } from "@/lib/server/auth/login-limit";
import { hashPassword, verifyPassword } from "@/lib/server/auth/password";
import { getDb } from "@/lib/server/db/client";
import {
  createAccount,
  createAccountSession,
  deleteAccountSession,
  deleteAccountSessions,
  DuplicateAccountError,
  findAccountByIdentifier,
  findAccountConflict,
  getAccountByCustomerId,
  getAccountById,
  setAccountPassword,
  touchAccountLogin,
  updateAccountContacts,
} from "@/lib/server/db/repos/accounts";
import { createCustomer, getCustomerByPhone, updateCustomer } from "@/lib/server/db/repos/customers";

/*
 * Storefront account: registration (phone + e-mail + password), sign-in with the phone or the
 * e-mail, sign-out, profile and password changes. Used with useActionState in the account forms.
 */

export type AccountField =
  | "identifier"
  | "phone"
  | "email"
  | "password"
  | "confirm"
  | "current"
  | "firstName"
  | "lastName"
  | "city"
  | "address";

export interface AccountFormState {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<AccountField, string>>;
  /** Values to show again after a failed submit (never the passwords) */
  values?: Partial<Record<Exclude<AccountField, "password" | "confirm" | "current">, string>>;
}

const SESSION_EXPIRED = "Сесія завершилась. Увійдіть знову.";
const PHONE_FORMAT = "Вкажіть номер у форматі +38 (0XX) XXX-XX-XX.";
const EMAIL_FORMAT = "Перевірте адресу електронної пошти.";
/** Registrations per IP share the login limiter: 8 per 15 minutes */
const REGISTER_KEY = "account:register";

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function issuesToFieldErrors(error: z.ZodError, fields: readonly AccountField[]): AccountFormState["fieldErrors"] {
  const fieldErrors: AccountFormState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && (fields as readonly string[]).includes(key)) {
      fieldErrors[key as AccountField] ??= issue.message;
    }
  }
  return fieldErrors;
}

async function signIn(db: Awaited<ReturnType<typeof getDb>>, accountId: string): Promise<void> {
  const h = await headers();
  const { token, expiresAt } = await createAccountSession(db, accountId, h.get("user-agent") ?? undefined);
  await setAccountCookies(token, expiresAt);
  await touchAccountLogin(db, accountId);
}

// ── registration ────────────────────────────────────────────

const registerSchema = z.object({
  phone: z.string().trim().min(1, "Вкажіть номер телефону.").max(30, PHONE_FORMAT),
  email: z.string().trim().min(1, "Вкажіть електронну адресу.").max(120, EMAIL_FORMAT),
  password: z.string().min(1, "Придумайте пароль.").max(200, "Пароль задовгий."),
  confirm: z.string().max(200, "Пароль задовгий."),
  next: z.string().max(500).optional(),
});

export async function registerAction(_prev: AccountFormState | undefined, formData: FormData): Promise<AccountFormState> {
  const values = { phone: text(formData, "phone"), email: text(formData, "email") };
  const parsed = registerSchema.safeParse({
    phone: values.phone,
    email: values.email,
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error, ["phone", "email", "password", "confirm"]), values };

  const { phone, email, password, confirm, next } = parsed.data;
  const fieldErrors: NonNullable<AccountFormState["fieldErrors"]> = {};
  if (!isValidUaPhone(phone)) fieldErrors.phone = PHONE_FORMAT;
  if (!isValidEmail(email)) fieldErrors.email = EMAIL_FORMAT;
  const issue = passwordIssue(password);
  if (issue) fieldErrors.password = issue;
  else if (password !== confirm) fieldErrors.confirm = "Паролі не збігаються.";
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const ip = await clientIp();
  if (loginBlockedFor(ip, REGISTER_KEY) > 0) {
    return { error: "Забагато реєстрацій з вашої адреси. Спробуйте за кілька хвилин.", values };
  }

  const db = await getDb();
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);

  const conflict = await findAccountConflict(db, { phone: normalizedPhone, email: normalizedEmail });
  if (conflict === "phone") return { fieldErrors: { phone: "Цей номер уже зареєстровано — увійдіть або вкажіть інший." }, values };
  if (conflict === "email") return { fieldErrors: { email: "Цю адресу вже зареєстровано — увійдіть або вкажіть іншу." }, values };

  // The CRM customer created from earlier orders with this phone becomes the account's profile,
  // so its order history shows up in the cabinet right away.
  let customer = await getCustomerByPhone(db, normalizedPhone);
  if (customer && (await getAccountByCustomerId(db, customer.id))) {
    return { fieldErrors: { phone: "Цей номер уже зареєстровано — увійдіть." }, values };
  }
  if (!customer) {
    customer = await createCustomer(db, { phone: normalizedPhone, firstName: "", lastName: "", email: normalizedEmail });
  } else if (!customer.email) {
    await updateCustomer(db, customer.id, { email: normalizedEmail });
  }

  let accountId: string;
  try {
    const account = await createAccount(db, {
      customerId: customer.id,
      phone: normalizedPhone,
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
    });
    accountId = account._id;
  } catch (error) {
    if (error instanceof DuplicateAccountError) return { fieldErrors: { [error.field]: error.message }, values };
    throw error;
  }
  recordLoginFailure(ip, REGISTER_KEY);
  await signIn(db, accountId);
  redirect(safeAccountNext(next));
}

// ── sign-in / sign-out ──────────────────────────────────────

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Вкажіть номер телефону або електронну адресу.").max(120),
  password: z.string().min(1, "Вкажіть пароль.").max(200, "Пароль задовгий."),
  next: z.string().max(500).optional(),
});

export async function loginAction(_prev: AccountFormState | undefined, formData: FormData): Promise<AccountFormState> {
  const values = { identifier: text(formData, "identifier") };
  const parsed = loginSchema.safeParse({
    identifier: values.identifier,
    password: text(formData, "password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error, ["identifier", "password"]), values };

  const { identifier: raw, password, next } = parsed.data;
  const identifier = parseIdentifier(raw);
  if (!identifier) {
    return { fieldErrors: { identifier: "Введіть номер у форматі +38 (0XX) XXX-XX-XX або електронну адресу." }, values };
  }

  const ip = await clientIp();
  const limitKey = `account:${identifier.value}`;
  const wait = loginBlockedFor(ip, limitKey);
  if (wait > 0) return { error: `Забагато невдалих спроб. Спробуйте через ${Math.ceil(wait / 60)} хв.`, values };

  const db = await getDb();
  const account = await findAccountByIdentifier(db, raw);
  // the same amount of work whether or not the account exists, so timing does not reveal it
  let valid = false;
  if (account) valid = await verifyPassword(password, account.passwordHash);
  else await hashPassword(password);
  if (!account || !valid) {
    recordLoginFailure(ip, limitKey);
    return { error: "Невірний логін або пароль.", values };
  }
  if (account.status !== "active") return { error: "Обліковий запис заблоковано. Зверніться до менеджера магазину.", values };

  clearLoginFailures(ip, limitKey);
  await signIn(db, account._id);
  redirect(safeAccountNext(next));
}

export async function logoutAction(): Promise<void> {
  const token = await readAccountToken();
  if (token) {
    try {
      await deleteAccountSession(await getDb(), token);
    } catch (error) {
      console.error("[AutoFlex] Не вдалося видалити сесію покупця", error);
    }
  }
  await clearAccountCookies();
  redirect("/");
}

// ── profile ─────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().trim().max(60, "Задовге ім'я."),
  lastName: z.string().trim().max(60, "Задовге прізвище."),
  phone: z.string().trim().min(1, "Вкажіть номер телефону.").max(30, PHONE_FORMAT),
  email: z.string().trim().min(1, "Вкажіть електронну адресу.").max(120, EMAIL_FORMAT),
  city: z.string().trim().max(80, "Задовга назва населеного пункту."),
  address: z.string().trim().max(160, "Задовга адреса."),
});

export async function updateProfileAction(_prev: AccountFormState | undefined, formData: FormData): Promise<AccountFormState> {
  const values = {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    city: text(formData, "city"),
    address: text(formData, "address"),
  };
  const context = await getCurrentAccount();
  if (!context) return { error: SESSION_EXPIRED, values };

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: issuesToFieldErrors(parsed.error, ["firstName", "lastName", "phone", "email", "city", "address"]), values };
  }
  const data = parsed.data;
  const fieldErrors: NonNullable<AccountFormState["fieldErrors"]> = {};
  if (!isValidUaPhone(data.phone)) fieldErrors.phone = PHONE_FORMAT;
  if (!isValidEmail(data.email)) fieldErrors.email = EMAIL_FORMAT;
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const db = await getDb();
  const phone = normalizePhone(data.phone);
  const email = normalizeEmail(data.email);

  if (phone !== context.customer.phone) {
    const other = await getCustomerByPhone(db, phone);
    if (other && other.id !== context.customer.id) {
      return { fieldErrors: { phone: "Цей номер уже використовується іншим клієнтом. Зверніться до менеджера." }, values };
    }
  }
  try {
    await updateAccountContacts(db, context.account.id, { phone, email });
  } catch (error) {
    if (error instanceof DuplicateAccountError) return { fieldErrors: { [error.field]: error.message }, values };
    throw error;
  }
  await updateCustomer(db, context.customer.id, {
    firstName: data.firstName,
    lastName: data.lastName,
    phone,
    email,
    city: data.city,
    address: data.address,
  });
  revalidatePath("/account");
  return { success: "Дані збережено.", values: { ...values, phone, email } };
}

// ── password ────────────────────────────────────────────────

const passwordSchema = z.object({
  current: z.string().min(1, "Вкажіть поточний пароль.").max(200, "Пароль задовгий."),
  password: z.string().min(1, "Придумайте новий пароль.").max(200, "Пароль задовгий."),
  confirm: z.string().max(200, "Пароль задовгий."),
});

export async function changePasswordAction(_prev: AccountFormState | undefined, formData: FormData): Promise<AccountFormState> {
  const context = await getCurrentAccount();
  if (!context) return { error: SESSION_EXPIRED };

  const parsed = passwordSchema.safeParse({
    current: text(formData, "current"),
    password: text(formData, "password"),
    confirm: text(formData, "confirm"),
  });
  if (!parsed.success) return { fieldErrors: issuesToFieldErrors(parsed.error, ["current", "password", "confirm"]) };

  const { current, password, confirm } = parsed.data;
  const issue = passwordIssue(password);
  if (issue) return { fieldErrors: { password: issue } };
  if (password !== confirm) return { fieldErrors: { confirm: "Паролі не збігаються." } };

  const db = await getDb();
  const account = await getAccountById(db, context.account.id);
  if (!account) return { error: SESSION_EXPIRED };
  if (!(await verifyPassword(current, account.passwordHash))) return { fieldErrors: { current: "Поточний пароль невірний." } };
  if (current === password) return { fieldErrors: { password: "Новий пароль збігається з поточним." } };

  await setAccountPassword(db, account._id, await hashPassword(password));
  const token = await readAccountToken();
  await deleteAccountSessions(db, account._id, token ?? undefined);
  return { success: "Пароль змінено. На інших пристроях потрібно буде увійти знову." };
}
