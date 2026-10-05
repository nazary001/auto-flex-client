"use client";

import { useSyncExternalStore } from "react";

/*
 * Tiny client-only channel between <BuyBox> and <ProductGallery>, which the product page renders
 * as siblings. When the buyer picks a variant that has its own photo, BuyBox publishes that URL
 * here and the gallery shows it first. No props thread through the (server) page, and nothing is
 * persisted — the value is reset when BuyBox unmounts (navigating away) or a variant without a
 * photo is selected.
 */

let current: string | undefined;
const listeners = new Set<() => void>();

export function setVariantImage(image: string | undefined): void {
  if (current === image) return;
  current = image;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string | undefined {
  return current;
}

function getServerSnapshot(): string | undefined {
  return undefined;
}

/** The photo of the currently selected variant, or undefined. Server renders without it. */
export function useVariantImage(): string | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
