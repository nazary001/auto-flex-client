"use client";

import Link from "next/link";
import { User } from "lucide-react";
import { useAccountSummary } from "@/lib/account/client";

/**
 * Header entry to the customer cabinet. Guests see "Увійти"; a signed-in customer sees their
 * first name. The pages stay static: the state comes from a small client request, made only
 * when the sign-in hint cookie is present.
 */
export function AccountLink() {
  const { loading, summary } = useAccountSummary();
  const signedIn = summary !== null;
  const label = signedIn ? summary.firstName.trim() || "Кабінет" : loading ? "Кабінет" : "Увійти";

  return (
    <Link
      href={signedIn || loading ? "/account" : "/account/login"}
      aria-label={signedIn ? `Кабінет: ${label}` : "Увійти до кабінету"}
      className="group flex w-[4.25rem] flex-col items-center gap-1 rounded-btn px-1 py-1.5 text-[11px] font-medium text-ink-2 transition-colors hover:bg-mist hover:text-brand-700"
    >
      <span className="relative">
        <User aria-hidden className="size-6" strokeWidth={1.75} />
        {signedIn && <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-ok ring-2 ring-white" />}
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
