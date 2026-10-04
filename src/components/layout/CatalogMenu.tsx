"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, ChevronRight, Menu, X } from "lucide-react";
import { CategoryIcon } from "@/components/icons";
import { ProductImage } from "@/components/product/ProductImage";
import { useEscape } from "@/lib/hooks";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/Button";
import type { NavData } from "./nav-data";
import { useOutsidePointer } from "./use-dismiss";

const HOVER_INTENT_MS = 110;

export function CatalogMenu({ data }: { data: NavData }) {
  const { groups, popularMakes } = data;
  const ids = useId();
  const panelId = `${ids}-panel`;
  const subpanelId = `${ids}-subpanel`;

  const [open, setOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState(groups[0]?.slug ?? "");

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const subpanelRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusSubs = useRef(false);

  function close() {
    setOpen(false);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }

  useOutsidePointer(open, close, [buttonRef, panelRef]);
  useEscape(open, () => {
    close();
    buttonRef.current?.focus();
  });

  // Move focus into the subpanel after a keyboard activation
  useEffect(() => {
    if (focusSubs.current) {
      focusSubs.current = false;
      subpanelRef.current?.querySelector<HTMLElement>("a")?.focus();
    }
  }, [activeSlug]);

  useEffect(() => () => void (hoverTimer.current && clearTimeout(hoverTimer.current)), []);

  const active = groups.find((g) => g.slug === activeSlug) ?? groups[0];

  function scheduleActivate(slug: string) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setActiveSlug(slug), HOVER_INTENT_MS);
  }
  function cancelActivate() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }
  function onGroupClick(slug: string, keyboard: boolean) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const already = slug === activeSlug;
    setActiveSlug(slug);
    if (keyboard) {
      if (already) subpanelRef.current?.querySelector<HTMLElement>("a")?.focus();
      else focusSubs.current = true;
    }
  }

  // Close the menu whenever a link inside the panel is activated (navigation)
  function onPanelClick(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) close();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        className={buttonClass({ className: "shrink-0" })}
      >
        {open ? <X aria-hidden className="size-[18px]" /> : <Menu aria-hidden className="size-[18px]" />}
        Каталог
      </button>

      {open &&
        createPortal(
          <div aria-hidden onClick={close} className="fixed inset-0 z-30 bg-navy-950/40 animate-fade-in" />,
          document.body,
        )}

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          onClick={onPanelClick}
          className="absolute inset-x-0 top-full z-40 mt-2 flex max-h-[72vh] flex-col overflow-hidden rounded-card border border-line-soft bg-white shadow-pop animate-fade-in"
        >
            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(232px,268px)_1fr]">
              {/* Groups */}
              <ul className="overflow-y-auto overscroll-contain border-line-soft py-2 lg:border-r">
                {groups.map((group) => {
                  const isActive = group.slug === active?.slug;
                  return (
                    <li key={group.slug}>
                      <button
                        type="button"
                        aria-expanded={isActive}
                        aria-controls={subpanelId}
                        onMouseEnter={() => scheduleActivate(group.slug)}
                        onMouseLeave={cancelActivate}
                        onFocus={() => {
                          cancelActivate();
                          setActiveSlug(group.slug);
                        }}
                        onClick={(e) => onGroupClick(group.slug, e.detail === 0)}
                        className={cn(
                          "flex w-full items-center gap-3 border-l-2 px-4 py-2.5 text-left text-[15px] transition-colors",
                          isActive
                            ? "border-brand-600 bg-brand-50 text-brand-700"
                            : "border-transparent text-ink hover:bg-mist-soft hover:text-brand-700",
                        )}
                      >
                        <CategoryIcon
                          name={group.icon}
                          className={cn("size-5 shrink-0", isActive ? "text-brand-700" : "text-brand-700")}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
                        <ChevronRight
                          aria-hidden
                          className={cn("size-4 shrink-0", isActive ? "text-brand-600" : "text-ink-3")}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Active group detail */}
              <div ref={subpanelRef} id={subpanelId} className="min-w-0 overflow-y-auto p-5 lg:p-6">
                {active && (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-ink">{active.name}</h3>
                        {active.description && (
                          <p className="mt-1 max-w-xl text-sm text-ink-3">{active.description}</p>
                        )}
                      </div>
                      <Link
                        href={`/catalog/${active.slug}`}
                        className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-800"
                      >
                        Усі товари групи
                        <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </div>

                    <div className="mt-4 flex items-start gap-6">
                      <ul className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                        {active.subs.map((sub) => (
                          <li key={sub.slug}>
                            <Link
                              href={`/catalog/${sub.slug}`}
                              className="block truncate rounded-md px-2 py-1.5 text-sm text-ink-2 transition-colors hover:bg-mist-soft hover:text-brand-700"
                            >
                              {sub.name}
                            </Link>
                          </li>
                        ))}
                      </ul>

                      <div aria-hidden className="hidden w-44 shrink-0 xl:block">
                        <ProductImage illustration={active.illustration} alt="" sizes="176px" className="rounded-card" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Popular makes */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-t border-line-soft bg-mist-soft px-5 py-3.5 lg:px-6">
              <span className="mr-1 text-sm font-semibold text-ink">Авто за маркою:</span>
              {popularMakes.map((make) => (
                <Link
                  key={make.slug}
                  href={`/avto/${make.slug}`}
                  className="rounded-full border border-line-soft bg-white px-3 py-1 text-sm text-ink-2 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
                >
                  {make.name}
                </Link>
              ))}
              <Link
                href="/avto"
                className="group inline-flex items-center gap-1 px-2 py-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-800"
              >
                Усі марки
                <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
        </div>
      )}
    </>
  );
}
