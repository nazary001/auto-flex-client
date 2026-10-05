"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Triggers the browser print dialog; hidden on the printed page via `adm-no-print`. */
export function PrintButton() {
  return (
    <Button type="button" variant="secondary" size="sm" className="adm-no-print" onClick={() => window.print()}>
      <Printer aria-hidden className="size-4" strokeWidth={1.75} />
      Друкувати
    </Button>
  );
}
