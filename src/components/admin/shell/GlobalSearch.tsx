"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";

/** Topbar search: submits GET /admin/search?q=…; the "/" key focuses it unless already typing. */
export function GlobalSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form action="/admin/search" method="get" role="search" className="relative block w-full max-w-md">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
        strokeWidth={1.75}
      />
      <input
        ref={inputRef}
        type="search"
        name="q"
        placeholder="Пошук: номер, телефон, артикул…"
        aria-label="Глобальний пошук"
        className="field field-sm w-full pl-9"
      />
    </form>
  );
}
