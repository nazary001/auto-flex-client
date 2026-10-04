"use client";

import { useEffect, useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/**
 * false on the server and during hydration, true afterwards.
 * Gate anything that reads localStorage-backed state on it to avoid hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

/** Locks page scroll while `locked` is true (drawers, mobile menus) */
export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [locked]);
}

/** Calls `onEscape` when Escape is pressed while `active` is true */
export function useEscape(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active, onEscape]);
}
