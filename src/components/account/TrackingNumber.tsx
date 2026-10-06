"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/** The parcel number in tabular figures with a copy-to-clipboard button */
export function TrackingNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard unavailable (insecure context / denied): the number stays selectable as text
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="tabular font-semibold text-ink select-all">{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Номер скопійовано" : `Скопіювати номер ${value}`}
        className="grid size-7 shrink-0 place-content-center rounded-full text-ink-3 transition-colors hover:bg-mist hover:text-brand-700"
      >
        {copied ? <Check aria-hidden className="size-3.5 text-ok" /> : <Copy aria-hidden className="size-3.5" />}
      </button>
    </span>
  );
}
