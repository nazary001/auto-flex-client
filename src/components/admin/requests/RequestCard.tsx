"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, StickyNote } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, buttonClass } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { ActionButton, DateTime, Pill, PhoneLink, StatusBadge } from "@/components/admin/ui";
import { requestKindLabel } from "@/lib/admin/labels";
import { toast } from "@/lib/store";
import type { CustomerRequest } from "@/lib/admin/types";
import { assignRequestAction, requestNoteAction, setRequestStatusAction } from "@/lib/admin/actions/requests";

interface RequestUser {
  id: string;
  name: string;
}

interface RequestCardProps {
  request: CustomerRequest;
  assigneeName?: string;
  /** "/product/<slug>" when the referenced product exists in the catalog */
  productHref?: string;
  users: RequestUser[];
  canWrite: boolean;
  focused: boolean;
}

const OPEN_STATUSES: CustomerRequest["status"][] = ["new", "in_progress"];

export function RequestCard({ request, assigneeName, productHref, users, canWrite, focused }: RequestCardProps) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  const [pending, startTransition] = useTransition();
  const [doneOpen, setDoneOpen] = useState(false);
  const [doneNote, setDoneNote] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(request.resultNote ?? "");

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focused]);

  function markDone() {
    startTransition(async () => {
      const result = await setRequestStatusAction({ id: request.id, status: "done", resultNote: doneNote.trim() || undefined });
      if (result.ok) {
        toast({ title: "Заявку опрацьовано" });
        setDoneOpen(false);
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  function saveNote() {
    startTransition(async () => {
      const result = await requestNoteAction({ id: request.id, resultNote: note.trim() });
      if (result.ok) {
        toast({ title: "Нотатку збережено" });
        setEditingNote(false);
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  function reassign(assigneeId: string) {
    startTransition(async () => {
      const result = await assignRequestAction({ id: request.id, assigneeId });
      if (result.ok) router.refresh();
      else toast({ title: result.error, tone: "error" });
    });
  }

  const name = request.name?.trim() || "Без імені";

  return (
    <article
      ref={ref}
      id={`request-${request.id}`}
      className={cn(
        "rounded-card border bg-white p-4 transition-colors sm:p-5",
        focused ? "border-brand-300 ring-2 ring-brand-200 adm-flash" : "border-line-soft",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Pill tone="neutral" size="sm">
          {requestKindLabel[request.kind]}
        </Pill>
        <StatusBadge kind="request" value={request.status} size="sm" />
        <DateTime iso={request.createdAt} mode="relative" className="text-[12.5px] text-ink-3" />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <p className="text-[15px] font-semibold text-ink">{name}</p>
        <PhoneLink phone={request.phone} />
      </div>

      {(request.productName || request.productSku) && (
        <p className="mt-2 text-sm text-ink-2">
          <span className="text-ink-3">Товар: </span>
          {productHref ? (
            <Link
              href={productHref}
              target="_blank"
              rel="noreferrer"
              className="link inline-flex items-center gap-1 font-medium"
            >
              {request.productName ?? request.productSku}
              <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
            </Link>
          ) : (
            <span className="font-medium text-ink">{request.productName ?? request.productSku}</span>
          )}
          {request.productSku && <span className="tabular text-ink-3"> · {request.productSku}</span>}
        </p>
      )}

      {request.comment && <p className="mt-2 text-sm whitespace-pre-line text-ink-2">{request.comment}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-3">
        {canWrite ? (
          <label className="flex items-center gap-1.5">
            <span>Відповідальний</span>
            <select
              value={request.assigneeId ?? ""}
              onChange={(e) => reassign(e.target.value)}
              disabled={pending}
              aria-label="Відповідальний менеджер"
              className="field field-sm w-auto min-w-40"
            >
              <option value="">Не призначено</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span>Відповідальний: {assigneeName ?? "не призначено"}</span>
        )}
      </div>

      {/* Result note */}
      {editingNote ? (
        <div className="mt-3">
          <Field label="Нотатка" htmlFor={`note-${request.id}`}>
            <Textarea
              id={`note-${request.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Що зробили або зʼясували"
            />
          </Field>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={saveNote} disabled={pending} aria-busy={pending || undefined}>
              Зберегти
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNote(request.resultNote ?? "");
                setEditingNote(false);
              }}
              disabled={pending}
            >
              Скасувати
            </Button>
          </div>
        </div>
      ) : (
        request.resultNote && (
          <p className="mt-3 rounded-btn bg-mist-soft px-3 py-2 text-sm text-ink-2">
            <span className="text-ink-3">Результат: </span>
            {request.resultNote}
          </p>
        )
      )}

      {request.orderId && (
        <p className="mt-3 text-sm">
          <Link href={`/admin/orders/${request.orderId}`} className="link font-medium">
            Перейти до замовлення
          </Link>
        </p>
      )}

      {canWrite && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-soft pt-3">
          {request.status === "new" && (
            <ActionButton
              action={() => setRequestStatusAction({ id: request.id, status: "in_progress", assignToMe: true })}
              successMessage="Заявку взято в роботу"
              variant="secondary"
              size="sm"
            >
              Взяти в роботу
            </ActionButton>
          )}

          {OPEN_STATUSES.includes(request.status) && (
            <Button size="sm" onClick={() => setDoneOpen(true)} disabled={pending}>
              Опрацьовано
            </Button>
          )}

          {request.status === "in_progress" && (
            <ActionButton
              action={() => setRequestStatusAction({ id: request.id, status: "new" })}
              successMessage="Повернуто в нові"
              variant="ghost"
              size="sm"
            >
              Повернути в нові
            </ActionButton>
          )}

          {request.kind === "quick_order" && OPEN_STATUSES.includes(request.status) && (
            <Link href={`/admin/orders/new?request=${request.id}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
              Створити замовлення
            </Link>
          )}

          {request.status === "new" && (
            <ActionButton
              action={() => setRequestStatusAction({ id: request.id, status: "spam" })}
              confirm={{ title: "Позначити як спам?", confirmLabel: "Спам", tone: "danger" }}
              successMessage="Позначено як спам"
              variant="ghost"
              size="sm"
            >
              Спам
            </ActionButton>
          )}

          {!editingNote && (
            <button
              type="button"
              onClick={() => setEditingNote(true)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-btn px-2 py-1 text-sm font-medium text-ink-3 transition-colors hover:text-brand-700"
            >
              <StickyNote aria-hidden className="size-4" strokeWidth={1.75} />
              Нотатка
            </button>
          )}
        </div>
      )}

      <Modal open={doneOpen} onClose={() => setDoneOpen(false)} title="Опрацювати заявку" className="max-w-md">
        <Field label="Результат" htmlFor={`done-${request.id}`} hint="Коротко про підсумок — необовʼязково">
          <Textarea
            id={`done-${request.id}`}
            value={doneNote}
            onChange={(e) => setDoneNote(e.target.value)}
            rows={3}
            placeholder="Напр. передзвонив, оформив замовлення AF-…"
          />
        </Field>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDoneOpen(false)} disabled={pending}>
            Скасувати
          </Button>
          <Button onClick={markDone} disabled={pending} aria-busy={pending || undefined}>
            Опрацьовано
          </Button>
        </div>
      </Modal>
    </article>
  );
}
