"use client";

import { useSyncExternalStore } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";

const THRESHOLD = 500;

function subscribe(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  window.addEventListener("resize", callback);
  return () => {
    window.removeEventListener("scroll", callback);
    window.removeEventListener("resize", callback);
  };
}

const getSnapshot = () => window.scrollY > THRESHOLD;
const getServerSnapshot = () => false;

/** Appears after scrolling; sits above the mobile tab bar. */
export function BackToTop() {
  const visible = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <button
      type="button"
      aria-label="Нагору"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 grid size-11 place-content-center rounded-full border border-line-soft bg-white text-brand-700 shadow-pop transition-[opacity,transform] duration-200 hover:bg-brand-50 hover:text-brand-800 lg:right-6 lg:bottom-6",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <ArrowUp aria-hidden className="size-5" strokeWidth={2} />
    </button>
  );
}
