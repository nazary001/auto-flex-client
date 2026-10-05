import type { Db, Filter } from "mongodb";
import { normalizePhone } from "@/lib/format";
import type { CustomerRequest, Page, Paging, RequestListFilter, RequestStatus } from "@/lib/admin/types";
import { cols, type RequestDoc } from "../collections";
import { compact, containsRegex, fromDoc, newId, nowIso, paginate, toDoc } from "../util";

const toRequest = (doc: RequestDoc): CustomerRequest => fromDoc<CustomerRequest>(doc);

export type CreateRequestInput = Pick<CustomerRequest, "kind" | "phone"> &
  Partial<Pick<CustomerRequest, "name" | "productId" | "productName" | "productSku" | "comment" | "status">>;

export async function createRequest(
  db: Db,
  input: CreateRequestInput,
  options: { createdAt?: string } = {},
): Promise<CustomerRequest> {
  const now = options.createdAt ?? nowIso();
  const request: CustomerRequest = compact({
    id: newId(),
    kind: input.kind,
    status: input.status ?? "new",
    phone: normalizePhone(input.phone),
    name: input.name?.trim() || undefined,
    productId: input.productId,
    productName: input.productName,
    productSku: input.productSku,
    comment: input.comment?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  });
  await cols(db).requests.insertOne(toDoc(request));
  return request;
}

export async function getRequest(db: Db, id: string): Promise<CustomerRequest | null> {
  const doc = await cols(db).requests.findOne({ _id: id });
  return doc ? toRequest(doc) : null;
}

export async function listRequests(db: Db, filter: RequestListFilter, paging: Paging): Promise<Page<CustomerRequest>> {
  const query: Filter<RequestDoc> = {};
  if (filter.status?.length) query.status = { $in: filter.status };
  if (filter.kind?.length) query.kind = { $in: filter.kind };
  if (filter.assigneeId) query.assigneeId = filter.assigneeId;
  if (filter.q?.trim()) {
    const q = filter.q.trim();
    const re = containsRegex(q);
    const digits = q.replace(/\D/g, "");
    query.$or = [{ name: re }, { comment: re }, { productName: re }, { productSku: re }];
    if (digits.length >= 3) query.$or.push({ phone: new RegExp(digits) });
  }
  return paginate(cols(db).requests, query, { createdAt: -1 }, paging, toRequest);
}

export async function listRequestsByPhone(db: Db, phone: string, limit = 20): Promise<CustomerRequest[]> {
  const docs = await cols(db)
    .requests.find({ phone: normalizePhone(phone) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toRequest);
}

export async function updateRequest(
  db: Db,
  id: string,
  patch: Partial<Pick<CustomerRequest, "status" | "assigneeId" | "resultNote" | "orderId" | "name" | "comment">>,
): Promise<CustomerRequest | null> {
  const $set: Record<string, unknown> = compact({ ...patch, updatedAt: nowIso() });
  const $unset: Record<string, ""> = {};
  for (const [key, value] of Object.entries(patch)) if (value === undefined) $unset[key] = "";
  const update: Record<string, unknown> = { $set };
  if (Object.keys($unset).length) update.$unset = $unset;
  const doc = await cols(db).requests.findOneAndUpdate({ _id: id }, update, { returnDocument: "after" });
  return doc ? toRequest(doc) : null;
}

export async function countRequestsByStatus(db: Db): Promise<Record<RequestStatus, number>> {
  const rows = await cols(db)
    .requests.aggregate<{ _id: RequestStatus; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }])
    .toArray();
  const out: Record<RequestStatus, number> = { new: 0, in_progress: 0, done: 0, spam: 0 };
  for (const row of rows) out[row._id] = row.n;
  return out;
}

export async function countNewRequests(db: Db): Promise<number> {
  return cols(db).requests.countDocuments({ status: "new" });
}
