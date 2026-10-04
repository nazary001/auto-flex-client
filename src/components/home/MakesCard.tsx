"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MakeOption {
  slug: string;
  name: string;
}

/** Lowercase and strip diacritics so "skoda" matches "Škoda", "citroen" matches "Citroën". */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("uk");
}

/** «Марки авто» card: filter-as-you-type over the make list, each linking to /avto/[make]. */
export function MakesCard({ makes, className }: { makes: MakeOption[]; className?: string }) {
  const [query, setQuery] = useState("");
  const inputId = useId();

  const q = normalize(query.trim());
  const filtered = q ? makes.filter((m) => normalize(m.name).includes(q)) : makes;

  return (
    <nav aria-label="Марки авто" className={cn("card overflow-hidden", className)}>
      <p className="bg-navy-900 px-4 py-3 text-[15px] font-semibold text-white">Марки авто</p>

      <div className="p-3">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
            strokeWidth={1.75}
          />
          <label htmlFor={inputId} className="sr-only">
            Пошук за маркою
          </label>
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Пошук за маркою"
            autoComplete="off"
            className="field field-sm pl-9"
          />
        </div>

        {filtered.length > 0 ? (
          <ul className="scrollbar-none mt-2 grid max-h-64 gap-0.5 overflow-y-auto">
            {filtered.map((make) => (
              <li key={make.slug}>
                <Link
                  href={`/avto/${make.slug}`}
                  className="block truncate rounded-md px-3 py-1.5 text-sm text-ink-2 transition-colors hover:bg-mist-soft hover:text-brand-700"
                >
                  {make.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 px-3 pb-1 text-sm text-ink-3">Нічого не знайдено. Спробуйте іншу назву.</p>
        )}
      </div>

      <Link
        href="/avto"
        className="group flex items-center justify-between gap-2 border-t border-line-soft px-4 py-3 text-sm font-semibold text-brand-600 transition-colors hover:bg-mist-soft hover:text-brand-800"
      >
        Усі марки
        <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </nav>
  );
}
