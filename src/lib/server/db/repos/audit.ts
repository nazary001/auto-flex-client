import type { Db, Filter } from "mongodb";
import type { Actor, AuditEntry, AuditListFilter, Page, Paging } from "@/lib/admin/types";
import { cols, type AuditDoc } from "../collections";
import { compact, dateRange, fromDoc, newId, nowIso, paginate, toDoc } from "../util";

const toEntry = (doc: AuditDoc): AuditEntry => fromDoc<AuditEntry>(doc);

export interface RecordAuditInput {
  actor: Actor;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  data?: Record<string, unknown>;
}

export async function recordAudit(db: Db, input: RecordAuditInput): Promise<AuditEntry> {
  const entry: AuditEntry = compact({
    id: newId(),
    at: nowIso(),
    actorId: input.actor.id,
    actorName: input.actor.name,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    summary: input.summary,
    data: input.data,
  });
  await cols(db).audit.insertOne(toDoc(entry));
  return entry;
}

export async function listAudit(db: Db, filter: AuditListFilter, paging: Paging): Promise<Page<AuditEntry>> {
  const query: Filter<AuditDoc> = {};
  if (filter.entity) query.entity = filter.entity;
  if (filter.entityId) query.entityId = filter.entityId;
  if (filter.actorId) query.actorId = filter.actorId;
  if (filter.action) query.action = filter.action;
  const range = dateRange(filter.from, filter.to);
  if (range) query.at = range;
  return paginate(cols(db).audit, query, { at: -1 }, paging, toEntry);
}

export async function listAuditForEntity(db: Db, entity: string, entityId: string, limit = 50): Promise<AuditEntry[]> {
  const docs = await cols(db).audit.find({ entity, entityId }).sort({ at: -1 }).limit(limit).toArray();
  return docs.map(toEntry);
}

export async function listAuditActions(db: Db): Promise<string[]> {
  const actions = await cols(db).audit.distinct("action");
  return (actions as string[]).sort();
}
