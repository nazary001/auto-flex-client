# Customer accounts (storefront login & registration) — design

Date: 2026-10-05. Status: implemented.

## Goal

Registration with **phone + e-mail + password (twice)**; sign-in with **phone or e-mail** (buyer's choice) and
the password. A signed-in buyer sees their orders, keeps delivery details for a faster checkout, changes the
password and signs out. Guests can still order without an account.

## Data model

- `accounts` (`AccountDoc`): `_id`, `customerId` (one account per CRM customer), `phone` (380XXXXXXXXX, unique),
  `email` (lower-cased, unique), `passwordHash` (scrypt, shared with the admin `password.ts`), `status`
  (`active` | `blocked`), `createdAt`, `updatedAt`, `lastLoginAt?`, `passwordChangedAt?`.
- `account_sessions` (`AccountSessionDoc`): `_id` = sha256(token), `accountId`, `createdAt`, `expiresAt`
  (TTL index), `userAgent?`. 30 days.
- Profile data (name, city, address) lives on the **CRM customer** (`customers`), so the back office and the
  cabinet share one record. `Customer.address?` was added for the default branch/street.

Linking rule: registration looks the CRM customer up **by phone**; an existing customer (created from earlier
orders) gets the account attached, so their order history appears in the cabinet at once. Otherwise a customer
with empty names is created. Orders placed with the account's phone keep attaching to that customer through
the existing `upsertFromOrder`.

## Server modules

- `src/lib/account/identity.ts` — pure: `parseIdentifier()` (phone in any spelling → 380…, e-mail → lower
  case), `isValidEmail`, `passwordIssue` (≥ 8 chars, no surrounding spaces).
- `src/lib/server/db/repos/accounts.ts` — CRUD, `findAccountByIdentifier`, `findAccountConflict`,
  `updateAccountContacts`, `setAccountPassword`, sessions.
- `src/lib/server/account/session.ts` — cookies `af_user` (httpOnly, path `/`) and `af_user_hint` (plain flag
  the header reads; never trusted).
- `src/lib/server/account/dal.ts` — `getCurrentAccount()` (per-request cache), `requireAccount(path)`
  (redirects to `/account/login?next=…`), `safeAccountNext()` (same-site paths only, never `/admin`).
- `src/lib/account/actions.ts` ("use server") — `registerAction`, `loginAction`, `logoutAction`,
  `updateProfileAction`, `changePasswordAction`; zod validation, Ukrainian field errors, `useActionState`.
- `GET /api/account/me` — `{ authenticated, profile }`, `Cache-Control: no-store`.

## Security

- Generic sign-in error ("Невірний логін або пароль"); the password hash is computed even when the account
  does not exist, so timing does not reveal accounts.
- Brute force: the admin limiter (`login-limit.ts`) keyed by IP + identifier (8 failures / 15 min); the same
  limiter caps registrations per IP.
- Session token: 32 random bytes, only its hash is stored; password change deletes the other sessions;
  sign-out deletes the session server-side and clears both cookies.
- Registration tells the visitor when the phone or e-mail is taken (accepted trade-off for a shop).
- Server Actions carry the built-in origin check; `next` is sanitised.

## UI

- `/account/login`, `/account/register` (narrow card, `AuthShell`); signed-in visitors are redirected.
- `/account` — greeting, phone · e-mail, sign-out; tabs: orders (from the database: by customer id ∪ by phone,
  status pill, delivery/payment, TTN, lines), profile form, password form, vehicle (unchanged client panel).
- Header `AccountLink` (client island): "Увійти" for guests, the first name (or "Кабінет") when signed in;
  pages stay static — the state comes from `/api/account/me`, requested only when the hint cookie is present,
  cached 30 s and re-checked on navigation.
- Checkout prefills from the account when nothing is saved locally.
- Admin → customer card: "Акаунт на сайті" pill and an account card with **"Видати тимчасовий пароль"**
  (manager restores access; the password is shown once, all sessions are closed, audited as
  `customer.password_reset`). This replaces an e-mail/SMS reset flow, which needs a provider.

## Out of scope

Self-service password reset by e-mail/SMS, social sign-in, blocking accounts from the admin UI (the `status`
field exists), merging duplicate CRM customers when a buyer changes the phone to one another customer uses
(the form asks to contact a manager).
