"use client";

import type { FormEvent, ReactNode } from "react";

/** Submits the enclosing form whenever a control inside changes (filters that apply instantly). */
export function AutoSubmit({ children }: { children: ReactNode }) {
  function onChange(event: FormEvent<HTMLSpanElement>) {
    event.currentTarget.closest("form")?.requestSubmit();
  }
  return (
    <span className="contents" onChange={onChange}>
      {children}
    </span>
  );
}
