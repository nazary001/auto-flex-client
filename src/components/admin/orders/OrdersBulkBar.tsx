"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/store";
import { allowedTransitions } from "@/lib/admin/domain/order-status";
import { orderStatusMeta } from "@/lib/admin/labels";
import type { OrderStatus } from "@/lib/admin/types";
import { bulkAssignAction, bulkStatusAction } from "@/lib/admin/actions/orders";

interface OrdersBulkBarProps {
  assignees: { id: string; name: string }[];
}

/**
 * Floating bar for the orders list. Reads the checked rows from the enclosing <form>, offers
 * "assign" and "change status" (only transitions valid for every selected order) and calls the
 * bulk actions. Mounted inside the list form; selection lives in the DOM, not React state.
 */
export function OrdersBulkBar({ assignees }: OrdersBulkBarProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const recompute = useCallback((form: HTMLFormElement) => {
    const checked = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked'));
    const seen = new Set<string>();
    const nextIds: string[] = [];
    const nextStatuses: OrderStatus[] = [];
    for (const box of checked) {
      if (seen.has(box.value)) continue;
      seen.add(box.value);
      nextIds.push(box.value);
      const s = box.dataset.status;
      if (s) nextStatuses.push(s as OrderStatus);
    }
    setIds(nextIds);
    setStatuses([...new Set(nextStatuses)]);
  }, []);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const handler = () => recompute(form);
    form.addEventListener("change", handler);
    recompute(form);
    return () => form.removeEventListener("change", handler);
  }, [recompute]);

  const form = () => rootRef.current?.closest("form") ?? null;

  function clearSelection() {
    const el = form();
    if (!el) return;
    el.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((box) => (box.checked = false));
    recompute(el);
  }

  // Transitions valid for every selected order
  const validTransitions =
    statuses.length === 0
      ? []
      : statuses
          .map((s) => allowedTransitions(s))
          .reduce<OrderStatus[]>((acc, list, index) => (index === 0 ? list : acc.filter((t) => list.includes(t))), []);

  function runAssign() {
    startTransition(async () => {
      const result = await bulkAssignAction({ ids, assigneeId: assignee });
      if (result.ok) {
        toast({ title: `Призначено: ${result.data.count}` });
        clearSelection();
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  function runStatus() {
    if (!status) return;
    if (status === "cancelled" && reason.trim().length === 0) {
      toast({ title: "Вкажіть причину скасування.", tone: "error" });
      return;
    }
    startTransition(async () => {
      const result = await bulkStatusAction({ ids, to: status, reason: reason.trim() || undefined });
      if (result.ok) {
        toast({ title: result.data.failed ? `Оновлено ${result.data.count}, пропущено ${result.data.failed}` : `Оновлено: ${result.data.count}` });
        setStatus("");
        setReason("");
        clearSelection();
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <div ref={rootRef}>
      {ids.length > 0 && (
        <div className="sticky bottom-3 z-30 mt-3">
          <div className="flex flex-wrap items-center gap-2 rounded-card border border-line-soft bg-white p-2.5 shadow-pop sm:gap-3 sm:px-3.5">
            <span className="tabular text-sm font-semibold text-ink">Обрано: {ids.length}</span>
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
            >
              <X aria-hidden className="size-3.5" strokeWidth={2} />
              Зняти
            </button>

            <span aria-hidden className="hidden h-6 w-px bg-line-soft sm:block" />

            <div className="flex items-center gap-1.5">
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                aria-label="Відповідальний"
                className="field field-sm w-auto min-w-40"
              >
                <option value="">Без відповідального</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <Button variant="secondary" size="sm" disabled={pending} onClick={runAssign}>
                Призначити
              </Button>
            </div>

            <span aria-hidden className="hidden h-6 w-px bg-line-soft sm:block" />

            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Новий статус"
                className="field field-sm w-auto min-w-40"
                disabled={validTransitions.length === 0}
              >
                <option value="">{validTransitions.length === 0 ? "Немає спільних переходів" : "Змінити статус…"}</option>
                {validTransitions.map((s) => (
                  <option key={s} value={s}>
                    {orderStatusMeta[s].label}
                  </option>
                ))}
              </select>
              {status === "cancelled" && (
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runStatus();
                    }
                  }}
                  placeholder="Причина скасування"
                  aria-label="Причина скасування"
                  className="field field-sm w-auto min-w-44"
                />
              )}
              <Button variant="secondary" size="sm" disabled={pending || !status} onClick={runStatus}>
                Застосувати
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
