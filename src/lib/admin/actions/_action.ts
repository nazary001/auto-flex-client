import type { Db } from "mongodb";
import { z, type ZodType } from "zod";
import type { Permission } from "@/lib/admin/permissions";
import type { Actor, AdminUser } from "@/lib/admin/types";
import { AuthError, requireActor, toActor } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { recordAudit, type RecordAuditInput } from "@/lib/server/db/repos/audit";

/*
 * Every admin Server Action is built with `runAction`: parse the input with zod, check the
 * permission, run, and map every failure to a result the client can show. Actions never throw
 * to the client (except Next.js redirects, which are re-thrown).
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export interface ActionContext {
  db: Db;
  user: AdminUser;
  actor: Actor;
  /** Shortcut for recordAudit with the current actor */
  audit: (input: Omit<RecordAuditInput, "actor">) => Promise<void>;
}

/** Thrown inside `run` to return a user-facing message (not logged as an error) */
export class ActionError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = undefined>(error: string, fieldErrors?: Record<string, string>): ActionResult<T> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

function isNextRedirect(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"));
}

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export interface RunActionOptions<I, O> {
  permission?: Permission;
  schema: ZodType<I>;
  input: unknown;
  run: (input: I, ctx: ActionContext) => Promise<O> | O;
}

export async function runAction<I, O>({ permission, schema, input, run }: RunActionOptions<I, O>): Promise<ActionResult<O>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    const first = Object.values(fieldErrors)[0] ?? "Перевірте введені дані.";
    return fail(first, fieldErrors);
  }
  try {
    const user = await requireActor(permission);
    const db = await getDb();
    const actor = toActor(user);
    const ctx: ActionContext = {
      db,
      user,
      actor,
      audit: async (entry) => {
        await recordAudit(db, { ...entry, actor });
      },
    };
    return ok(await run(parsed.data, ctx));
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    if (error instanceof AuthError) return fail(error.message);
    if (error instanceof ActionError) return fail(error.message, error.fieldErrors);
    if (error instanceof Error && error.name === "TransitionError") return fail(error.message);
    console.error("[AutoFlex] Помилка дії адмінки", error);
    return fail("Не вдалося виконати дію. Спробуйте ще раз.");
  }
}

/** Reusable zod pieces */
export const idSchema = z.string().min(1).max(80);
export const moneySchema = z.coerce.number().min(0).max(100_000_000);
export const textSchema = (max: number) => z.string().trim().max(max);
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));
