"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatPrice, stockMeta } from "@/lib/format";
import { toast } from "@/lib/store";
import type { StockStatus } from "@/lib/types";
import { updateProductFieldAction } from "@/lib/admin/actions/catalog";

const STOCKS: StockStatus[] = ["in_stock", "low_stock", "preorder", "out_of_stock"];

/** Click-to-edit money cell: Enter / blur saves, Esc cancels. */
export function InlineNumber({
  id,
  field,
  value,
  allowEmpty,
  muted,
}: {
  id: string;
  field: "price" | "oldPrice";
  value?: number;
  allowEmpty?: boolean;
  muted?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [pending, start] = useTransition();

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === "" && !allowEmpty) {
      setDraft(value != null ? String(value) : "");
      return;
    }
    const next = trimmed === "" ? 0 : Math.round(Number(trimmed));
    if (!Number.isFinite(next) || next < 0) {
      setDraft(value != null ? String(value) : "");
      return;
    }
    if (next === (value ?? 0)) return;
    start(async () => {
      const result = await updateProductFieldAction({ id, field, value: next });
      if (result.ok) {
        toast({ title: "Збережено" });
        router.refresh();
      } else {
        toast({ title: result.error, tone: "error" });
        setDraft(value != null ? String(value) : "");
      }
    });
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setDraft(value != null ? String(value) : "");
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        inputMode="numeric"
        value={draft}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        aria-label={field === "price" ? "Ціна" : "Стара ціна"}
        className="field field-sm w-24 text-right tabular"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        "tabular rounded-btn px-1.5 py-0.5 text-right transition-colors hover:bg-brand-50 hover:text-brand-700",
        muted ? "text-ink-3" : "font-medium text-ink",
        pending && "opacity-50",
      )}
    >
      {value != null && value > 0 ? formatPrice(value) : <span className="text-ink-3">—</span>}
    </button>
  );
}

/** Inline stock selector that saves on change. */
export function InlineStock({ id, value }: { id: string; value: StockStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function change(next: string) {
    if (next === value) return;
    start(async () => {
      const result = await updateProductFieldAction({ id, field: "stock", value: next });
      if (result.ok) router.refresh();
      else toast({ title: result.error, tone: "error" });
    });
  }

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => change(e.target.value)}
      aria-label="Наявність"
      className="field field-sm w-auto min-w-36"
    >
      {STOCKS.map((s) => (
        <option key={s} value={s}>
          {stockMeta[s].label}
        </option>
      ))}
    </select>
  );
}
