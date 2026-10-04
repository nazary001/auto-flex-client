"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";

/** «Артикул: BP-204531» with a copy-to-clipboard button */
export function CopySku({ sku, className }: { sku: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(sku);
      setCopied(true);
    } catch {
      // Clipboard is unavailable (insecure context / denied permission): the SKU stays selectable as text
    }
  }

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 text-[13px] text-ink-3", className)}>
      <span className="truncate">
        Артикул: <span className="tabular font-medium text-ink-2 select-all">{sku}</span>
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Артикул скопійовано" : `Скопіювати артикул ${sku}`}
        className="relative z-10 grid size-6 shrink-0 place-content-center rounded text-ink-3 transition-colors hover:bg-mist hover:text-brand-700"
      >
        {copied ? <Check aria-hidden className="size-3.5 text-ok" /> : <Copy aria-hidden className="size-3.5" />}
      </button>
    </span>
  );
}
