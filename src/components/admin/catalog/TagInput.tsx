"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

/** Free-text tag editor (used for OE / cross-reference numbers). Enter or comma commits. */
export function TagInput({ id, values, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const parts = raw
      .split(/[,\n]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...values];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="field flex min-h-10 flex-wrap items-center gap-1.5 py-1.5">
      {values.map((value) => (
        <span key={value} className="tabular inline-flex items-center gap-1 rounded-btn bg-mist px-2 py-0.5 text-[13px] text-ink-2">
          {value}
          <button
            type="button"
            onClick={() => onChange(values.filter((v) => v !== value))}
            aria-label={`Прибрати ${value}`}
            className="text-ink-3 hover:text-danger"
          >
            <X aria-hidden className="size-3.5" strokeWidth={2} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(draft)}
        placeholder={values.length === 0 ? placeholder : ""}
        className="tabular min-w-24 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-ink-3"
      />
    </div>
  );
}
