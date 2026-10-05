import type { Db, Filter } from "mongodb";
import type { AuditEntry, Page, Paging } from "@/lib/admin/types";
import { cols, type AuditDoc } from "@/lib/server/db/collections";
import { dateRange, fromDoc, paginate } from "@/lib/server/db/util";

/*
 * Read side of the audit log for /admin/audit. The repository's `listAudit` filters by a real
 * actor id; here we additionally support the two system pseudo-actors (storefront and system
 * tasks) which share a null `actorId` and are told apart by name.
 */

const SITE_ACTOR_NAME = "Сайт";
const SYSTEM_ACTOR_NAME = "Система";

export interface AuditQuery {
  entity?: string;
  actorId?: string;
  /** Entries with a null actorId, distinguished by their recorded name */
  actorKind?: "site" | "system";
  action?: string;
  from?: string;
  to?: string;
}

export async function queryAudit(db: Db, filter: AuditQuery, paging: Paging): Promise<Page<AuditEntry>> {
  const query: Filter<AuditDoc> = {};
  if (filter.entity) query.entity = filter.entity;
  if (filter.action) query.action = filter.action;
  if (filter.actorId) {
    query.actorId = filter.actorId;
  } else if (filter.actorKind) {
    query.actorId = null;
    query.actorName = filter.actorKind === "site" ? SITE_ACTOR_NAME : SYSTEM_ACTOR_NAME;
  }
  const range = dateRange(filter.from, filter.to);
  if (range) query.at = range;
  return paginate(cols(db).audit, query, { at: -1 }, paging, (doc) => fromDoc<AuditEntry>(doc));
}

/** Distinct action codes, for the action filter */
export async function listAuditActions(db: Db): Promise<string[]> {
  const actions = await cols(db).audit.distinct("action");
  return (actions as string[]).filter(Boolean).sort();
}

// ── Entity metadata ─────────────────────────────────────────

export const AUDIT_ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: "order", label: "Замовлення" },
  { value: "purchase_order", label: "Закупівля" },
  { value: "supplier", label: "Постачальник" },
  { value: "customer", label: "Клієнт" },
  { value: "request", label: "Заявка" },
  { value: "product", label: "Товар" },
  { value: "category", label: "Категорія" },
  { value: "brand", label: "Бренд" },
  { value: "review", label: "Відгук" },
  { value: "promo", label: "Акція" },
  { value: "faq", label: "FAQ" },
  { value: "settings", label: "Налаштування" },
  { value: "user", label: "Користувач" },
  { value: "system", label: "Система" },
];

const entityLabels = new Map(AUDIT_ENTITY_OPTIONS.map((option) => [option.value, option.label]));

export function auditEntityLabel(entity: string): string {
  return entityLabels.get(entity) ?? entity;
}

/** Detail link for the entities that have an admin page, otherwise null */
export function auditEntityHref(entity: string, entityId: string): string | null {
  if (!entityId) return null;
  switch (entity) {
    case "order":
      return `/admin/orders/${entityId}`;
    case "purchase_order":
      return `/admin/purchases/${entityId}`;
    case "supplier":
      return `/admin/suppliers/${entityId}`;
    case "customer":
      return `/admin/customers/${entityId}`;
    case "product":
      return `/admin/products/${entityId}`;
    default:
      return null;
  }
}

/** Resolves the actor filter value from the select into an AuditQuery fragment */
export function parseAuditActor(value: string | undefined): Pick<AuditQuery, "actorId" | "actorKind"> {
  if (!value) return {};
  if (value === "site") return { actorKind: "site" };
  if (value === "system") return { actorKind: "system" };
  return { actorId: value };
}
