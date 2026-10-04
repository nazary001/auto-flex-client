"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface AnchorNavProps {
  sections: { id: string; label: string }[];
}

/** Sticky in-page navigation for the stacked product sections (desktop only). Highlights the section in view. */
export function AnchorNav({ sections }: AnchorNavProps) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-112px 0px -62% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Розділи товару" className="hidden self-start lg:sticky lg:top-24 lg:block">
      <ul className="grid gap-0.5 border-l border-line-soft">
        {sections.map((section) => {
          const isActive = section.id === active;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors",
                  isActive
                    ? "border-brand-600 font-semibold text-ink"
                    : "border-transparent text-ink-3 hover:border-line hover:text-ink",
                )}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
