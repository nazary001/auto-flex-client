"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/admin/ui";
import { setTagsAction } from "@/lib/admin/actions/orders";
import { useOrderAction } from "./use-order-action";

interface OrderTagsEditorProps {
  id: string;
  tags: string[];
  canWrite: boolean;
}

/** Chip editor for order tags; commits the whole set with setTagsAction. */
export function OrderTagsEditor({ id, tags, canWrite }: OrderTagsEditorProps) {
  const { pending, run } = useOrderAction();
  const [list, setList] = useState<string[]>(tags);
  const [draft, setDraft] = useState("");
  const dirty = list.join("\u0000") !== tags.join("\u0000");

  function add(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setList((prev) => (prev.includes(value) ? prev : [...prev, value].slice(0, 20)));
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && list.length > 0) {
      setList((prev) => prev.slice(0, -1));
    }
  }

  if (!canWrite) {
    return list.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {list.map((tag) => (
          <Pill key={tag} tone="neutral" size="sm">
            {tag}
          </Pill>
        ))}
      </div>
    ) : (
      <p className="text-sm text-ink-3">Міток немає.</p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {list.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-xs font-semibold text-ink-2">
            {tag}
            <button type="button" aria-label={`Прибрати ${tag}`} onClick={() => setList((prev) => prev.filter((t) => t !== tag))}>
              <X aria-hidden className="size-3" strokeWidth={2.5} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
        placeholder="Додати мітку і Enter"
        aria-label="Нова мітка"
        className="field field-sm mt-2 w-full"
      />
      {dirty && (
        <Button
          size="sm"
          className="mt-2"
          disabled={pending}
          onClick={() => run(() => setTagsAction({ id, tags: list }), { success: "Мітки збережено" })}
        >
          Зберегти мітки
        </Button>
      )}
    </div>
  );
}
