"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Plus, Search } from "lucide-react";
import { ActionButton, Pill } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Rating } from "@/components/ui/Rating";
import { DateTime } from "@/components/admin/ui";
import { toast } from "@/lib/store";
import type { AdminReviewRow } from "@/lib/admin/queries/catalog";
import {
  createReviewAction,
  deleteReviewAction,
  searchProductsForReviewAction,
  setReviewStatusAction,
  updateReviewAction,
} from "@/lib/admin/actions/reviews";

const RATINGS = [5, 4, 3, 2, 1];

interface EditDraft {
  id: string;
  author: string;
  rating: number;
  text: string;
  car: string;
  date: string;
}

interface CreateDraft {
  productId: string;
  productName: string;
  author: string;
  rating: number;
  text: string;
  car: string;
  date: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function ReviewsBoard({ rows, canWrite }: { rows: AdminReviewRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [create, setCreate] = useState<CreateDraft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [results, setResults] = useState<{ id: string; name: string; sku: string }[]>([]);
  const [pending, start] = useTransition();
  const [searching, startSearch] = useTransition();

  function runEdit() {
    if (!edit) return;
    start(async () => {
      const result = await updateReviewAction(edit);
      if (result.ok) {
        toast({ title: "Відгук оновлено" });
        setEdit(null);
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  function runCreate() {
    if (!create) return;
    start(async () => {
      const result = await createReviewAction(create);
      if (result.ok) {
        toast({ title: "Відгук додано" });
        setCreate(null);
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  function search(q: string) {
    if (!create) return;
    setCreate({ ...create, productName: q, productId: "" });
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      const result = await searchProductsForReviewAction({ q });
      if (result.ok) setResults(result.data);
    });
  }

  function runDelete() {
    if (!deleteId) return;
    start(async () => {
      const result = await deleteReviewAction({ id: deleteId });
      if (result.ok) {
        toast({ title: "Відгук видалено" });
        setDeleteId(null);
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <div>
      {canWrite && (
        <div className="mb-3 flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setResults([]);
              setCreate({ productId: "", productName: "", author: "", rating: 5, text: "", car: "", date: today() });
            }}
          >
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
            Відгук
          </Button>
        </div>
      )}

      <ul className="grid gap-3">
        {rows.map((review) => (
          <li key={review.id} className="rounded-card border border-line-soft bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {review.productSlug ? (
                    <Link href={`/admin/products/${review.productId}`} className="text-sm font-semibold text-ink hover:text-brand-700">
                      {review.productName}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-ink">{review.productName}</span>
                  )}
                  {review.productSlug && (
                    <a
                      href={`/product/${review.productSlug}`}
                      target="_blank"
                      rel="noopener"
                      aria-label="Переглянути товар на сайті"
                      className="text-ink-3 hover:text-brand-700"
                    >
                      <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
                    </a>
                  )}
                  <Pill tone={review.source === "admin" ? "slate" : "blue"} size="sm" withDot={false}>
                    {review.source === "admin" ? "Адмін" : "Сайт"}
                  </Pill>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-3">
                  <Rating value={review.rating} size="sm" />
                  <span className="font-medium text-ink-2">{review.author}</span>
                  {review.car && <span>· {review.car}</span>}
                  <span>· <DateTime iso={review.date} /></span>
                </div>
              </div>
              <span className="shrink-0">
                <Pill
                  tone={review.status === "approved" ? "green" : review.status === "rejected" ? "red" : "amber"}
                  size="sm"
                >
                  {review.status === "approved" ? "Опубліковано" : review.status === "rejected" ? "Відхилено" : "На модерації"}
                </Pill>
              </span>
            </div>

            <p className="mt-2.5 text-[14px] leading-6 text-ink-2">{review.text}</p>

            {canWrite && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
                {review.status !== "approved" && (
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    action={() => setReviewStatusAction({ id: review.id, status: "approved" })}
                    successMessage="Відгук опубліковано"
                  >
                    Опублікувати
                  </ActionButton>
                )}
                {review.status !== "rejected" && (
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    action={() => setReviewStatusAction({ id: review.id, status: "rejected" })}
                    successMessage="Відгук відхилено"
                  >
                    Відхилити
                  </ActionButton>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setEdit({
                      id: review.id,
                      author: review.author,
                      rating: review.rating,
                      text: review.text,
                      car: review.car ?? "",
                      date: review.date.slice(0, 10),
                    })
                  }
                >
                  Редагувати
                </Button>
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeleteId(review.id)}>
                  Видалити
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Edit review */}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title="Редагувати відгук">
        {edit && (
          <div className="grid gap-4">
            <Field label="Автор" htmlFor="rv-author" required>
              <Input id="rv-author" value={edit.author} onChange={(e) => setEdit({ ...edit, author: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Оцінка" htmlFor="rv-rating">
                <Select id="rv-rating" value={String(edit.rating)} onChange={(e) => setEdit({ ...edit, rating: Number(e.target.value) })}>
                  {RATINGS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Дата" htmlFor="rv-date">
                <Input id="rv-date" type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
              </Field>
            </div>
            <Field label="Авто" htmlFor="rv-car">
              <Input id="rv-car" value={edit.car} onChange={(e) => setEdit({ ...edit, car: e.target.value })} />
            </Field>
            <Field label="Текст" htmlFor="rv-text" required>
              <Textarea id="rv-text" rows={4} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} />
            </Field>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEdit(null)} disabled={pending}>
                Скасувати
              </Button>
              <Button onClick={runEdit} disabled={pending || !edit.author.trim() || !edit.text.trim()} aria-busy={pending || undefined}>
                Зберегти
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create review */}
      <Modal open={create !== null} onClose={() => setCreate(null)} title="Новий відгук">
        {create && (
          <div className="grid gap-4">
            <Field label="Товар" htmlFor="rv-product" required hint="Пошук за назвою або артикулом">
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3">
                  <Search aria-hidden className="size-4" strokeWidth={1.75} />
                </span>
                <Input
                  id="rv-product"
                  value={create.productName}
                  onChange={(e) => search(e.target.value)}
                  placeholder="Почніть вводити…"
                  className="pl-9"
                  autoComplete="off"
                />
                {results.length > 0 && !create.productId && (
                  <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-card border border-line-soft bg-white p-1 shadow-pop">
                    {results.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCreate({ ...create, productId: p.id, productName: p.name });
                            setResults([]);
                          }}
                          className="flex w-full flex-col rounded-btn px-2.5 py-1.5 text-left hover:bg-mist"
                        >
                          <span className="text-sm text-ink">{p.name}</span>
                          <span className="tabular text-[12px] text-ink-3">{p.sku}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>
            {create.productId && <p className="text-[13px] text-ok">Товар обрано.</p>}
            {searching && <p className="text-[13px] text-ink-3">Пошук…</p>}
            <Field label="Автор" htmlFor="rv-new-author" required>
              <Input id="rv-new-author" value={create.author} onChange={(e) => setCreate({ ...create, author: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Оцінка" htmlFor="rv-new-rating">
                <Select id="rv-new-rating" value={String(create.rating)} onChange={(e) => setCreate({ ...create, rating: Number(e.target.value) })}>
                  {RATINGS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Дата" htmlFor="rv-new-date">
                <Input id="rv-new-date" type="date" value={create.date} onChange={(e) => setCreate({ ...create, date: e.target.value })} />
              </Field>
            </div>
            <Field label="Авто" htmlFor="rv-new-car">
              <Input id="rv-new-car" value={create.car} onChange={(e) => setCreate({ ...create, car: e.target.value })} />
            </Field>
            <Field label="Текст" htmlFor="rv-new-text" required>
              <Textarea id="rv-new-text" rows={4} value={create.text} onChange={(e) => setCreate({ ...create, text: e.target.value })} />
            </Field>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreate(null)} disabled={pending}>
                Скасувати
              </Button>
              <Button
                onClick={runCreate}
                disabled={pending || !create.productId || !create.author.trim() || !create.text.trim()}
                aria-busy={pending || undefined}
              >
                Додати
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Видалити відгук?"
        text="Відгук буде видалено назавжди."
        confirmLabel="Видалити"
        tone="danger"
        pending={pending}
        onConfirm={runDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
