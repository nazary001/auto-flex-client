"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { addOrderNoteAction } from "@/lib/admin/actions/orders";
import { toast } from "@/lib/store";
import { useOrderAction } from "./use-order-action";

const CALL_OUTCOMES = ["Не відповідає", "Підтвердив", "Передзвонити пізніше"];

/** Timeline composer: a free note or a call outcome (optionally with a comment). */
export function OrderNoteComposer({ id }: { id: string }) {
  const { pending, run } = useOrderAction();
  const [text, setText] = useState("");

  function addNote() {
    if (text.trim().length === 0) {
      toast({ title: "Введіть текст нотатки.", tone: "error" });
      return;
    }
    run(() => addOrderNoteAction({ id, type: "note", text: text.trim() }), {
      success: "Нотатку додано",
      onSuccess: () => setText(""),
    });
  }

  function addCall(outcome: string) {
    const note = text.trim();
    const body = note ? `${outcome}: ${note}` : outcome;
    run(() => addOrderNoteAction({ id, type: "call", text: body }), {
      success: "Дзвінок записано",
      onSuccess: () => setText(""),
    });
  }

  return (
    <div className="rounded-card border border-line-soft bg-mist-soft p-3">
      <Textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Нотатка або коментар до дзвінка…"
        aria-label="Нотатка"
        className="bg-white"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending} onClick={addNote}>
          Нотатка
        </Button>
        <span aria-hidden className="h-5 w-px bg-line-soft" />
        {CALL_OUTCOMES.map((outcome) => (
          <Button key={outcome} variant="secondary" size="sm" disabled={pending} onClick={() => addCall(outcome)}>
            {outcome}
          </Button>
        ))}
      </div>
    </div>
  );
}
