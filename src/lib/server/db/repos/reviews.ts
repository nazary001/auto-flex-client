import type { Db, Filter } from "mongodb";
import type { ModeratedReview, Page, Paging, ReviewStatus } from "@/lib/admin/types";
import { cols, type ReviewDoc } from "../collections";
import { compact, containsRegex, fromDoc, newId, nowIso, paginate, toDoc } from "../util";
import { recomputeProductRating } from "@/lib/server/catalog/products";

const toReview = (doc: ReviewDoc): ModeratedReview => fromDoc<ModeratedReview>(doc);

export interface CreateReviewInput {
  productId: string;
  author: string;
  rating: number;
  text: string;
  car?: string;
  status?: ReviewStatus;
  source?: "site" | "admin";
  date?: string;
}

export async function createReview(db: Db, input: CreateReviewInput): Promise<ModeratedReview> {
  const now = nowIso();
  const review: ModeratedReview = compact({
    id: newId(),
    productId: input.productId,
    author: input.author.trim(),
    rating: Math.min(5, Math.max(1, Math.round(input.rating))),
    date: (input.date ?? now).slice(0, 10),
    text: input.text.trim(),
    car: input.car?.trim() || undefined,
    status: input.status ?? "pending",
    source: input.source ?? "site",
    createdAt: now,
  });
  await cols(db).reviews.insertOne(toDoc(review));
  if (review.status === "approved") await recomputeProductRating(db, review.productId);
  return review;
}

export async function getReview(db: Db, id: string): Promise<ModeratedReview | null> {
  const doc = await cols(db).reviews.findOne({ _id: id });
  return doc ? toReview(doc) : null;
}

export interface ReviewListFilter {
  status?: ReviewStatus[];
  productId?: string;
  q?: string;
}

export async function listReviews(db: Db, filter: ReviewListFilter, paging: Paging): Promise<Page<ModeratedReview>> {
  const query: Filter<ReviewDoc> = {};
  if (filter.status?.length) query.status = { $in: filter.status };
  if (filter.productId) query.productId = filter.productId;
  if (filter.q?.trim()) {
    const re = containsRegex(filter.q);
    query.$or = [{ author: re }, { text: re }, { car: re }];
  }
  return paginate(cols(db).reviews, query, { createdAt: -1 }, paging, toReview);
}

export async function setReviewStatus(db: Db, id: string, status: ReviewStatus): Promise<ModeratedReview | null> {
  const doc = await cols(db).reviews.findOneAndUpdate({ _id: id }, { $set: { status } }, { returnDocument: "after" });
  if (doc) await recomputeProductRating(db, doc.productId);
  return doc ? toReview(doc) : null;
}

export async function updateReview(
  db: Db,
  id: string,
  patch: Partial<Pick<ModeratedReview, "author" | "rating" | "text" | "car" | "date">>,
): Promise<ModeratedReview | null> {
  const doc = await cols(db).reviews.findOneAndUpdate({ _id: id }, { $set: compact({ ...patch }) }, { returnDocument: "after" });
  if (doc) await recomputeProductRating(db, doc.productId);
  return doc ? toReview(doc) : null;
}

export async function deleteReview(db: Db, id: string): Promise<void> {
  const doc = await cols(db).reviews.findOneAndDelete({ _id: id });
  if (doc) await recomputeProductRating(db, doc.productId);
}

/** Published reviews, merged into the storefront catalog */
export async function approvedReviews(db: Db): Promise<ModeratedReview[]> {
  const docs = await cols(db).reviews.find({ status: "approved" }).toArray();
  return docs.map(toReview);
}

export async function countPendingReviews(db: Db): Promise<number> {
  return cols(db).reviews.countDocuments({ status: "pending" });
}

export async function countReviewsByStatus(db: Db): Promise<Record<ReviewStatus, number>> {
  const rows = await cols(db)
    .reviews.aggregate<{ _id: ReviewStatus; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }])
    .toArray();
  const out: Record<ReviewStatus, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const row of rows) out[row._id] = row.n;
  return out;
}
