"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a popover (mega-menu, mini-cart, search suggestions) when the pointer
 * goes down outside every referenced element. Paired with `useEscape` from
 * "@/lib/hooks" for keyboard dismissal. Refs that are currently null are ignored.
 */
export function useOutsidePointer(
  active: boolean,
  onDismiss: () => void,
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
): void {
  useEffect(() => {
    if (!active) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      for (const ref of refs) {
        if (ref.current?.contains(target)) return;
      }
      onDismiss();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onDismiss, ...refs]);
}
