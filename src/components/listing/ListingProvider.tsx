"use client";

import { createContext, useContext, useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { buildListingHref, type ListingPatch, type RawSearchParams } from "@/components/listing/params";

interface ListingNav {
  /** Patches the URL (router.replace in a transition, scroll preserved). */
  navigate: (patch: ListingPatch, optimistic?: () => void) => void;
  /** Replaces the URL with a ready-made href (the filter panel builds it from its optimistic state). */
  replace: (href: string, optimistic?: () => void) => void;
  /** True while the server re-renders the results for a new URL. */
  isPending: boolean;
}

const ListingContext = createContext<ListingNav | null>(null);

/**
 * Wraps a product listing so the toolbar, filters and results share one
 * navigation transition — filters update the URL without reloading or losing
 * scroll position, and the results dim while the new page is prepared.
 */
export function ListingProvider({
  pathname,
  searchParams,
  children,
}: {
  pathname: string;
  searchParams: RawSearchParams;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // While a transition is pending, `searchParams` is still the previous render's value.
  // Remember the last requested query so two quick changes build on each other.
  const pendingQuery = useRef<string | null>(null);
  useEffect(() => {
    pendingQuery.current = null;
  }, [searchParams]);

  const replace = (href: string, optimistic?: () => void) => {
    pendingQuery.current = href.split("?")[1] ?? "";
    startTransition(() => {
      optimistic?.();
      router.replace(href, { scroll: false });
    });
  };

  const navigate = (patch: ListingPatch, optimistic?: () => void) => {
    const current: RawSearchParams =
      pendingQuery.current === null ? searchParams : Object.fromEntries(new URLSearchParams(pendingQuery.current));
    replace(buildListingHref(pathname, current, patch), optimistic);
  };

  return <ListingContext.Provider value={{ navigate, replace, isPending }}>{children}</ListingContext.Provider>;
}

export function useListingNav(): ListingNav {
  const ctx = useContext(ListingContext);
  if (!ctx) throw new Error("useListingNav must be used inside <ListingProvider>");
  return ctx;
}
