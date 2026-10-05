"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/store";

interface CopyTextProps {
  text: string;
  /** Visible label next to the icon; when omitted the button is icon-only */
  label?: string;
  className?: string;
}

/** Copies `text` to the clipboard and confirms with a toast. */
export function CopyText({ text, label, className }: CopyTextProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Скопійовано" });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Не вдалося скопіювати", tone: "error" });
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ? undefined : "Скопіювати"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-btn text-ink-3 transition-colors hover:text-brand-700",
        className,
      )}
    >
      {copied ? (
        <Check aria-hidden className="size-4 text-ok" strokeWidth={2} />
      ) : (
        <Copy aria-hidden className="size-4" strokeWidth={1.75} />
      )}
      {label && <span className="text-sm">{label}</span>}
    </button>
  );
}
