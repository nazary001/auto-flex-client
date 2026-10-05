"use client";

import { useRef, useState, useTransition } from "react";
import { Textarea } from "@/components/ui/Field";
import { toast } from "@/lib/store";
import { updateCustomerAction } from "@/lib/admin/actions/customers";

/** Internal notes with autosave: writes on blur when the text actually changed. */
export function CustomerNotes({ id, notes }: { id: string; notes: string }) {
  const [value, setValue] = useState(notes);
  const saved = useRef(notes);
  const [pending, startTransition] = useTransition();

  function save() {
    const next = value.trim();
    if (next === saved.current.trim()) return;
    startTransition(async () => {
      const result = await updateCustomerAction({ id, notes: next });
      if (result.ok) {
        saved.current = next;
        toast({ title: "Нотатку збережено" });
      } else {
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        rows={5}
        aria-label="Нотатки про клієнта"
        placeholder="Побажання, домовленості, історія спілкування…"
      />
      <p className="mt-1.5 text-[12.5px] text-ink-3">
        {pending ? "Збереження…" : "Зберігається автоматично після втрати фокуса"}
      </p>
    </div>
  );
}
